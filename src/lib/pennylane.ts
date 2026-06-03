const BASE_URL = 'https://app.pennylane.com/api/external/v2'

// --- In-memory cache ---
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000       // 15 min (invoices, account sums)
const LEDGER_TTL_MS = 60 * 60 * 1000       // 1 h (individual ledger entries)

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) return entry.data as T
  cache.delete(key)
  return null
}

function setInCache(key: string, data: unknown, ttl = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

// --- Low-level fetch (with rate-limit retry) ---
async function plFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) throw new Error('PENNYLANE_API_KEY not configured')

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${BASE_URL}${path}${qs ? '?' + qs : ''}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after') ?? '5') * 1000
      await new Promise((r) => setTimeout(r, wait))
      return plFetch(path, params)
    }
    throw new Error(`Pennylane API error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}

// --- Customer invoice type ---
export interface Invoice {
  id: number
  date: string        // YYYY-MM-DD
  amountHT: number
  paid: boolean
  remainingHT: number
  label: string
  deadline: string
}

// --- Ledger entry line type (internal) ---
interface LedgerLine {
  debit: string
  credit: string
  ledger_account: { number: string }
}

interface LedgerEntryDetail {
  ledger_entry_lines: LedgerLine[]
}

// --- Fetch individual ledger entry (cached 1h) ---
async function fetchLedgerEntryDetail(id: number): Promise<LedgerEntryDetail> {
  const key = `le_${id}`
  const cached = getFromCache<LedgerEntryDetail>(key)
  if (cached) return cached

  const data = await plFetch<{ ledger_entry: LedgerEntryDetail }>(`/ledger_entries/${id}`)
  // Pennylane v2 wraps the entry under a key
  const entry = (data as Record<string, unknown>).ledger_entry as LedgerEntryDetail | undefined ?? data as unknown as LedgerEntryDetail
  setInCache(key, entry, LEDGER_TTL_MS)
  return entry
}

// --- Public: get all customer invoices (15 min cache) ---
export async function getAllCustomerInvoices(): Promise<Invoice[]> {
  const cacheKey = 'all_customer_invoices'
  const cached = getFromCache<Invoice[]>(cacheKey)
  if (cached) return cached

  const raw: {
    id: number
    date: string
    currency_amount_before_tax: string
    paid: boolean
    remaining_amount_without_tax: string
    label: string
    deadline: string
  }[] = []

  let cursor: string | undefined
  let pages = 0
  do {
    const params: Record<string, string> = { sort: '-date', limit: '100' }
    if (cursor) params.cursor = cursor
    const res = await plFetch<{
      items?: typeof raw
      has_more: boolean
      next_cursor?: string
    }>('/customer_invoices', params)

    const items = (res.items ?? []) as typeof raw
    raw.push(...items)
    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined
    pages++
    if (pages > 100) break
  } while (cursor)

  const invoices: Invoice[] = raw.map((r) => ({
    id: r.id,
    date: r.date,
    amountHT: parseFloat(r.currency_amount_before_tax) || 0,
    paid: r.paid === true,
    remainingHT: parseFloat(r.remaining_amount_without_tax) || 0,
    label: r.label ?? '',
    deadline: r.deadline ?? '',
  }))

  setInCache(cacheKey, invoices)
  return invoices
}

// --- Public: get expense account sums for a period ---
// Returns Map<YYYY-MM, Map<3-digit-account-prefix, total-debit>>
export async function getExpenseAccountSums(
  fromDate: string,
  toDate: string
): Promise<Map<string, Map<string, number>>> {
  const cacheKey = `expense_sums_${fromDate}_${toDate}`
  const cached = getFromCache<Map<string, Map<string, number>>>(cacheKey)
  if (cached) return cached

  // Step 1: page through ledger entries, collect IDs in range
  const entryIds: { id: number; date: string }[] = []
  let cursor: string | undefined
  let pages = 0

  do {
    const params: Record<string, string> = { sort: '-date', limit: '100' }
    if (cursor) params.cursor = cursor

    const res = await plFetch<{
      items: { id: number; date: string; label?: string; status?: string }[]
      has_more: boolean
      next_cursor?: string
    }>('/ledger_entries', params)

    let hitPastRange = false
    for (const entry of res.items ?? []) {
      if (entry.date > toDate) continue
      if (entry.date < fromDate) { hitPastRange = true; break }
      if (entry.status === 'validation_needed') continue  // not yet accounted
      entryIds.push({ id: entry.id, date: entry.date })
    }

    cursor = !hitPastRange && res.has_more && res.next_cursor ? res.next_cursor : undefined
    pages++
    if (pages > 60) break
  } while (cursor)

  // Step 2: fetch detail lines (concurrency 8, in-memory cache 1h)
  const monthly = new Map<string, Map<string, number>>()
  const CONCURRENCY = 8

  for (let i = 0; i < entryIds.length; i += CONCURRENCY) {
    const batch = entryIds.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((e) =>
        fetchLedgerEntryDetail(e.id).then((detail) => ({
          date: e.date,
          lines: detail.ledger_entry_lines ?? [],
        }))
      )
    )

    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const monthKey = r.value.date.slice(0, 7)
      if (!monthly.has(monthKey)) monthly.set(monthKey, new Map())
      const monthSums = monthly.get(monthKey)!

      for (const line of r.value.lines) {
        const debit = parseFloat(line.debit) || 0
        if (debit <= 0) continue
        const code = line.ledger_account?.number ?? ''
        if (!code.startsWith('6')) continue  // only expense accounts
        const prefix3 = code.slice(0, 3)
        monthSums.set(prefix3, (monthSums.get(prefix3) ?? 0) + debit)
      }
    }
  }

  setInCache(cacheKey, monthly)
  return monthly
}

export function clearCache() {
  cache.clear()
}

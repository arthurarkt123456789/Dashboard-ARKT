import { PLCustomerInvoice, PLSupplierInvoice } from '@/types'

const BASE_URL = 'https://app.pennylane.com/api/external/v2'

// Categories are cached indefinitely (they don't change once set in Pennylane)
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000
const CATEGORY_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour for categories

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) return entry.data as T
  cache.delete(key)
  return null
}

function setInCache(key: string, data: unknown, ttl = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

async function plFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) throw new Error('PENNYLANE_API_KEY not configured')

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${BASE_URL}${path}${qs ? '?' + qs : ''}`

  const cached = getFromCache<T>(url)
  if (cached) return cached

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '5') * 1000
      await new Promise((r) => setTimeout(r, retryAfter))
      return plFetch(path, params)
    }
    throw new Error(`Pennylane API error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  setInCache(url, data)
  return data as T
}

async function paginateAll<T>(path: string, baseParams: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = []
  let cursor: string | undefined
  do {
    const params: Record<string, string> = { ...baseParams, limit: '100' }
    if (cursor) params.cursor = cursor
    const response = await plFetch<{ items?: T[]; has_more: boolean; next_cursor?: string }>(path, params)
    const items = (response as Record<string, unknown>).items as T[] ?? []
    results.push(...items)
    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined
  } while (cursor)
  return results
}

// --- Ledger entry types ---

export interface PLLedgerLine {
  id: number
  debit: string
  credit: string
  ledger_account: { number: string }
}

export interface PLLedgerEntry {
  id: number
  ledger_entry_lines: PLLedgerLine[]
}

// Extract the expense account code (6xx debit lines, exclude 44x TVA)
export function extractAccountCode(lines: PLLedgerLine[]): string | null {
  const line = lines.find(
    (l) => parseFloat(l.debit) > 0 && l.ledger_account.number.startsWith('6')
  )
  return line?.ledger_account.number ?? null
}

async function fetchLedgerEntry(invoiceId: number): Promise<PLLedgerEntry> {
  const cacheKey = `ledger_${invoiceId}`
  const cached = getFromCache<PLLedgerEntry>(cacheKey)
  if (cached) return cached

  const entry = await plFetch<PLLedgerEntry>(`/ledger_entries/${invoiceId}`)
  setInCache(cacheKey, entry, CATEGORY_CACHE_TTL_MS)
  return entry
}

// Fetch ledger entries for all COMPLETE invoices (only those have accounting lines)
export async function fetchLedgerEntries(
  invoices: PLSupplierInvoice[]
): Promise<Map<number, string | null>> {
  const CONCURRENCY = 10  // Pennylane allows 25 req/5s — 10 parallel is safe
  const result = new Map<number, string | null>()

  // Only complete invoices have ledger lines — skip the rest (saves most API calls)
  const toFetch = invoices.filter(
    (inv) => inv.accounting_status === 'complete' && getFromCache(`ledger_${inv.id}`) === null
  )

  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((inv) =>
        fetchLedgerEntry(inv.id).then((e) => ({ id: inv.id, code: extractAccountCode(e.ledger_entry_lines) }))
      )
    )
    for (const r of results) {
      if (r.status === 'fulfilled') result.set(r.value.id, r.value.code)
    }
    // No delay needed between batches — 10 req at once is well within 25/5s limit
  }

  // Add already-cached entries
  for (const inv of invoices) {
    if (!result.has(inv.id)) {
      const cached = getFromCache<PLLedgerEntry>(`ledger_${inv.id}`)
      result.set(inv.id, cached ? extractAccountCode(cached.ledger_entry_lines) : null)
    }
  }

  return result
}

export async function fetchCustomerInvoices(fromDate: string, toDate: string): Promise<PLCustomerInvoice[]> {
  const cacheKey = 'customer_invoices_all'
  let all = getFromCache<PLCustomerInvoice[]>(cacheKey)
  if (!all) {
    all = await paginateAll<PLCustomerInvoice>('/customer_invoices', { sort: '-date' })
    setInCache(cacheKey, all)
  }
  return all.filter((inv) => inv.date >= fromDate && inv.date <= toDate)
}

export async function fetchSupplierInvoices(fromDate: string, toDate: string): Promise<PLSupplierInvoice[]> {
  const cacheKey = 'supplier_invoices_all'
  let all = getFromCache<PLSupplierInvoice[]>(cacheKey)
  if (!all) {
    all = await paginateAll<PLSupplierInvoice>('/supplier_invoices', { sort: '-date' })
    setInCache(cacheKey, all)
  }
  return all.filter((inv) => inv.date >= fromDate && inv.date <= toDate)
}

// Fetch payroll amounts from ledger entries (OD journal, labels contain salary keywords)
// Returns monthly map YYYY-MM → total gross payroll (641 + 645 debit)
export async function fetchPayrollFromLedger(
  fromDate: string,
  toDate: string
): Promise<{ monthly: Map<string, number>; total: number }> {
  const SALARY_KEYWORDS = ['salaire', 'appointement', 'paie', 'charges sociales', 'salaires']
  const payrollEntries: { id: number; date: string }[] = []

  let cursor: string | undefined
  let pages = 0
  do {
    const params: Record<string, string> = { sort: '-date', limit: '100' }
    if (cursor) params.cursor = cursor
    const res = await plFetch<{
      items: { id: number; date: string; label: string; status: string }[]
      has_more: boolean
      next_cursor?: string
    }>('/ledger_entries', params)

    let hitPastRange = false
    for (const entry of res.items ?? []) {
      if (entry.date > toDate) continue
      if (entry.date < fromDate) { hitPastRange = true; break }
      // Don't filter by status — OD payroll entries have null status
      if (entry.status === 'validation_needed') continue
      const lower = (entry.label ?? '').toLowerCase()
      if (SALARY_KEYWORDS.some((k) => lower.includes(k))) {
        payrollEntries.push({ id: entry.id, date: entry.date })
      }
    }

    cursor = !hitPastRange && res.has_more && res.next_cursor ? res.next_cursor : undefined
    pages++
    if (pages > 15) break
  } while (cursor)

  // Fetch ledger lines for each payroll entry (batched)
  const monthly = new Map<string, number>()
  let total = 0
  const CONCURRENCY = 8

  for (let i = 0; i < payrollEntries.length; i += CONCURRENCY) {
    const batch = payrollEntries.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((e) =>
        fetchLedgerEntry(e.id).then((entry) => ({
          date: e.date,
          amount: (entry.ledger_entry_lines ?? [])
            .filter(
              (l) =>
                parseFloat(l.debit) > 0 &&
                (l.ledger_account.number.startsWith('641') ||
                  l.ledger_account.number.startsWith('642') ||
                  l.ledger_account.number.startsWith('644') ||
                  l.ledger_account.number.startsWith('645') ||
                  l.ledger_account.number.startsWith('646'))
            )
            .reduce((s, l) => s + parseFloat(l.debit), 0),
        }))
      )
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.amount > 0) {
        const monthKey = r.value.date.slice(0, 7)
        monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + r.value.amount)
        total += r.value.amount
      }
    }
  }

  return { monthly, total }
}

export function clearCache() {
  cache.clear()
}

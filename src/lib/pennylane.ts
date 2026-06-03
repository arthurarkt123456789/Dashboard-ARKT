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

// --- Category types ---

export interface PLPlanItem {
  number: string  // e.g. "611", "641"
  label: string   // e.g. "Sous-traitance générale"
}

export interface PLInvoiceCategory {
  id: number
  amount: string
  plan_item: PLPlanItem
}

// Fetch categories for one invoice (cached per invoice ID)
async function fetchInvoiceCategories(invoiceId: number): Promise<PLInvoiceCategory[]> {
  const cacheKey = `cat_${invoiceId}`
  const cached = getFromCache<PLInvoiceCategory[]>(cacheKey)
  if (cached) return cached

  const res = await plFetch<{ items: PLInvoiceCategory[] }>(
    `/supplier_invoices/${invoiceId}/categories`
  )
  const items = res.items ?? []
  setInCache(cacheKey, items, CATEGORY_CACHE_TTL_MS)
  return items
}

// Fetch categories for all invoices with concurrency limit (max 8 parallel to respect rate limit)
export async function fetchAllSupplierCategories(
  invoices: PLSupplierInvoice[]
): Promise<Map<number, PLInvoiceCategory[]>> {
  const CONCURRENCY = 8
  const result = new Map<number, PLInvoiceCategory[]>()

  // Only fetch for invoices not already in cache
  const toFetch = invoices.filter((inv) => getFromCache(`cat_${inv.id}`) === null)

  // Process with concurrency limit
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((inv) => fetchInvoiceCategories(inv.id).then((cats) => ({ id: inv.id, cats })))
    )
    for (const { id, cats } of batchResults) result.set(id, cats)
    // Small delay between batches to stay within rate limits
    if (i + CONCURRENCY < toFetch.length) await new Promise((r) => setTimeout(r, 300))
  }

  // Also include already-cached ones
  for (const inv of invoices) {
    if (!result.has(inv.id)) {
      const cached = getFromCache<PLInvoiceCategory[]>(`cat_${inv.id}`)
      result.set(inv.id, cached ?? [])
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

export function clearCache() {
  cache.clear()
}

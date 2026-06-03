import { PLCustomerInvoice, PLSupplierInvoice } from '@/types'

const BASE_URL = 'https://app.pennylane.com/api/external/v2'

const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) return entry.data as T
  cache.delete(key)
  return null
}

function setInCache(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

async function plFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) throw new Error('PENNYLANE_API_KEY not configured')

  // Build query string manually to avoid URLSearchParams encoding brackets
  const qs = Object.entries({ ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${BASE_URL}${path}${qs ? '?' + qs : ''}`

  const cacheKey = url
  const cached = getFromCache<T>(cacheKey)
  if (cached) return cached

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after') ?? '5'
      await new Promise((r) => setTimeout(r, parseInt(retryAfter) * 1000))
      return plFetch(path, params)
    }
    throw new Error(`Pennylane API error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  setInCache(cacheKey, data)
  return data as T
}

async function paginateAll<T>(path: string, baseParams: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string> = { ...baseParams, limit: '100' }
    if (cursor) params.cursor = cursor

    const response = await plFetch<{
      customer_invoices?: T[]
      supplier_invoices?: T[]
      invoices?: T[]
      has_more: boolean
      next_cursor?: string
    }>(path, params)

    const items =
      (response as Record<string, unknown>).items as T[] ??
      (response as Record<string, unknown>).customer_invoices as T[] ??
      (response as Record<string, unknown>).supplier_invoices as T[] ??
      []

    results.push(...items)
    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined
  } while (cursor)

  return results
}

// Fetch all invoices then filter by date in JS — avoids API filter format issues
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

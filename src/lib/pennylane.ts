import { PLCustomerInvoice, PLSupplierInvoice } from '@/types'

const BASE_URL = 'https://app.pennylane.com/api/external/v2'

// Simple in-memory cache to stay within rate limits (25 req/5s)
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

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

  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const cacheKey = url.toString()
  const cached = getFromCache<T>(cacheKey)
  if (cached) return cached

  const res = await fetch(url.toString(), {
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

// Paginate through all results using cursor-based pagination
async function paginateAll<T>(path: string, baseParams: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string> = { ...baseParams, limit: '100' }
    if (cursor) params.cursor = cursor

    const response = await plFetch<{ invoices?: T[]; customer_invoices?: T[]; supplier_invoices?: T[]; has_more: boolean; next_cursor?: string }>(path, params)

    // Try different possible array keys
    const items = (response as Record<string, unknown>).customer_invoices as T[]
      ?? (response as Record<string, unknown>).supplier_invoices as T[]
      ?? (response as Record<string, unknown>).invoices as T[]
      ?? []

    results.push(...items)

    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined
  } while (cursor)

  return results
}

export async function fetchCustomerInvoices(fromDate: string, toDate: string): Promise<PLCustomerInvoice[]> {
  const cacheKey = `customer_invoices_${fromDate}_${toDate}`
  const cached = getFromCache<PLCustomerInvoice[]>(cacheKey)
  if (cached) return cached

  const invoices = await paginateAll<PLCustomerInvoice>('/customer_invoices', {
    'filter[date][gteq]': fromDate,
    'filter[date][lteq]': toDate,
    sort: 'date',
  })

  setInCache(cacheKey, invoices)
  return invoices
}

export async function fetchSupplierInvoices(fromDate: string, toDate: string): Promise<PLSupplierInvoice[]> {
  const cacheKey = `supplier_invoices_${fromDate}_${toDate}`
  const cached = getFromCache<PLSupplierInvoice[]>(cacheKey)
  if (cached) return cached

  const invoices = await paginateAll<PLSupplierInvoice>('/supplier_invoices', {
    'filter[date][gteq]': fromDate,
    'filter[date][lteq]': toDate,
    sort: 'date',
  })

  setInCache(cacheKey, invoices)
  return invoices
}

export function clearCache() {
  cache.clear()
}

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

async function plGet(url: string, apiKey: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  return r.json()
}

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  // 1. Count total customer invoices across all pages
  let totalInvoices = 0
  let cursor: string | undefined
  let pages = 0
  do {
    const url = `https://app.pennylane.com/api/external/v2/customer_invoices?limit=100${cursor ? `&cursor=${cursor}` : ''}&sort=-date`
    const data = await plGet(url, apiKey)
    totalInvoices += data?.items?.length ?? 0
    pages++
    cursor = data?.has_more && data?.next_cursor ? data.next_cursor : undefined
    if (pages > 20) break // safety
  } while (cursor)

  // 2. Look for payroll (641/645) in ledger_entries — paginate until we find some
  let payrollFound: { label: string; date: string; id: number }[] = []
  let leCursor: string | undefined
  let lePages = 0
  do {
    const url = `https://app.pennylane.com/api/external/v2/ledger_entries?limit=100${leCursor ? `&cursor=${leCursor}` : ''}&sort=-date`
    const data = await plGet(url, apiKey)
    const items = data?.items ?? []
    for (const entry of items) {
      if ((entry.label ?? '').toLowerCase().includes('salaire') ||
          (entry.label ?? '').toLowerCase().includes('paie') ||
          (entry.label ?? '').toLowerCase().includes('payr')) {
        payrollFound.push({ label: entry.label, date: entry.date, id: entry.id })
      }
    }
    leCursor = data?.has_more && data?.next_cursor ? data.next_cursor : undefined
    lePages++
    if (lePages > 5 || payrollFound.length > 3) break
  } while (leCursor)

  // 3. Also fetch ledger_entry_lines for first payroll entry found
  let payrollLines = null
  if (payrollFound[0]) {
    const d = await plGet(`https://app.pennylane.com/api/external/v2/ledger_entries/${payrollFound[0].id}`, apiKey)
    payrollLines = d?.ledger_entry_lines
  }

  return NextResponse.json({
    ok: true,
    customer_invoices: { total_fetched: totalInvoices, pages_fetched: pages },
    payroll_entries_found: payrollFound,
    payroll_ledger_lines: payrollLines,
  })
}

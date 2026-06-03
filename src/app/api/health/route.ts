export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const headers = { Authorization: `Bearer ${apiKey}` }

  // Check N-1: what's the oldest invoice we have?
  const [firstPage, lastPage] = await Promise.all([
    fetch('https://app.pennylane.com/api/external/v2/customer_invoices?limit=5&sort=-date', { headers }).then(r => r.json()),
    fetch('https://app.pennylane.com/api/external/v2/customer_invoices?limit=5&sort=date', { headers }).then(r => r.json()),
  ])

  const newest = firstPage?.items?.[0]?.date
  const oldest = lastPage?.items?.[0]?.date
  const totalPages = firstPage?.has_more

  // Check payroll: try to find 641/645 ledger entries via a supplier invoice with payroll codes
  // Also try GET /ledger_entries to see if it lists entries
  const ledgerListRes = await fetch(
    'https://app.pennylane.com/api/external/v2/ledger_entries?limit=3',
    { headers }
  ).then(r => r.json()).catch(() => null)

  return NextResponse.json({
    ok: true,
    invoice_date_range: { newest, oldest, has_more_pages: totalPages },
    total_customer_invoices_first5: firstPage?.items?.map((i: { date: string; invoice_number: string }) => ({ date: i.date, ref: i.invoice_number })),
    ledger_entries_list_test: ledgerListRes,
  })
}

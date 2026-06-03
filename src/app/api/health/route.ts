export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const h = { Authorization: `Bearer ${apiKey}` }
  const get = (url: string) => fetch(url, { headers: h }).then(r => r.json())

  // Check "Salaires, appointements" ledger entry lines (id from previous debug)
  const salaireEntry = await get('https://app.pennylane.com/api/external/v2/ledger_entries/21526998560768')

  // Check prevYear invoices: how many from Oct 2024 - Sep 2025?
  // We fetch from the cache indirectly by checking a direct filter via sort=date
  const prevYearSample = await get(
    'https://app.pennylane.com/api/external/v2/customer_invoices?limit=5&sort=date'
  )

  return NextResponse.json({
    ok: true,
    salaire_entry_status: salaireEntry?.status,
    salaire_ledger_lines: salaireEntry?.ledger_entry_lines,
    oldest_invoices: prevYearSample?.items?.map((i: {date: string; invoice_number: string; currency_amount_before_tax: string}) => ({
      date: i.date,
      ref: i.invoice_number,
      amount_ht: i.currency_amount_before_tax
    })),
  })
}

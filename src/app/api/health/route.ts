export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const headers = { Authorization: `Bearer ${apiKey}` }

  // Fetch enough to find a complete invoice
  const res = await fetch('https://app.pennylane.com/api/external/v2/supplier_invoices?limit=100', { headers })
  const data = await res.json()
  const items: { id: number; label: string; accounting_status: string }[] = data?.items ?? []

  const complete = items.find(i => i.accounting_status === 'complete')
  if (!complete) {
    return NextResponse.json({ ok: true, error: 'No complete invoice found in first 100', statuses: items.map(i => i.accounting_status) })
  }

  const ledger = await fetch(
    `https://app.pennylane.com/api/external/v2/ledger_entries/${complete.id}`,
    { headers }
  ).then(r => r.json())

  return NextResponse.json({
    ok: true,
    invoice: { id: complete.id, label: complete.label, accounting_status: complete.accounting_status },
    ledger_entry_lines: ledger.ledger_entry_lines,
    all_keys: Object.keys(ledger),
  })
}

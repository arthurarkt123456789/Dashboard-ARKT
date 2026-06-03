export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const headers = { Authorization: `Bearer ${apiKey}` }

  // Get a few supplier invoices
  const res = await fetch('https://app.pennylane.com/api/external/v2/supplier_invoices?limit=5', { headers })
  const data = await res.json()
  const items = data?.items ?? []

  // Try fetching ledger entry for the first invoice (id is the same)
  const first = items[0]
  const complete = items.find((i: { accounting_status: string }) => i.accounting_status === 'complete') ?? first

  const results = await Promise.all([
    // Test 1: GET /ledger_entries/{id}
    fetch(`https://app.pennylane.com/api/external/v2/ledger_entries/${complete.id}`, { headers })
      .then(r => r.json()).catch(e => ({ error: String(e) })),

    // Test 2: GET /supplier_invoices/{id}/ledger_entries (maybe sub-resource?)
    fetch(`https://app.pennylane.com/api/external/v2/supplier_invoices/${complete.id}/ledger_entries`, { headers })
      .then(r => r.json()).catch(e => ({ error: String(e) })),

    // Test 3: GET /ledger_entries?filter[invoice_id]=...
    fetch(`https://app.pennylane.com/api/external/v2/ledger_entries?filter[source_id]=${complete.id}`, { headers })
      .then(r => r.json()).catch(e => ({ error: String(e) })),
  ])

  return NextResponse.json({
    ok: true,
    invoice: { id: complete.id, label: complete.label, accounting_status: complete.accounting_status, ledger_entry: complete.ledger_entry },
    test1_ledger_entry_direct: results[0],
    test2_sub_resource: results[1],
    test3_filter: results[2],
  })
}

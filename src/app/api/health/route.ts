export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const headers = { Authorization: `Bearer ${apiKey}` }

  const res = await fetch('https://app.pennylane.com/api/external/v2/supplier_invoices?limit=50', { headers })
  const data = await res.json()
  const items = data?.items ?? []

  const statusCounts: Record<string, number> = {}
  for (const inv of items) {
    statusCounts[inv.accounting_status] = (statusCounts[inv.accounting_status] ?? 0) + 1
  }

  // Find first COMPLETE invoice (fully accounted)
  const complete = items.find((inv: { accounting_status: string }) => inv.accounting_status === 'complete')
  let completeCats = null
  if (complete) {
    const r = await fetch(
      `https://app.pennylane.com/api/external/v2/supplier_invoices/${complete.id}/categories`,
      { headers }
    )
    completeCats = await r.json()
  }

  return NextResponse.json({
    ok: true,
    accounting_status_breakdown: statusCounts,
    complete_invoice: complete ? { id: complete.id, label: complete.label } : null,
    complete_categories: completeCats,
  })
}

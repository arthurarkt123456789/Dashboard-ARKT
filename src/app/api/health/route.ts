export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const headers = { Authorization: `Bearer ${apiKey}` }

  // Fetch first 50 supplier invoices and check their accounting_status
  const res = await fetch(
    'https://app.pennylane.com/api/external/v2/supplier_invoices?limit=50',
    { headers }
  )
  const data = await res.json()
  const items = data?.items ?? []

  const statusCounts: Record<string, number> = {}
  for (const inv of items) {
    statusCounts[inv.accounting_status] = (statusCounts[inv.accounting_status] ?? 0) + 1
  }

  // Find first validated invoice and fetch its categories
  const validated = items.find((inv: { accounting_status: string }) => inv.accounting_status !== 'validation_needed')
  let validatedCats = null
  if (validated) {
    const r = await fetch(
      `https://app.pennylane.com/api/external/v2/supplier_invoices/${validated.id}/categories`,
      { headers }
    )
    validatedCats = await r.json()
  }

  return NextResponse.json({
    ok: true,
    total_fetched: items.length,
    accounting_status_breakdown: statusCounts,
    first_validated_invoice: validated ? { id: validated.id, label: validated.label, accounting_status: validated.accounting_status } : null,
    first_validated_categories: validatedCats,
  })
}

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PENNYLANE_API_KEY not set' }, { status: 500 })

  const headers = { Authorization: `Bearer ${apiKey}` }

  const [suppRes, catRes] = await Promise.all([
    fetch('https://app.pennylane.com/api/external/v2/supplier_invoices?limit=3', { headers }),
    fetch('https://app.pennylane.com/api/external/v2/plan_item_categories?limit=50', { headers }),
  ])

  const [supp, cats] = await Promise.all([suppRes.json(), catRes.json()])

  // Also fetch categories of first supplier invoice if it exists
  let invoiceCategories = null
  const firstId = supp?.items?.[0]?.id
  if (firstId) {
    const catInvRes = await fetch(
      `https://app.pennylane.com/api/external/v2/supplier_invoices/${firstId}/categories`,
      { headers }
    )
    invoiceCategories = await catInvRes.json()
  }

  return NextResponse.json({
    supplier_invoice_sample: supp?.items?.[0],
    supplier_invoice_keys: supp?.items?.[0] ? Object.keys(supp.items[0]) : [],
    invoice_categories: invoiceCategories,
    plan_item_categories_status: catRes.status,
    plan_item_categories: cats,
  })
}

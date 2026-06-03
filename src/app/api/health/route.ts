export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const headers = { Authorization: `Bearer ${apiKey}` }

  // Test 1: supplier invoices with include[]=categories
  const r1 = await fetch(
    'https://app.pennylane.com/api/external/v2/supplier_invoices?limit=1&include[]=categories',
    { headers }
  )
  const d1 = await r1.json()

  // Test 2: categories of first invoice
  const firstId = d1?.items?.[0]?.id
  let cats = null
  if (firstId) {
    const r2 = await fetch(
      `https://app.pennylane.com/api/external/v2/supplier_invoices/${firstId}/categories`,
      { headers }
    )
    cats = await r2.json()
  }

  return NextResponse.json({
    ok: true,
    include_test: d1?.items?.[0]?.categories,
    categories_endpoint: cats,
  })
}

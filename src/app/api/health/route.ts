export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  const res = await fetch(
    'https://app.pennylane.com/api/external/v2/supplier_invoices?limit=3',
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  const data = await res.json()
  const sample = data?.items?.[0]

  return NextResponse.json({
    ok: true,
    supplier_keys: sample ? Object.keys(sample) : [],
    supplier_sample: sample ?? null,
  })
}

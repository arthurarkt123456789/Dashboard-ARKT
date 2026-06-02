export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PENNYLANE_API_KEY not set' }, { status: 500 })

  const res = await fetch('https://app.pennylane.com/api/external/v2/customer_invoices?limit=2', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  const raw = await res.json()
  return NextResponse.json({ status: res.status, keys: Object.keys(raw), sample: raw })
}

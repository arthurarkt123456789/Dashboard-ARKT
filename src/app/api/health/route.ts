export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchPayrollFromLedger } from '@/lib/pennylane'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  // Test payroll extraction for current FY (Oct 2025 - today)
  const payroll = await fetchPayrollFromLedger('2025-10-01', '2026-09-30').catch((e) => ({ monthly: new Map(), total: 0, error: String(e) }))

  const monthlyObj: Record<string, number> = {}
  Array.from(payroll.monthly.entries()).forEach(([k, v]) => { monthlyObj[k] = v })

  return NextResponse.json({
    ok: true,
    payroll_total: payroll.total,
    payroll_monthly: monthlyObj,
    payroll_entries_count: payroll.monthly.size,
  })
}

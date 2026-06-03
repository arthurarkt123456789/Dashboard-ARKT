export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchPayrollFromLedger } from '@/lib/pennylane'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true, error: 'no api key' })

  // Test payroll for both current and N-1 fiscal years
  const [current, prevYear] = await Promise.all([
    fetchPayrollFromLedger('2025-10-01', '2026-09-30').catch(() => ({ monthly: new Map(), total: 0 })),
    fetchPayrollFromLedger('2024-10-01', '2025-09-30').catch(() => ({ monthly: new Map(), total: 0 })),
  ])

  const currentMonthly: Record<string, number> = {}
  Array.from(current.monthly.entries()).forEach(([k, v]) => { currentMonthly[k] = Math.round(v) })

  const prevMonthly: Record<string, number> = {}
  Array.from(prevYear.monthly.entries()).forEach(([k, v]) => { prevMonthly[k] = Math.round(v) })

  return NextResponse.json({
    ok: true,
    current_year: { total: Math.round(current.total), monthly: currentMonthly, months_found: current.monthly.size },
    prev_year: { total: Math.round(prevYear.total), monthly: prevMonthly, months_found: prevYear.monthly.size },
  })
}

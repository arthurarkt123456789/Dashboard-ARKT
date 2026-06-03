export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchPnLAccountSums, sumAccountPrefixes } from '@/lib/pennylane'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true, error: 'no api key' })

  // Fetch exact P&L account sums for N-1 (Oct 2024 - Sep 2025)
  const prevSums = await fetchPnLAccountSums('2024-10-01', '2025-09-30').catch(() => new Map())

  // Aggregate all prefixes and their totals
  const totalByPrefix: Record<string, number> = {}
  for (const monthMap of Array.from((prevSums as Map<string, Map<string, number>>).values())) {
    for (const [prefix, amount] of Array.from(monthMap.entries())) {
      totalByPrefix[prefix] = (totalByPrefix[prefix] ?? 0) + amount
    }
  }

  const cogsPrefixes = ['60', '601', '604', '607', '611', '612', '621']
  const payrollPrefixes = ['641', '642', '644', '645', '646', '647', '648']

  const totalCOGS = sumAccountPrefixes(prevSums, cogsPrefixes)
  const totalPayroll = sumAccountPrefixes(prevSums, payrollPrefixes)

  const externalPfx = Object.keys(totalByPrefix).filter(
    (p) => !cogsPrefixes.some((c) => p.startsWith(c) || c.startsWith(p)) &&
           !payrollPrefixes.some((c) => p.startsWith(c) || c.startsWith(p))
  )
  const totalExternal = sumAccountPrefixes(prevSums, externalPfx)

  return NextResponse.json({
    ok: true,
    n1_pnl: {
      total_by_prefix: Object.fromEntries(
        Object.entries(totalByPrefix)
          .sort(([, a], [, b]) => b - a)
          .map(([k, v]) => [k, Math.round(v)])
      ),
      cogs_total: Math.round(totalCOGS),
      payroll_total: Math.round(totalPayroll),
      external_total: Math.round(totalExternal),
      months_scanned: prevSums.size,
    },
  })
}

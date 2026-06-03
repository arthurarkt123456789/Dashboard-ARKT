export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getExpenseAccountSums } from '@/lib/pennylane'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true, error: 'no api key' })

  const prevSums = await getExpenseAccountSums('2024-10-01', '2025-09-30').catch(
    () => new Map<string, Map<string, number>>()
  )

  const totalByPrefix: Record<string, number> = {}
  for (const monthMap of Array.from(prevSums.values())) {
    for (const [prefix, amount] of Array.from(monthMap.entries())) {
      totalByPrefix[prefix] = (totalByPrefix[prefix] ?? 0) + amount
    }
  }

  const cogsPrefixes = ['60', '601', '604', '607', '611', '612', '621']
  const payrollPrefixes = ['641', '642', '644', '645', '646', '647', '648']

  function sumPfx(prefixes: string[]): number {
    let total = 0
    for (const [prefix, amount] of Object.entries(totalByPrefix)) {
      if (prefixes.some((p) => prefix.startsWith(p) || p.startsWith(prefix))) {
        total += amount
      }
    }
    return total
  }

  const externalPfx = Object.keys(totalByPrefix).filter(
    (p) =>
      !cogsPrefixes.some((c) => p.startsWith(c) || c.startsWith(p)) &&
      !payrollPrefixes.some((c) => p.startsWith(c) || c.startsWith(p))
  )

  return NextResponse.json({
    ok: true,
    n1_pnl: {
      total_by_prefix: Object.fromEntries(
        Object.entries(totalByPrefix)
          .sort(([, a], [, b]) => b - a)
          .map(([k, v]) => [k, Math.round(v)])
      ),
      cogs_total: Math.round(sumPfx(cogsPrefixes)),
      payroll_total: Math.round(sumPfx(payrollPrefixes)),
      external_total: Math.round(sumPfx(externalPfx)),
      months_scanned: prevSums.size,
    },
  })
}

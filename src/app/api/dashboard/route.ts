export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAllCustomerInvoices, getExpenseAccountSums } from '@/lib/pennylane'
import { computePnL, computeMonthly, getFiscalYear, getPrevFiscalYear } from '@/lib/pnl'
import { getSettings } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const now = new Date()
    const fy = getFiscalYear(now)
    const prev = getPrevFiscalYear(now)

    const fyStart = format(fy.start, 'yyyy-MM-dd')
    const fyNow = format(now, 'yyyy-MM-dd')
    const prevStart = format(prev.start, 'yyyy-MM-dd')
    const prevEnd = format(prev.end, 'yyyy-MM-dd')

    const [allInvoices, settings, rawPipeline] = await Promise.all([
      getAllCustomerInvoices(),
      getSettings().catch(() => ({ payrollMonthly: 0, currentBankBalance: 0, bartPucciNames: [], cogsAccountPrefixes: ['60','607','611','621'], payrollAccountPrefixes: ['641','645'] })),
      prisma.pipelineEntry.findMany({ orderBy: { expectedDate: 'asc' } }).catch(() => []),
    ])

    const currentInvoices = allInvoices.filter((inv) => inv.date >= fyStart && inv.date <= fyNow)
    const prevInvoices = allInvoices.filter((inv) => inv.date >= prevStart && inv.date <= prevEnd)

    // Fetch expense account sums — these are the slow calls, run in parallel
    const [currentSums, prevSums] = await Promise.all([
      getExpenseAccountSums(fyStart, fyNow).catch(() => new Map<string, Map<string, number>>()),
      getExpenseAccountSums(prevStart, prevEnd).catch(() => new Map<string, Map<string, number>>()),
    ])

    const currentPnL = computePnL(currentInvoices, currentSums, 0, fyStart, fyNow)
    const prevPnL = computePnL(prevInvoices, prevSums, 0, prevStart, prevEnd)
    const prevFullPnL = computePnL(prevInvoices, prevSums, 0, prevStart, prevEnd)

    const monthly = computeMonthly(allInvoices, currentSums, new Map(), fy.start)
    const prevMonthly = computeMonthly(allInvoices, prevSums, new Map(), prev.start)

    const pipeline = rawPipeline.map((p) => ({
      id: p.id,
      clientName: p.clientName,
      description: p.description,
      amount: p.amount,
      expectedDate: p.expectedDate ? p.expectedDate.toISOString().slice(0, 10) : null,
      isRecurring: p.isRecurring,
      frequency: p.frequency,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

    const pipelineTotal = pipeline
      .filter((p) => !p.expectedDate || new Date(p.expectedDate) >= now)
      .reduce((s, p) => s + p.amount, 0)

    return NextResponse.json({
      current: currentPnL,
      prevYtd: prevPnL,
      prevFull: prevFullPnL,
      monthly,
      prevMonthly,
      runRate: {
        ytd: currentPnL.revenue,
        unpaid: currentPnL.invoicedUnpaid,
        pipeline: pipelineTotal,
        total: currentPnL.revenue + currentPnL.invoicedUnpaid + pipelineTotal,
        prevFullRevenue: prevFullPnL.revenue,
      },
      pipeline,
      settings,
    })
  } catch (err) {
    console.error('[dashboard] Error:', err)
    return NextResponse.json(
      { error: String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500 }
    )
  }
}

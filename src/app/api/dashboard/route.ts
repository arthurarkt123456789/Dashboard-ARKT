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

  const now = new Date()
  const fy = getFiscalYear(now)
  const prev = getPrevFiscalYear(now)

  const fyStart = format(fy.start, 'yyyy-MM-dd')
  const fyNow = format(now, 'yyyy-MM-dd')
  const prevStart = format(prev.start, 'yyyy-MM-dd')
  const prevEnd = format(prev.end, 'yyyy-MM-dd')

  const [allInvoices, settings, rawPipeline] = await Promise.all([
    getAllCustomerInvoices(),
    getSettings(),
    prisma.pipelineEntry.findMany({ orderBy: { expectedDate: 'asc' } }),
  ])

  const currentInvoices = allInvoices.filter((inv) => inv.date >= fyStart && inv.date <= fyNow)
  const prevInvoices = allInvoices.filter((inv) => inv.date >= prevStart && inv.date <= prevEnd)

  const [currentSums, prevSums] = await Promise.all([
    getExpenseAccountSums(fyStart, fyNow),
    getExpenseAccountSums(prevStart, prevEnd),
  ])

  // P&L computations
  const currentPnL = computePnL(currentInvoices, currentSums, 0, fyStart, fyNow)
  const prevPnL = computePnL(prevInvoices, prevSums, 0, prevStart, prevEnd)
  const prevFullPnL = computePnL(prevInvoices, prevSums, 0, prevStart, prevEnd)

  // Monthly for chart (current FY only)
  const monthly = computeMonthly(allInvoices, currentSums, new Map(), fy.start)
  const prevMonthly = computeMonthly(allInvoices, prevSums, new Map(), prev.start)

  // Pipeline
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

  // Run-rate
  const pipelineTotal = pipeline
    .filter((p) => !p.expectedDate || new Date(p.expectedDate) >= now)
    .reduce((s, p) => s + p.amount, 0)

  const runRate = {
    ytd: currentPnL.revenue,
    unpaid: currentPnL.invoicedUnpaid,
    pipeline: pipelineTotal,
    total: currentPnL.revenue + currentPnL.invoicedUnpaid + pipelineTotal,
    prevFullRevenue: prevFullPnL.revenue,
  }

  return NextResponse.json({
    current: currentPnL,
    prevYtd: prevPnL,
    prevFull: prevFullPnL,
    monthly,
    prevMonthly,
    runRate,
    pipeline,
    settings,
  })
}

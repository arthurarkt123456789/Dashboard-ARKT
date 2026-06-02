export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { fetchCustomerInvoices, fetchSupplierInvoices } from '@/lib/pennylane'
import { getSettings } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import {
  computeMonthlyRevenue,
  computeFiscalSummary,
  computeRunRate,
  computeExpenseSummary,
  computeCashFlow,
  computeHealthStatus,
  detectDuplicates,
  getFiscalYear,
  getPrevFiscalYear,
} from '@/lib/calculations'
import { format, addMonths } from 'date-fns'
import { PipelineEntry } from '@/types'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const now = new Date()
  const fy = getFiscalYear(now)
  const prev = getPrevFiscalYear(now)
  // Include a couple extra months before prev FY for recurring detection
  const fetchFrom = format(addMonths(prev.start, -2), 'yyyy-MM-dd')
  const fetchTo = format(fy.end, 'yyyy-MM-dd')

  const [currentInvoices, currentExpenses, prevInvoices, prevExpenses, settings, rawPipeline] =
    await Promise.all([
      fetchCustomerInvoices(format(fy.start, 'yyyy-MM-dd'), fetchTo),
      fetchSupplierInvoices(format(fy.start, 'yyyy-MM-dd'), fetchTo),
      fetchCustomerInvoices(format(prev.start, 'yyyy-MM-dd'), format(prev.end, 'yyyy-MM-dd')),
      fetchSupplierInvoices(format(prev.start, 'yyyy-MM-dd'), format(prev.end, 'yyyy-MM-dd')),
      getSettings(),
      prisma.pipelineEntry.findMany({ orderBy: { expectedDate: 'asc' } }),
    ])

  // Detect duplicates in pipeline
  const recentInvoices = currentInvoices.filter((inv) => {
    const d = new Date(inv.issue_date)
    return d >= addMonths(now, -3)
  })
  const dupIds = detectDuplicates(
    rawPipeline.map((p) => ({
      id: p.id,
      clientName: p.clientName,
      amount: p.amount,
      expectedDate: p.expectedDate ? format(p.expectedDate, 'yyyy-MM-dd') : null,
    })),
    recentInvoices
  )

  const pipeline: PipelineEntry[] = rawPipeline.map((p) => ({
    id: p.id,
    clientName: p.clientName,
    description: p.description,
    amount: p.amount,
    expectedDate: p.expectedDate ? format(p.expectedDate, 'yyyy-MM-dd') : null,
    isRecurring: p.isRecurring,
    frequency: p.frequency,
    isDuplicate: dupIds.has(p.id),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  const monthly = computeMonthlyRevenue(currentInvoices, prevInvoices, currentExpenses, prevExpenses, settings, now)
  const fiscal = computeFiscalSummary(monthly, now)
  const runRate = computeRunRate(currentInvoices, pipeline, settings, now)
  const expenses = computeExpenseSummary(currentExpenses, settings, now)
  const cashFlow = computeCashFlow(currentInvoices, currentExpenses, pipeline, settings, now)
  const health = computeHealthStatus(fiscal, runRate, cashFlow)

  // Unpaid invoices sorted by deadline
  const unpaidInvoices = currentInvoices
    .filter((inv) => !inv.is_paid && inv.outstanding_balance > 0)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  // Compute proper prevYearTotal for run-rate
  const prevYearTotal = prevInvoices.reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0)
  runRate.prevYearTotal = prevYearTotal
  runRate.variance = runRate.total - prevYearTotal
  runRate.variancePct = prevYearTotal > 0 ? ((runRate.total - prevYearTotal) / prevYearTotal) * 100 : 0

  return NextResponse.json({
    monthly,
    fiscal,
    runRate,
    expenses,
    cashFlow,
    health,
    unpaidInvoices,
    pipeline,
    settings,
  })
}

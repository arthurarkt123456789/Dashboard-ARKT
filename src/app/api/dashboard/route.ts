export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { fetchCustomerInvoices, fetchSupplierInvoices, fetchAllSupplierCategories } from '@/lib/pennylane'
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
import { PipelineEntry, PLCustomerInvoice, PLSupplierInvoice, DEFAULT_SETTINGS, extractClientName } from '@/types'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const now = new Date()
  const fy = getFiscalYear(now)
  const prev = getPrevFiscalYear(now)
  const fetchFrom = format(addMonths(prev.start, -2), 'yyyy-MM-dd')
  const fetchTo = format(fy.end, 'yyyy-MM-dd')

  const hasPennylane = !!process.env.PENNYLANE_API_KEY

  // Fetch data — fall back to empty arrays if Pennylane key not configured
  let currentInvoices: PLCustomerInvoice[] = []
  let currentExpenses: PLSupplierInvoice[] = []
  let prevInvoices: PLCustomerInvoice[] = []
  let prevExpenses: PLSupplierInvoice[] = []
  let pennylaneError: string | null = null

  if (hasPennylane) {
    try {
      ;[currentInvoices, currentExpenses, prevInvoices, prevExpenses] = await Promise.all([
        fetchCustomerInvoices(format(fy.start, 'yyyy-MM-dd'), fetchTo),
        fetchSupplierInvoices(format(fy.start, 'yyyy-MM-dd'), fetchTo),
        fetchCustomerInvoices(format(prev.start, 'yyyy-MM-dd'), format(prev.end, 'yyyy-MM-dd')),
        fetchSupplierInvoices(format(prev.start, 'yyyy-MM-dd'), format(prev.end, 'yyyy-MM-dd')),
      ])
    } catch (e) {
      pennylaneError = e instanceof Error ? e.message : 'Erreur Pennylane'
    }
  } else {
    pennylaneError = 'Clé API Pennylane non configurée — ajoutez PENNYLANE_API_KEY dans les variables Railway.'
  }

  const [settings, rawPipeline] = await Promise.all([
    getSettings().catch(() => DEFAULT_SETTINGS),
    prisma.pipelineEntry.findMany({ orderBy: { expectedDate: 'asc' } }).catch(() => []),
  ])

  const recentInvoices = currentInvoices.filter((inv) => new Date(inv.date) >= addMonths(now, -3))
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

  // Fetch Pennylane accounting categories for all supplier invoices
  const allExpenses = [...currentExpenses, ...prevExpenses]
  const categoryMap = await fetchAllSupplierCategories(allExpenses).catch(() => new Map())

  const monthly = computeMonthlyRevenue(currentInvoices, prevInvoices, currentExpenses, prevExpenses, settings, now, categoryMap)
  const invoicedUnpaid = currentInvoices
    .filter((inv) => !inv.paid && parseFloat(inv.remaining_amount_without_tax) > 0)
    .reduce((s, inv) => s + (parseFloat(inv.remaining_amount_without_tax) || 0), 0)
  const fiscal = computeFiscalSummary(monthly, now, invoicedUnpaid)
  const runRate = computeRunRate(currentInvoices, pipeline, settings, now)
  const expenses = computeExpenseSummary(currentExpenses, settings, now, categoryMap)
  const cashFlow = computeCashFlow(currentInvoices, currentExpenses, pipeline, settings, now, categoryMap)
  const health = computeHealthStatus(fiscal, runRate, cashFlow)

  const unpaidInvoices = currentInvoices
    .filter((inv) => !inv.paid && parseFloat(inv.remaining_amount_without_tax) > 0)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  const prevYearTotal = prevInvoices.reduce((s, inv) => s + (parseFloat(inv.currency_amount_before_tax) || 0), 0)
  runRate.prevYearTotal = prevYearTotal
  runRate.variance = runRate.total - prevYearTotal
  runRate.variancePct = prevYearTotal > 0 ? ((runRate.total - prevYearTotal) / prevYearTotal) * 100 : 0

  // Coverage stats: how many invoices have Pennylane accounting categories
  const ht = (e: PLSupplierInvoice) => parseFloat(e.currency_amount_before_tax) || 0
  const categorized = currentExpenses.filter((e) => (categoryMap.get(e.id) ?? []).length > 0).length
  const expenseCoverage = {
    total: currentExpenses.length,
    categorized,
    totalAmount: currentExpenses.reduce((s, e) => s + ht(e), 0),
    categorizedAmount: currentExpenses
      .filter((e) => (categoryMap.get(e.id) ?? []).length > 0)
      .reduce((s, e) => s + ht(e), 0),
  }

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
    expenseCoverage,
    pennylaneError,
  })
}

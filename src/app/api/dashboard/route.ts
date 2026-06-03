export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { fetchCustomerInvoices, fetchSupplierInvoices, fetchLedgerEntries, fetchPayrollFromLedger } from '@/lib/pennylane'
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
  classifyByAccountCode,
} from '@/lib/calculations'
import { format, addMonths } from 'date-fns'
import { PipelineEntry, PipelineGrid, PLCustomerInvoice, PLSupplierInvoice, DEFAULT_SETTINGS, extractClientName } from '@/types'

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

  const [settings, rawPipeline, rawPipelineGrid] = await Promise.all([
    getSettings().catch(() => DEFAULT_SETTINGS),
    prisma.pipelineEntry.findMany({ orderBy: { expectedDate: 'asc' } }).catch(() => []),
    prisma.pipelineMonthEntry.findMany().catch(() => []),
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

  // Build pipelineGrid
  const gridClientSet = new Set(rawPipelineGrid.map((e) => e.clientName))
  const gridClients = Array.from(gridClientSet).sort()
  const pipelineGrid: PipelineGrid = {
    clients: gridClients,
    months: [], // filled on client side from fiscal year
    entries: rawPipelineGrid.map((e) => ({ clientName: e.clientName, month: e.month, amount: e.amount })),
  }

  const fyStart = format(getFiscalYear(now).start, 'yyyy-MM-dd')
  const fyNow = format(now, 'yyyy-MM-dd')
  const prevFyStart = format(prev.start, 'yyyy-MM-dd')
  const prevFyEnd = format(prev.end, 'yyyy-MM-dd')

  // Ledger entries: DB-cached (fast after first load), then payroll sequentially to avoid rate limits
  const allExpenses = [...currentExpenses, ...prevExpenses]
  const categoryMap = await fetchLedgerEntries(allExpenses).catch(() => new Map<number, string | null>())

  // Split into current and prev category maps
  const currentExpenseIds = new Set(currentExpenses.map((e) => e.id))
  const prevCategoryMap = new Map<number, string | null>()
  const currentCategoryMap = new Map<number, string | null>()
  for (const [id, code] of Array.from(categoryMap.entries())) {
    if (currentExpenseIds.has(id)) currentCategoryMap.set(id, code)
    else prevCategoryMap.set(id, code)
  }

  // Fetch payroll sequentially (not parallel) to avoid rate limits
  const payrollLedger = await fetchPayrollFromLedger(fyStart, fyNow)
    .catch(() => ({ monthly: new Map<string, number>(), total: 0 }))
  const prevPayrollLedger = await fetchPayrollFromLedger(prevFyStart, prevFyEnd)
    .catch(() => ({ monthly: new Map<string, number>(), total: 0 }))

  const monthly = computeMonthlyRevenue(
    currentInvoices, prevInvoices, currentExpenses, prevExpenses,
    settings, now, currentCategoryMap, prevCategoryMap,
    payrollLedger.monthly, prevPayrollLedger.monthly
  )

  const invoicedUnpaid = currentInvoices
    .filter((inv) => !inv.paid && parseFloat(inv.remaining_amount_without_tax) > 0)
    .reduce((s, inv) => s + (parseFloat(inv.remaining_amount_without_tax) || 0), 0)

  const fiscal = computeFiscalSummary(monthly, now, invoicedUnpaid, prevInvoices, prevExpenses, settings, prevCategoryMap)
  const runRate = computeRunRate(currentInvoices, pipeline, settings, now)

  const expenses = computeExpenseSummary(currentExpenses, settings, now, currentCategoryMap, payrollLedger)
  const cashFlow = computeCashFlow(currentInvoices, currentExpenses, pipeline, settings, now, currentCategoryMap)
  const health = computeHealthStatus(fiscal, runRate, cashFlow)

  const unpaidInvoices = currentInvoices
    .filter((inv) => !inv.paid && parseFloat(inv.remaining_amount_without_tax) > 0)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  const prevYearTotal = prevInvoices.reduce((s, inv) => s + (parseFloat(inv.currency_amount_before_tax) || 0), 0)
  runRate.prevYearTotal = prevYearTotal
  runRate.variance = runRate.total - prevYearTotal
  runRate.variancePct = prevYearTotal > 0 ? ((runRate.total - prevYearTotal) / prevYearTotal) * 100 : 0

  const ht = (e: PLSupplierInvoice) => parseFloat(e.currency_amount_before_tax) || 0
  const categorized = currentExpenses.filter((e) => currentCategoryMap.get(e.id) != null).length
  const expenseCoverage = {
    total: currentExpenses.length,
    categorized,
    totalAmount: currentExpenses.reduce((s, e) => s + ht(e), 0),
    categorizedAmount: currentExpenses.filter((e) => currentCategoryMap.get(e.id) != null).reduce((s, e) => s + ht(e), 0),
  }

  // Detail lines for COGS and payroll — for verification in the UI
  const fyExpenses = currentExpenses.filter((e) => e.date >= fyStart && e.date <= fyNow)
  const classify = (e: PLSupplierInvoice) => classifyByAccountCode(currentCategoryMap.get(e.id), settings.cogsAccountPrefixes, settings.payrollAccountPrefixes)
  const toDetail = (e: PLSupplierInvoice) => ({ date: e.date, supplier: extractClientName(e.label), accountCode: currentCategoryMap.get(e.id) ?? '—', amount: ht(e) })

  const cogsDetail = fyExpenses.filter((e) => classify(e) === 'cogs').map(toDetail).sort((a, b) => b.amount - a.amount)
  const payrollDetail = fyExpenses.filter((e) => classify(e) === 'payroll').map(toDetail).sort((a, b) => b.amount - a.amount)

  // Prev year payroll
  const prevPayroll = prevPayrollLedger.total > 0 ? prevPayrollLedger.total : 0

  // Prev year full expenses
  const classifyPrev = (e: PLSupplierInvoice) => classifyByAccountCode(prevCategoryMap.get(e.id), settings.cogsAccountPrefixes, settings.payrollAccountPrefixes)
  const prevPayrollFromInvoices = prevExpenses.filter((e) => classifyPrev(e) === 'payroll').reduce((s, e) => s + ht(e), 0)
  const prevYearFullExpenses = {
    totalPayroll: prevPayroll + prevPayrollFromInvoices,  // OD journal + supplier invoices (mutuelle etc.)
    totalDirectCosts: prevExpenses.filter((e) => classifyPrev(e) === 'cogs').reduce((s, e) => s + ht(e), 0),
    totalExternalCosts: prevExpenses.filter((e) => classifyPrev(e) === 'external').reduce((s, e) => s + ht(e), 0),
  }

  const prevYearInvoiceCount = prevInvoices.length

  return NextResponse.json({
    monthly,
    fiscal,
    runRate,
    expenses,
    cashFlow,
    health,
    unpaidInvoices,
    pipeline,
    pipelineGrid,
    settings,
    expenseCoverage,
    cogsDetail,
    payrollDetail,
    prevYearInvoiceCount,
    prevPayroll,
    prevYearFullExpenses,
    pennylaneError,
  })
}

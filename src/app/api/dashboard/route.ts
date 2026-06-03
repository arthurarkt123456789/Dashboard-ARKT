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
  classifyExpense,
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

  // Fetch ledger entries — 20s timeout to prevent infinite loading
  const categoryMap = await Promise.race([
    fetchLedgerEntries(currentExpenses),
    new Promise<Map<number, string | null>>((r) => setTimeout(() => r(new Map()), 20000)),
  ]).catch(() => new Map())

  const monthly = computeMonthlyRevenue(currentInvoices, prevInvoices, currentExpenses, prevExpenses, settings, now, categoryMap)
  const invoicedUnpaid = currentInvoices
    .filter((inv) => !inv.paid && parseFloat(inv.remaining_amount_without_tax) > 0)
    .reduce((s, inv) => s + (parseFloat(inv.remaining_amount_without_tax) || 0), 0)
  const fiscal = computeFiscalSummary(monthly, now, invoicedUnpaid)
  const runRate = computeRunRate(currentInvoices, pipeline, settings, now)
  // Fetch payroll from ledger entries (OD journal) — 15s timeout
  const fyStart = format(getFiscalYear(now).start, 'yyyy-MM-dd')
  const fyNow = format(now, 'yyyy-MM-dd')
  const payrollLedger = await Promise.race([
    fetchPayrollFromLedger(fyStart, fyNow),
    new Promise<{ monthly: Map<string, number>; total: number }>((r) =>
      setTimeout(() => r({ monthly: new Map(), total: 0 }), 15000)
    ),
  ]).catch(() => ({ monthly: new Map<string, number>(), total: 0 }))

  const expenses = computeExpenseSummary(currentExpenses, settings, now, categoryMap, payrollLedger)
  const cashFlow = computeCashFlow(currentInvoices, currentExpenses, pipeline, settings, now, categoryMap)
  const health = computeHealthStatus(fiscal, runRate, cashFlow)

  const unpaidInvoices = currentInvoices
    .filter((inv) => !inv.paid && parseFloat(inv.remaining_amount_without_tax) > 0)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  const prevYearTotal = prevInvoices.reduce((s, inv) => s + (parseFloat(inv.currency_amount_before_tax) || 0), 0)
  runRate.prevYearTotal = prevYearTotal
  runRate.variance = runRate.total - prevYearTotal
  runRate.variancePct = prevYearTotal > 0 ? ((runRate.total - prevYearTotal) / prevYearTotal) * 100 : 0

  const ht = (e: PLSupplierInvoice) => parseFloat(e.currency_amount_before_tax) || 0
  const categorized = currentExpenses.filter((e) => categoryMap.get(e.id) != null).length
  const expenseCoverage = {
    total: currentExpenses.length,
    categorized,
    totalAmount: currentExpenses.reduce((s, e) => s + ht(e), 0),
    categorizedAmount: currentExpenses.filter((e) => categoryMap.get(e.id) != null).reduce((s, e) => s + ht(e), 0),
  }

  // Detail lines for COGS and payroll — for verification in the UI
  const fyExpenses = currentExpenses.filter((e) => e.date >= fyStart && e.date <= fyNow)

  const classify = (e: PLSupplierInvoice) => classifyExpense(extractClientName(e.label), categoryMap.get(e.id), settings)
  const toDetail = (e: PLSupplierInvoice) => ({ date: e.date, supplier: extractClientName(e.label), accountCode: categoryMap.get(e.id) ?? '—', amount: ht(e) })

  const cogsDetail = fyExpenses.filter((e) => classify(e) === 'cogs').map(toDetail).sort((a, b) => b.amount - a.amount)
  const payrollDetail = fyExpenses.filter((e) => classify(e) === 'payroll').map(toDetail).sort((a, b) => b.amount - a.amount)
  const directorDetail = fyExpenses.filter((e) => classify(e) === 'director').map(toDetail).sort((a, b) => b.amount - a.amount)
  const meuleryDetail = fyExpenses.filter((e) => classify(e) === 'meulery').map(toDetail).sort((a, b) => b.amount - a.amount)

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
    settings,
    expenseCoverage,
    cogsDetail,
    payrollDetail,
    directorDetail,
    meuleryDetail,
    prevYearInvoiceCount,
    pennylaneError,
  })
}

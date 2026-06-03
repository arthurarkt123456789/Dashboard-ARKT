import { PLInvoiceCategory } from '@/lib/pennylane'
import {
  PLCustomerInvoice,
  PLSupplierInvoice,
  MonthlyRevenue,
  FiscalYearSummary,
  RunRateProjection,
  ExpenseSummary,
  CashFlowMonth,
  HealthStatus,
  PipelineEntry,
  AppSettings,
  extractClientName,
} from '@/types'
import {
  format,
  startOfMonth,
  addMonths,
  differenceInMonths,
  parseISO,
  isAfter,
  isBefore,
  endOfMonth,
} from 'date-fns'
import { fr } from 'date-fns/locale'

// --- Helpers to read actual Pennylane v2 fields ---

function amountHT(inv: PLCustomerInvoice | PLSupplierInvoice): number {
  return parseFloat(inv.currency_amount_before_tax) || 0
}

function isPaid(inv: PLCustomerInvoice | PLSupplierInvoice): boolean {
  if ('paid' in inv) return inv.paid === true
  if ('payment_status' in inv) return (inv as PLSupplierInvoice).payment_status === 'paid'
  return false
}

function remainingHT(inv: PLCustomerInvoice): number {
  return parseFloat(inv.remaining_amount_without_tax) || 0
}

function invDate(inv: PLCustomerInvoice | PLSupplierInvoice): string {
  return inv.date // YYYY-MM-DD
}

function clientName(inv: PLCustomerInvoice): string {
  return extractClientName(inv.label)
}


// --- Fiscal year helpers ---

export function getFiscalYear(date: Date): { start: Date; end: Date; label: string } {
  const month = date.getMonth()
  const year = date.getFullYear()
  const start = month >= 9 ? new Date(year, 9, 1) : new Date(year - 1, 9, 1)
  const end = new Date(start.getFullYear() + 1, 8, 30)
  return { start, end, label: `${start.getFullYear()}-${end.getFullYear()}` }
}

export function getPrevFiscalYear(date: Date): { start: Date; end: Date } {
  const current = getFiscalYear(date)
  return { start: addMonths(current.start, -12), end: addMonths(current.end, -12) }
}

function formatMonth(date: Date): string {
  return format(date, 'yyyy-MM')
}

function labelMonth(date: Date): string {
  return format(date, 'MMM yy', { locale: fr })
}

// --- Client classification ---

function isBartPucci(name: string, names: string[]): boolean {
  const lower = name.toLowerCase()
  return names.some((n) => lower.includes(n.toLowerCase()))
}

export type CostCategory = 'cogs' | 'payroll' | 'external'

export function classifyByAccountCode(
  cats: PLInvoiceCategory[],
  cogsPrefixes: string[],
  payrollPrefixes: string[]
): CostCategory {
  if (cats.length === 0) return 'external'
  // Use the category with the highest amount to determine classification
  const primary = cats.reduce((a, b) =>
    parseFloat(b.amount) > parseFloat(a.amount) ? b : a
  )
  const code = primary.plan_item?.number ?? ''
  if (payrollPrefixes.some((p) => code.startsWith(p))) return 'payroll'
  if (cogsPrefixes.some((p) => code.startsWith(p))) return 'cogs'
  return 'external'
}

// --- Monthly revenue ---

export function computeMonthlyRevenue(
  currentInvoices: PLCustomerInvoice[],
  prevInvoices: PLCustomerInvoice[],
  currentExpenses: PLSupplierInvoice[],
  prevExpenses: PLSupplierInvoice[],
  settings: AppSettings,
  now: Date,
  categoryMap: Map<number, PLInvoiceCategory[]> = new Map()
): MonthlyRevenue[] {
  const fy = getFiscalYear(now)
  const months: MonthlyRevenue[] = []

  for (let i = 0; i < 12; i++) {
    const monthStart = addMonths(fy.start, i)
    const monthKey = formatMonth(monthStart)

    const curInv = currentInvoices.filter((inv) => invDate(inv).startsWith(monthKey))
    const revenue = curInv.reduce((s, inv) => s + amountHT(inv), 0)
    const bartPucci = curInv
      .filter((inv) => isBartPucci(clientName(inv), settings.bartPucciNames))
      .reduce((s, inv) => s + amountHT(inv), 0)

    const monthExp = currentExpenses.filter((e) => invDate(e).startsWith(monthKey))
    const directCosts = monthExp
      .filter((e) => classifyByAccountCode(categoryMap.get(e.id) ?? [], settings.cogsAccountPrefixes, settings.payrollAccountPrefixes) === 'cogs')
      .reduce((s, e) => s + amountHT(e), 0)

    const grossMargin = revenue - directCosts
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0

    const prevMonthKey = formatMonth(addMonths(monthStart, -12))
    const prevInv = prevInvoices.filter((inv) => invDate(inv).startsWith(prevMonthKey))
    const prevRevenue = prevInv.reduce((s, inv) => s + amountHT(inv), 0)
    const prevBartPucci = prevInv
      .filter((inv) => isBartPucci(clientName(inv), settings.bartPucciNames))
      .reduce((s, inv) => s + amountHT(inv), 0)
    const prevDirectCosts = prevExpenses
      .filter((e) => invDate(e).startsWith(prevMonthKey) && classifyByAccountCode(categoryMap.get(e.id) ?? [], settings.cogsAccountPrefixes, settings.payrollAccountPrefixes) === 'cogs')
      .reduce((s, e) => s + amountHT(e), 0)
    const prevGrossMargin = prevRevenue - prevDirectCosts

    months.push({
      month: monthKey,
      label: labelMonth(monthStart),
      revenue,
      bartPucci,
      directCosts,
      grossMargin,
      grossMarginPct,
      cumRevenue: 0,
      cumBartPucci: 0,
      cumGrossMargin: 0,
      prevYearRevenue: prevRevenue,
      prevYearBartPucci: prevBartPucci,
      prevYearGrossMargin: prevGrossMargin,
      prevYearCumRevenue: 0,
      prevYearCumBartPucci: 0,
      prevYearCumGrossMargin: 0,
    })
  }

  let cumRev = 0, cumBP = 0, cumGM = 0, cumPrevRev = 0, cumPrevBP = 0, cumPrevGM = 0
  for (const m of months) {
    cumRev += m.revenue; cumBP += m.bartPucci; cumGM += m.grossMargin
    cumPrevRev += m.prevYearRevenue; cumPrevBP += m.prevYearBartPucci; cumPrevGM += m.prevYearGrossMargin
    m.cumRevenue = cumRev; m.cumBartPucci = cumBP; m.cumGrossMargin = cumGM
    m.prevYearCumRevenue = cumPrevRev; m.prevYearCumBartPucci = cumPrevBP; m.prevYearCumGrossMargin = cumPrevGM
  }

  return months
}

// --- Fiscal year summary ---

export function computeFiscalSummary(
  monthly: MonthlyRevenue[],
  now: Date,
  invoicedUnpaid: number = 0
): FiscalYearSummary {
  const fy = getFiscalYear(now)
  const ytd = monthly.filter((m) => m.month <= formatMonth(now))

  const totalRevenue = ytd.reduce((s, m) => s + m.revenue, 0)
  const totalBartPucci = ytd.reduce((s, m) => s + m.bartPucci, 0)
  const totalDirectCosts = ytd.reduce((s, m) => s + m.directCosts, 0)
  const totalGrossMargin = ytd.reduce((s, m) => s + m.grossMargin, 0)
  const prevYearRevenue = ytd.reduce((s, m) => s + m.prevYearRevenue, 0)
  const prevYearBartPucci = ytd.reduce((s, m) => s + m.prevYearBartPucci, 0)
  const prevYearGrossMargin = ytd.reduce((s, m) => s + m.prevYearGrossMargin, 0)

  const theoreticalRevenue = totalRevenue + invoicedUnpaid
  const theoreticalGrossMargin = theoreticalRevenue - totalDirectCosts

  return {
    year: fy.label,
    startDate: format(fy.start, 'yyyy-MM-dd'),
    endDate: format(fy.end, 'yyyy-MM-dd'),
    totalRevenue,
    totalBartPucci,
    bartPucciPct: totalRevenue > 0 ? (totalBartPucci / totalRevenue) * 100 : 0,
    totalDirectCosts,
    totalGrossMargin,
    grossMarginPct: totalRevenue > 0 ? (totalGrossMargin / totalRevenue) * 100 : 0,
    theoreticalRevenue,
    theoreticalGrossMargin,
    theoreticalGrossMarginPct: theoreticalRevenue > 0 ? (theoreticalGrossMargin / theoreticalRevenue) * 100 : 0,
    prevYearRevenue,
    prevYearBartPucci,
    prevYearBartPucciPct: prevYearRevenue > 0 ? (prevYearBartPucci / prevYearRevenue) * 100 : 0,
    prevYearGrossMargin,
    revenueGrowthPct: prevYearRevenue > 0 ? ((totalRevenue - prevYearRevenue) / prevYearRevenue) * 100 : 0,
    marginGrowthPct: prevYearGrossMargin > 0 ? ((totalGrossMargin - prevYearGrossMargin) / prevYearGrossMargin) * 100 : 0,
    bartPucciGrowthPct: prevYearRevenue > 0
      ? ((totalBartPucci / Math.max(totalRevenue, 1)) - (prevYearBartPucci / Math.max(prevYearRevenue, 1))) * 100
      : 0,
  }
}

// --- Run-rate ---

export function computeRunRate(
  currentInvoices: PLCustomerInvoice[],
  pipeline: PipelineEntry[],
  settings: AppSettings,
  now: Date
): RunRateProjection {
  const fy = getFiscalYear(now)
  const monthsRemaining = Math.max(0, differenceInMonths(fy.end, now))

  const ytdInvoices = currentInvoices.filter(
    (inv) => invDate(inv) >= format(fy.start, 'yyyy-MM-dd') && invDate(inv) <= format(now, 'yyyy-MM-dd')
  )
  const ytdRevenue = ytdInvoices.reduce((s, inv) => s + amountHT(inv), 0)

  const invoicedUnpaid = currentInvoices
    .filter((inv) => !isPaid(inv) && remainingHT(inv) > 0)
    .reduce((s, inv) => s + remainingHT(inv), 0)

  // Recurring detection: clients with ≥3 invoices in last 6 months
  const sixMonthsAgo = addMonths(now, -6)
  const recent = currentInvoices.filter((inv) => parseISO(invDate(inv)) >= sixMonthsAgo)
  const byClient = new Map<string, number>()
  for (const inv of recent) {
    const name = clientName(inv)
    byClient.set(name, (byClient.get(name) ?? 0) + 1)
  }
  const recurringMonthly = new Map<string, number>()
  for (const [name, count] of Array.from(byClient.entries())) {
    if (count >= 3) {
      const avg = recent.filter((inv) => clientName(inv) === name).reduce((s, inv) => s + amountHT(inv), 0) / 6
      recurringMonthly.set(name, avg)
    }
  }
  const confirmedRecurring = Array.from(recurringMonthly.values()).reduce((s, v) => s + v, 0) * monthsRemaining
  const pipelineTotal = pipeline.filter((p) => !p.isDuplicate).reduce((s, p) => s + p.amount, 0)

  const total = ytdRevenue + invoicedUnpaid + confirmedRecurring + pipelineTotal
  return { ytdRevenue, invoicedUnpaid, confirmedRecurring, pipeline: pipelineTotal, total, prevYearTotal: 0, variance: 0, variancePct: 0, monthsRemaining }
}

// --- Duplicate detection ---

export function detectDuplicates(
  pipeline: { id: number; clientName: string; amount: number; expectedDate?: string | null }[],
  recentInvoices: PLCustomerInvoice[]
): Set<number> {
  const dupIds = new Set<number>()
  for (const entry of pipeline) {
    const entryName = entry.clientName.toLowerCase().trim()
    for (const inv of recentInvoices) {
      const invName = clientName(inv).toLowerCase().trim()
      if (!invName.includes(entryName) && !entryName.includes(invName)) continue
      const amountMatch = Math.abs(amountHT(inv) - entry.amount) / Math.max(entry.amount, 1) < 0.25
      let dateMatch = false
      if (entry.expectedDate) {
        dateMatch = Math.abs(new Date(entry.expectedDate).getTime() - new Date(invDate(inv)).getTime()) < 45 * 24 * 60 * 60 * 1000
      }
      if (amountMatch || dateMatch) { dupIds.add(entry.id); break }
    }
  }
  return dupIds
}

// --- Expense summary ---

export function computeExpenseSummary(
  expenses: PLSupplierInvoice[],
  settings: AppSettings,
  now: Date,
  categoryMap: Map<number, PLInvoiceCategory[]> = new Map()
): ExpenseSummary {
  const fy = getFiscalYear(now)
  const fyExp = expenses.filter((e) => invDate(e) >= format(fy.start, 'yyyy-MM-dd') && invDate(e) <= format(now, 'yyyy-MM-dd'))

  let totalPayroll = 0, totalDirectCosts = 0, totalExternalCosts = 0
  for (const e of fyExp) {
    const cat = classifyByAccountCode(categoryMap.get(e.id) ?? [], settings.cogsAccountPrefixes, settings.payrollAccountPrefixes)
    if (cat === 'payroll') totalPayroll += amountHT(e)
    else if (cat === 'cogs') totalDirectCosts += amountHT(e)
    else totalExternalCosts += amountHT(e)
  }

  const monthsElapsed = differenceInMonths(now, fy.start) + 1
  if (settings.payrollMonthly > 0 && totalPayroll === 0) totalPayroll = settings.payrollMonthly * monthsElapsed

  return { totalPayroll, totalDirectCosts, totalExternalCosts, totalExpenses: totalPayroll + totalDirectCosts + totalExternalCosts, monthlyPayroll: [], monthlyDirectCosts: [], monthlyExternalCosts: [] }
}

// --- Cash flow ---

export function computeCashFlow(
  currentInvoices: PLCustomerInvoice[],
  currentExpenses: PLSupplierInvoice[],
  pipeline: PipelineEntry[],
  settings: AppSettings,
  now: Date,
  categoryMap: Map<number, PLInvoiceCategory[]> = new Map()
): CashFlowMonth[] {
  const fy = getFiscalYear(now)
  const months: CashFlowMonth[] = []
  let cumulativeCash = settings.currentBankBalance

  const displayStart = startOfMonth(
    addMonths(now, -3) < fy.start ? fy.start : addMonths(now, -3)
  )
  let current = displayStart
  const fyEnd = endOfMonth(fy.end)

  while (!isAfter(current, fyEnd)) {
    const monthKey = formatMonth(current)
    const isHistorical = isBefore(current, startOfMonth(now))

    const monthInv = currentInvoices.filter((inv) => invDate(inv).startsWith(monthKey))
    const revenue = monthInv.reduce((s, inv) => s + amountHT(inv), 0)

    let collected = 0
    if (isHistorical) {
      collected = monthInv.filter(isPaid).reduce((s, inv) => s + amountHT(inv), 0)
    } else {
      const unpaidDue = currentInvoices.filter((inv) => !isPaid(inv) && inv.deadline?.startsWith(monthKey))
      const pipelineDue = pipeline.filter((p) => !p.isDuplicate && p.expectedDate?.startsWith(monthKey))
      collected = unpaidDue.reduce((s, inv) => s + remainingHT(inv), 0) + pipelineDue.reduce((s, p) => s + p.amount, 0)
    }

    const monthExp = currentExpenses.filter((e) => invDate(e).startsWith(monthKey))
    const classify = (e: PLSupplierInvoice) => classifyByAccountCode(categoryMap.get(e.id) ?? [], settings.cogsAccountPrefixes, settings.payrollAccountPrefixes)
    const payroll = isHistorical
      ? (monthExp.filter((e) => classify(e) === 'payroll').reduce((s, e) => s + amountHT(e), 0) || settings.payrollMonthly)
      : settings.payrollMonthly
    const directCosts = monthExp.filter((e) => classify(e) === 'cogs').reduce((s, e) => s + amountHT(e), 0)
    const externalCosts = monthExp.filter((e) => classify(e) === 'external').reduce((s, e) => s + amountHT(e), 0)

    const totalOut = payroll + directCosts + externalCosts
    const netFlow = (isHistorical ? revenue : collected) - totalOut
    const canPayStartOfMonth = cumulativeCash >= payroll
    cumulativeCash += netFlow

    months.push({ month: monthKey, label: labelMonth(current), isHistorical, revenue, collected, payroll, directCosts, externalCosts, totalOut, netFlow, cumulativeCash, canPayStartOfMonth, canPayEndOfMonth: cumulativeCash >= 0 })
    current = addMonths(current, 1)
  }
  return months
}

// --- Health ---

export function computeHealthStatus(fiscal: FiscalYearSummary, runRate: RunRateProjection, cashFlow: CashFlowMonth[]): HealthStatus {
  const commercial = fiscal.revenueGrowthPct > 5 ? 'green' : fiscal.revenueGrowthPct >= 0 ? 'yellow' : 'red'
  const financial = fiscal.grossMarginPct > 50 ? 'green' : fiscal.grossMarginPct >= 25 ? 'yellow' : 'red'
  const runwayMonths = cashFlow.filter((m) => !m.isHistorical && m.canPayEndOfMonth).length
  const danger = runwayMonths >= 3 ? 'green' : runwayMonths >= 1 ? 'yellow' : 'red'
  const monthlyOut = cashFlow[0]?.totalOut ?? 1
  return {
    commercial, financial, danger,
    revenueGrowthPct: fiscal.revenueGrowthPct,
    grossMarginPct: fiscal.grossMarginPct,
    runwayMonths,
    runwayWithSigned: runRate.invoicedUnpaid / Math.max(monthlyOut, 1),
    runwayWithPipeline: (runRate.invoicedUnpaid + runRate.pipeline) / Math.max(monthlyOut, 1),
  }
}

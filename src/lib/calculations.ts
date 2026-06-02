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
} from '@/types'
import {
  format,
  startOfMonth,
  addMonths,
  differenceInMonths,
  parseISO,
  isAfter,
  isBefore,
  isWithinInterval,
  endOfMonth,
} from 'date-fns'
import { fr } from 'date-fns/locale'

// --- Fiscal year helpers ---

export function getFiscalYear(date: Date): { start: Date; end: Date; label: string } {
  const month = date.getMonth() // 0-indexed, so Oct = 9
  const year = date.getFullYear()
  const start = month >= 9
    ? new Date(year, 9, 1)       // Oct 1 this year
    : new Date(year - 1, 9, 1)   // Oct 1 last year
  const end = new Date(start.getFullYear() + 1, 8, 30) // Sep 30 next year
  const label = `${start.getFullYear()}-${end.getFullYear()}`
  return { start, end, label }
}

export function getPrevFiscalYear(date: Date): { start: Date; end: Date } {
  const current = getFiscalYear(date)
  return {
    start: addMonths(current.start, -12),
    end: addMonths(current.end, -12),
  }
}

function formatMonth(date: Date): string {
  return format(date, 'yyyy-MM')
}

function labelMonth(date: Date): string {
  return format(date, 'MMM yy', { locale: fr })
}

// --- Client classification ---

function isBartPucci(clientName: string, names: string[]): boolean {
  const lower = clientName.toLowerCase()
  return names.some((n) => lower.includes(n.toLowerCase()))
}

function isDirectCost(supplierName: string, label: string, keywords: string[]): boolean {
  const text = `${supplierName} ${label ?? ''}`.toLowerCase()
  return keywords.some((k) => text.includes(k.toLowerCase()))
}

function isPayroll(supplierName: string, label: string, keywords: string[]): boolean {
  const text = `${supplierName} ${label ?? ''}`.toLowerCase()
  return keywords.some((k) => text.includes(k.toLowerCase()))
}

// --- Monthly revenue computation ---

export function computeMonthlyRevenue(
  currentInvoices: PLCustomerInvoice[],
  prevInvoices: PLCustomerInvoice[],
  currentExpenses: PLSupplierInvoice[],
  prevExpenses: PLSupplierInvoice[],
  settings: AppSettings,
  now: Date
): MonthlyRevenue[] {
  const fy = getFiscalYear(now)
  const months: MonthlyRevenue[] = []

  for (let i = 0; i < 12; i++) {
    const monthStart = addMonths(fy.start, i)
    const monthKey = formatMonth(monthStart)
    const monthLabel = labelMonth(monthStart)

    // Current FY invoices for this month
    const curInv = currentInvoices.filter((inv) => inv.issue_date.startsWith(monthKey))
    const revenue = curInv.reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0)
    const bartPucci = curInv
      .filter((inv) => isBartPucci(inv.customer_name, settings.bartPucciNames))
      .reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0)

    // Direct costs for this month (from supplier invoices)
    const monthExpenses = currentExpenses.filter((e) => e.issue_date.startsWith(monthKey))
    const directCosts = monthExpenses
      .filter((e) => isDirectCost(e.supplier_name, e.label ?? '', settings.directCostKeywords))
      .reduce((s, e) => s + e.amount_eur_excl_taxes, 0)

    const grossMargin = revenue - directCosts
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0

    // Prior FY — shift month key back 12 months
    const prevMonthStart = addMonths(monthStart, -12)
    const prevMonthKey = formatMonth(prevMonthStart)
    const prevInv = prevInvoices.filter((inv) => inv.issue_date.startsWith(prevMonthKey))
    const prevRevenue = prevInv.reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0)
    const prevDirectCosts = prevExpenses
      .filter((e) => e.issue_date.startsWith(prevMonthKey) && isDirectCost(e.supplier_name, e.label ?? '', settings.directCostKeywords))
      .reduce((s, e) => s + e.amount_eur_excl_taxes, 0)
    const prevGrossMargin = prevRevenue - prevDirectCosts

    months.push({
      month: monthKey,
      label: monthLabel,
      revenue,
      bartPucci,
      directCosts,
      grossMargin,
      grossMarginPct,
      cumRevenue: 0,
      cumBartPucci: 0,
      cumGrossMargin: 0,
      prevYearRevenue: prevRevenue,
      prevYearGrossMargin: prevGrossMargin,
      prevYearCumRevenue: 0,
      prevYearCumGrossMargin: 0,
    })
  }

  // Fill cumulative fields
  let cumRev = 0, cumBP = 0, cumGM = 0, cumPrevRev = 0, cumPrevGM = 0
  for (const m of months) {
    cumRev += m.revenue
    cumBP += m.bartPucci
    cumGM += m.grossMargin
    cumPrevRev += m.prevYearRevenue
    cumPrevGM += m.prevYearGrossMargin
    m.cumRevenue = cumRev
    m.cumBartPucci = cumBP
    m.cumGrossMargin = cumGM
    m.prevYearCumRevenue = cumPrevRev
    m.prevYearCumGrossMargin = cumPrevGM
  }

  return months
}

// --- Fiscal year summary ---

export function computeFiscalSummary(
  monthly: MonthlyRevenue[],
  now: Date
): FiscalYearSummary {
  const fy = getFiscalYear(now)
  const ytdMonths = monthly.filter((m) => m.month <= formatMonth(now))

  const totalRevenue = ytdMonths.reduce((s, m) => s + m.revenue, 0)
  const totalBartPucci = ytdMonths.reduce((s, m) => s + m.bartPucci, 0)
  const totalDirectCosts = ytdMonths.reduce((s, m) => s + m.directCosts, 0)
  const totalGrossMargin = ytdMonths.reduce((s, m) => s + m.grossMargin, 0)

  const prevYearRevenue = ytdMonths.reduce((s, m) => s + m.prevYearRevenue, 0)
  const prevYearGrossMargin = ytdMonths.reduce((s, m) => s + m.prevYearGrossMargin, 0)

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
    prevYearRevenue,
    prevYearGrossMargin,
    revenueGrowthPct: prevYearRevenue > 0 ? ((totalRevenue - prevYearRevenue) / prevYearRevenue) * 100 : 0,
    marginGrowthPct: prevYearGrossMargin > 0 ? ((totalGrossMargin - prevYearGrossMargin) / prevYearGrossMargin) * 100 : 0,
  }
}

// --- Run-rate projection ---

export function computeRunRate(
  currentInvoices: PLCustomerInvoice[],
  pipeline: PipelineEntry[],
  settings: AppSettings,
  now: Date
): RunRateProjection {
  const fy = getFiscalYear(now)
  const monthsRemaining = Math.max(0, differenceInMonths(fy.end, now))

  // YTD: invoices in current FY up to now
  const ytdInvoices = currentInvoices.filter(
    (inv) => inv.issue_date >= format(fy.start, 'yyyy-MM-dd') && inv.issue_date <= format(now, 'yyyy-MM-dd')
  )
  const ytdRevenue = ytdInvoices.reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0)

  // Unpaid invoices (already invoiced, not yet paid)
  const invoicedUnpaid = currentInvoices
    .filter((inv) => !inv.is_paid && inv.outstanding_balance > 0)
    .reduce((s, inv) => s + inv.outstanding_balance, 0)

  // Detect recurring clients: clients with ≥3 invoices in the last 6 months
  const sixMonthsAgo = addMonths(now, -6)
  const recentInvoices = currentInvoices.filter((inv) => parseISO(inv.issue_date) >= sixMonthsAgo)
  const byClient = new Map<string, number>()
  for (const inv of recentInvoices) {
    byClient.set(inv.customer_name, (byClient.get(inv.customer_name) ?? 0) + 1)
  }

  // Monthly recurring clients (≥3 invoices in 6 months = ~monthly)
  const recurringMonthly = new Map<string, number>()
  for (const [name, count] of Array.from(byClient.entries())) {
    if (count >= 3) {
      const clientInvoices = recentInvoices.filter((inv) => inv.customer_name === name)
      const avgMonthly = clientInvoices.reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0) / 6
      recurringMonthly.set(name, avgMonthly)
    }
  }

  const confirmedRecurring = Array.from(recurringMonthly.values()).reduce((s, v) => s + v, 0) * monthsRemaining

  // Pipeline total (excluding duplicates)
  const pipelineTotal = pipeline
    .filter((p) => !p.isDuplicate)
    .reduce((s, p) => s + p.amount, 0)

  // Estimated prior FY total (naive: sum all prior year invoices from monthly data)
  // We'll pass this from outside since we need the full prior year data
  // For now, approximate as ytdRevenue scaled by months
  const monthsElapsed = 12 - monthsRemaining
  const prevYearTotal = monthsElapsed > 0 ? (ytdRevenue / monthsElapsed) * 12 * 0.9 : 0 // placeholder

  const total = ytdRevenue + invoicedUnpaid + confirmedRecurring + pipelineTotal
  const variance = total - prevYearTotal
  const variancePct = prevYearTotal > 0 ? (variance / prevYearTotal) * 100 : 0

  return {
    ytdRevenue,
    invoicedUnpaid,
    confirmedRecurring,
    pipeline: pipelineTotal,
    total,
    prevYearTotal,
    variance,
    variancePct,
    monthsRemaining,
  }
}

// --- Duplicate detection ---

export function detectDuplicates(
  pipeline: { id: number; clientName: string; amount: number; expectedDate?: string | null }[],
  recentInvoices: PLCustomerInvoice[]
): Set<number> {
  const duplicateIds = new Set<number>()

  for (const entry of pipeline) {
    const entryName = entry.clientName.toLowerCase().trim()
    for (const inv of recentInvoices) {
      const invName = inv.customer_name.toLowerCase().trim()

      const nameMatch = invName.includes(entryName) || entryName.includes(invName)
      if (!nameMatch) continue

      const amountMatch = Math.abs(inv.amount_eur_excl_taxes - entry.amount) / Math.max(entry.amount, 1) < 0.25
      let dateMatch = false
      if (entry.expectedDate) {
        const expectedMs = new Date(entry.expectedDate).getTime()
        const invoiceMs = new Date(inv.issue_date).getTime()
        dateMatch = Math.abs(expectedMs - invoiceMs) < 45 * 24 * 60 * 60 * 1000 // 45 days
      }

      if (amountMatch || dateMatch) {
        duplicateIds.add(entry.id)
        break
      }
    }
  }

  return duplicateIds
}

// --- Expense summary ---

export function computeExpenseSummary(
  expenses: PLSupplierInvoice[],
  settings: AppSettings,
  now: Date
): ExpenseSummary {
  const fy = getFiscalYear(now)

  const fyExpenses = expenses.filter(
    (e) =>
      e.issue_date >= format(fy.start, 'yyyy-MM-dd') &&
      e.issue_date <= format(now, 'yyyy-MM-dd')
  )

  let totalPayroll = 0
  let totalDirectCosts = 0
  let totalExternalCosts = 0

  for (const e of fyExpenses) {
    if (isPayroll(e.supplier_name, e.label ?? '', settings.payrollKeywords)) {
      totalPayroll += e.amount_eur_excl_taxes
    } else if (isDirectCost(e.supplier_name, e.label ?? '', settings.directCostKeywords)) {
      totalDirectCosts += e.amount_eur_excl_taxes
    } else {
      totalExternalCosts += e.amount_eur_excl_taxes
    }
  }

  // Add manual payroll override (monthly × months elapsed)
  const monthsElapsed = differenceInMonths(now, fy.start) + 1
  if (settings.payrollMonthly > 0 && totalPayroll === 0) {
    totalPayroll = settings.payrollMonthly * monthsElapsed
  }

  return {
    totalPayroll,
    totalDirectCosts,
    totalExternalCosts,
    totalExpenses: totalPayroll + totalDirectCosts + totalExternalCosts,
    monthlyPayroll: [],
    monthlyDirectCosts: [],
    monthlyExternalCosts: [],
  }
}

// --- Cash flow forecast ---

export function computeCashFlow(
  currentInvoices: PLCustomerInvoice[],
  currentExpenses: PLSupplierInvoice[],
  pipeline: PipelineEntry[],
  settings: AppSettings,
  now: Date
): CashFlowMonth[] {
  const fy = getFiscalYear(now)
  const months: CashFlowMonth[] = []
  let cumulativeCash = settings.currentBankBalance

  // Show past 3 months + remaining FY months (up to 12 total)
  const fyStart = fy.start
  const histStart = addMonths(now, -3)
  const displayStart = histStart < fyStart ? fyStart : histStart

  let current = startOfMonth(displayStart)
  const fyEnd = endOfMonth(fy.end)

  while (!isAfter(current, fyEnd)) {
    const monthKey = formatMonth(current)
    const isHistorical = isBefore(current, startOfMonth(now))

    // Revenue/collections for this month
    const monthInvoices = currentInvoices.filter((inv) => inv.issue_date.startsWith(monthKey))
    const revenue = monthInvoices.reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0)

    // For historical: use actual data; for future: use deadline of unpaid invoices + pipeline
    let collected = 0
    if (isHistorical) {
      // Approximation: paid invoices issued this month
      collected = monthInvoices.filter((inv) => inv.is_paid).reduce((s, inv) => s + inv.amount_eur_excl_taxes, 0)
    } else {
      // Future expected collections: unpaid invoices with deadline this month + pipeline
      const unpaidDue = currentInvoices.filter(
        (inv) => !inv.is_paid && inv.deadline?.startsWith(monthKey)
      )
      const pipelineDue = pipeline.filter(
        (p) => !p.isDuplicate && p.expectedDate?.startsWith(monthKey)
      )
      collected =
        unpaidDue.reduce((s, inv) => s + inv.outstanding_balance, 0) +
        pipelineDue.reduce((s, p) => s + p.amount, 0)
    }

    // Costs for this month
    const monthExpenses = currentExpenses.filter((e) => e.issue_date.startsWith(monthKey))
    const payroll = isHistorical
      ? monthExpenses.filter((e) => isPayroll(e.supplier_name, e.label ?? '', settings.payrollKeywords)).reduce((s, e) => s + e.amount_eur_excl_taxes, 0) ||
        settings.payrollMonthly
      : settings.payrollMonthly
    const directCosts = monthExpenses
      .filter((e) => isDirectCost(e.supplier_name, e.label ?? '', settings.directCostKeywords))
      .reduce((s, e) => s + e.amount_eur_excl_taxes, 0)
    const externalCosts = monthExpenses
      .filter(
        (e) =>
          !isPayroll(e.supplier_name, e.label ?? '', settings.payrollKeywords) &&
          !isDirectCost(e.supplier_name, e.label ?? '', settings.directCostKeywords)
      )
      .reduce((s, e) => s + e.amount_eur_excl_taxes, 0)

    const totalOut = payroll + directCosts + externalCosts
    const netFlow = (isHistorical ? revenue : collected) - totalOut

    // Start-of-month check: can we pay fixed charges (payroll) before revenue comes in?
    const canPayStartOfMonth = cumulativeCash >= payroll
    cumulativeCash += netFlow
    const canPayEndOfMonth = cumulativeCash >= 0

    months.push({
      month: monthKey,
      label: labelMonth(current),
      isHistorical,
      revenue,
      collected,
      payroll,
      directCosts,
      externalCosts,
      totalOut,
      netFlow,
      cumulativeCash,
      canPayStartOfMonth,
      canPayEndOfMonth,
    })

    current = addMonths(current, 1)
  }

  return months
}

// --- Health status ---

export function computeHealthStatus(
  fiscal: FiscalYearSummary,
  runRate: RunRateProjection,
  cashFlow: CashFlowMonth[],
): HealthStatus {
  // Commercial health: revenue growth
  const commercial =
    fiscal.revenueGrowthPct > 5 ? 'green' :
    fiscal.revenueGrowthPct >= 0 ? 'yellow' : 'red'

  // Financial health: gross margin %
  const financial =
    fiscal.grossMarginPct > 50 ? 'green' :
    fiscal.grossMarginPct >= 25 ? 'yellow' : 'red'

  // Danger: how many future months have positive end-of-month cash
  const futureMths = cashFlow.filter((m) => !m.isHistorical)
  const positiveMonths = futureMths.filter((m) => m.canPayEndOfMonth).length
  const runwayMonths = positiveMonths

  const danger =
    runwayMonths >= 3 ? 'green' :
    runwayMonths >= 1 ? 'yellow' : 'red'

  // Runway with signed (invoiced unpaid already counted in runRate)
  const runwayWithSigned = runRate.invoicedUnpaid / Math.max(cashFlow[0]?.totalOut ?? 1, 1)
  const runwayWithPipeline = (runRate.invoicedUnpaid + runRate.pipeline) / Math.max(cashFlow[0]?.totalOut ?? 1, 1)

  return {
    commercial,
    financial,
    danger,
    revenueGrowthPct: fiscal.revenueGrowthPct,
    grossMarginPct: fiscal.grossMarginPct,
    runwayMonths,
    runwayWithSigned,
    runwayWithPipeline,
  }
}

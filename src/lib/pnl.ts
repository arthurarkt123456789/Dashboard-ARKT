import { format, addMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Invoice } from './pennylane'

// Re-export Invoice so consumers can import from pnl.ts if needed
export type { Invoice }

// --- Account prefix constants ---
export const COGS_PREFIXES = ['60', '601', '604', '607', '611', '612', '621']
export const PAYROLL_PREFIXES = ['641', '642', '644', '645', '646', '647', '648']

// --- P&L result type ---
export interface PnLResult {
  revenue: number          // sum of amountHT for period
  invoicedUnpaid: number   // sum of remainingHT where !paid
  cogs: number             // sum of 60x/611/621 debits
  grossMargin: number      // revenue - cogs
  grossMarginPct: number
  payroll: number          // sum of 641/642/645 debits + odPayroll
  odPayroll: number        // payroll from OD journal scan
  externalCosts: number    // all other 6xx debits
  ebitda: number           // grossMargin - payroll - externalCosts
  ebitdaPct: number
}

// --- Monthly chart point ---
export interface MonthlyPoint {
  month: string       // YYYY-MM
  label: string       // "oct. 25"
  revenue: number
  cogs: number
  grossMargin: number
  payroll: number
  externalCosts: number
  ebe: number
  cumRevenue: number
  cumGrossMargin: number
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
  const { start, end } = getFiscalYear(date)
  return {
    start: addMonths(start, -12),
    end: addMonths(end, -12),
  }
}

// --- Helper: sum expense accounts by prefixes ---
function sumPrefixes(
  accountSums: Map<string, Map<string, number>>,
  prefixes: string[],
  fromMonth: string,
  toMonth: string
): number {
  let total = 0
  for (const [month, sums] of Array.from(accountSums.entries())) {
    if (month < fromMonth || month > toMonth) continue
    for (const [prefix, amount] of Array.from(sums.entries())) {
      if (prefixes.some((p) => prefix.startsWith(p) || p.startsWith(prefix))) {
        total += amount
      }
    }
  }
  return total
}

function sumAllSixxx(
  accountSums: Map<string, Map<string, number>>,
  fromMonth: string,
  toMonth: string
): number {
  let total = 0
  for (const [month, sums] of Array.from(accountSums.entries())) {
    if (month < fromMonth || month > toMonth) continue
    for (const amount of Array.from(sums.values())) {
      total += amount
    }
  }
  return total
}

// --- computePnL ---
export function computePnL(
  invoices: Invoice[],
  accountSums: Map<string, Map<string, number>>,
  odPayroll: number,
  fromDate: string,
  toDate: string
): PnLResult {
  const fromMonth = fromDate.slice(0, 7)
  const toMonth = toDate.slice(0, 7)

  // Revenue = invoices in period
  const periodInvoices = invoices.filter((inv) => inv.date >= fromDate && inv.date <= toDate)
  const revenue = periodInvoices.reduce((s, inv) => s + inv.amountHT, 0)

  // Invoiced unpaid = remaining HT where not paid (all invoices not just period — open invoices)
  const invoicedUnpaid = invoices
    .filter((inv) => !inv.paid && inv.remainingHT > 0)
    .reduce((s, inv) => s + inv.remainingHT, 0)

  const cogs = sumPrefixes(accountSums, COGS_PREFIXES, fromMonth, toMonth)
  const payrollFromAccounts = sumPrefixes(accountSums, PAYROLL_PREFIXES, fromMonth, toMonth)
  const payroll = payrollFromAccounts + odPayroll
  const total6xx = sumAllSixxx(accountSums, fromMonth, toMonth)
  const externalCosts = Math.max(0, total6xx - cogs - payrollFromAccounts)

  const grossMargin = revenue - cogs
  const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0
  const ebitda = grossMargin - payroll - externalCosts
  const ebitdaPct = revenue > 0 ? (ebitda / revenue) * 100 : 0

  return {
    revenue,
    invoicedUnpaid,
    cogs,
    grossMargin,
    grossMarginPct,
    payroll,
    odPayroll,
    externalCosts,
    ebitda,
    ebitdaPct,
  }
}

// --- computeMonthly ---
export function computeMonthly(
  invoices: Invoice[],
  accountSums: Map<string, Map<string, number>>,
  odPayrollByMonth: Map<string, number>,
  fiscalStart: Date
): MonthlyPoint[] {
  const points: MonthlyPoint[] = []
  let cumRevenue = 0
  let cumGrossMargin = 0

  for (let i = 0; i < 12; i++) {
    const monthDate = addMonths(fiscalStart, i)
    const monthKey = format(monthDate, 'yyyy-MM')
    const label = format(monthDate, 'MMM yy', { locale: fr })

    // Revenue for this month
    const monthInvoices = invoices.filter((inv) => inv.date.startsWith(monthKey))
    const revenue = monthInvoices.reduce((s, inv) => s + inv.amountHT, 0)

    // Expenses for this month
    const monthSums = accountSums.get(monthKey) ?? new Map<string, number>()

    let cogsTotal = 0
    let payrollFromAccounts = 0
    let total6xx = 0

    for (const [prefix, amount] of Array.from(monthSums.entries())) {
      total6xx += amount
      if (COGS_PREFIXES.some((p) => prefix.startsWith(p) || p.startsWith(prefix))) {
        cogsTotal += amount
      } else if (PAYROLL_PREFIXES.some((p) => prefix.startsWith(p) || p.startsWith(prefix))) {
        payrollFromAccounts += amount
      }
    }

    const odPayroll = odPayrollByMonth.get(monthKey) ?? 0
    const payroll = payrollFromAccounts + odPayroll
    const externalCosts = Math.max(0, total6xx - cogsTotal - payrollFromAccounts)
    const grossMargin = revenue - cogsTotal
    const ebe = grossMargin - payroll - externalCosts

    cumRevenue += revenue
    cumGrossMargin += grossMargin

    points.push({
      month: monthKey,
      label,
      revenue,
      cogs: cogsTotal,
      grossMargin,
      payroll,
      externalCosts,
      ebe,
      cumRevenue,
      cumGrossMargin,
    })
  }

  return points
}

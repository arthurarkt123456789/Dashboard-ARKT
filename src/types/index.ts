// --- Pennylane raw types (v2 actual format) ---

export interface PLCustomerInvoice {
  id: number
  invoice_number: string
  label: string
  date: string           // YYYY-MM-DD
  deadline: string
  currency_amount_before_tax: string  // HT as string
  currency_amount: string             // TTC as string
  paid: boolean
  remaining_amount_without_tax: string
  status: string
  customer: { id: number; url: string }
}

export interface PLSupplierInvoice {
  id: number
  invoice_number?: string
  label: string
  date: string
  deadline: string
  currency_amount_before_tax: string
  currency_amount: string
  paid: boolean
  remaining_amount_without_tax: string
  status: string
  supplier?: { id: number; url: string }
}

// Extracts customer name from Pennylane label
// "Facture REMO FRANCE - F-2026-62 (label généré)" → "REMO FRANCE"
export function extractClientName(label: string): string {
  return label
    .replace(/ \(label généré\)/i, '')
    .replace(/^(Facture|Avoir) /i, '')
    .replace(/ - [A-Z0-9-]+$/, '')
    .trim()
}

// --- Processed/computed types ---

export interface MonthlyRevenue {
  month: string
  label: string
  revenue: number
  bartPucci: number
  directCosts: number
  grossMargin: number
  grossMarginPct: number
  cumRevenue: number
  cumBartPucci: number
  cumGrossMargin: number
  prevYearRevenue: number
  prevYearBartPucci: number
  prevYearGrossMargin: number
  prevYearCumRevenue: number
  prevYearCumBartPucci: number
  prevYearCumGrossMargin: number
}

export interface FiscalYearSummary {
  year: string
  startDate: string
  endDate: string
  totalRevenue: number
  totalBartPucci: number
  bartPucciPct: number
  totalDirectCosts: number
  totalGrossMargin: number
  grossMarginPct: number
  theoreticalRevenue: number
  theoreticalGrossMargin: number
  theoreticalGrossMarginPct: number
  prevYearRevenue: number
  prevYearBartPucci: number
  prevYearBartPucciPct: number
  prevYearGrossMargin: number
  revenueGrowthPct: number
  marginGrowthPct: number
  bartPucciGrowthPct: number
}

export interface RunRateProjection {
  ytdRevenue: number
  invoicedUnpaid: number
  confirmedRecurring: number
  pipeline: number
  total: number
  prevYearTotal: number
  variance: number
  variancePct: number
  monthsRemaining: number
}

export interface PipelineEntry {
  id: number
  clientName: string
  description?: string | null
  amount: number
  expectedDate?: string | null
  isRecurring: boolean
  frequency?: string | null
  isDuplicate: boolean
  createdAt: string
  updatedAt: string
}

export interface ExpenseSummary {
  totalPayroll: number
  totalDirectCosts: number
  totalExternalCosts: number
  totalExpenses: number
  monthlyPayroll: number[]
  monthlyDirectCosts: number[]
  monthlyExternalCosts: number[]
}

export interface CashFlowMonth {
  month: string
  label: string
  isHistorical: boolean
  revenue: number
  collected: number
  payroll: number
  directCosts: number
  externalCosts: number
  totalOut: number
  netFlow: number
  cumulativeCash: number
  canPayStartOfMonth: boolean
  canPayEndOfMonth: boolean
}

export interface HealthStatus {
  commercial: 'green' | 'yellow' | 'red'
  financial: 'green' | 'yellow' | 'red'
  danger: 'green' | 'yellow' | 'red'
  revenueGrowthPct: number
  grossMarginPct: number
  runwayMonths: number
  runwayWithSigned: number
  runwayWithPipeline: number
}

export interface DashboardData {
  monthly: MonthlyRevenue[]
  fiscal: FiscalYearSummary
  runRate: RunRateProjection
  expenses: ExpenseSummary
  cashFlow: CashFlowMonth[]
  health: HealthStatus
  unpaidInvoices: PLCustomerInvoice[]
  pipeline: PipelineEntry[]
  settings: AppSettings
  pennylaneError?: string | null
}

export interface AppSettings {
  payrollMonthly: number
  currentBankBalance: number
  bartPucciNames: string[]
  directCostKeywords: string[]
  payrollKeywords: string[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  payrollMonthly: 0,
  currentBankBalance: 0,
  bartPucciNames: ['bart', 'pucci', 'bart & pucci', 'bart&pucci'],
  directCostKeywords: ['sous-traitance', 'prestation', 'achat refact', 'mission'],
  payrollKeywords: ['salaire', 'paie', 'fiche de paie', 'bulletin', 'rémunération'],
}

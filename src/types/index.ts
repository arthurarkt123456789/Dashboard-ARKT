// --- Pennylane raw types ---

export interface PLCustomerInvoice {
  id: number
  invoice_number: string
  issue_date: string
  deadline: string
  customer_name: string
  amount_eur: number
  amount_eur_excl_taxes: number
  is_paid: boolean
  outstanding_balance: number
  status: string
}

export interface PLSupplierInvoice {
  id: number
  issue_date: string
  deadline: string
  supplier_name: string
  amount_eur: number
  amount_eur_excl_taxes: number
  is_paid: boolean
  label?: string
  category?: string
}

export interface PLInvoiceLine {
  id: number
  label: string
  currency_amount: number
  currency_tax: number
  margin?: number
}

// --- Processed/computed types ---

export interface MonthlyRevenue {
  month: string // YYYY-MM
  label: string // "Oct 24"
  revenue: number
  bartPucci: number
  directCosts: number
  grossMargin: number
  grossMarginPct: number
  cumRevenue: number
  cumBartPucci: number
  cumGrossMargin: number
  prevYearRevenue: number
  prevYearGrossMargin: number
  prevYearCumRevenue: number
  prevYearCumGrossMargin: number
}

export interface FiscalYearSummary {
  year: string // e.g. "2024-2025"
  startDate: string
  endDate: string
  totalRevenue: number
  totalBartPucci: number
  bartPucciPct: number
  totalDirectCosts: number
  totalGrossMargin: number
  grossMarginPct: number
  prevYearRevenue: number
  prevYearGrossMargin: number
  revenueGrowthPct: number
  marginGrowthPct: number
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
  month: string // YYYY-MM
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

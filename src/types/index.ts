import type { Invoice, PnLResult, MonthlyPoint } from '@/lib/pnl'

export type { Invoice, PnLResult, MonthlyPoint }

export interface PipelineEntryUI {
  id: number
  clientName: string
  description?: string | null
  amount: number
  expectedDate?: string | null
  isRecurring: boolean
  frequency?: string | null
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  payrollMonthly: number
  currentBankBalance: number
  bartPucciNames: string[]
  cogsAccountPrefixes: string[]
  payrollAccountPrefixes: string[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  payrollMonthly: 0,
  currentBankBalance: 0,
  bartPucciNames: ['bart', 'pucci', 'bart & pucci', 'bart&pucci'],
  cogsAccountPrefixes: ['60', '601', '604', '607', '611', '612', '621'],
  payrollAccountPrefixes: ['641', '642', '644', '645', '646', '647', '648'],
}

export interface DashboardData {
  current: PnLResult
  prevYtd: PnLResult
  prevFull: PnLResult
  monthly: MonthlyPoint[]
  prevMonthly: MonthlyPoint[]
  runRate: {
    ytd: number
    unpaid: number
    pipeline: number
    total: number
    prevFullRevenue: number
  }
  pipeline: PipelineEntryUI[]
  settings: AppSettings
}

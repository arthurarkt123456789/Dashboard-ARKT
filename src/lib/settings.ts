import { prisma } from './prisma'
import { AppSettings, DEFAULT_SETTINGS } from '@/types'

export async function getSettings(): Promise<AppSettings> {
  try {
    const rows = await prisma.setting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

    return {
      payrollMonthly: parseFloat(map.payrollMonthly ?? '0') || 0,
      currentBankBalance: parseFloat(map.currentBankBalance ?? '0') || 0,
      bartPucciNames: map.bartPucciNames ? JSON.parse(map.bartPucciNames) : DEFAULT_SETTINGS.bartPucciNames,
      directCostKeywords: map.directCostKeywords ? JSON.parse(map.directCostKeywords) : DEFAULT_SETTINGS.directCostKeywords,
      payrollKeywords: map.payrollKeywords ? JSON.parse(map.payrollKeywords) : DEFAULT_SETTINGS.payrollKeywords,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

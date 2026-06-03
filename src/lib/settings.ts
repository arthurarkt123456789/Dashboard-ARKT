import { prisma } from './prisma'
import { AppSettings, DEFAULT_SETTINGS } from '@/types'

export async function getSettings(): Promise<AppSettings> {
  try {
    const rows = await prisma.setting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return {
      payrollMonthly: parseFloat(map.payrollMonthly ?? '0') || 0,
      currentBankBalance: parseFloat(map.currentBankBalance ?? '0') || 0,
      bartPucciNames: map.bartPucciNames
        ? JSON.parse(map.bartPucciNames)
        : DEFAULT_SETTINGS.bartPucciNames,
      cogsAccountPrefixes: map.cogsAccountPrefixes
        ? JSON.parse(map.cogsAccountPrefixes)
        : DEFAULT_SETTINGS.cogsAccountPrefixes,
      payrollAccountPrefixes: map.payrollAccountPrefixes
        ? JSON.parse(map.payrollAccountPrefixes)
        : DEFAULT_SETTINGS.payrollAccountPrefixes,
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

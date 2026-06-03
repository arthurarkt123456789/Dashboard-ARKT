export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSupplierInvoices } from '@/lib/pennylane'
import { extractClientName } from '@/types'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true, error: 'no api key' })

  // 1. Check DB cache content for prev year invoices
  const cachedCount = await prisma.ledgerEntryCache.count()
  const cogs60x = await prisma.ledgerEntryCache.findMany({
    where: { accountCode: { startsWith: '60' } },
  })
  const payrollCodes = await prisma.ledgerEntryCache.findMany({
    where: { accountCode: { startsWith: '64' } },
  })

  // 2. Fetch prev year supplier invoices and cross-reference with cache
  const prevExpenses = await fetchSupplierInvoices('2024-10-01', '2025-09-30')
  const prevIds = new Set(prevExpenses.map((e) => BigInt(e.id)))

  const prevCached = await prisma.ledgerEntryCache.findMany({
    where: { invoiceId: { in: Array.from(prevIds) } },
  })

  // Distribution of account codes for N-1 expenses
  const codeDist: Record<string, number> = {}
  for (const row of prevCached) {
    const code = row.accountCode ?? 'null'
    const prefix = code.slice(0, 3)
    codeDist[prefix] = (codeDist[prefix] ?? 0) + 1
  }

  // Total COGS (60x) amount for prev year
  const cogs60xIds = new Set(cogs60x.map((r) => Number(r.invoiceId)))
  const cogs60xExpenses = prevExpenses.filter((e) => cogs60xIds.has(e.id))
  const total60xHT = cogs60xExpenses.reduce((s, e) => s + (parseFloat(e.currency_amount_before_tax) || 0), 0)

  // List top COGS invoices
  const cogsList = cogs60xExpenses
    .map((e) => ({
      supplier: extractClientName(e.label),
      code: cogs60x.find((r) => Number(r.invoiceId) === e.id)?.accountCode,
      amount: parseFloat(e.currency_amount_before_tax) || 0,
      status: e.accounting_status,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15)

  // How many prev year invoices have no account code in cache?
  const uncategorizedCount = prevExpenses.filter(
    (e) => !prevCached.find((r) => Number(r.invoiceId) === e.id)
  ).length

  return NextResponse.json({
    ok: true,
    db_cache_total: cachedCount,
    prev_year_expenses: prevExpenses.length,
    prev_year_in_cache: prevCached.length,
    prev_year_uncategorized: uncategorizedCount,
    account_code_distribution: codeDist,
    total_60x_cogs_ht: Math.round(total60xHT),
    cogs_invoices: cogsList,
    payroll_codes_in_cache: payrollCodes.length,
  })
}

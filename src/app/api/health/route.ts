export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchSupplierInvoices, fetchLedgerEntries } from '@/lib/pennylane'
import { extractClientName } from '@/types'

export async function GET() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true })

  // Fetch prev FY supplier invoices (Oct 2024 - Sep 2025)
  const prevExpenses = await fetchSupplierInvoices('2024-10-01', '2025-09-30')

  // Status distribution
  const statuses: Record<string, number> = {}
  for (const e of prevExpenses) statuses[e.accounting_status] = (statuses[e.accounting_status] ?? 0) + 1

  // Fetch ledger entries (now includes 'entry' status)
  const categoryMap = await fetchLedgerEntries(prevExpenses).catch(() => new Map())

  // Account code distribution
  const codeDist: Record<string, { count: number; total: number }> = {}
  for (const e of prevExpenses) {
    const code = categoryMap.get(e.id) ?? 'null'
    const ht = parseFloat(e.currency_amount_before_tax) || 0
    if (!codeDist[code]) codeDist[code] = { count: 0, total: 0 }
    codeDist[code].count++
    codeDist[code].total += ht
  }

  // Specifically check 60x invoices
  const cogs60x = prevExpenses
    .filter((e) => {
      const code = categoryMap.get(e.id)
      return code && code.startsWith('60')
    })
    .map((e) => ({ supplier: extractClientName(e.label), code: categoryMap.get(e.id), amount: parseFloat(e.currency_amount_before_tax) || 0, status: e.accounting_status }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    ok: true,
    prev_fy_expense_count: prevExpenses.length,
    status_distribution: statuses,
    category_map_size: categoryMap.size,
    account_code_distribution: codeDist,
    cogs_60x_invoices: cogs60x.slice(0, 20),
    total_60x_ht: cogs60x.reduce((s, e) => s + e.amount, 0),
  })
}

export const dynamic = 'force-dynamic'

// Endpoint to force-fetch ledger entries for ALL supplier invoices
// including validation_needed ones — tries to get any partial data
import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchSupplierInvoices, extractAccountCode } from '@/lib/pennylane'

export async function POST() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  // Get all supplier invoices (both years)
  const [current, prev] = await Promise.all([
    fetchSupplierInvoices('2025-10-01', '2026-09-30'),
    fetchSupplierInvoices('2024-10-01', '2025-09-30'),
  ])

  const all = [...current, ...prev]

  // Find invoices NOT yet in cache
  const cachedIds = await prisma.ledgerEntryCache.findMany({
    select: { invoiceId: true },
    where: { invoiceId: { in: all.map((e) => BigInt(e.id)) } },
  })
  const cachedSet = new Set(cachedIds.map((r) => Number(r.invoiceId)))
  const missing = all.filter((e) => !cachedSet.has(e.id))

  let fetched = 0
  let errors = 0
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  // Fetch in batches of 5
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5)
    await Promise.allSettled(
      batch.map(async (inv) => {
        try {
          const r = await fetch(
            `https://app.pennylane.com/api/external/v2/ledger_entries/${inv.id}`,
            { headers }
          )
          const data = await r.json()
          const code = extractAccountCode(data.ledger_entry_lines ?? [])
          await prisma.ledgerEntryCache.upsert({
            where: { invoiceId: BigInt(inv.id) },
            update: { accountCode: code, fetchedAt: new Date() },
            create: { invoiceId: BigInt(inv.id), accountCode: code },
          })
          fetched++
        } catch {
          errors++
        }
      })
    )
    await new Promise((r) => setTimeout(r, 300))
  }

  return NextResponse.json({
    ok: true,
    total: all.length,
    already_cached: cachedSet.size,
    newly_fetched: fetched,
    errors,
  })
}

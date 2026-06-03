export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const entries = await prisma.pipelineMonthEntry.findMany()
  const clients = Array.from(new Set(entries.map((e) => e.clientName))).sort()
  return NextResponse.json({
    clients,
    entries: entries.map((e) => ({ clientName: e.clientName, month: e.month, amount: e.amount })),
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()

  if (body.action === 'add_client') {
    // Just return ok — client will be created when first cell is added
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'delete_client') {
    await prisma.pipelineMonthEntry.deleteMany({ where: { clientName: body.clientName } })
    return NextResponse.json({ ok: true })
  }

  // Default: upsert a cell value
  const { clientName, month, amount } = body
  if (Number(amount) === 0) {
    await prisma.pipelineMonthEntry.deleteMany({ where: { clientName, month } })
  } else {
    await prisma.pipelineMonthEntry.upsert({
      where: { clientName_month: { clientName, month } },
      update: { amount: parseFloat(amount) },
      create: { clientName, month, amount: parseFloat(amount) },
    })
  }
  return NextResponse.json({ ok: true })
}

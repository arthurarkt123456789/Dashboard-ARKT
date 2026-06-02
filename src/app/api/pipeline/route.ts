import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const entries = await prisma.pipelineEntry.findMany({ orderBy: { expectedDate: 'asc' } })
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()
  const entry = await prisma.pipelineEntry.create({
    data: {
      clientName: body.clientName,
      description: body.description ?? null,
      amount: parseFloat(body.amount),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      isRecurring: body.isRecurring ?? false,
      frequency: body.frequency ?? null,
    },
  })
  return NextResponse.json(entry, { status: 201 })
}

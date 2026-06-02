import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const id = parseInt(params.id)
  const body = await req.json()
  const entry = await prisma.pipelineEntry.update({
    where: { id },
    data: {
      clientName: body.clientName,
      description: body.description ?? null,
      amount: parseFloat(body.amount),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      isRecurring: body.isRecurring ?? false,
      frequency: body.frequency ?? null,
    },
  })
  return NextResponse.json(entry)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const id = parseInt(params.id)
  await prisma.pipelineEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

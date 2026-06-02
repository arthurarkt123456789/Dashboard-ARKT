export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSettings, saveSetting } from '@/lib/settings'

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  return NextResponse.json(await getSettings())
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()
  for (const [key, value] of Object.entries(body)) {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value)
    await saveSetting(key, serialized)
  }
  return NextResponse.json({ ok: true })
}

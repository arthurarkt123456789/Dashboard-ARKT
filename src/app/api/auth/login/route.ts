import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const ok = await verifyPassword(password)
  if (!ok) return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  await createSession()
  return NextResponse.json({ ok: true })
}

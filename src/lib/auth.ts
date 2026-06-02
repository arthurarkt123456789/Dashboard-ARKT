import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const SESSION_COOKIE = 'arkt-session'
const SESSION_VALUE = 'authenticated'

export async function verifyPassword(input: string): Promise<boolean> {
  const hash = process.env.DASHBOARD_PASSWORD_HASH
  const plain = process.env.DASHBOARD_PASSWORD

  if (hash) return bcrypt.compare(input, hash)
  if (plain) return input === plain
  return false
}

export async function createSession() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value === SESSION_VALUE
}

'use server'

import { eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { adminDb } from '@/db/admin'
import { users } from '@/db/schema'
import type { ActionState } from '@/components/admin/ActionForm'
import { decryptText, encryptText } from '@/lib/crypto'
import { hashPassword, passwordProblems, verifyPassword } from '@/lib/passwords'
import { verifyTotp } from '@/lib/totp'
import { audit } from '@/server/admin/audit'
import { completeMfa, endOtherSessions, endSession, getSession, requireSignedIn, startPendingSession } from '@/server/admin/session'
import { clientIp } from '@/server/shared/request'
import { rateLimit } from '@/server/shared/ratelimit'

const MAX_FAILURES = 5
const LOCK_MINUTES = 15
let dummyHash: Promise<string> | null = null

async function registerFailure(userId: string, failures: number) {
  const lock = failures + 1 >= MAX_FAILURES
  await adminDb()
    .update(users)
    .set(lock ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedAttempts: failures + 1 })
    .where(eq(users.id, userId))
  await audit(null, userId, lock ? 'auth.locked' : 'auth.failed', 'user', userId)
}

const GENERIC = 'Email or password is incorrect.'

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const password = String(fd.get('password') ?? '')
  const ip = await clientIp()
  if (!(await rateLimit('login', ip, 30, 900)).ok) return { error: 'Too many sign-in attempts from this connection. Wait 15 minutes.' }

  const [user] = await adminDb().select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
  // Always spend the same work, so response time does not reveal which emails exist.
  dummyHash ??= hashPassword('not-a-real-password')
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await dummyHash), false)
  if (!user || !user.active) return { error: GENERIC }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: `This account is locked after repeated failures. Try again after ${LOCK_MINUTES} minutes.` }
  }
  if (!ok) {
    await registerFailure(user.id, user.failedAttempts)
    return { error: GENERIC }
  }
  await adminDb().update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id))
  await startPendingSession(user.id)
  redirect(user.totpEnabledAt ? '/admin/login/verify' : '/admin/login/enroll')
}

async function pendingUser() {
  const s = await getSession()
  if (!s) redirect('/admin/login')
  if (s.mfaVerified) redirect('/admin')
  const [user] = await adminDb().select().from(users).where(eq(users.id, s.user.id))
  if (!user) redirect('/admin/login')
  return { session: s, user }
}

export async function verifyCode(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { session, user } = await pendingUser()
  if (!user.totpSecretEnc) redirect('/admin/login/enroll')
  if (!(await rateLimit('totp', user.id, 10, 600)).ok) return { error: 'Too many codes tried. Wait 10 minutes.' }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: 'This account is temporarily locked.' }
  const secret = decryptText(user.totpSecretEnc, 'APP_ENCRYPTION_KEY', `totp:${user.id}`)
  const step = verifyTotp(secret, String(fd.get('code') ?? ''), { lastStep: user.totpLastStep })
  if (step === null) {
    await registerFailure(user.id, user.failedAttempts)
    return { error: 'That code is not valid. Use the current 6-digit code from your authenticator app.' }
  }
  await adminDb().update(users).set({ totpLastStep: step, failedAttempts: 0 }).where(eq(users.id, user.id))
  await completeMfa(session)
  await audit(null, user.id, 'auth.login', 'user', user.id)
  redirect('/admin')
}

export async function enroll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { session, user } = await pendingUser()
  if (user.totpEnabledAt) redirect('/admin/login/verify')
  if (!user.totpPendingSecretEnc) return { error: 'Reload the page to get a new setup code.' }
  if (!(await rateLimit('totp', user.id, 10, 600)).ok) return { error: 'Too many codes tried. Wait 10 minutes.' }
  const secret = decryptText(user.totpPendingSecretEnc, 'APP_ENCRYPTION_KEY', `totp-pending:${user.id}`)
  const step = verifyTotp(secret, String(fd.get('code') ?? ''))
  if (step === null) return { error: 'That code does not match. Check the time on your phone and try the current code.' }
  await adminDb()
    .update(users)
    .set({
      totpSecretEnc: encryptText(secret, 'APP_ENCRYPTION_KEY', `totp:${user.id}`),
      totpPendingSecretEnc: null,
      totpEnabledAt: new Date(),
      totpLastStep: step,
    })
    .where(eq(users.id, user.id))
  await completeMfa(session)
  await audit(null, user.id, 'auth.totp_enrolled', 'user', user.id)
  redirect(user.mustChangePassword ? '/admin/account/password' : '/admin')
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireSignedIn()
  const s = await getSession()
  const current = String(fd.get('current') ?? '')
  const next = String(fd.get('next') ?? '')
  const confirm = String(fd.get('confirm') ?? '')
  const [user] = await adminDb().select().from(users).where(eq(users.id, me.id))
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: 'Your current password is not correct.' }
  if (next !== confirm) return { error: 'The new passwords do not match.' }
  const problems = passwordProblems(next, user.email)
  if (problems.length) return { error: problems.join(' ') }
  if (next === current) return { error: 'Choose a password you have not used here before.' }
  await adminDb().update(users).set({ passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, me.id))
  if (s) await endOtherSessions(me.id, s.id)
  await audit(null, me.id, 'auth.password_changed', 'user', me.id)
  redirect('/admin')
}

export async function logout() {
  const s = await getSession()
  await endSession()
  if (s) await audit(null, s.user.id, 'auth.logout', 'user', s.user.id)
  redirect('/admin/login')
}

/**
 * Admin sessions. Password first, then a TOTP code: a session is usable only
 * after the second factor. Sessions expire 12 hours after sign-in, always.
 */
import 'server-only'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminDb } from '@/db/admin'
import { sessions, users, type User } from '@/db/schema'
import type { UserRole } from '@/db/enums'
import { randomToken, sha256Hex } from '@/lib/crypto'
import { atLeast } from './permissions'

export const SESSION_HOURS = 12
const PENDING_MINUTES = 10
const secure = process.env.NODE_ENV === 'production'
export const SESSION_COOKIE = secure ? '__Host-record_session' : 'record_session'

export type SessionUser = Pick<User, 'id' | 'email' | 'displayName' | 'role' | 'mustChangePassword' | 'totpEnabledAt'>
export type Session = { id: string; user: SessionUser; mfaVerified: boolean; expiresAt: Date }

async function setCookie(token: string, expiresAt: Date) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', expires: expiresAt })
}

/** Start a session after the password check. It must pass TOTP within 10 minutes. */
export async function startPendingSession(userId: string) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + PENDING_MINUTES * 60_000)
  await adminDb().insert(sessions).values({ id: sha256Hex(token), userId, expiresAt })
  await setCookie(token, expiresAt)
}

/** Second factor passed: replace the pending session with a fresh, full one. */
export async function completeMfa(pending: Session) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000)
  await adminDb().transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.id, pending.id))
    await tx.insert(sessions).values({ id: sha256Hex(token), userId: pending.user.id, expiresAt, mfaVerifiedAt: new Date() })
    await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, pending.user.id))
  })
  await setCookie(token, expiresAt)
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const id = sha256Hex(token)
  const rows = await adminDb()
    .select({
      id: sessions.id,
      expiresAt: sessions.expiresAt,
      mfaVerifiedAt: sessions.mfaVerifiedAt,
      lastSeenAt: sessions.lastSeenAt,
      user: {
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        mustChangePassword: users.mustChangePassword,
        totpEnabledAt: users.totpEnabledAt,
        active: users.active,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1)
  const row = rows[0]
  if (!row || !row.user.active) return null
  if (Date.now() - row.lastSeenAt.getTime() > 5 * 60_000) {
    await adminDb().update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id))
  }
  const { active: _active, ...user } = row.user
  return { id: row.id, user, mfaVerified: row.mfaVerifiedAt !== null, expiresAt: row.expiresAt }
}

/** For admin pages and actions: a fully signed-in user with at least `min` role. */
export async function requireUser(min: UserRole = 'contributor'): Promise<SessionUser> {
  const s = await getSession()
  if (!s) redirect('/admin/login')
  if (!s.mfaVerified) redirect(s.user.totpEnabledAt ? '/admin/login/verify' : '/admin/login/enroll')
  if (s.user.mustChangePassword) redirect('/admin/account/password')
  if (!atLeast(s.user.role, min)) redirect('/admin?denied=1')
  return s.user
}

/** Like requireUser, but allows a user who still has to change their password. */
export async function requireSignedIn(): Promise<SessionUser> {
  const s = await getSession()
  if (!s) redirect('/admin/login')
  if (!s.mfaVerified) redirect(s.user.totpEnabledAt ? '/admin/login/verify' : '/admin/login/enroll')
  return s.user
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await adminDb().delete(sessions).where(eq(sessions.id, sha256Hex(token)))
  jar.delete(SESSION_COOKIE)
}

export async function endOtherSessions(userId: string, keepId: string) {
  await adminDb().delete(sessions).where(and(eq(sessions.userId, userId), sql`${sessions.id} <> ${keepId}`))
}

export async function purgeExpiredSessions() {
  await adminDb().delete(sessions).where(lt(sessions.expiresAt, new Date()))
}

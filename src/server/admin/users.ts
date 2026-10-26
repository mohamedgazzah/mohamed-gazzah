import 'server-only'
import { asc, eq, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { sessions, users } from '@/db/schema'
import { USER_ROLES, type UserRole } from '@/db/enums'
import { hashPassword, temporaryPassword } from '@/lib/passwords'
import { audit } from './audit'
import { WorkflowError } from './incidents'
import { can } from './permissions'
import type { SessionUser } from './session'

function assertAdmin(user: SessionUser) {
  if (!can.manageUsers(user.role)) throw new WorkflowError('Only admins can manage users.')
}

export async function listUsers() {
  return adminDb()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      active: users.active,
      totpEnabledAt: users.totpEnabledAt,
      lastLoginAt: users.lastLoginAt,
      lockedUntil: users.lockedUntil,
      isDemo: users.isDemo,
    })
    .from(users)
    .orderBy(asc(users.displayName))
}

/** Creates the account and returns a temporary password to hand over once. */
export async function createUser(admin: SessionUser, input: { email: string; displayName: string; role: UserRole }) {
  assertAdmin(admin)
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkflowError('Enter a valid email address.')
  if (!input.displayName.trim()) throw new WorkflowError('Enter a display name.')
  if (!USER_ROLES.includes(input.role)) throw new WorkflowError('Choose a role.')
  const [dupe] = await adminDb().select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`)
  if (dupe) throw new WorkflowError('An account with this email already exists.')
  const password = temporaryPassword()
  const [row] = await adminDb()
    .insert(users)
    .values({ email, displayName: input.displayName.trim(), role: input.role, passwordHash: await hashPassword(password), mustChangePassword: true })
    .returning({ id: users.id })
  await audit(null, admin.id, 'user.create', 'user', row!.id, { role: input.role })
  return { id: row!.id, password }
}

export async function updateUser(admin: SessionUser, id: string, action: 'role' | 'deactivate' | 'activate' | 'reset_2fa' | 'reset_password', role?: UserRole) {
  assertAdmin(admin)
  if (id === admin.id && action !== 'reset_password') throw new WorkflowError('Ask another admin to change your own role, status or two-factor setup.')
  const db = adminDb()
  let password: string | null = null
  if (action === 'role') {
    if (!role || !USER_ROLES.includes(role)) throw new WorkflowError('Choose a role.')
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id))
  } else if (action === 'deactivate' || action === 'activate') {
    await db.update(users).set({ active: action === 'activate', updatedAt: new Date() }).where(eq(users.id, id))
  } else if (action === 'reset_2fa') {
    await db.update(users).set({ totpSecretEnc: null, totpPendingSecretEnc: null, totpEnabledAt: null, totpLastStep: null, updatedAt: new Date() }).where(eq(users.id, id))
  } else {
    password = temporaryPassword()
    await db.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: true, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, id))
  }
  // Any security change signs the person out everywhere.
  if (action !== 'role' && action !== 'activate') await db.delete(sessions).where(eq(sessions.userId, id))
  await audit(null, admin.id, `user.${action}`, 'user', id, role ? { role } : {})
  return { password }
}

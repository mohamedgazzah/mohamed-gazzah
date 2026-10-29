/**
 * First-run setup: creates the first admin from the browser, so a new
 * deployment needs no terminal. Open only while ADMIN_SETUP_TOKEN is set and
 * no account exists; the person then has to enroll two-factor authentication
 * before reaching anything else. Later accounts are created under Users.
 */
import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { adminDb } from '@/db/admin'
import { auditLog, users } from '@/db/schema'
import { hashPassword, passwordProblems } from '@/lib/passwords'
import { WorkflowError } from './incidents'

export const SETUP_TOKEN_MIN_LENGTH = 32

function configuredToken(): string | null {
  const token = process.env.ADMIN_SETUP_TOKEN ?? ''
  return token.length >= SETUP_TOKEN_MIN_LENGTH ? token : null
}

async function anyAccount(db: Pick<NodePgDatabase, 'execute'>): Promise<boolean> {
  const res = await db.execute<{ found: boolean }>(sql`select exists (select 1 from record.users) as found`)
  return res.rows[0]!.found
}

export async function setupOpen(db: NodePgDatabase = adminDb()): Promise<boolean> {
  return configuredToken() !== null && !(await anyAccount(db))
}

export function setupTokenMatches(given: string): boolean {
  const expected = configuredToken()
  if (!expected) return false
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(given), digest(expected))
}

export async function createFirstAdmin(
  input: { email: string; displayName: string; password: string },
  db: NodePgDatabase = adminDb(),
): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkflowError('Enter a valid email address.')
  if (!displayName) throw new WorkflowError('Enter your name.')
  const problems = passwordProblems(input.password, email)
  if (problems.length) throw new WorkflowError(problems.join(' '))
  const passwordHash = await hashPassword(input.password)

  return db.transaction(async (tx) => {
    // One setup at a time, and only while there are no accounts at all.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('record.first_admin'))`)
    if (await anyAccount(tx)) throw new WorkflowError('Setup is already complete. Sign in instead.')
    const [row] = await tx
      .insert(users)
      .values({ email, displayName, role: 'admin', passwordHash, mustChangePassword: false })
      .returning({ id: users.id })
    await tx.insert(auditLog).values({ actorId: row!.id, action: 'user.setup', entityType: 'user', entityId: row!.id, details: { role: 'admin' } })
    return { id: row!.id }
  })
}

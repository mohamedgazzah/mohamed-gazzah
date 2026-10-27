/**
 * First-run setup: the first admin can be created from the browser only while
 * ADMIN_SETUP_TOKEN is set and no account exists, and only once. Runs against
 * its own empty database, since the shared test database has accounts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { setupDatabase, withClient, withDatabase } from '../../scripts/lib/database'
import { verifyPassword } from '@/lib/passwords'
import { createFirstAdmin, setupOpen, setupTokenMatches } from '@/server/admin/setup'
import { TEST_DB, testUrls } from './test-env'

const DB = `${TEST_DB}_setup`
const urls = {
  migration: withDatabase(testUrls.migration, DB),
  app: withDatabase(testUrls.app, DB),
  public: withDatabase(testUrls.public, DB),
}
const TOKEN = 'setup-token-for-tests-0123456789abcdef'
let pool: pg.Pool
let db: NodePgDatabase

beforeAll(async () => {
  await setupDatabase({ superuserUrl: testUrls.superuser, migrationUrl: urls.migration, appUrl: urls.app, publicUrl: urls.public, allowDemo: false, dropExisting: true })
  pool = new pg.Pool({ connectionString: urls.app, max: 4 })
  db = drizzle(pool)
})

afterAll(async () => {
  delete process.env.ADMIN_SETUP_TOKEN
  await pool?.end()
  await withClient(testUrls.superuser, (c) => c.query(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`))
})

describe('first-run setup', () => {
  it('stays closed without a long enough setup token', async () => {
    delete process.env.ADMIN_SETUP_TOKEN
    expect(await setupOpen(db)).toBe(false)
    expect(setupTokenMatches('')).toBe(false)
    process.env.ADMIN_SETUP_TOKEN = 'too-short'
    expect(await setupOpen(db)).toBe(false)
    expect(setupTokenMatches('too-short')).toBe(false)
  })

  it('creates one admin, once, who must still enroll two-factor authentication', async () => {
    process.env.ADMIN_SETUP_TOKEN = TOKEN
    expect(await setupOpen(db)).toBe(true)
    expect(setupTokenMatches(TOKEN)).toBe(true)
    expect(setupTokenMatches(`${TOKEN}x`)).toBe(false)
    await expect(createFirstAdmin({ email: 'first@example.org', displayName: 'First', password: 'short' }, db)).rejects.toThrow(/at least 12/)
    await expect(createFirstAdmin({ email: 'not-an-email', displayName: 'First', password: 'a long opening passphrase' }, db)).rejects.toThrow(/valid email/)

    // Two people racing the same page: exactly one account is created.
    const attempts = await Promise.allSettled([
      createFirstAdmin({ email: 'First@Example.org', displayName: 'First Admin', password: 'a long opening passphrase' }, db),
      createFirstAdmin({ email: 'second@example.org', displayName: 'Second Admin', password: 'another long passphrase' }, db),
    ])
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1)
    expect(String((attempts.find((a) => a.status === 'rejected') as PromiseRejectedResult).reason)).toMatch(/already complete/)

    const rows = (
      await db.execute<{ email: string; role: string; must_change_password: boolean; totp_enabled_at: Date | null; password_hash: string }>(
        sql`select email, role, must_change_password, totp_enabled_at, password_hash from record.users`,
      )
    ).rows
    expect(rows).toHaveLength(1)
    const [admin] = rows
    expect(['first@example.org', 'second@example.org']).toContain(admin!.email)
    expect(admin).toMatchObject({ role: 'admin', must_change_password: false, totp_enabled_at: null })
    const chosen = admin!.email === 'first@example.org' ? 'a long opening passphrase' : 'another long passphrase'
    expect(await verifyPassword(chosen, admin!.password_hash)).toBe(true)

    const audited = await db.execute(sql`select 1 from record.audit_log where action = 'user.setup'`)
    expect(audited.rows).toHaveLength(1)
    expect(await setupOpen(db)).toBe(false)
    await expect(createFirstAdmin({ email: 'late@example.org', displayName: 'Late', password: 'one more long passphrase' }, db)).rejects.toThrow(/already complete/)
  })
})

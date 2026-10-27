/**
 * Deploy step: db:migrate gives each runtime role the password in its
 * connection string, stored as a SCRAM verifier, and refuses a connection
 * string for any other role.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureLogin, roleOf, scramVerifier, withClient } from '../../scripts/lib/database'
import { testUrls } from './test-env'

const ROLE = 'record_login_test'
const PASSWORD = 'LoginTest0123456789abcdef'
const FAST = { retries: 1, delayMs: 50 }

function urlFor(user: string, password: string) {
  const u = new URL(testUrls.app)
  u.username = user
  u.password = password
  return u.toString()
}

const asSuperuser = (q: string) => withClient(testUrls.superuser, (c) => c.query(q))

beforeAll(() => asSuperuser(`DROP ROLE IF EXISTS ${ROLE}`))
afterAll(() => asSuperuser(`DROP ROLE IF EXISTS ${ROLE}`))

describe('runtime role sign-in', () => {
  it('reads the role from plain and Supabase-pooler connection strings', () => {
    expect(roleOf('postgres://record_app:pw@localhost:5432/db')).toBe('record_app')
    expect(roleOf('postgresql://record_public.abcdefghij:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres')).toBe('record_public')
  })

  it('builds verifiers that never contain the password', () => {
    const v = scramVerifier('correct horse battery staple')
    expect(v).toMatch(/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
    expect(v).not.toContain('horse')
    expect(scramVerifier('same')).not.toBe(scramVerifier('same'))
  })

  it('sets the password from the connection string when the role cannot sign in, then leaves it alone', async () => {
    await withClient(testUrls.migration, (c) => c.query(`CREATE ROLE ${ROLE} NOLOGIN`))
    expect(await ensureLogin(testUrls.migration, urlFor(ROLE, PASSWORD), ROLE, FAST)).toBe('password_set')
    expect(await ensureLogin(testUrls.migration, urlFor(ROLE, PASSWORD), ROLE, FAST)).toBe('ok')
    const stored = await withClient(testUrls.superuser, (c) =>
      c.query<{ rolpassword: string; rolcanlogin: boolean }>('SELECT rolpassword, rolcanlogin FROM pg_authid WHERE rolname = $1', [ROLE]),
    )
    expect(stored.rows[0]!.rolcanlogin).toBe(true)
    expect(stored.rows[0]!.rolpassword).toMatch(/^SCRAM-SHA-256\$/)

    // A changed password in the connection string replaces the old one.
    const next = 'NextLoginTest0123456789xyz'
    expect(await ensureLogin(testUrls.migration, urlFor(ROLE, next), ROLE, FAST)).toBe('password_set')
    expect(await ensureLogin(testUrls.migration, urlFor(ROLE, next), ROLE, FAST)).toBe('ok')
  })

  it('refuses another role and short passwords', async () => {
    await expect(ensureLogin(testUrls.migration, testUrls.migration, 'record_app', FAST)).rejects.toThrow(/must use the record_app role/)
    await expect(ensureLogin(testUrls.migration, urlFor(ROLE, 'short'), ROLE, FAST)).rejects.toThrow(/at least 16 characters/)
  })
})

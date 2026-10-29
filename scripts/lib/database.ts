import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { sslOptions as ssl } from '../../src/db/pool'

export type ParsedUrl = { user: string; password: string; database: string; host: string; port: number }

export function parseDbUrl(url: string): ParsedUrl {
  const u = new URL(url)
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    host: u.hostname,
    port: Number(u.port || 5432),
  }
}

export function withDatabase(url: string, database: string): string {
  const u = new URL(url)
  u.pathname = `/${database}`
  return u.toString()
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`

export async function withClient<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const tls = ssl()
  const client = new pg.Client({ connectionString: url, ...(tls ? { ssl: tls } : {}) })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/** Apply every migration in ./drizzle as the schema owner. */
export async function runMigrations(migrationUrl: string) {
  const tls = ssl()
  const pool = new pg.Pool({ connectionString: migrationUrl, max: 1, ...(tls ? { ssl: tls } : {}) })
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') })
  } finally {
    await pool.end()
  }
}

/**
 * A SCRAM-SHA-256 verifier for a password (RFC 7677, as Postgres stores it).
 * ALTER ROLE then never carries the password itself, which statement logs
 * could keep.
 */
export function scramVerifier(password: string, iterations = 4096): string {
  const salt = randomBytes(16)
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  const clientKey = createHmac('sha256', salted).update('Client Key').digest()
  const storedKey = createHash('sha256').update(clientKey).digest()
  const serverKey = createHmac('sha256', salted).update('Server Key').digest()
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`
}

/** The role in a connection string. Supabase's pooler spells it "<role>.<project-ref>". */
export function roleOf(url: string): string {
  return parseDbUrl(url).user.split('.')[0]!
}

async function connectError(url: string): Promise<Error | null> {
  try {
    await withClient(url, (c) => c.query('SELECT 1'))
    return null
  } catch (err) {
    return err as Error
  }
}

/**
 * Make sure a runtime role can sign in with the password in its connection
 * string, so a new deployment needs no SQL step: if it cannot, set that
 * password (as the schema owner) and check again. Refuses a connection string
 * for any other role, so a misconfigured URL can never change, say, the owner.
 */
export async function ensureLogin(migrationUrl: string, url: string, role: string, opts = { retries: 5, delayMs: 2000 }) {
  const found = roleOf(url)
  if (found !== role) throw new Error(`This connection string is for "${found}"; it must use the ${role} role.`)
  if ((await connectError(url)) === null) return 'ok'
  const { password } = parseDbUrl(url)
  if (!/^[\x21-\x7e]{16,}$/.test(password)) {
    throw new Error(`Give ${role} a password of at least 16 characters with no spaces (letters and digits are easiest in a URL).`)
  }
  await withClient(migrationUrl, (c) => c.query(`ALTER ROLE ${ident(role)} WITH LOGIN PASSWORD ${literal(scramVerifier(password))}`))
  let err: Error | null = null
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    // Connection poolers can take a moment to notice a new password.
    if (attempt > 0) await sleep(opts.delayMs)
    err = await connectError(url)
    if (err === null) return 'password_set'
  }
  throw new Error(`Set the password for ${role}, but still cannot connect with its connection string: ${err!.message}`)
}

/**
 * Role settings that live outside the app's schemas, so a schema-only backup
 * does not carry them: access to Supabase's `extensions` schema (PostGIS,
 * pg_trgm) and the runtime roles' search path. Migration 0002 sets them
 * first; repeating it on every deploy also repairs a restored database.
 */
export async function ensureRoleSettings(migrationUrl: string) {
  await withClient(migrationUrl, (c) =>
    c.query(`DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    BEGIN
      GRANT USAGE ON SCHEMA extensions TO record_app, record_public;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Could not grant USAGE on schema extensions; grant it manually (see docs/DEPLOY.md).';
    END;
    ALTER ROLE record_app SET search_path = "$user", public, extensions;
    ALTER ROLE record_public SET search_path = "$user", public, extensions;
  END IF;
END
$$`),
  )
}

/**
 * Local and test setup, run as a Postgres superuser:
 * create the owner role and database, install extensions, run migrations,
 * give the runtime roles their passwords.
 */
export async function setupDatabase(opts: {
  superuserUrl: string
  migrationUrl: string
  appUrl: string
  publicUrl: string
  allowDemo: boolean
  dropExisting?: boolean
}) {
  const owner = parseDbUrl(opts.migrationUrl)
  const app = parseDbUrl(opts.appUrl)
  const pub = parseDbUrl(opts.publicUrl)
  const dbName = owner.database

  await withClient(opts.superuserUrl, async (c) => {
    const role = await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [owner.user])
    if (role.rowCount === 0) {
      await c.query(`CREATE ROLE ${ident(owner.user)} LOGIN CREATEROLE PASSWORD ${literal(owner.password)}`)
    }
    if (opts.dropExisting) {
      await c.query(`DROP DATABASE IF EXISTS ${ident(dbName)} WITH (FORCE)`)
    }
    const db = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if (db.rowCount === 0) {
      await c.query(`CREATE DATABASE ${ident(dbName)} OWNER ${ident(owner.user)}`)
    }
  })

  // Extensions need a superuser locally (on Supabase they are preinstalled).
  await withClient(withDatabase(opts.superuserUrl, dbName), async (c) => {
    await c.query('CREATE EXTENSION IF NOT EXISTS postgis')
    await c.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    if (opts.allowDemo) {
      await c.query(`ALTER DATABASE ${ident(dbName)} SET record.allow_demo = 'on'`)
    } else {
      await c.query(`ALTER DATABASE ${ident(dbName)} RESET record.allow_demo`)
    }
  })

  await runMigrations(opts.migrationUrl)

  await withClient(opts.superuserUrl, async (c) => {
    for (const r of [app, pub]) {
      await c.query(`ALTER ROLE ${ident(r.user)} WITH LOGIN PASSWORD ${literal(r.password)}`)
    }
  })
}

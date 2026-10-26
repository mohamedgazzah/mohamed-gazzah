import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

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

function ssl(): pg.ClientConfig['ssl'] {
  const ca = process.env.DATABASE_CA_CERT
  return ca ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } : undefined
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

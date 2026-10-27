import pg from 'pg'

// Dates stay as 'YYYY-MM-DD' strings: they are calendar dates, not instants.
pg.types.setTypeParser(1082, (v) => v)

type PoolName = 'app' | 'public'

/**
 * TLS for hosted Postgres. Production always uses TLS and verifies the
 * server, so a missing setting fails loudly instead of falling back to an
 * unencrypted connection. Supabase signs its certificates with its own root
 * CA: put that certificate (PEM) in DATABASE_CA_CERT. Providers with publicly
 * trusted certificates need nothing. Local databases connect without TLS
 * unless DATABASE_CA_CERT is set.
 */
export function sslOptions(): pg.PoolConfig['ssl'] {
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n')
  const production = process.env.APP_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (ca) return { ca, rejectUnauthorized: true }
  return production ? { rejectUnauthorized: true } : undefined
}
const globalPools = globalThis as unknown as { __recordPools?: Partial<Record<PoolName, pg.Pool>> }

/** One pool per role per process (reused across dev hot reloads). */
export function getPool(name: PoolName, envVar: 'DATABASE_URL' | 'PUBLIC_DATABASE_URL'): pg.Pool {
  globalPools.__recordPools ??= {}
  const existing = globalPools.__recordPools[name]
  if (existing) return existing
  const connectionString = process.env[envVar]
  if (!connectionString) throw new Error(`${envVar} is not set`)
  const ssl = sslOptions()
  const pool = new pg.Pool({
    connectionString,
    ...(ssl ? { ssl } : {}),
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    application_name: `record-${name}`,
  })
  pool.on('error', (err) => console.error(`[db:${name}] idle client error`, err.message))
  globalPools.__recordPools[name] = pool
  return pool
}

/**
 * Local development database: `npm run db:setup` (add --reset to start over).
 * Uses POSTGRES_SUPERUSER_URL to create roles, the database and extensions,
 * then applies migrations as the owner in MIGRATION_DATABASE_URL.
 */
import { isProductionEnv, loadEnv, requireEnv } from './lib/env'
import { setupDatabase } from './lib/database'

loadEnv()

if (isProductionEnv()) {
  console.error('db:setup is for local development. Use `npm run db:migrate` in production.')
  process.exit(1)
}

await setupDatabase({
  superuserUrl: process.env.POSTGRES_SUPERUSER_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres',
  migrationUrl: requireEnv('MIGRATION_DATABASE_URL'),
  appUrl: requireEnv('DATABASE_URL'),
  publicUrl: requireEnv('PUBLIC_DATABASE_URL'),
  allowDemo: true,
  dropExisting: process.argv.includes('--reset'),
})
console.log('Database ready.')

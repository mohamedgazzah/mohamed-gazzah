/** Apply migrations as the schema owner. Safe to run on every deploy. */
import { loadEnv, requireEnv } from './lib/env'
import { runMigrations } from './lib/database'

loadEnv()
await runMigrations(requireEnv('MIGRATION_DATABASE_URL'))
console.log('Migrations applied.')

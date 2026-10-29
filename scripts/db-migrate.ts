/**
 * Apply migrations as the schema owner, then make sure the two runtime roles
 * have their settings and can sign in with the passwords in DATABASE_URL and
 * PUBLIC_DATABASE_URL (setting them if not). Safe to run on every deploy, and
 * the last step of restoring a backup (docs/DEPLOY.md).
 */
import { loadEnv, requireEnv } from './lib/env'
import { ensureLogin, ensureRoleSettings, runMigrations } from './lib/database'

loadEnv()
const migrationUrl = requireEnv('MIGRATION_DATABASE_URL')
await runMigrations(migrationUrl)
await ensureRoleSettings(migrationUrl)
console.log('Migrations applied.')

for (const [name, role] of [
  ['DATABASE_URL', 'record_app'],
  ['PUBLIC_DATABASE_URL', 'record_public'],
] as const) {
  const url = process.env[name]
  if (!url) {
    console.log(`${name} is not set; skipping the ${role} sign-in check.`)
    continue
  }
  const result = await ensureLogin(migrationUrl, url, role)
  console.log(result === 'ok' ? `${role} can sign in.` : `Set the password for ${role} from ${name}.`)
}

/**
 * Create the first admin (or any user) from the command line:
 *   npm run admin:create -- --email editors@example.org --name "Jane Editor" [--role admin]
 * Prints a temporary password once. At first sign-in the person must set up
 * two-factor authentication and choose a new password.
 */
import { parseArgs } from 'node:util'
import { loadEnv } from './lib/env'

loadEnv()
const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'admin' } } })
if (!values.email || !values.name) {
  console.error('Usage: npm run admin:create -- --email you@example.org --name "Your Name" [--role admin|senior_editor|editor|contributor]')
  process.exit(1)
}
const { sql } = await import('drizzle-orm')
const { adminDb } = await import('@/db/admin')
const { users } = await import('@/db/schema')
const { USER_ROLES } = await import('@/db/enums')
const { hashPassword, temporaryPassword } = await import('@/lib/passwords')
const { audit } = await import('@/server/admin/audit')

const role = values.role as (typeof USER_ROLES)[number]
if (!USER_ROLES.includes(role)) {
  console.error(`Unknown role ${values.role}`)
  process.exit(1)
}
const email = values.email.trim().toLowerCase()
const [existing] = await adminDb().select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`)
if (existing) {
  console.error('A user with that email already exists.')
  process.exit(1)
}
const password = temporaryPassword()
const [row] = await adminDb()
  .insert(users)
  .values({ email, displayName: values.name, role, passwordHash: await hashPassword(password), mustChangePassword: true })
  .returning({ id: users.id })
await audit(null, null, 'user.create_cli', 'user', row!.id, { role })
console.log(`Created ${role} ${email}`)
console.log(`Temporary password (shown once): ${password}`)
console.log('Sign in at /admin/login, set up two-factor authentication, then choose a new password.')
process.exit(0)

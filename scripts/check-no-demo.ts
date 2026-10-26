/**
 * Deploy guard: fails if any DEMO record or demo account exists. Run it in
 * the production deploy pipeline (`npm run check:no-demo`).
 */
import { loadEnv } from './lib/env'

loadEnv()
const { sql } = await import('drizzle-orm')
const { adminDb } = await import('@/db/admin')
const res = await adminDb().execute<{ incidents: number; users: number; cases: number }>(sql`
  select (select count(*) from record.incidents where is_demo)::int as incidents,
         (select count(*) from record.users where is_demo)::int as users,
         (select count(*) from record.cases where is_demo)::int as cases`)
const r = res.rows[0]!
if (r.incidents || r.users || r.cases) {
  console.error(`Demo data found: ${r.incidents} records, ${r.users} accounts, ${r.cases} cases. Never ship demo data to production.`)
  process.exit(1)
}
console.log('No demo data present.')
process.exit(0)

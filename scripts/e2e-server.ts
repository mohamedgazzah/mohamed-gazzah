/**
 * Playwright's web server: a fresh database with the demo seed, a production
 * build in .next-e2e, then `next start`. Run by `npm run test:e2e`.
 */
import { spawn, spawnSync } from 'node:child_process'
import { setupDatabase } from './lib/database'
import { E2E_PORT, e2eEnv } from './lib/e2e-env'

const env = e2eEnv()
await setupDatabase({
  superuserUrl: process.env.POSTGRES_SUPERUSER_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres',
  migrationUrl: env.MIGRATION_DATABASE_URL!,
  appUrl: env.DATABASE_URL!,
  publicUrl: env.PUBLIC_DATABASE_URL!,
  allowDemo: true,
  dropExisting: true,
})

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { env, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('npx', ['tsx', '--conditions=react-server', 'scripts/seed-demo.ts'])
if (!process.env.E2E_SKIP_BUILD) run('npx', ['next', 'build'])
const server = spawn('npx', ['next', 'start', '-p', String(E2E_PORT)], { env, stdio: 'inherit' })
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.kill(sig))
server.on('exit', (code) => process.exit(code ?? 0))

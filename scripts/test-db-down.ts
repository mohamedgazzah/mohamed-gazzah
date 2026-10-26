/**
 * Acceptance: incident pages are statically generated and still load if the
 * database is down.
 *
 * Uses the production build made by `npm run test:e2e` (.next-e2e), and
 * starts it with both database URLs pointing at a port where nothing
 * listens. Prerendered incident pages must still return 200 with their
 * content.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { e2eEnv } from './lib/e2e-env'

const PORT = 3300
const DEAD = 'postgres://nobody:nothing@127.0.0.1:1/nowhere'

if (!existsSync('.next-e2e/prerender-manifest.json')) {
  console.error('No e2e build found. Run `npm run test:e2e` first (it builds into .next-e2e).')
  process.exit(1)
}
const manifest = JSON.parse(readFileSync('.next-e2e/prerender-manifest.json', 'utf8')) as { routes: Record<string, unknown> }
const incidentRoutes = Object.keys(manifest.routes).filter((r) => r.startsWith('/incidents/'))
if (!incidentRoutes.length) {
  console.error('The build has no prerendered incident pages.')
  process.exit(1)
}

const env = { ...e2eEnv(), DATABASE_URL: DEAD, PUBLIC_DATABASE_URL: DEAD, MIGRATION_DATABASE_URL: DEAD }
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://localhost:${PORT}/robots.txt`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('Server did not start')
}

let failures = 0
try {
  await waitForServer()
  for (const route of incidentRoutes) {
    const res = await fetch(`http://localhost:${PORT}${route}`)
    const html = await res.text()
    const id = /\/incidents\/((?:US|DEMO)-\d{4}-\d{4,})/.exec(route)?.[1] ?? ''
    const ok = res.status === 200 && html.includes(id) && html.includes('Sources')
    console.log(`${ok ? 'PASS' : 'FAIL'} ${res.status} ${route}`)
    if (!ok) failures++
  }
  for (const route of ['/', '/methodology', '/about', '/data']) {
    const res = await fetch(`http://localhost:${PORT}${route}`)
    console.log(`${res.status === 200 ? 'PASS' : 'FAIL'} ${res.status} ${route} (static page)`)
    if (res.status !== 200) failures++
  }
  const explore = await fetch(`http://localhost:${PORT}/incidents`)
  console.log(`INFO ${explore.status} /incidents (searching needs the database; an error page is expected)`)
} finally {
  server.kill('SIGTERM')
}
if (failures) {
  console.error(`\n${failures} page(s) failed with the database down.\n${log.slice(-2000)}`)
  process.exit(1)
}
console.log(`\nAll ${incidentRoutes.length} prerendered incident pages and the static pages load with the database down.`)
process.exit(0)

/**
 * Acceptance: Lighthouse scores of at least 90 for performance and
 * accessibility on Home, Explore and an Incident page, on mobile.
 *
 * Starts the e2e build (.next-e2e, made by `npm run test:e2e`) against the
 * e2e database, runs Lighthouse's default mobile configuration, and writes
 * reports/lighthouse/summary.json plus one HTML report per page.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { e2eEnv } from './lib/e2e-env'

const PORT = 3400
const PAGES = ['/', '/incidents', '/incidents/DEMO-2026-0002']
const CHROME = process.env.CHROME_PATH ?? ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find((p) => existsSync(p))

if (!existsSync('.next-e2e/BUILD_ID')) {
  console.error('No e2e build found. Run `npm run test:e2e` first.')
  process.exit(1)
}

// Its own process group, so stopping it also stops the server npx starts.
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  env: { ...e2eEnv(), NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
  stdio: 'ignore',
  detached: true,
})
for (let i = 0; i < 60; i++) {
  try {
    await fetch(`http://localhost:${PORT}/robots.txt`)
    break
  } catch {
    await new Promise((r) => setTimeout(r, 500))
  }
}

mkdirSync('reports/lighthouse', { recursive: true })
const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] })
const summary: Record<string, Record<string, number>> = {}
let failed = false
try {
  for (const page of PAGES) {
    const url = `http://localhost:${PORT}${page}`
    await fetch(url) // warm the server, as a CDN would
    const result = await lighthouse(url, { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] })
    if (!result) throw new Error(`No Lighthouse result for ${url}`)
    const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([k, c]) => [k, Math.round((c.score ?? 0) * 100)]))
    summary[page] = scores
    const name = page === '/' ? 'home' : page.replace(/^\//, '').replace(/\W+/g, '-')
    writeFileSync(`reports/lighthouse/${name}.html`, (result.report as string[])[0]!)
    console.log(`${page.padEnd(30)} performance ${scores.performance}  accessibility ${scores.accessibility}  best-practices ${scores['best-practices']}  seo ${scores.seo}`)
    if ((scores.performance ?? 0) < 90 || (scores.accessibility ?? 0) < 90) failed = true
  }
} finally {
  await chrome.kill()
  process.kill(-server.pid!, 'SIGTERM')
}
writeFileSync('reports/lighthouse/summary.json', `${JSON.stringify({ date: new Date().toISOString(), formFactor: 'mobile', scores: summary }, null, 2)}\n`)
if (failed) {
  console.error('A page scored below 90 for performance or accessibility.')
  process.exit(1)
}
process.exit(0)

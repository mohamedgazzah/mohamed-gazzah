/**
 * Acceptance: V0 records and editor notes never appear in any public page,
 * API response, sitemap or download. The demo seed puts canary strings in
 * editor notes and in an unpublished V0 draft; this crawls every public
 * surface and looks for them.
 */
import { expect, test } from '@playwright/test'
import { CRON_SECRET, EDITOR_NOTE_CANARY, V0_CANARY, V0_RECORD_ID } from './helpers'

const forbidden = [EDITOR_NOTE_CANARY, V0_CANARY, V0_RECORD_ID, 'editor_notes', 'Private: submitter']

test('no public page, feed or download contains private data', async ({ page, request }) => {
  // Build tonight's release first, so the downloads exist.
  const job = await request.get('/api/jobs/export', { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
  expect(job.ok()).toBe(true)
  const { version } = (await job.json()) as { version: string }

  const sitemap = await (await request.get('/sitemap.xml')).text()
  const recordUrls = Array.from(sitemap.matchAll(/<loc>([^<]+\/incidents\/[^<]+)<\/loc>/g)).map((m) => new URL(m[1]!).pathname)
  // The five demo records, plus any published by the admin workflow test.
  expect(recordUrls.length).toBeGreaterThanOrEqual(5)
  expect(recordUrls.some((u) => u.includes(V0_RECORD_ID))).toBe(false)

  const urls = [
    '/',
    '/incidents',
    '/incidents?v=1,2,3',
    '/incidents?v=1,2,3&view=cards',
    '/incidents?v=1,2,3&view=map',
    '/incidents?q=CANARY&v=1,2,3',
    '/incidents?q=Dearborn&v=1,2,3',
    '/incidents/download?v=1,2,3',
    '/methodology',
    '/data',
    '/data/dictionary.json',
    `/data/downloads/record-v${version}.csv`,
    `/data/downloads/record-v${version}.json`,
    `/data/downloads/record-v${version}.csv.sha256`,
    '/about',
    '/report',
    '/sitemap.xml',
    '/robots.txt',
    ...recordUrls,
  ]
  for (const url of urls) {
    const res = await request.get(url)
    expect(res.status(), url).toBe(200)
    const body = await res.text()
    for (const f of forbidden) expect(body, `${url} contains ${f}`).not.toContain(f)
  }
  // Rendered pages too (client-side content included).
  for (const url of ['/', '/incidents?v=1,2,3&view=map', recordUrls[0]!]) {
    await page.goto(url)
    const html = await page.content()
    for (const f of forbidden) expect(html, `${url} contains ${f}`).not.toContain(f)
  }
})

test('the unpublished V0 record has no public page', async ({ request }) => {
  const res = await request.get(`/incidents/${V0_RECORD_ID}-anything`)
  expect(res.status()).toBe(404)
})

test('scheduled jobs refuse requests without the secret', async ({ request }) => {
  for (const job of ['export', 'archive', 'retention', 'nightly']) {
    expect((await request.get(`/api/jobs/${job}`)).status()).toBe(401)
    expect((await request.get(`/api/jobs/${job}`, { headers: { Authorization: 'Bearer wrong' } })).status()).toBe(401)
  }
})

test('admin pages and evidence files are not reachable without signing in', async ({ request }) => {
  const res = await request.get('/admin/incidents', { maxRedirects: 0 })
  expect([303, 307, 308]).toContain(res.status())
  expect(res.headers()['location']).toContain('/admin/login')
  const file = await request.get('/admin/files/00000000-0000-0000-0000-000000000000')
  expect(file.status()).toBe(404)
  const login = await request.get('/admin/login')
  expect(login.headers()['x-robots-tag']).toContain('noindex')
})

test('security headers are set', async ({ request }) => {
  const res = await request.get('/')
  const h = res.headers()
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['x-powered-by']).toBeUndefined()
  expect(h['set-cookie']).toBeUndefined()
})

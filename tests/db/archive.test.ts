/** Acceptance: every new source gets an archived URL (Wayback) shortly after saving. */
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb } from '@/db/admin'
import { publishedIncidents, sources } from '@/db/schema'
import * as wf from '@/server/admin/incidents'
import { archivePending } from '@/server/jobs/archive'
import { CHECKLIST_ALL, completeDraft, team } from './helpers'

let server: http.Server
let calls: string[] = []

beforeAll(async () => {
  // A stand-in for web.archive.org's Save Page Now endpoint.
  server = http.createServer((req, res) => {
    calls.push(req.url ?? '')
    if (req.url?.startsWith('/save/')) {
      const target = req.url.slice('/save/'.length)
      if (target.includes('fail')) {
        res.writeHead(520)
        return res.end()
      }
      res.writeHead(302, { Location: `/web/20261026120000/${target}` })
      return res.end()
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  process.env.WAYBACK_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  delete process.env.WAYBACK_ACCESS_KEY
})

afterAll(() => {
  server.close()
  delete process.env.WAYBACK_BASE_URL
})

describe('source archiving', () => {
  it('archives the sources saved with a record, and updates the live page', async () => {
    const t = await team()
    const draft = completeDraft()
    const { id, newSourceIds } = await wf.saveIncident(t.author, draft, 'x')
    expect(newSourceIds).toHaveLength(1)
    await wf.submitForReview(t.author, id)
    await wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, '')
    await wf.publishIncident(t.senior, id, 'Published.')

    calls = []
    const result = await archivePending({ ids: newSourceIds })
    expect(result.archived).toBe(1)
    expect(calls[0]).toBe(`/save/${draft.sources[0]!.url}`)
    const [src] = await adminDb().select().from(sources).where(eq(sources.id, newSourceIds[0]!))
    expect(src?.archiveStatus).toBe('archived')
    expect(src?.archivedUrl).toBe(`https://web.archive.org/web/20261026120000/${draft.sources[0]!.url}`)
    // Archiving is bookkeeping, not an editorial change: no new revision.
    const [snap] = await adminDb().select().from(publishedIncidents).where(eq(publishedIncidents.id, id))
    expect(snap?.sources[0]?.archived_url).toBe(src?.archivedUrl)
    const { incident } = (await wf.loadDraft(id))!
    expect(incident.revision).toBe(1)
    expect(incident.workflowStatus).toBe('published')
  })

  it('retries failures and gives up after six attempts', async () => {
    const t = await team()
    const draft = completeDraft()
    draft.sources[0]!.url = 'https://example.org/will-fail'
    const { newSourceIds } = await wf.saveIncident(t.author, draft, 'x')
    for (let i = 0; i < 6; i++) await archivePending({ ids: newSourceIds })
    const [src] = await adminDb().select().from(sources).where(eq(sources.id, newSourceIds[0]!))
    expect(src?.archiveStatus).toBe('failed')
    expect(src?.archiveAttempts).toBe(6)
  })

  it('the scheduled job picks up pending sources without being told which', async () => {
    const t = await team()
    const { newSourceIds } = await wf.saveIncident(t.author, completeDraft(), 'x')
    await archivePending({ limit: 100 })
    const [src] = await adminDb().select().from(sources).where(eq(sources.id, newSourceIds[0]!))
    expect(src?.archiveStatus).toBe('archived')
  })
})

/**
 * Acceptance: stat tiles, the CSV and Explore give the same totals for the
 * same filters; downloads never contain private data; nightly releases are
 * versioned with a checksum and a changelog.
 */
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { adminDb } from '@/db/admin'
import { EMPTY_FILTERS, type Filters } from '@/lib/filters'
import * as wf from '@/server/admin/incidents'
import { buildRelease, diffReleases } from '@/server/jobs/export'
import { exportRows, rowsToCsv } from '@/server/public/export'
import { countIncidents, searchIncidents } from '@/server/public/incidents'
import { CANARY_NOTE, CHECKLIST_ALL, completeDraft, team } from './helpers'

beforeAll(async () => {
  const t = await team()
  const drafts = [
    completeDraft({ verificationLevel: 'V3', stateFips: '26', incidentTypes: ['VAND'], dateStart: '2026-02-01' }),
    completeDraft({ verificationLevel: 'V2', stateFips: '17', incidentTypes: ['THRT'], dateStart: '2026-03-01' }),
    completeDraft({ verificationLevel: 'V1', stateFips: '26', incidentTypes: ['THRT', 'HARS'], dateStart: '2026-04-01' }),
  ]
  for (const d of drafts) {
    const { id } = await wf.saveIncident(t.author, d, 'x')
    await wf.submitForReview(t.author, id)
    await wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, '')
    await wf.publishIncident(t.senior, id, 'Published.')
  }
  // An unpublished V0 draft that must never be exported.
  await wf.saveIncident(t.author, completeDraft({ title: 'Unpublished V0 export canary', verificationLevel: 'V0' }), 'x')
})

const combos: Partial<Filters>[] = [
  {},
  { state: ['MI'] },
  { type: ['THRT'] },
  { type: ['THRT', 'VAND'], state: ['MI'] },
  { v: ['V1', 'V2', 'V3'] },
  { v: ['V1'] },
  { from: '2026-03-01', to: '2026-12-31' },
  { q: 'test sentence' },
  { source: ['news'], severity: [2] },
]

describe('one set of filters, one total', () => {
  for (const combo of combos) {
    it(`Explore, stat count and CSV agree for ${JSON.stringify(combo)}`, async () => {
      const f = { ...EMPTY_FILTERS, ...combo }
      const explore = await searchIncidents(f, { sort: 'newest', page: 1, pageSize: 10_000 })
      const stat = await countIncidents(f)
      const csvRows = await exportRows(f)
      const csv = rowsToCsv(csvRows)
      expect(stat.incidents).toBe(explore.total)
      expect(csvRows.length).toBe(explore.total)
      expect(csv.trim().split('\r\n').length - 1).toBe(explore.total)
      expect(new Set(csvRows.map((r) => r.id))).toEqual(new Set(explore.rows.map((r) => r.id)))
    })
  }
})

describe('nightly release', () => {
  it('is versioned by date, checksummed, and has no private data', async () => {
    const r1 = await buildRelease(new Date('2026-10-25T12:00:00Z'))
    expect(r1.version).toBe('2026.10.25')
    const [row] = (await adminDb().execute<{ csv: string; json: string; csv_sha256: string; json_sha256: string; record_count: number }>(
      sql`select csv, json, csv_sha256, json_sha256, record_count from record.dataset_releases where version = '2026.10.25'`,
    )).rows
    expect(row).toBeDefined()
    expect(createHash('sha256').update(row!.csv).digest('hex')).toBe(row!.csv_sha256)
    expect(createHash('sha256').update(row!.json).digest('hex')).toBe(row!.json_sha256)
    for (const text of [row!.csv, row!.json]) {
      expect(text).not.toContain(CANARY_NOTE)
      expect(text).not.toContain('Unpublished V0 export canary')
      expect(text).not.toContain('editor_notes')
      expect(text).not.toContain('search_document')
    }
    const json = JSON.parse(row!.json) as { records: { verification_level: string }[]; methodology_version: string }
    expect(json.methodology_version).toBe('1.0')
    expect(json.records.every((r) => ['V1', 'V2', 'V3'].includes(r.verification_level))).toBe(true)
    expect(row!.record_count).toBe(json.records.length)
  })

  it('lists what changed since the previous release', async () => {
    const r2 = await buildRelease(new Date('2026-10-26T12:00:00Z'))
    expect(r2.version).toBe('2026.10.26')
    expect(r2.changelog.added).toEqual([])
    expect(diffReleases(new Map([['A', '1'], ['B', '1']]), new Map([['B', '2'], ['C', '1']]))).toEqual({ added: ['C'], updated: ['B'], removed: ['A'] })
  })
})

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
import { INCIDENT_TYPES } from '@/db/enums'
import { countIncidents, searchIncidents } from '@/server/public/incidents'
import { countsByCity, countsByMonth, countsByState, countsByType, monthsBetween } from '@/server/public/stats'
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

describe('charts and the map count what Explore lists', () => {
  for (const combo of combos) {
    it(`state, city, type and month totals match Explore for ${JSON.stringify(combo)}`, async () => {
      const f = { ...EMPTY_FILTERS, ...combo }
      const total = (await countIncidents(f)).incidents
      // Each record has one state: the map's totals add up to the list.
      const byState = await countsByState(f)
      expect(Object.values(byState).reduce((a, b) => a + b, 0)).toBe(total)
      for (const [state, n] of Object.entries(byState)) expect((await countIncidents({ ...f, state: [state] })).incidents).toBe(n)
      // City circles plus state-level-only records add up to the state.
      const cities = await countsByCity(f)
      expect(cities.cities.reduce((a, c) => a + c.count, 0) + cities.stateOnly).toBe(total)
      for (const c of cities.cities) expect((await countIncidents({ ...f, state: [c.stateCode], city: c.city })).incidents).toBe(c.count)
      // A type bar or toggle shows what Explore lists for that type with the other filters kept.
      const byType = await countsByType({ ...f, type: [] })
      for (const t of INCIDENT_TYPES) expect((await countIncidents({ ...f, type: [t] })).incidents, t).toBe(byType[t])
      // A month column opens Explore for that month, with the same number.
      for (const m of await countsByMonth(f, '2026-01-01', '2026-06-30')) expect((await countIncidents({ ...f, from: m.from, to: m.to })).incidents, m.month).toBe(m.count)
    })
  }

  it('lists calendar months and clips the first and last to the window', async () => {
    expect(monthsBetween('2025-11-15', '2026-02-03').map((m) => m.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    const months = await countsByMonth({ ...EMPTY_FILTERS, from: '2026-02-10' }, '2026-01-01', '2026-03-20')
    expect(months.map((m) => [m.month, m.from, m.to])).toEqual([
      ['2026-02', '2026-02-10', '2026-02-28'],
      ['2026-03', '2026-03-01', '2026-03-20'],
    ])
  })
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

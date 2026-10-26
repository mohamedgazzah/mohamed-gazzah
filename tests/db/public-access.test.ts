/**
 * Acceptance: V0 records and editor notes never appear in any public page,
 * API response, sitemap or download. The public site reads through a role
 * that can only see record_public views; these tests prove what that role
 * can and cannot reach.
 */
import { getViewSelectedFields, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { adminDb } from '@/db/admin'
import { publicIncidents } from '@/db/schema'
import * as wf from '@/server/admin/incidents'
import { allRecordPaths, getIncident, searchIncidents } from '@/server/public/incidents'
import { EMPTY_FILTERS } from '@/lib/filters'
import { CANARY_NOTE, CHECKLIST_ALL, asOwner, asPublic, completeDraft, team } from './helpers'

let v0Id: string
let publishedId: string

beforeAll(async () => {
  const t = await team()
  const v0 = await wf.saveIncident(t.author, completeDraft({ title: 'V0 canary draft', verificationLevel: 'V0' }), 'v0')
  v0Id = v0.id
  const pub = await wf.saveIncident(t.author, completeDraft({ title: 'Published canary record' }), 'pub')
  publishedId = pub.id
  await wf.submitForReview(t.author, pub.id)
  await wf.reviewIncident(t.reviewer, pub.id, 'approved', CHECKLIST_ALL, '')
  await wf.publishIncident(t.senior, pub.id, 'Published.')
  const demo = await wf.saveIncident(t.author, completeDraft({ title: 'DEMO: fictional record' }), 'demo', { idPrefix: 'DEMO' })
  await wf.submitForReview(t.author, demo.id)
  await wf.reviewIncident(t.reviewer, demo.id, 'approved', CHECKLIST_ALL, '')
  await wf.publishIncident(t.senior, demo.id, 'Published.')
})

describe('the public role', () => {
  it('cannot read any internal table', async () => {
    const tables = await adminDb().execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'record'`)
    expect(tables.rows.length).toBeGreaterThan(15)
    for (const { tablename } of tables.rows) {
      const msg = await asPublic((c) => c.query(`select * from record.${tablename} limit 1`).then(() => 'readable', (e: Error) => e.message))
      expect(msg, tablename).toMatch(/permission denied/)
    }
  })

  it('cannot call the workflow functions', async () => {
    const msg = await asPublic((c) => c.query(`select record.publish_blockers('x')`).then(() => 'ok', (e: Error) => e.message))
    expect(msg).toMatch(/permission denied/)
  })

  it('sees exactly the columns declared for the public view, with no private fields', async () => {
    const declared = Object.values(getViewSelectedFields(publicIncidents)).map((c) => (c as PgColumn).name).sort()
    const actual = await asPublic((c) =>
      c.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'record_public' and table_name = 'incidents'`),
    )
    expect(actual.rows.map((r) => r.column_name).sort()).toEqual(declared)
    for (const forbidden of ['editor_notes', 'workflow_status', 'created_by', 'published_by', 'approved_review_id', 'lead_id', 'exclusion_reason']) {
      expect(declared).not.toContain(forbidden)
    }
  })

  it('never sees V0 drafts or editor notes', async () => {
    const rows = await asPublic((c) => c.query(`select row_to_json(i)::text as j, id from record_public.incidents i`))
    const all = rows.rows.map((r) => r.j).join('\n')
    expect(all).not.toContain(CANARY_NOTE)
    expect(all).not.toContain('V0 canary draft')
    expect(rows.rows.map((r) => r.id)).not.toContain(v0Id)
    expect(rows.rows.map((r) => r.id)).toContain(publishedId)
  })

  it('the public query layer cannot return a V0 record even when asked by id', async () => {
    expect(await getIncident(v0Id)).toBeNull()
    expect((await allRecordPaths()).map((p) => p.id)).not.toContain(v0Id)
    const all = await searchIncidents({ ...EMPTY_FILTERS, v: ['V1', 'V2', 'V3'] }, { sort: 'newest', page: 1, pageSize: 1000 })
    expect(all.rows.map((r) => r.id)).not.toContain(v0Id)
    expect(JSON.stringify(await getIncident(publishedId))).not.toContain(CANARY_NOTE)
  })

  it('hides demo records unless the database allows them', async () => {
    const counts = await asPublic(async (c) => {
      await c.query('begin')
      const on = await c.query(`select count(*)::int as n from record_public.incidents where is_demo`)
      await c.query(`set local record.allow_demo = 'off'`)
      const off = await c.query(`select count(*)::int as n from record_public.incidents where is_demo`)
      await c.query('rollback')
      return { on: on.rows[0].n as number, off: off.rows[0].n as number }
    })
    expect(counts.off).toBe(0)
    expect(counts.on).toBeGreaterThanOrEqual(1)
  })
})

describe('row-level security', () => {
  it('is enabled on every internal table', async () => {
    const res = await asOwner((c) =>
      c.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'record' and c.relkind = 'r'`,
      ),
    )
    for (const r of res.rows) expect(r.relrowsecurity, r.relname).toBe(true)
  })
})

/**
 * Acceptance: "A record cannot be published without at least one source, a
 * verification level, a legal status, and approval by a second editor who is
 * not the author" — enforced by the database, not only the UI.
 */
import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { adminDb, withActor } from '@/db/admin'
import { incidents, publishedIncidents, reviews } from '@/db/schema'
import { LEGAL_EVENT_TYPES, LEGAL_STATUSES, LEGAL_STATUS_EVIDENCE } from '@/db/enums'
import { US_STATES } from '@/lib/states'
import * as wf from '@/server/admin/incidents'
import { CHECKLIST_ALL, asApp, asOwner, completeDraft, rejectionCode, team } from './helpers'

let t: Awaited<ReturnType<typeof team>>

beforeAll(async () => {
  t = await team()
})

async function submitted(draft = completeDraft()) {
  const { id } = await wf.saveIncident(t.author, draft, 'test draft')
  await wf.submitForReview(t.author, id)
  return id
}

async function approved(draft = completeDraft()) {
  const id = await submitted(draft)
  await wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, '')
  return id
}

describe('two-person review', () => {
  it('rejects a review by the author', async () => {
    const id = await submitted()
    expect(await rejectionCode(wf.reviewIncident(t.author, id, 'approved', CHECKLIST_ALL, ''))).toBe('reviewer_is_author')
  })

  it('rejects approval by an editor who edited the revision under review', async () => {
    const id = await submitted()
    const { draft } = (await wf.loadDraft(id))!
    await wf.saveIncident(t.reviewer, { ...draft, title: `${draft.title} (edited)` }, 'reviewer edit')
    await wf.submitForReview(t.author, id)
    expect(await rejectionCode(wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, ''))).toBe('reviewer_edited_revision')
    // A third editor who touched neither can approve.
    await wf.reviewIncident(t.third, id, 'approved', CHECKLIST_ALL, '')
    await wf.publishIncident(t.senior, id, 'Published.')
  })

  it('rejects a review by a contributor', async () => {
    const id = await submitted()
    await expect(wf.reviewIncident(t.contributor, id, 'approved', CHECKLIST_ALL, '')).rejects.toThrow()
    // and at the database layer, bypassing the role check in the app:
    const code = await rejectionCode(
      withActor(t.contributor.id, 'x', (tx) => tx.insert(reviews).values({ incidentId: id, revision: 0, reviewerId: t.contributor.id, decision: 'approved', ...CHECKLIST_ALL })),
    )
    expect(code).toBe('review_requires_editor_role')
  })

  it('requires every checklist item for approval (database constraint)', async () => {
    const id = await submitted()
    const err = await withActor(t.reviewer.id, 'x', (tx) =>
      tx.insert(reviews).values({ incidentId: id, revision: 0, reviewerId: t.reviewer.id, decision: 'approved', ...CHECKLIST_ALL, chkVictimPrivacy: false }),
    ).catch((e: { cause?: { constraint?: string } }) => e)
    expect((err as { cause?: { constraint?: string } }).cause?.constraint).toBe('reviews_checklist_complete')
  })

  it('cannot record a review as someone else', async () => {
    const id = await submitted()
    const code = await rejectionCode(
      withActor(t.author.id, 'x', (tx) => tx.insert(reviews).values({ incidentId: id, revision: 0, reviewerId: t.reviewer.id, decision: 'approved', ...CHECKLIST_ALL })),
    )
    expect(code).toBe('review_actor_mismatch')
  })
})

describe('publish preconditions', () => {
  it('blocks approval without a source', async () => {
    const id = await submitted(completeDraft({ sources: [], legalEvents: [], legalStatus: 'unknown' }))
    const code = await rejectionCode(wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, ''))
    expect(code).toBe('approval_blocked')
    expect(await wf.publishBlockers(id)).toContain('no_source')
  })

  it('blocks approval at verification level V0', async () => {
    const id = await submitted(completeDraft({ verificationLevel: 'V0' }))
    expect(await rejectionCode(wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, ''))).toBe('approval_blocked')
    expect(await wf.publishBlockers(id)).toContain('verification_level_v0')
  })

  it('blocks approval without a legal status', async () => {
    const id = await submitted(completeDraft({ legalStatus: null }))
    expect(await rejectionCode(wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, ''))).toBe('approval_blocked')
    expect(await wf.publishBlockers(id)).toContain('legal_status_missing')
  })

  it('blocks a legal status with no supporting dated, sourced event', async () => {
    const id = await submitted(completeDraft({ legalStatus: 'charged' }))
    expect(await wf.publishBlockers(id)).toContain('legal_status_without_event')
  })

  it('blocks names unless the person has been charged', async () => {
    const draft = completeDraft()
    const { id } = await wf.saveIncident(t.author, draft, 'x')
    // The editor form refuses names before charge; the database refuses them too.
    await withActor(t.author.id, 'x', (tx) => tx.update(incidents).set({ perpetratorNames: ['A Person'] }).where(eq(incidents.id, id)))
    expect(await wf.publishBlockers(id)).toContain('names_require_charge')
  })

  it('refuses to publish without an approved review', async () => {
    const id = await submitted()
    expect(await rejectionCode(wf.publishIncident(t.senior, id, 'Published.'))).toBe('publish_requires_second_editor_approval')
  })

  it('refuses to publish when the publisher is not a senior editor', async () => {
    const id = await approved()
    expect(await rejectionCode(wf.publishIncident(t.reviewer, id, 'Published.'))).toBe('Only senior editors can publish.')
    // Bypassing the app's role check, the database still refuses:
    const code = await rejectionCode(withActor(t.reviewer.id, 'x', (tx) => tx.execute(sql`select record.publish_incident(${id}, 'x', '1.0')`)))
    expect(code).toBe('publish_requires_senior_editor')
  })

  it('voids an approval when the record changes after review', async () => {
    const id = await approved()
    const { draft } = (await wf.loadDraft(id))!
    await wf.saveIncident(t.author, { ...draft, summary: `${draft.summary} Another sentence.[1]` }, 'late change')
    const [row] = await adminDb().select({ status: incidents.workflowStatus, revision: incidents.revision }).from(incidents).where(eq(incidents.id, id))
    expect(row).toEqual({ status: 'draft', revision: 2 })
    expect(await rejectionCode(wf.publishIncident(t.senior, id, 'Published.'))).toBe('publish_requires_second_editor_approval')
  })

  it('voids an approval when only a source changes', async () => {
    const id = await approved()
    const { draft } = (await wf.loadDraft(id))!
    await wf.saveIncident(t.author, { ...draft, sources: draft.sources.map((s) => ({ ...s, title: 'Changed title' })) }, 'source change')
    const [row] = await adminDb().select({ status: incidents.workflowStatus }).from(incidents).where(eq(incidents.id, id))
    expect(row?.status).toBe('draft')
  })

  it('publishes with source, level, status and a second editor’s approval; first log entry is "Published."', async () => {
    const id = await approved()
    const revision = await wf.publishIncident(t.senior, id, 'ignored for first publication')
    expect(revision).toBe(1)
    const [snap] = await adminDb().select().from(publishedIncidents).where(eq(publishedIncidents.id, id))
    expect(snap?.sourceCount).toBe(1)
    expect(snap?.verificationLevel).toBe('V2')
    const res = await adminDb().execute<{ change_log: { note: string }[] }>(sql`select change_log from record_public.incidents where id = ${id}`)
    expect(res.rows[0]?.change_log[0]?.note).toBe('Published.')
  })

  it('keeps the published revision live while a later revision is edited', async () => {
    const id = await approved()
    await wf.publishIncident(t.senior, id, 'Published.')
    const { draft } = (await wf.loadDraft(id))!
    await wf.saveIncident(t.author, { ...draft, title: `${draft.title} updated` }, 'update')
    const [snap] = await adminDb().select({ title: publishedIncidents.title, revision: publishedIncidents.revision }).from(publishedIncidents).where(eq(publishedIncidents.id, id))
    expect(snap).toEqual({ title: draft.title, revision: 1 })
    // Republishing needs a new review and a public note.
    await wf.submitForReview(t.author, id)
    await wf.reviewIncident(t.reviewer, id, 'approved', CHECKLIST_ALL, '')
    expect(await rejectionCode(wf.publishIncident(t.senior, id, ''))).toBe('publish_requires_public_note')
    await wf.publishIncident(t.senior, id, 'Corrected the headline.')
    const res = await adminDb().execute<{ change_log: { note: string; changed_fields: string[] }[] }>(sql`select change_log from record_public.incidents where id = ${id}`)
    expect(res.rows[0]?.change_log.map((c) => c.note)).toEqual(['Published.', 'Corrected the headline.'])
    expect(res.rows[0]?.change_log[1]?.changed_fields).toContain('title')
  })

  it('stops even the schema owner from writing an unreviewed snapshot', async () => {
    const { id } = await wf.saveIncident(t.author, completeDraft(), 'x')
    const code = await asOwner(async (c) => {
      const review = randomUUID()
      try {
        await c.query(
          `INSERT INTO record.published_incidents (id, revision, slug, title, summary, date_start, state_fips, incident_types, target_type, severity,
             state_code, verification_level, legal_status, source_types, source_count, sources, legal_events, statements, cases,
             methodology_version, is_demo, created_at, published_at, updated_at, approved_review_id, published_by, search_text)
           VALUES ($1, 1, 's', 't', 's', '2026-01-01', '26', '{VAND}', 'other', 1, 'MI', 'V2', 'reported', '{news}', 1, '[{}]', '[]', '[]', '[]',
             '1.0', false, now(), now(), now(), $2, $3, 'x')`,
          [id, review, t.senior.id],
        )
        return 'inserted'
      } catch (e) {
        return (e as Error).message.split(':')[0]
      }
    })
    expect(code).toBe('publish_requires_second_editor_approval')
  })
})

describe('privileges and history', () => {
  it('the app role cannot write the public snapshot directly', async () => {
    const msg = await asApp((c) => c.query(`DELETE FROM record.published_incidents`).then(() => 'ok', (e: Error) => e.message))
    expect(msg).toMatch(/permission denied/)
  })

  it('the audit log, reviews and change log are append-only, even for the owner', async () => {
    for (const table of ['audit_log', 'reviews', 'change_log', 'publications']) {
      const msg = await asOwner((c) => c.query(`DELETE FROM record.${table}`).then(() => 'ok', (e: Error) => e.message))
      expect(msg, table).toMatch(/append_only/)
      const upd = await asOwner((c) => c.query(`UPDATE record.${table} SET created_at = created_at`).then(() => 'ok', (e: Error) => e.message))
      if (table !== 'audit_log') expect(upd, table).toMatch(/append_only|does not exist/)
    }
    const trunc = await asOwner((c) => c.query(`TRUNCATE record.audit_log`).then(() => 'ok', (e: Error) => e.message))
    expect(trunc).toMatch(/append_only/)
  })

  it('every content change is attributed and logged with its reason', async () => {
    const { id } = await wf.saveIncident(t.author, completeDraft(), 'first')
    const { draft } = (await wf.loadDraft(id))!
    await wf.saveIncident(t.third, { ...draft, city: 'Othertown' }, 'fixed the city')
    const res = await adminDb().execute<{ field: string; reason: string; actor_id: string }>(
      sql`select field, reason, actor_id from record.change_log where incident_id = ${id} and field = 'city'`,
    )
    expect(res.rows).toEqual([{ field: 'city', reason: 'fixed the city', actor_id: t.third.id }])
  })

  it('refuses unattributed content changes', async () => {
    const { id } = await wf.saveIncident(t.author, completeDraft(), 'x')
    const msg = await asApp((c) => c.query(`UPDATE record.incidents SET title = 'x' WHERE id = $1`, [id]).then(() => 'ok', (e: Error) => e.message))
    expect(msg).toMatch(/^actor_required/)
  })

  it('records the acting user as author, whatever the caller sends', async () => {
    const res = await withActor(t.third.id, 'x', async (tx) => {
      await tx.insert(incidents).values({ id: 'US-2099-9999', slug: 's', title: 't', dateStart: '2026-01-01', stateFips: '26', incidentTypes: ['VAND'], targetType: 'other', severity: 1, createdBy: t.author.id })
      return tx.select({ by: incidents.createdBy }).from(incidents).where(eq(incidents.id, 'US-2099-9999'))
    })
    expect(res[0]?.by).toBe(t.third.id)
  })
})

describe('reference data stays in sync with the code', () => {
  it('legal status evidence rules match record.legal_event_establishes()', async () => {
    const res = await adminDb().execute<{ s: string; e: string; ok: boolean }>(sql`
      select s::text as s, e::text as e, record.legal_event_establishes(e, s) as ok
      from unnest(enum_range(null::record.legal_status)) s, unnest(enum_range(null::record.legal_event_type)) e`)
    expect(res.rows.length).toBe(LEGAL_STATUSES.length * LEGAL_EVENT_TYPES.length)
    for (const r of res.rows) {
      const expected = (LEGAL_STATUS_EVIDENCE as Record<string, readonly string[]>)[r.s]!.includes(r.e)
      expect(r.ok, `${r.s} / ${r.e}`).toBe(expected)
    }
  })

  it('states and territories match src/lib/states.ts', async () => {
    const res = await adminDb().execute<{ fips: string; code: string; name: string }>(sql`select fips, code, name from record.us_states order by fips`)
    expect(res.rows).toEqual(US_STATES.map((s) => ({ fips: s.fips, code: s.code, name: s.name })))
  })
})

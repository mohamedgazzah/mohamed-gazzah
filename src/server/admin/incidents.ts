/**
 * The editorial workflow (Section 4): draft → review by a second editor →
 * publish. The database enforces the rules (drizzle/0002_rules.sql); this
 * module checks roles, validates input and reports rule violations clearly.
 */
import 'server-only'
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { adminDb, withActor, type AdminTx } from '@/db/admin'
import {
  cases,
  changeLog,
  incidentCases,
  incidentEdits,
  incidents,
  legalEvents,
  publications,
  publishedIncidents,
  reviews,
  sources,
  statements,
  users,
  type Incident,
} from '@/db/schema'
import { METHODOLOGY_VERSION, type ReviewChecklistKey, type ReviewDecision } from '@/db/enums'
import { slugify } from '@/lib/slug'
import { todayIso } from '@/lib/format'
import { incidentDraftInput, type IncidentDraftInput } from '@/lib/validation'
import { audit } from './audit'
import { can } from './permissions'
import type { SessionUser } from './session'
import { revalidateRecord } from '../shared/revalidate'

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export function emptyDraft(): IncidentDraftInput {
  return {
    id: null,
    title: '',
    summary: '',
    dateStart: todayIso(),
    dateEnd: null,
    datePrecision: 'day',
    stateFips: '',
    countyFips: null,
    city: null,
    lat: null,
    lng: null,
    locationPrecision: 'city',
    incidentTypes: [],
    targetType: 'individual',
    targetAttributes: [],
    severity: 1,
    deaths: null,
    injuries: null,
    propertyDamage: 'unknown',
    perpetratorType: 'unknown',
    perpetratorCount: null,
    perpetratorNames: [],
    biasIndicators: [],
    verificationLevel: 'V0',
    legalStatus: null,
    hateCrimeCharged: 'unknown',
    agenciesInvolved: [],
    relatedIncidentIds: [],
    tags: [],
    caseIds: [],
    editorNotes: '',
    sources: [],
    legalEvents: [],
    statements: [],
  }
}

/** Incident columns written from the editor form. */
function incidentValues(d: IncidentDraftInput) {
  return {
    slug: slugify(d.title),
    title: d.title,
    summary: d.summary,
    dateStart: d.dateStart,
    dateEnd: d.dateEnd,
    datePrecision: d.datePrecision,
    stateFips: d.stateFips,
    countyFips: d.countyFips,
    city: d.city,
    lat: d.lat,
    lng: d.lng,
    locationPrecision: d.locationPrecision,
    incidentTypes: d.incidentTypes,
    targetType: d.targetType,
    targetAttributes: d.targetAttributes,
    severity: d.severity,
    deaths: d.deaths,
    injuries: d.injuries,
    propertyDamage: d.propertyDamage,
    perpetratorType: d.perpetratorType,
    perpetratorCount: d.perpetratorCount,
    perpetratorNames: d.perpetratorNames,
    biasIndicators: d.biasIndicators,
    verificationLevel: d.verificationLevel,
    legalStatus: d.legalStatus,
    hateCrimeCharged: d.hateCrimeCharged,
    agenciesInvolved: d.agenciesInvolved,
    relatedIncidentIds: d.relatedIncidentIds,
    tags: d.tags,
    editorNotes: d.editorNotes,
  }
}

async function syncChildren(tx: AdminTx, incidentId: string, d: IncidentDraftInput, actorId: string): Promise<string[]> {
  const keepSources = d.sources.map((s) => s.id)
  const keepEvents = d.legalEvents.map((e) => e.id)
  const keepStatements = d.statements.map((s) => s.id)
  const none = ['00000000-0000-0000-0000-000000000000']

  // 1. Remove events and statements that were deleted (they may cite sources being removed).
  await tx.delete(legalEvents).where(and(eq(legalEvents.incidentId, incidentId), notInArray(legalEvents.id, keepEvents.length ? keepEvents : none)))
  await tx.delete(statements).where(and(eq(statements.incidentId, incidentId), notInArray(statements.id, keepStatements.length ? keepStatements : none)))

  // 2. Upsert sources in editor order; positions are 1..n so summary markers match.
  const existingSources = await tx.select({ id: sources.id, url: sources.url }).from(sources).where(eq(sources.incidentId, incidentId))
  const existingIds = new Set(existingSources.map((s) => s.id))
  const newSourceIds: string[] = []
  for (const [i, s] of d.sources.entries()) {
    const values = {
      position: i + 1,
      url: s.url,
      outlet: s.outlet,
      title: s.title,
      author: s.author,
      publishedDate: s.publishedDate,
      accessedDate: s.accessedDate,
      sourceType: s.sourceType,
      claimAttribution: s.claimAttribution,
    }
    if (existingIds.has(s.id)) {
      const urlChanged = existingSources.find((e) => e.id === s.id)?.url !== s.url
      await tx
        .update(sources)
        .set(urlChanged ? { ...values, archivedUrl: null, archiveStatus: 'pending', archiveAttempts: 0, archivedAt: null, archiveJobId: null } : values)
        .where(and(eq(sources.id, s.id), eq(sources.incidentId, incidentId)))
      if (urlChanged) newSourceIds.push(s.id)
    } else {
      await tx.insert(sources).values({ id: s.id, incidentId, createdBy: actorId, ...values })
      newSourceIds.push(s.id)
    }
  }

  // 3. Upsert legal events and statements.
  const existingEvents = new Set(
    (await tx.select({ id: legalEvents.id }).from(legalEvents).where(eq(legalEvents.incidentId, incidentId))).map((r) => r.id),
  )
  for (const e of d.legalEvents) {
    const values = { date: e.date, eventType: e.eventType, description: e.description, sourceId: e.sourceId, caseId: e.caseId }
    if (existingEvents.has(e.id)) await tx.update(legalEvents).set(values).where(eq(legalEvents.id, e.id))
    else await tx.insert(legalEvents).values({ id: e.id, incidentId, ...values })
  }
  const existingStatements = new Set(
    (await tx.select({ id: statements.id }).from(statements).where(eq(statements.incidentId, incidentId))).map((r) => r.id),
  )
  for (const s of d.statements) {
    const values = {
      speaker: s.speaker,
      speakerRole: s.speakerRole,
      organization: s.organization,
      statementType: s.statementType,
      date: s.date,
      quote: s.quote,
      paraphrase: s.paraphrase,
      sourceId: s.sourceId,
    }
    if (existingStatements.has(s.id)) await tx.update(statements).set(values).where(eq(statements.id, s.id))
    else await tx.insert(statements).values({ id: s.id, incidentId, ...values })
  }

  // 4. Remove sources that were deleted (now unreferenced).
  await tx.delete(sources).where(and(eq(sources.incidentId, incidentId), notInArray(sources.id, keepSources.length ? keepSources : none)))

  // 5. Case links.
  const linked = (await tx.select({ caseId: incidentCases.caseId }).from(incidentCases).where(eq(incidentCases.incidentId, incidentId))).map((r) => r.caseId)
  const wanted = Array.from(new Set(d.caseIds))
  if (wanted.length) {
    const found = await tx.select({ id: cases.id }).from(cases).where(inArray(cases.id, wanted))
    const missing = wanted.filter((w) => !found.some((f) => f.id === w))
    if (missing.length) throw new WorkflowError(`Unknown case id: ${missing.join(', ')}. Create the case first.`)
  }
  const toRemove = linked.filter((c) => !wanted.includes(c))
  if (toRemove.length) await tx.delete(incidentCases).where(and(eq(incidentCases.incidentId, incidentId), inArray(incidentCases.caseId, toRemove)))
  for (const c of wanted.filter((w) => !linked.includes(w))) await tx.insert(incidentCases).values({ incidentId, caseId: c })

  return newSourceIds
}

async function lockIncident(tx: AdminTx, id: string): Promise<Incident> {
  const [row] = await tx.select().from(incidents).where(eq(incidents.id, id)).for('update')
  if (!row) throw new WorkflowError('Record not found.')
  return row
}

function assertCanEdit(user: SessionUser, inc: Incident) {
  if (can.editAnyRecord(user.role)) return
  if (inc.createdBy !== user.id) throw new WorkflowError('Contributors can edit only their own drafts.')
  if (inc.firstPublishedAt) throw new WorkflowError('Contributors cannot edit published records. Ask an editor.')
}

export type SaveResult = { id: string; revision: number; newSourceIds: string[] }

/**
 * Create or update a record and all its sources, legal events, statements
 * and case links in one transaction. `reason` goes into the change log.
 */
export async function saveIncident(
  user: SessionUser,
  input: IncidentDraftInput,
  reason: string,
  opts: { idPrefix?: 'US' | 'DEMO'; leadId?: string | null } = {},
): Promise<SaveResult> {
  if (!can.draft(user.role)) throw new WorkflowError('You cannot draft records.')
  const d = incidentDraftInput.parse(input)
  const why = reason.trim() || (d.id ? 'Edited' : 'Initial draft')
  return withActor(user.id, why, async (tx) => {
    let id = d.id
    if (!id) {
      const year = Number(d.dateStart.slice(0, 4))
      const prefix = opts.idPrefix ?? 'US'
      const res = await tx.execute<{ id: string }>(sql`select record.next_id(${prefix}, ${year}) as id`)
      id = res.rows[0]!.id
      await tx.insert(incidents).values({
        id,
        ...incidentValues(d),
        createdBy: user.id,
        isDemo: prefix === 'DEMO',
        leadId: opts.leadId ?? null,
      })
      await audit(tx, user.id, 'incident.create', 'incident', id, { reason: why })
    } else {
      const current = await lockIncident(tx, id)
      assertCanEdit(user, current)
      await tx.update(incidents).set(incidentValues(d)).where(eq(incidents.id, id))
      await audit(tx, user.id, 'incident.save', 'incident', id, { reason: why })
    }
    const newSourceIds = await syncChildren(tx, id, d, user.id)
    const [row] = await tx.select({ revision: incidents.revision }).from(incidents).where(eq(incidents.id, id))
    return { id, revision: row!.revision, newSourceIds }
  })
}

export async function submitForReview(user: SessionUser, id: string) {
  await withActor(user.id, 'Submitted for review', async (tx) => {
    const inc = await lockIncident(tx, id)
    assertCanEdit(user, inc)
    await tx.update(incidents).set({ workflowStatus: 'in_review' }).where(eq(incidents.id, id))
    await audit(tx, user.id, 'incident.submit', 'incident', id, { revision: inc.revision })
  })
}

export async function withdrawFromReview(user: SessionUser, id: string) {
  await withActor(user.id, 'Withdrawn from review', async (tx) => {
    const inc = await lockIncident(tx, id)
    assertCanEdit(user, inc)
    if (inc.workflowStatus !== 'in_review' && inc.workflowStatus !== 'approved') throw new WorkflowError('This record is not in review.')
    await tx.update(incidents).set({ workflowStatus: 'draft' }).where(eq(incidents.id, id))
    await audit(tx, user.id, 'incident.withdraw', 'incident', id)
  })
}

export type Checklist = Record<ReviewChecklistKey, boolean>

export async function reviewIncident(user: SessionUser, id: string, decision: ReviewDecision, checklist: Checklist, comments: string) {
  if (!can.review(user.role)) throw new WorkflowError('Only editors can review records.')
  if (decision === 'approved' && !Object.values(checklist).every(Boolean)) {
    throw new WorkflowError('Tick every item on the checklist before approving.')
  }
  if (decision === 'returned' && !comments.trim()) throw new WorkflowError('Say what needs to change when returning a draft.')
  await withActor(user.id, `Review: ${decision}`, async (tx) => {
    await tx.insert(reviews).values({ incidentId: id, revision: 0, reviewerId: user.id, decision, comments: comments.trim(), ...checklist })
  })
}

export async function publishIncident(user: SessionUser, id: string, note: string) {
  if (!can.publish(user.role)) throw new WorkflowError('Only senior editors can publish.')
  const before = await adminDb().select({ slug: publishedIncidents.slug }).from(publishedIncidents).where(eq(publishedIncidents.id, id))
  const revision = await withActor(user.id, 'Published', async (tx) => {
    const res = await tx.execute<{ revision: number }>(sql`select record.publish_incident(${id}, ${note}, ${METHODOLOGY_VERSION}) as revision`)
    return res.rows[0]!.revision
  })
  const [after] = await adminDb().select({ slug: publishedIncidents.slug }).from(publishedIncidents).where(eq(publishedIncidents.id, id))
  revalidateRecord(id, [before[0]?.slug, after?.slug])
  return revision
}

export async function unpublishIncident(user: SessionUser, id: string, reason: string) {
  if (!can.publish(user.role)) throw new WorkflowError('Only senior editors can unpublish.')
  const [snap] = await adminDb().select({ slug: publishedIncidents.slug }).from(publishedIncidents).where(eq(publishedIncidents.id, id))
  await withActor(user.id, 'Unpublished', async (tx) => {
    await tx.execute(sql`select record.unpublish_incident(${id}, ${reason})`)
  })
  revalidateRecord(id, [snap?.slug])
}

export async function excludeIncident(user: SessionUser, id: string, reason: string) {
  if (!can.review(user.role)) throw new WorkflowError('Only editors can exclude records.')
  if (!reason.trim()) throw new WorkflowError('Give the reason this record is out of scope.')
  await withActor(user.id, `Excluded: ${reason}`, async (tx) => {
    await lockIncident(tx, id)
    await tx.update(incidents).set({ workflowStatus: 'excluded', exclusionReason: reason.trim() }).where(eq(incidents.id, id))
    await audit(tx, user.id, 'incident.exclude', 'incident', id, { reason })
  })
}

export async function restoreIncident(user: SessionUser, id: string) {
  if (!can.review(user.role)) throw new WorkflowError('Only editors can restore excluded records.')
  await withActor(user.id, 'Restored to draft', async (tx) => {
    const inc = await lockIncident(tx, id)
    if (inc.workflowStatus !== 'excluded') throw new WorkflowError('This record is not excluded.')
    await tx.update(incidents).set({ workflowStatus: 'draft', exclusionReason: null }).where(eq(incidents.id, id))
    await audit(tx, user.id, 'incident.restore', 'incident', id)
  })
}

export async function publishBlockers(id: string): Promise<string[]> {
  const res = await adminDb().execute<{ b: string[] }>(sql`select record.publish_blockers(${id}) as b`)
  return res.rows[0]?.b ?? []
}

// ---------------------------------------------------------------------------
// Reading records for the editor
// ---------------------------------------------------------------------------
export async function loadDraft(id: string): Promise<{ incident: Incident; draft: IncidentDraftInput } | null> {
  const db = adminDb()
  const [inc] = await db.select().from(incidents).where(eq(incidents.id, id))
  if (!inc) return null
  const [srcs, events, stmts, links] = await Promise.all([
    db.select().from(sources).where(eq(sources.incidentId, id)).orderBy(asc(sources.position), asc(sources.createdAt)),
    db.select().from(legalEvents).where(eq(legalEvents.incidentId, id)).orderBy(asc(legalEvents.date), asc(legalEvents.createdAt)),
    db.select().from(statements).where(eq(statements.incidentId, id)).orderBy(asc(statements.createdAt)),
    db.select().from(incidentCases).where(eq(incidentCases.incidentId, id)),
  ])
  const draft: IncidentDraftInput = {
    id: inc.id,
    title: inc.title,
    summary: inc.summary,
    dateStart: inc.dateStart,
    dateEnd: inc.dateEnd,
    datePrecision: inc.datePrecision,
    stateFips: inc.stateFips,
    countyFips: inc.countyFips,
    city: inc.city,
    lat: inc.lat,
    lng: inc.lng,
    locationPrecision: inc.locationPrecision,
    incidentTypes: inc.incidentTypes,
    targetType: inc.targetType,
    targetAttributes: inc.targetAttributes,
    severity: inc.severity,
    deaths: inc.deaths,
    injuries: inc.injuries,
    propertyDamage: inc.propertyDamage,
    perpetratorType: inc.perpetratorType,
    perpetratorCount: inc.perpetratorCount,
    perpetratorNames: inc.perpetratorNames,
    biasIndicators: inc.biasIndicators,
    verificationLevel: inc.verificationLevel,
    legalStatus: inc.legalStatus,
    hateCrimeCharged: inc.hateCrimeCharged,
    agenciesInvolved: inc.agenciesInvolved,
    relatedIncidentIds: inc.relatedIncidentIds,
    tags: inc.tags,
    caseIds: links.map((l) => l.caseId),
    editorNotes: inc.editorNotes,
    sources: srcs.map((s) => ({
      id: s.id,
      url: s.url,
      outlet: s.outlet,
      title: s.title,
      author: s.author,
      publishedDate: s.publishedDate,
      accessedDate: s.accessedDate,
      sourceType: s.sourceType,
      claimAttribution: s.claimAttribution,
    })),
    legalEvents: events.map((e) => ({ id: e.id, date: e.date, eventType: e.eventType, description: e.description, sourceId: e.sourceId, caseId: e.caseId })),
    statements: stmts.map((s) => ({
      id: s.id,
      speaker: s.speaker,
      speakerRole: s.speakerRole,
      organization: s.organization,
      statementType: s.statementType,
      date: s.date,
      quote: s.quote,
      paraphrase: s.paraphrase,
      sourceId: s.sourceId,
    })),
  }
  return { incident: inc, draft }
}

export async function loadWorkflowContext(id: string) {
  const db = adminDb()
  const [inc] = await db.select().from(incidents).where(eq(incidents.id, id))
  if (!inc) return null
  const [reviewRows, pubRows, logRows, editors, live, author, blockers, archive] = await Promise.all([
    db
      .select({
        id: reviews.id,
        revision: reviews.revision,
        decision: reviews.decision,
        comments: reviews.comments,
        createdAt: reviews.createdAt,
        reviewer: users.displayName,
        reviewerId: reviews.reviewerId,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.reviewerId))
      .where(eq(reviews.incidentId, id))
      .orderBy(desc(reviews.createdAt)),
    db.select().from(publications).where(eq(publications.incidentId, id)).orderBy(desc(publications.id)),
    db
      .select({
        id: changeLog.id,
        revision: changeLog.revision,
        field: changeLog.field,
        reason: changeLog.reason,
        createdAt: changeLog.createdAt,
        actor: users.displayName,
      })
      .from(changeLog)
      .leftJoin(users, eq(users.id, changeLog.actorId))
      .where(eq(changeLog.incidentId, id))
      .orderBy(desc(changeLog.id))
      .limit(200),
    db
      .select({ actorId: incidentEdits.actorId, name: users.displayName })
      .from(incidentEdits)
      .innerJoin(users, eq(users.id, incidentEdits.actorId))
      .where(and(eq(incidentEdits.incidentId, id), eq(incidentEdits.revision, inc.revision))),
    db.select({ revision: publishedIncidents.revision, slug: publishedIncidents.slug }).from(publishedIncidents).where(eq(publishedIncidents.id, id)),
    db.select({ name: users.displayName }).from(users).where(eq(users.id, inc.createdBy)),
    publishBlockers(id),
    db.select({ id: sources.id, url: sources.url, status: sources.archiveStatus, archivedUrl: sources.archivedUrl, error: sources.archiveLastError }).from(sources).where(eq(sources.incidentId, id)),
  ])
  return {
    incident: inc,
    reviews: reviewRows,
    publications: pubRows,
    changeLog: logRows,
    editorsOfRevision: editors,
    live: live[0] ?? null,
    authorName: author[0]?.name ?? 'Unknown',
    blockers,
    archive,
  }
}

export type DuplicateCandidate = {
  id: string
  title: string
  summary: string
  dateStart: string
  city: string | null
  stateFips: string
  workflowStatus: string
  sameCity: boolean
  textScore: number
  km: number | null
}

/** Possible duplicates: within ±3 days, and the same city or similar text (Section 4). */
export async function findDuplicates(p: {
  id: string | null
  dateStart: string
  stateFips: string
  city: string | null
  lat: number | null
  lng: number | null
  text: string
}): Promise<DuplicateCandidate[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateStart)) return []
  const text = p.text.slice(0, 2000)
  const res = await adminDb().execute<{
    id: string
    title: string
    summary: string
    date_start: string
    city: string | null
    state_fips: string
    workflow_status: string
    same_city: boolean
    text_score: number
    km: number | null
  }>(sql`
    SELECT i.id, i.title, i.summary, i.date_start, i.city, i.state_fips, i.workflow_status,
      (i.city IS NOT NULL AND lower(i.city) = lower(${p.city ?? ''}) AND i.state_fips = ${p.stateFips}) AS same_city,
      similarity(i.title || ' ' || i.summary, ${text}) AS text_score,
      CASE WHEN ${p.lat}::float8 IS NOT NULL AND ${p.lng}::float8 IS NOT NULL AND i.geom IS NOT NULL
        THEN round((ST_DistanceSphere(i.geom, ST_SetSRID(ST_MakePoint(${p.lng}::float8, ${p.lat}::float8), 4326)) / 1000)::numeric, 1)::float8
      END AS km
    FROM record.incidents i
    WHERE i.id <> ${p.id ?? ''}
      AND abs(i.date_start - ${p.dateStart}::date) <= 3
      AND (
        (i.city IS NOT NULL AND lower(i.city) = lower(${p.city ?? ''}) AND i.state_fips = ${p.stateFips})
        OR similarity(i.title || ' ' || i.summary, ${text}) > 0.2
        OR (${p.lat}::float8 IS NOT NULL AND i.geom IS NOT NULL
            AND ST_DWithin(i.geom::geography, ST_SetSRID(ST_MakePoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography, 25000))
      )
    ORDER BY same_city DESC, text_score DESC
    LIMIT 10`)
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    dateStart: r.date_start,
    city: r.city,
    stateFips: r.state_fips,
    workflowStatus: r.workflow_status,
    sameCity: r.same_city,
    textScore: Number(r.text_score),
    km: r.km === null ? null : Number(r.km),
  }))
}

export async function listIncidents(filter: { status?: string; q?: string; mine?: string } = {}) {
  const db = adminDb()
  const conds = []
  if (filter.status) conds.push(sql`${incidents.workflowStatus}::text = ${filter.status}`)
  if (filter.mine) conds.push(eq(incidents.createdBy, filter.mine))
  if (filter.q) conds.push(sql`(${incidents.id} ILIKE ${'%' + filter.q + '%'} OR ${incidents.title} ILIKE ${'%' + filter.q + '%'})`)
  return db
    .select({
      id: incidents.id,
      title: incidents.title,
      dateStart: incidents.dateStart,
      stateFips: incidents.stateFips,
      city: incidents.city,
      workflowStatus: incidents.workflowStatus,
      verificationLevel: incidents.verificationLevel,
      revision: incidents.revision,
      updatedAt: incidents.updatedAt,
      nextReviewDue: incidents.nextReviewDue,
      author: users.displayName,
      createdBy: incidents.createdBy,
      liveRevision: publishedIncidents.revision,
    })
    .from(incidents)
    .innerJoin(users, eq(users.id, incidents.createdBy))
    .leftJoin(publishedIncidents, eq(publishedIncidents.id, incidents.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(incidents.updatedAt))
    .limit(200)
}

/** Drafts waiting for a second editor, excluding the viewer's own work. */
export async function reviewQueue(user: SessionUser) {
  const rows = await listIncidents({ status: 'in_review' })
  const db = adminDb()
  const edits = rows.length
    ? await db
        .select({ incidentId: incidentEdits.incidentId, revision: incidentEdits.revision, actorId: incidentEdits.actorId })
        .from(incidentEdits)
        .where(inArray(incidentEdits.incidentId, rows.map((r) => r.id)))
    : []
  return rows.map((r) => {
    const editedByMe = edits.some((e) => e.incidentId === r.id && e.revision === r.revision && e.actorId === user.id)
    return { ...r, canReview: r.createdBy !== user.id && !editedByMe, whyNot: r.createdBy === user.id ? 'You wrote it' : editedByMe ? 'You edited this revision' : null }
  })
}

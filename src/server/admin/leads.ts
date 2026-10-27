/**
 * Leads inbox (Section 4, step 1): every public submission and monitor match
 * lands here. Triage marks it a new incident (creating a V0 draft), an
 * update to a record, a duplicate, or out of scope with a reason.
 */
import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { incidents, leads, newsCandidates, submissionFiles, submissionPrivate, submissions } from '@/db/schema'
import { INCIDENT_TYPES, type IncidentType, type LeadSource, type LeadStatus } from '@/db/enums'
import { stateByFips } from '@/lib/states'
import { decryptText } from '@/lib/crypto'
import { isRecordId } from '@/lib/slug'
import { todayIso } from '@/lib/format'
import { audit } from './audit'
import { WorkflowError, emptyDraft, saveIncident } from './incidents'
import { can } from './permissions'
import type { SessionUser } from './session'

export async function listLeads(status: LeadStatus | 'all' = 'new') {
  return adminDb()
    .select({
      id: leads.id,
      source: leads.source,
      status: leads.status,
      headline: leads.headline,
      url: leads.url,
      outlet: leads.outlet,
      publishedDate: leads.publishedDate,
      matchedTerms: leads.matchedTerms,
      incidentId: leads.incidentId,
      createdAt: leads.createdAt,
      city: submissions.city,
      stateFips: submissions.stateFips,
      scan: newsCandidates.assessment,
      scanNote: newsCandidates.note,
    })
    .from(leads)
    .leftJoin(submissions, eq(submissions.id, leads.submissionId))
    .leftJoin(newsCandidates, eq(newsCandidates.leadId, leads.id))
    .where(status === 'all' ? undefined : eq(leads.status, status))
    .orderBy(desc(leads.createdAt))
    .limit(200)
}

export type ContactDetails = { name: string | null; email: string | null; phone: string | null }

/** Submission details for editors. Contact details are decrypted only for roles allowed to see them. */
export async function loadSubmission(user: SessionUser, submissionId: string) {
  const db = adminDb()
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId))
  if (!sub) return null
  const files = await db
    .select({ id: submissionFiles.id, mimeType: submissionFiles.mimeType, sizeBytes: submissionFiles.sizeBytes, metadataStripped: submissionFiles.metadataStripped, createdAt: submissionFiles.createdAt })
    .from(submissionFiles)
    .where(eq(submissionFiles.submissionId, submissionId))
  let contact: ContactDetails | null = null
  let address: string | null = null
  if (can.viewSubmitterDetails(user.role)) {
    const [priv] = await db.select().from(submissionPrivate).where(eq(submissionPrivate.submissionId, submissionId))
    if (priv?.contactEnc) contact = JSON.parse(decryptText(priv.contactEnc, 'SUBMISSIONS_ENCRYPTION_KEY', `contact:${submissionId}`)) as ContactDetails
    if (priv?.addressEnc) address = decryptText(priv.addressEnc, 'SUBMISSIONS_ENCRYPTION_KEY', `address:${submissionId}`)
    if (priv) await audit(null, user.id, 'submission.view_private', 'submission', submissionId)
  }
  return { submission: sub, files, contact, address }
}

export async function getLead(user: SessionUser, id: string) {
  const [lead] = await adminDb().select().from(leads).where(eq(leads.id, id))
  if (!lead) return null
  const sub = lead.submissionId ? await loadSubmission(user, lead.submissionId) : null
  return { lead, sub }
}

export type TriageDecision = Exclude<LeadStatus, 'new'>

export async function triageLead(
  user: SessionUser,
  id: string,
  decision: TriageDecision,
  opts: { reason?: string; incidentId?: string; stateFips?: string; incidentType?: IncidentType },
) {
  if (!can.triage(user.role)) throw new WorkflowError('Only editors can triage leads.')
  const db = adminDb()
  const [lead] = await db.select().from(leads).where(eq(leads.id, id))
  if (!lead) throw new WorkflowError('Lead not found.')
  if (lead.status !== 'new') throw new WorkflowError('This lead has already been triaged.')
  const reason = opts.reason?.trim() ?? ''
  let incidentId = opts.incidentId?.trim().toUpperCase() || null

  if (decision === 'out_of_scope' && !reason) throw new WorkflowError('Give the reason it is out of scope.')
  if ((decision === 'update' || (decision === 'duplicate' && incidentId)) && !(incidentId && isRecordId(incidentId))) {
    throw new WorkflowError('Enter the id of the existing record, e.g. US-2026-0412.')
  }
  if (incidentId && decision !== 'new_incident') {
    const [exists] = await db.select({ id: incidents.id }).from(incidents).where(eq(incidents.id, incidentId))
    if (!exists) throw new WorkflowError(`No record ${incidentId}.`)
  }

  if (decision === 'new_incident') {
    const sub = lead.submissionId ? (await db.select().from(submissions).where(eq(submissions.id, lead.submissionId)))[0] : undefined
    // From the morning scan: its reading of the article, unverified.
    const scan = (await db.select({ a: newsCandidates.assessment, model: newsCandidates.model }).from(newsCandidates).where(eq(newsCandidates.leadId, lead.id)).limit(1))[0]
    const a = scan?.a ?? null
    const scanDate = a?.incident_date && /^\d{4}-\d{2}-\d{2}$/.test(a.incident_date) && a.incident_date >= '2020-01-01' && a.incident_date <= todayIso() ? a.incident_date : null
    const draft = emptyDraft()
    draft.title = `Untriaged lead: ${lead.headline}`.slice(0, 110)
    draft.dateStart = sub?.incidentDate ?? scanDate ?? lead.publishedDate ?? todayIso()
    const stateFips = opts.stateFips || sub?.stateFips || ''
    if (!stateByFips(stateFips)) throw new WorkflowError('Choose the state for the new draft.')
    if (!opts.incidentType || !INCIDENT_TYPES.includes(opts.incidentType)) throw new WorkflowError('Choose an incident type for the new draft.')
    draft.stateFips = stateFips
    draft.city = sub?.city ?? a?.city ?? null
    draft.incidentTypes = [opts.incidentType]
    draft.editorNotes = [
      `Created from lead ${lead.id} (${lead.source}).`,
      sub ? `Submission says: ${sub.whatHappened}` : null,
      lead.url ? `Lead link: ${lead.url}` : null,
      a ? `Morning scan (${scan?.model ?? 'model'}), unverified: ${a.summary} Why: ${a.reason}` : null,
      sub?.links.length ? `Links given: ${sub.links.join(' ')}` : null,
    ]
      .filter(Boolean)
      .join('\n')
    const res = await saveIncident(user, draft, 'Draft created from lead', { leadId: lead.id })
    incidentId = res.id
  }

  await db
    .update(leads)
    .set({ status: decision, triageReason: reason || null, incidentId, triagedBy: user.id, triagedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.status, 'new')))
  if (lead.submissionId && (decision === 'duplicate' || decision === 'out_of_scope')) {
    await db.update(submissions).set({ resolvedAt: new Date() }).where(eq(submissions.id, lead.submissionId))
  }
  await audit(null, user.id, `lead.${decision}`, 'lead', id, { incidentId, reason })
  return { incidentId }
}

export async function createManualLead(user: SessionUser, input: { headline: string; url: string | null; outlet: string | null; source: LeadSource }) {
  if (!can.triage(user.role)) throw new WorkflowError('Only editors can add leads.')
  if (!input.headline.trim()) throw new WorkflowError('Give the lead a headline.')
  const [row] = await adminDb()
    .insert(leads)
    .values({ source: input.source, headline: input.headline.trim().slice(0, 300), url: input.url, outlet: input.outlet })
    .returning({ id: leads.id })
  await audit(null, user.id, 'lead.create', 'lead', row!.id)
  return row!.id
}

export async function leadCounts() {
  const res = await adminDb().execute<{ status: LeadStatus; n: number }>(sql`select status, count(*)::int as n from record.leads group by status`)
  return Object.fromEntries(res.rows.map((r) => [r.status, Number(r.n)])) as Partial<Record<LeadStatus, number>>
}

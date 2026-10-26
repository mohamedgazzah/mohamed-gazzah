/** Corrections queue with SLA timers: 72-hour response (48 hours for privacy removals), 7-day fix. */
import 'server-only'
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { correctionTickets, submissions, users } from '@/db/schema'
import type { CorrectionStatus } from '@/db/enums'
import { audit } from './audit'
import { WorkflowError } from './incidents'
import { can } from './permissions'
import type { SessionUser } from './session'

export async function listTickets(open = true) {
  return adminDb()
    .select({
      id: correctionTickets.id,
      recordId: correctionTickets.recordId,
      status: correctionTickets.status,
      isPrivacyRequest: correctionTickets.isPrivacyRequest,
      responseDueAt: correctionTickets.responseDueAt,
      fixDueAt: correctionTickets.fixDueAt,
      firstResponseAt: correctionTickets.firstResponseAt,
      createdAt: correctionTickets.createdAt,
      excerpt: sql<string>`left(${submissions.whatHappened}, 200)`,
      assignee: users.displayName,
    })
    .from(correctionTickets)
    .innerJoin(submissions, eq(submissions.id, correctionTickets.submissionId))
    .leftJoin(users, eq(users.id, correctionTickets.assignedTo))
    .where(open ? inArray(correctionTickets.status, ['open', 'responded']) : undefined)
    .orderBy(open ? asc(correctionTickets.responseDueAt) : desc(correctionTickets.createdAt))
    .limit(200)
}

export async function getTicket(id: string) {
  const [t] = await adminDb().select().from(correctionTickets).where(eq(correctionTickets.id, id))
  return t ?? null
}

export async function updateTicket(user: SessionUser, id: string, action: 'assign' | 'respond' | 'resolve' | 'decline', note: string) {
  if (!can.handleCorrections(user.role)) throw new WorkflowError('Only editors can handle corrections.')
  const t = await getTicket(id)
  if (!t) throw new WorkflowError('Ticket not found.')
  const now = new Date()
  const db = adminDb()
  if (action === 'assign') {
    await db.update(correctionTickets).set({ assignedTo: user.id }).where(eq(correctionTickets.id, id))
  } else if (action === 'respond') {
    if (!note.trim()) throw new WorkflowError('Record what you told the requester.')
    await db
      .update(correctionTickets)
      .set({ status: 'responded', firstResponseAt: t.firstResponseAt ?? now, resolutionNote: note.trim() })
      .where(eq(correctionTickets.id, id))
  } else {
    if (!note.trim()) throw new WorkflowError(action === 'decline' ? 'Give the factual or legal basis for declining.' : 'Describe the fix.')
    const status: CorrectionStatus = action === 'resolve' ? 'resolved' : 'declined'
    await db
      .update(correctionTickets)
      .set({ status, resolvedAt: now, firstResponseAt: t.firstResponseAt ?? now, resolutionNote: note.trim() })
      .where(eq(correctionTickets.id, id))
    await db.update(submissions).set({ resolvedAt: now }).where(eq(submissions.id, t.submissionId))
  }
  await audit(null, user.id, `correction.${action}`, 'correction', id, { recordId: t.recordId })
}

export function slaState(t: { status: string; responseDueAt: Date; fixDueAt: Date; firstResponseAt: Date | null }, now = new Date()) {
  if (t.status === 'resolved' || t.status === 'declined') return { label: 'Closed', overdue: false }
  if (!t.firstResponseAt) {
    const hours = Math.round((t.responseDueAt.getTime() - now.getTime()) / 3_600_000)
    return hours < 0 ? { label: `Response overdue by ${-hours} h`, overdue: true } : { label: `Respond within ${hours} h`, overdue: false }
  }
  const days = Math.ceil((t.fixDueAt.getTime() - now.getTime()) / 86_400_000)
  return days < 0 ? { label: `Fix overdue by ${-days} d`, overdue: true } : { label: `Fix due in ${days} d`, overdue: false }
}

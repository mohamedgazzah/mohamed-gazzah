/**
 * Submitter data retention: contact details, addresses and files are deleted
 * 12 months after the matter is resolved, unless the submitter agreed to
 * keep them. Also clears expired sessions, and articles the news scan
 * skipped or failed over a year ago (ones that became leads stay with them).
 */
import 'server-only'
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { newsCandidates, submissionFiles, submissionPrivate, submissions } from '@/db/schema'
import { SLA } from '@/db/enums'
import { audit } from '../admin/audit'
import { purgeExpiredSessions } from '../admin/session'
import { deleteObject } from '../shared/storage'

export async function runRetention(now = new Date()) {
  const db = adminDb()

  // A submission is resolved when its lead's record reaches a final legal
  // outcome or is excluded (duplicates and out-of-scope leads are marked at triage).
  await db.execute(sql`
    UPDATE record.submissions s SET resolved_at = now()
    FROM record.leads l JOIN record.incidents i ON i.id = l.incident_id
    WHERE l.submission_id = s.id AND s.resolved_at IS NULL
      AND (record.is_final_status(i.legal_status) OR i.workflow_status = 'excluded')`)

  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - SLA.submitterDataRetentionMonths)
  const due = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(lt(submissions.resolvedAt, cutoff), eq(submissions.keepConsent, false), isNull(submissions.purgedAt)))
    .limit(500)

  let files = 0
  for (const { id } of due) {
    const rows = await db.select({ id: submissionFiles.id, key: submissionFiles.storageKey }).from(submissionFiles).where(eq(submissionFiles.submissionId, id))
    for (const f of rows) await deleteObject(f.key)
    if (rows.length) await db.delete(submissionFiles).where(inArray(submissionFiles.id, rows.map((r) => r.id)))
    files += rows.length
    await db.delete(submissionPrivate).where(eq(submissionPrivate.submissionId, id))
    await db.update(submissions).set({ purgedAt: now, hasContact: false, fileCount: 0 }).where(eq(submissions.id, id))
  }
  if (due.length) await audit(null, null, 'retention.purge', 'submission', null, { submissions: due.length, files })
  await purgeExpiredSessions()
  const yearAgo = new Date(now)
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const oldArticles = await db
    .delete(newsCandidates)
    .where(and(inArray(newsCandidates.status, ['skipped', 'failed']), lt(newsCandidates.createdAt, yearAgo)))
    .returning({ id: newsCandidates.id })
  return { purged: due.length, files, scanArticles: oldArticles.length }
}

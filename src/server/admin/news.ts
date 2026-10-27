/**
 * The morning news scan, as editors see it: the reading behind a lead, and a
 * log of every article read, including the ones it skipped.
 */
import 'server-only'
import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { newsCandidates } from '@/db/schema'
import type { NewsCandidateStatus } from '@/db/enums'

export async function scanReadingForLead(leadId: string) {
  const [row] = await adminDb().select().from(newsCandidates).where(eq(newsCandidates.leadId, leadId)).limit(1)
  return row ?? null
}

export async function listScanCandidates(opts: { status?: NewsCandidateStatus | 'all'; days?: number }) {
  const since = new Date(Date.now() - (opts.days ?? 7) * 86_400_000)
  return adminDb()
    .select()
    .from(newsCandidates)
    .where(and(gte(newsCandidates.createdAt, since), opts.status && opts.status !== 'all' ? eq(newsCandidates.status, opts.status) : undefined))
    .orderBy(desc(newsCandidates.createdAt), desc(newsCandidates.id))
    .limit(300)
}

/** Counts by status and tokens used over the last `days` days. */
export async function scanSummary(days = 7) {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await adminDb()
    .select({
      status: newsCandidates.status,
      n: count(),
      input: sql<number>`coalesce(sum((${newsCandidates.usage}->>'input_tokens')::int), 0)`.mapWith(Number),
      output: sql<number>`coalesce(sum((${newsCandidates.usage}->>'output_tokens')::int), 0)`.mapWith(Number),
      cacheRead: sql<number>`coalesce(sum((${newsCandidates.usage}->>'cache_read_input_tokens')::int), 0)`.mapWith(Number),
      cacheWrite: sql<number>`coalesce(sum((${newsCandidates.usage}->>'cache_creation_input_tokens')::int), 0)`.mapWith(Number),
    })
    .from(newsCandidates)
    .where(gte(newsCandidates.createdAt, since))
    .groupBy(newsCandidates.status)
  const [last] = await adminDb().select({ at: sql<string | null>`max(${newsCandidates.createdAt})` }).from(newsCandidates)
  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  for (const r of rows) {
    total.input += r.input
    total.output += r.output
    total.cacheRead += r.cacheRead
    total.cacheWrite += r.cacheWrite
  }
  return { byStatus: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<NewsCandidateStatus, number>>, tokens: total, lastFound: last?.at ?? null }
}

/**
 * Archive every source with the Internet Archive's Save Page Now, so sources
 * survive link rot and deletion. Runs right after a save and again from the
 * scheduled job until each source has an archived copy.
 */
import 'server-only'
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { publishedIncidents, sources } from '@/db/schema'
import { revalidateRecord } from '../shared/revalidate'

const MAX_ATTEMPTS = 6
const base = () => (process.env.WAYBACK_BASE_URL ?? 'https://web.archive.org').replace(/\/$/, '')

type Outcome = { status: 'archived'; archivedUrl: string } | { status: 'pending'; jobId: string } | { status: 'error'; error: string }

function archivedFromLocation(loc: string | null): string | null {
  if (!loc) return null
  const m = /\/web\/(\d{8,14})\/(.+)$/.exec(loc)
  return m ? `https://web.archive.org/web/${m[1]}/${m[2]}` : null
}

/** One Save Page Now request (authenticated SPN2 when keys are set). */
export async function requestArchive(url: string, jobId: string | null): Promise<Outcome> {
  const key = process.env.WAYBACK_ACCESS_KEY
  const secret = process.env.WAYBACK_SECRET_KEY
  try {
    if (key && secret) {
      const auth = { Authorization: `LOW ${key}:${secret}`, Accept: 'application/json' }
      if (!jobId) {
        const res = await fetch(`${base()}/save`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ url, skip_first_archive: '1' }),
          signal: AbortSignal.timeout(20_000),
        })
        const data = (await res.json()) as { job_id?: string; message?: string }
        if (!data.job_id) return { status: 'error', error: data.message ?? `HTTP ${res.status}` }
        jobId = data.job_id
      }
      const res = await fetch(`${base()}/save/status/${encodeURIComponent(jobId)}`, { headers: auth, signal: AbortSignal.timeout(20_000) })
      const data = (await res.json()) as { status?: string; timestamp?: string; original_url?: string; message?: string }
      if (data.status === 'success' && data.timestamp) {
        return { status: 'archived', archivedUrl: `https://web.archive.org/web/${data.timestamp}/${data.original_url ?? url}` }
      }
      if (data.status === 'pending') return { status: 'pending', jobId }
      return { status: 'error', error: data.message ?? `status ${data.status}` }
    }
    const res = await fetch(`${base()}/save/${url}`, { redirect: 'manual', signal: AbortSignal.timeout(90_000) })
    const archived = archivedFromLocation(res.headers.get('location')) ?? archivedFromLocation(res.headers.get('content-location'))
    if (archived) return { status: 'archived', archivedUrl: archived }
    return { status: 'error', error: `HTTP ${res.status}` }
  } catch (err) {
    return { status: 'error', error: (err as Error).message.slice(0, 300) }
  }
}

/** Archive pending sources: given ids, or the oldest pending ones. */
export async function archivePending(opts: { ids?: string[]; limit?: number } = {}) {
  const db = adminDb()
  const where = opts.ids?.length
    ? and(inArray(sources.id, opts.ids), eq(sources.archiveStatus, 'pending'))
    : and(eq(sources.archiveStatus, 'pending'), lt(sources.archiveAttempts, MAX_ATTEMPTS))
  const batch = await db
    .select({ id: sources.id, url: sources.url, incidentId: sources.incidentId, attempts: sources.archiveAttempts, jobId: sources.archiveJobId })
    .from(sources)
    .where(where)
    .orderBy(asc(sources.createdAt))
    .limit(opts.limit ?? 20)

  const touched = new Set<string>()
  const results = { archived: 0, pending: 0, failed: 0 }
  for (const s of batch) {
    const outcome = await requestArchive(s.url, s.jobId)
    const attempts = s.attempts + 1
    if (outcome.status === 'archived') {
      await db
        .update(sources)
        .set({ archivedUrl: outcome.archivedUrl, archiveStatus: 'archived', archivedAt: new Date(), archiveAttempts: attempts, archiveLastError: null, archiveJobId: null })
        .where(eq(sources.id, s.id))
      touched.add(s.incidentId)
      results.archived++
    } else if (outcome.status === 'pending') {
      await db.update(sources).set({ archiveJobId: outcome.jobId, archiveAttempts: attempts }).where(eq(sources.id, s.id))
      results.pending++
    } else {
      await db
        .update(sources)
        .set({ archiveAttempts: attempts, archiveLastError: outcome.error, archiveStatus: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', archiveJobId: null })
        .where(eq(sources.id, s.id))
      results.failed++
    }
  }

  // Live records get the archived links without a new review (see refresh_archived_urls).
  for (const incidentId of touched) {
    const [live] = await db.select({ slug: publishedIncidents.slug }).from(publishedIncidents).where(eq(publishedIncidents.id, incidentId))
    if (live) {
      await db.execute(sql`select record.refresh_archived_urls(${incidentId})`)
      revalidateRecord(incidentId, [live.slug])
    }
  }
  return { checked: batch.length, ...results }
}

export async function retryArchive(sourceId: string) {
  await adminDb().update(sources).set({ archiveStatus: 'pending', archiveAttempts: 0, archiveLastError: null, archiveJobId: null }).where(eq(sources.id, sourceId))
  return archivePending({ ids: [sourceId] })
}

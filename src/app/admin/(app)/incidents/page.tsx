import Link from 'next/link'
import { and, asc, eq, isNotNull, lte, sql } from 'drizzle-orm'
import { StatusPill } from '@/components/admin/StatusPill'
import { adminDb } from '@/db/admin'
import { incidents, sources } from '@/db/schema'
import { WORKFLOW_STATUSES, WORKFLOW_STATUS_META, type WorkflowStatus } from '@/db/enums'
import { formatDate, formatPlace, formatTimestamp, todayIso } from '@/lib/format'
import { stateByFips } from '@/lib/states'
import { listIncidents } from '@/server/admin/incidents'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'Records' }

export default async function RecordsPage(props: PageProps<'/admin/incidents'>) {
  const me = await requireUser()
  const sp = await props.searchParams
  const status = typeof sp.status === 'string' && (WORKFLOW_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as WorkflowStatus) : undefined
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : undefined
  let rows = await listIncidents({ status, q, mine: sp.mine ? me.id : undefined })
  if (sp.due) {
    const due = new Set(
      (await adminDb().select({ id: incidents.id }).from(incidents).where(and(isNotNull(incidents.nextReviewDue), lte(incidents.nextReviewDue, todayIso())))).map((r) => r.id),
    )
    rows = rows.filter((r) => due.has(r.id))
  }
  if (sp.archive === 'failed') {
    const failed = new Set((await adminDb().selectDistinct({ id: sources.incidentId }).from(sources).where(eq(sources.archiveStatus, 'failed'))).map((r) => r.id))
    rows = rows.filter((r) => failed.has(r.id))
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Records</h1>
        <Link href="/admin/incidents/new" className="btn">
          Draft a new record
        </Link>
      </div>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="q" className="label">
            Search id or title
          </label>
          <input id="q" name="q" defaultValue={q} className="control" />
        </div>
        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ''} className="control">
            <option value="">Any</option>
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {WORKFLOW_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
      </form>
      <div className="table-scroll card mt-4" role="region" aria-label="Records" tabIndex={0}>
        <table className="data-table">
          <caption className="sr-only">Working copies of records</caption>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Date</th>
              <th scope="col">Place</th>
              <th scope="col">Status</th>
              <th scope="col" className="num">
                Revision
              </th>
              <th scope="col">Author</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/incidents/${r.id}`} className="font-semibold">
                    {r.title}
                  </Link>
                  <span className="block text-sm text-muted tabular">
                    {r.id} · {r.verificationLevel}
                    {r.nextReviewDue && r.nextReviewDue <= todayIso() ? ' · 30-day review due' : ''}
                  </span>
                </td>
                <td className="whitespace-nowrap tabular">{formatDate(r.dateStart)}</td>
                <td className="whitespace-nowrap">{formatPlace(r.city, stateByFips(r.stateFips)?.code)}</td>
                <td>
                  <StatusPill status={r.workflowStatus} live={r.liveRevision} />
                </td>
                <td className="num">{r.revision}</td>
                <td>{r.author}</td>
                <td className="whitespace-nowrap tabular">{formatTimestamp(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="mt-4">No records match.</p> : null}
    </>
  )
}

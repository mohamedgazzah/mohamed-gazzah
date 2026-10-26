import Link from 'next/link'
import { count, desc, eq } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { auditLog, users } from '@/db/schema'
import { formatNumber, isoTimestamp } from '@/lib/format'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'Audit log' }
const PAGE = 100

export default async function AuditPage(props: PageProps<'/admin/audit'>) {
  await requireUser('senior_editor')
  const sp = await props.searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const db = adminDb()
  const [rows, total] = await Promise.all([
    db
      .select({ id: auditLog.id, at: auditLog.at, action: auditLog.action, entityType: auditLog.entityType, entityId: auditLog.entityId, details: auditLog.details, actor: users.displayName })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .orderBy(desc(auditLog.id))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ n: count() }).from(auditLog),
  ])
  const pages = Math.max(1, Math.ceil((total[0]?.n ?? 0) / PAGE))
  return (
    <>
      <h1 className="text-2xl">Audit log</h1>
      <p className="mt-2 hint">Every action by every user. Kept permanently; the database refuses edits and deletions.</p>
      <div className="table-scroll card mt-6" role="region" aria-label="Audit log" tabIndex={0}>
        <table className="data-table">
          <caption className="sr-only">Audit log, newest first</caption>
          <thead>
            <tr>
              <th scope="col">When (UTC)</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
              <th scope="col">Subject</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap tabular">{isoTimestamp(r.at).replace('T', ' ').slice(0, 19)}</td>
                <td>{r.actor ?? 'System'}</td>
                <td>{r.action}</td>
                <td className="tabular">
                  {r.entityType === 'incident' && r.entityId ? <Link href={`/admin/incidents/${r.entityId}`}>{r.entityId}</Link> : `${r.entityType}${r.entityId ? ` ${r.entityId.slice(0, 12)}` : ''}`}
                </td>
                <td className="max-w-md text-sm break-words">{Object.keys(r.details as object).length ? JSON.stringify(r.details) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pages" className="mt-4 flex gap-2">
        {page > 1 ? (
          <Link className="btn btn-secondary" href={`/admin/audit?page=${page - 1}`}>
            Newer
          </Link>
        ) : null}
        <span className="self-center text-sm">
          Page {formatNumber(page)} of {formatNumber(pages)}
        </span>
        {page < pages ? (
          <Link className="btn btn-secondary" href={`/admin/audit?page=${page + 1}`}>
            Older
          </Link>
        ) : null}
      </nav>
    </>
  )
}

import Link from 'next/link'
import { CORRECTION_STATUS_META } from '@/db/enums'
import { formatTimestamp } from '@/lib/format'
import { listTickets, slaState } from '@/server/admin/corrections'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'Corrections' }

export default async function CorrectionsPage(props: PageProps<'/admin/corrections'>) {
  await requireUser('editor')
  const sp = await props.searchParams
  const open = sp.view !== 'all'
  const rows = await listTickets(open)
  return (
    <>
      <h1 className="text-2xl">Corrections queue</h1>
      <p className="mt-2 hint">Respond within 72 hours (48 for removing identifying details). Fix material errors within 7 days, with a public change-log note.</p>
      <nav aria-label="Ticket view" className="mt-4 flex gap-2">
        <Link href="/admin/corrections" className={open ? 'btn' : 'btn btn-secondary'} aria-current={open ? 'page' : undefined}>
          Open
        </Link>
        <Link href="/admin/corrections?view=all" className={!open ? 'btn' : 'btn btn-secondary'} aria-current={!open ? 'page' : undefined}>
          All
        </Link>
      </nav>
      <ul className="mt-6 space-y-3">
        {rows.map((t) => {
          const sla = slaState(t)
          return (
            <li key={t.id} className="card p-4">
              <p className="text-sm tabular">
                <span className={sla.overdue ? 'font-semibold text-severe' : 'text-muted'}>{sla.label}</span>
                <span className="text-muted">
                  {' '}
                  · {CORRECTION_STATUS_META[t.status].label} · {t.recordId} · received {formatTimestamp(t.createdAt)}
                  {t.isPrivacyRequest ? ' · privacy removal request' : ''}
                  {t.assignee ? ` · assigned to ${t.assignee}` : ''}
                </span>
              </p>
              <p className="mt-1">
                <Link href={`/admin/corrections/${t.id}`}>{t.excerpt}</Link>
              </p>
            </li>
          )
        })}
      </ul>
      {rows.length === 0 ? <p className="card mt-6 p-4">No correction requests.</p> : null}
    </>
  )
}

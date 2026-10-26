import Link from 'next/link'
import { formatDate, formatTimestamp } from '@/lib/format'
import { reviewQueue } from '@/server/admin/incidents'
import { requireUser } from '@/server/admin/session'

export const metadata = { title: 'Review queue' }

export default async function ReviewQueuePage() {
  const me = await requireUser('editor')
  const rows = await reviewQueue(me)
  return (
    <>
      <h1 className="text-2xl">Review queue</h1>
      <p className="mt-2 hint">Drafts waiting for a second editor. You cannot review a record you wrote, or a revision you edited.</p>
      {rows.length === 0 ? (
        <p className="card mt-6 p-4">Nothing is waiting for review.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted tabular">
                  {r.id} · {formatDate(r.dateStart)} · revision {r.revision} · by {r.author} · updated {formatTimestamp(r.updatedAt)}
                </p>
              </div>
              {r.canReview ? (
                <Link href={`/admin/review/${r.id}`} className="btn">
                  Review
                </Link>
              ) : (
                <span className="text-sm text-muted">{r.whyNot}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

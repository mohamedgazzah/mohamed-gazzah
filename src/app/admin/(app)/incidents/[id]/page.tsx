import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionForm } from '@/components/admin/ActionForm'
import { RecordEditor } from '@/components/admin/RecordEditor'
import { StatusPill } from '@/components/admin/StatusPill'
import { formatTimestamp } from '@/lib/format'
import { incidentPath } from '@/lib/slug'
import { caseOptions } from '@/server/admin/cases'
import { BLOCKER_MESSAGES } from '@/server/admin/errors'
import { loadDraft, loadWorkflowContext } from '@/server/admin/incidents'
import { can } from '@/server/admin/permissions'
import { requireUser } from '@/server/admin/session'
import {
  excludeAction,
  publishAction,
  restoreAction,
  retryArchiveAction,
  submitAction,
  unpublishAction,
  withdrawAction,
} from '../../../_actions/records'

export const metadata = { title: 'Record' }

const DONE: Record<string, string> = {
  submitted: 'Submitted for review. A second editor will check it.',
  withdrawn: 'Withdrawn. The record is a draft again.',
  published: 'Published. The public page is updating now.',
  unpublished: 'Unpublished. The record is no longer public.',
  excluded: 'Marked as excluded, with the reason kept.',
  restored: 'Restored to draft.',
}

export default async function RecordPage(props: PageProps<'/admin/incidents/[id]'>) {
  const me = await requireUser()
  const { id } = await props.params
  const sp = await props.searchParams
  const [loaded, ctx, cases] = await Promise.all([loadDraft(id), loadWorkflowContext(id), caseOptions()])
  if (!loaded || !ctx) notFound()
  const inc = ctx.incident
  const isAuthor = inc.createdBy === me.id
  const editedThisRevision = ctx.editorsOfRevision.some((e) => e.actorId === me.id)
  const canEdit = can.editAnyRecord(me.role) || (isAuthor && !inc.firstPublishedAt)
  const status = inc.workflowStatus
  const liveIsCurrent = ctx.live?.revision === inc.revision

  return (
    <>
      <p className="text-sm">
        <Link href="/admin/incidents">All records</Link>
      </p>
      <h1 className="mt-1 text-2xl">{inc.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="tabular">{inc.id}</span>
        <StatusPill status={status} live={ctx.live?.revision} />
        <span>Working revision {inc.revision}</span>
        <span>Author: {ctx.authorName}</span>
        <span>Edited this revision: {ctx.editorsOfRevision.map((e) => e.name).join(', ') || '—'}</span>
        {ctx.live ? (
          <Link href={incidentPath(inc.id, ctx.live.slug)} target="_blank">
            View public page
          </Link>
        ) : null}
      </div>
      {sp.saved ? (
        <p role="status" className="mt-3 font-semibold text-confirmed">
          Draft saved.
        </p>
      ) : null}
      {typeof sp.done === 'string' && DONE[sp.done] ? (
        <p role="status" className="mt-3 font-semibold text-confirmed">
          {DONE[sp.done]}
        </p>
      ) : null}
      {sp.reviewed ? (
        <p role="status" className="mt-3 font-semibold text-confirmed">
          Review recorded: {sp.reviewed === 'approved' ? 'approved' : 'returned with comments'}.
        </p>
      ) : null}

      <section aria-labelledby="wf-h" className="card mt-6 space-y-4 p-4 sm:p-5">
        <h2 id="wf-h" className="text-xl">
          Workflow
        </h2>
        {ctx.live && !liveIsCurrent ? (
          <p className="text-base">
            The public page shows revision {ctx.live.revision}. Changes in revision {inc.revision} are not public until reviewed and published.
          </p>
        ) : null}
        {ctx.blockers.length ? (
          <div>
            <p className="font-semibold">Before this can be approved or published:</p>
            <ul className="list-disc ps-5 text-base">
              {ctx.blockers.map((b) => (
                <li key={b}>{BLOCKER_MESSAGES[b] ?? b}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-base text-confirmed">Meets every publishing precondition checked by the database.</p>
        )}
        {status === 'excluded' ? <p className="text-base">Excluded: {inc.exclusionReason}</p> : null}

        <div className="flex flex-wrap gap-6">
          {(status === 'draft' || status === 'returned' || status === 'unpublished') && canEdit ? (
            <ActionForm action={submitAction} submitLabel="Submit for review" className="space-y-2">
              <input type="hidden" name="id" value={inc.id} />
            </ActionForm>
          ) : null}
          {(status === 'in_review' || status === 'approved') && canEdit ? (
            <ActionForm action={withdrawAction} submitLabel="Withdraw from review" buttonClassName="btn btn-secondary" className="space-y-2">
              <input type="hidden" name="id" value={inc.id} />
            </ActionForm>
          ) : null}
          {status === 'in_review' && can.review(me.role) ? (
            isAuthor || editedThisRevision ? (
              <p className="max-w-sm text-base">
                {isAuthor ? 'You wrote this record' : 'You edited this revision'}, so another editor must review it.
              </p>
            ) : (
              <Link href={`/admin/review/${inc.id}`} className="btn">
                Review this record
              </Link>
            )
          ) : null}
          {status === 'approved' && can.publish(me.role) ? (
            <ActionForm action={publishAction} submitLabel={ctx.publications.length ? 'Publish update' : 'Publish'} className="w-full max-w-md space-y-2">
              <input type="hidden" name="id" value={inc.id} />
              {ctx.publications.some((p) => p.action !== 'unpublished') ? (
                <div>
                  <label htmlFor="note" className="label">
                    Public change-log note (one line)
                  </label>
                  <input id="note" name="note" required className="control" placeholder="Updated legal status after arraignment." />
                </div>
              ) : (
                <p className="hint">The first public change-log entry will read “Published.”</p>
              )}
            </ActionForm>
          ) : null}
          {ctx.live && can.publish(me.role) ? (
            <ActionForm action={unpublishAction} submitLabel="Unpublish now" buttonClassName="btn btn-secondary" className="w-full max-w-md space-y-2" confirm="Take this record off the public site now?">
              <input type="hidden" name="id" value={inc.id} />
              <label htmlFor="reason" className="label">
                Reason (legal or factual basis, or a privacy request)
              </label>
              <input id="reason" name="reason" required className="control" />
            </ActionForm>
          ) : null}
          {!ctx.live && status !== 'excluded' && can.review(me.role) ? (
            <details className="w-full max-w-md">
              <summary className="cursor-pointer font-semibold">Mark out of scope (excluded)</summary>
              <ActionForm action={excludeAction} submitLabel="Exclude" buttonClassName="btn btn-secondary" className="mt-2 space-y-2">
                <input type="hidden" name="id" value={inc.id} />
                <label htmlFor="ex-reason" className="label">
                  Reason, e.g. agency ruled out an anti-Muslim element
                </label>
                <input id="ex-reason" name="reason" required className="control" />
              </ActionForm>
            </details>
          ) : null}
          {status === 'excluded' && can.review(me.role) ? (
            <ActionForm action={restoreAction} submitLabel="Restore to draft" buttonClassName="btn btn-secondary">
              <input type="hidden" name="id" value={inc.id} />
            </ActionForm>
          ) : null}
        </div>
      </section>

      <div className="mt-8">
        {canEdit ? (
          <RecordEditor key={`${inc.id}-${inc.revision}`} initial={loaded.draft} cases={cases} isNew={false} />
        ) : (
          <p className="card p-4">You can view this record but not edit it. Ask an editor to make changes.</p>
        )}
      </div>

      <section aria-labelledby="archive-h" className="mt-10">
        <h2 id="archive-h" className="mb-3 text-xl">
          Source archiving
        </h2>
        <ul className="space-y-2 text-base">
          {ctx.archive.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3">
              <span className="break-all">{s.url}</span>
              <span className={s.status === 'archived' ? 'text-confirmed' : s.status === 'failed' ? 'text-severe' : 'text-reported'}>
                {s.status === 'archived' ? 'Archived' : s.status === 'failed' ? 'Failed' : 'Pending'}
              </span>
              {s.archivedUrl ? (
                <a href={s.archivedUrl} target="_blank" rel="noopener noreferrer">
                  Archived copy
                </a>
              ) : null}
              {s.error ? <span className="text-sm text-muted">{s.error}</span> : null}
              {s.status !== 'archived' ? (
                <ActionForm action={retryArchiveAction} submitLabel="Try now" buttonClassName="btn btn-quiet min-h-9" className="inline-flex items-center gap-2">
                  <input type="hidden" name="id" value={inc.id} />
                  <input type="hidden" name="sourceId" value={s.id} />
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reviews-h" className="mt-10">
        <h2 id="reviews-h" className="mb-3 text-xl">
          Reviews
        </h2>
        {ctx.reviews.length ? (
          <ul className="space-y-2 text-base">
            {ctx.reviews.map((r) => (
              <li key={r.id}>
                <span className="tabular text-muted">{formatTimestamp(r.createdAt)}</span> — revision {r.revision}: <strong>{r.decision}</strong> by {r.reviewer}
                {r.comments ? <span className="block ps-4">“{r.comments}”</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No reviews yet.</p>
        )}
      </section>

      <section aria-labelledby="pubs-h" className="mt-10">
        <h2 id="pubs-h" className="mb-3 text-xl">
          Public change log
        </h2>
        {ctx.publications.length ? (
          <ul className="space-y-1 text-base">
            {ctx.publications.map((p) => (
              <li key={p.id}>
                <span className="tabular text-muted">{formatTimestamp(p.createdAt)}</span> — {p.action}, revision {p.revision}: {p.publicNote}
                {p.changedFields.length ? <span className="text-muted"> ({p.changedFields.join(', ')})</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Not published yet.</p>
        )}
      </section>

      <section aria-labelledby="log-h" className="mt-10">
        <h2 id="log-h" className="mb-3 text-xl">
          Internal change log
        </h2>
        <div className="table-scroll card" role="region" aria-label="Internal change log" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">Every edit: who, when, which field, and why</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col" className="num">
                  Revision
                </th>
                <th scope="col">Who</th>
                <th scope="col">Field</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {ctx.changeLog.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap tabular">{formatTimestamp(c.createdAt)}</td>
                  <td className="num">{c.revision}</td>
                  <td>{c.actor ?? 'System'}</td>
                  <td>{c.field}</td>
                  <td>{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

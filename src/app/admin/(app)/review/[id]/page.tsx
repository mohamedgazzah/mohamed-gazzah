import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionForm } from '@/components/admin/ActionForm'
import { IncidentView } from '@/components/IncidentView'
import { REVIEW_CHECKLIST } from '@/db/enums'
import { draftToView } from '@/lib/draft-view'
import { lintSummary } from '@/lib/summary'
import { caseOptions } from '@/server/admin/cases'
import { BLOCKER_MESSAGES } from '@/server/admin/errors'
import { loadDraft, loadWorkflowContext } from '@/server/admin/incidents'
import { requireUser } from '@/server/admin/session'
import { reviewAction } from '../../../_actions/records'

export const metadata = { title: 'Review' }

export default async function ReviewPage(props: PageProps<'/admin/review/[id]'>) {
  const me = await requireUser('editor')
  const { id } = await props.params
  const [loaded, ctx, cases] = await Promise.all([loadDraft(id), loadWorkflowContext(id), caseOptions()])
  if (!loaded || !ctx) notFound()
  const inc = ctx.incident
  const blocked = inc.createdBy === me.id ? 'You wrote this record.' : ctx.editorsOfRevision.some((e) => e.actorId === me.id) ? 'You edited this revision.' : null
  const lastPublished = ctx.publications.find((p) => p.action !== 'unpublished')
  const changedSince = lastPublished
    ? Array.from(new Set(ctx.changeLog.filter((c) => c.revision > lastPublished.revision && !['workflow_status', 'editor_notes'].includes(c.field)).map((c) => c.field)))
    : []
  const lint = lintSummary(loaded.draft.summary, loaded.draft.sources.length)

  return (
    <>
      <p className="text-sm">
        <Link href="/admin/review">Review queue</Link> · <Link href={`/admin/incidents/${inc.id}`}>Open the record</Link>
      </p>
      <h1 className="mt-1 text-2xl">Review {inc.id}, revision {inc.revision}</h1>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="card p-4 sm:p-6">
          <p className="mb-4 rounded border border-dashed border-control p-2 text-sm text-muted">What the public page will show once published.</p>
          <IncidentView data={draftToView(loaded.draft, cases)} preview />
        </div>
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          {lastPublished ? (
            <div className="card p-4 text-base">
              <p className="font-semibold">Changed since revision {lastPublished.revision} (live)</p>
              <p>{changedSince.length ? changedSince.join(', ').replaceAll('_', ' ') : 'No content changes recorded.'}</p>
            </div>
          ) : null}
          {lint.length || ctx.blockers.length ? (
            <div className="card p-4 text-base">
              <p className="font-semibold">Automatic checks</p>
              <ul className="list-disc ps-5">
                {ctx.blockers.map((b) => (
                  <li key={b}>{BLOCKER_MESSAGES[b] ?? b}</li>
                ))}
                {lint.map((l, i) => (
                  <li key={i}>{l.detail}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {inc.editorNotes ? (
            <div className="card p-4 text-base">
              <p className="font-semibold">Editor notes (private)</p>
              <p className="whitespace-pre-wrap">{inc.editorNotes}</p>
            </div>
          ) : null}
          {inc.workflowStatus !== 'in_review' ? (
            <p className="card p-4">This record is not waiting for review (status: {inc.workflowStatus}).</p>
          ) : blocked ? (
            <p className="card p-4">{blocked} Another editor must review it.</p>
          ) : (
            <div className="card p-4">
              <h2 className="mb-3 text-xl">Checklist</h2>
              <ActionForm action={reviewAction} submitLabel="Record decision" className="space-y-3">
                <input type="hidden" name="id" value={inc.id} />
                <fieldset className="space-y-1">
                  <legend className="label">Tick each item you have checked</legend>
                  {REVIEW_CHECKLIST.map((c) => (
                    <label key={c.key} className="flex min-h-9 items-start gap-2 text-base">
                      <input type="checkbox" name={c.key} className="mt-1 h-4 w-4 accent-accent" />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend className="label">Decision</legend>
                  <label className="flex min-h-9 items-center gap-2 text-base">
                    <input type="radio" name="decision" value="approved" required className="h-4 w-4 accent-accent" /> Approve (every box must be ticked)
                  </label>
                  <label className="flex min-h-9 items-center gap-2 text-base">
                    <input type="radio" name="decision" value="returned" className="h-4 w-4 accent-accent" /> Return to the author with comments
                  </label>
                </fieldset>
                <div>
                  <label htmlFor="comments" className="label">
                    Comments (required when returning)
                  </label>
                  <textarea id="comments" name="comments" rows={4} className="control" />
                </div>
              </ActionForm>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

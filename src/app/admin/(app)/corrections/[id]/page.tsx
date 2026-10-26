import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionForm } from '@/components/admin/ActionForm'
import { SubmissionDetails } from '@/components/admin/SubmissionDetails'
import { CORRECTION_STATUS_META } from '@/db/enums'
import { formatTimestamp } from '@/lib/format'
import { getTicket, slaState } from '@/server/admin/corrections'
import { loadSubmission } from '@/server/admin/leads'
import { requireUser } from '@/server/admin/session'
import { correctionAction } from '../../../_actions/manage'

export const metadata = { title: 'Correction request' }

export default async function CorrectionPage(props: PageProps<'/admin/corrections/[id]'>) {
  const me = await requireUser('editor')
  const { id } = await props.params
  const t = await getTicket(id)
  if (!t) notFound()
  const sub = await loadSubmission(me, t.submissionId)
  const sla = slaState(t)
  const closed = t.status === 'resolved' || t.status === 'declined'
  return (
    <>
      <p className="text-sm">
        <Link href="/admin/corrections">Corrections queue</Link>
      </p>
      <h1 className="mt-1 text-2xl">
        Correction request for <Link href={`/admin/incidents/${t.recordId}`}>{t.recordId}</Link>
      </h1>
      <p className="mt-1 text-sm">
        <span className={sla.overdue ? 'font-semibold text-severe' : ''}>{sla.label}</span> · {CORRECTION_STATUS_META[t.status].label}
        {t.isPrivacyRequest ? ' · Privacy removal: remove identifying details within 48 hours, no questions asked. A senior editor can unpublish at once.' : ''}
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {sub ? <SubmissionDetails data={sub} /> : null}
          {t.resolutionNote ? (
            <p className="card p-4">
              <span className="font-semibold">Last note:</span> {t.resolutionNote}
              {t.firstResponseAt ? <span className="block text-sm text-muted">First response {formatTimestamp(t.firstResponseAt)}</span> : null}
            </p>
          ) : null}
        </div>
        {!closed ? (
          <aside className="card h-fit space-y-6 p-4">
            <ActionForm action={correctionAction} submitLabel="Assign to me" buttonClassName="btn btn-secondary">
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="action" value="assign" />
            </ActionForm>
            <ActionForm action={correctionAction} submitLabel="Save" className="space-y-3">
              <input type="hidden" name="id" value={t.id} />
              <fieldset className="space-y-1">
                <legend className="label">Action</legend>
                {(
                  [
                    ['respond', 'Record a response to the requester'],
                    ['resolve', 'Resolved: fixed (republish the record with a public note)'],
                    ['decline', 'Declined: no factual or legal basis'],
                  ] as const
                ).map(([v, label]) => (
                  <label key={v} className="flex min-h-9 items-start gap-2 text-base">
                    <input type="radio" name="action" value={v} required className="mt-1 h-4 w-4 accent-accent" /> {label}
                  </label>
                ))}
              </fieldset>
              <div>
                <label htmlFor="note" className="label">
                  Note
                </label>
                <textarea id="note" name="note" rows={4} required className="control" />
              </div>
            </ActionForm>
          </aside>
        ) : null}
      </div>
    </>
  )
}

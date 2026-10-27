import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionForm } from '@/components/admin/ActionForm'
import { SubmissionDetails } from '@/components/admin/SubmissionDetails'
import { INCIDENT_TYPES, INCIDENT_TYPE_META, LEAD_SOURCE_META, LEAD_STATUS_META, LEGAL_STATUS_META, TARGET_TYPE_META } from '@/db/enums'
import { formatDate } from '@/lib/format'
import { RELEVANCE_LABELS } from '@/lib/news-assessment'
import { US_STATES, stateByCode } from '@/lib/states'
import { findDuplicates } from '@/server/admin/incidents'
import { getLead } from '@/server/admin/leads'
import { scanReadingForLead } from '@/server/admin/news'
import { requireUser } from '@/server/admin/session'
import { triageAction } from '../../../_actions/manage'

export const metadata = { title: 'Lead' }

export default async function LeadPage(props: PageProps<'/admin/leads/[id]'>) {
  const me = await requireUser('editor')
  const { id } = await props.params
  const data = await getLead(me, id)
  if (!data) notFound()
  const { lead, sub } = data
  const s = sub?.submission
  const scan = lead.source !== 'submission' ? await scanReadingForLead(lead.id) : null
  const a = scan?.assessment ?? null
  const suggestedFips = a?.state_code ? stateByCode(a.state_code)?.fips : undefined
  const dupes =
    s?.incidentDate && s.stateFips
      ? await findDuplicates({ id: null, dateStart: s.incidentDate, stateFips: s.stateFips, city: s.city, lat: null, lng: null, text: s.whatHappened })
      : []

  return (
    <>
      <p className="text-sm">
        <Link href="/admin/leads">Leads inbox</Link>
      </p>
      <h1 className="mt-1 text-2xl">{lead.headline}</h1>
      <p className="mt-1 text-sm text-muted">
        {LEAD_SOURCE_META[lead.source].label} · {LEAD_STATUS_META[lead.status].label}
        {lead.incidentId ? (
          <>
            {' · '}
            <Link href={`/admin/incidents/${lead.incidentId}`}>{lead.incidentId}</Link>
          </>
        ) : null}
        {lead.triageReason ? ` · ${lead.triageReason}` : ''}
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {sub ? <SubmissionDetails data={sub} /> : null}
          {scan ? (
            <section aria-labelledby="scan-h" className="card p-4">
              <h2 id="scan-h" className="text-lg">
                The morning scan’s reading
              </h2>
              <p className="hint mt-1">
                Suggestions from {scan.model ?? 'the keyword rule'}, from the article as published. Check each against the article before using it.
              </p>
              {a ? (
                <dl className="mt-3 grid gap-x-4 gap-y-2 text-base sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <dt className="font-semibold">Judgment</dt>
                  <dd>
                    {RELEVANCE_LABELS[a.relevance]} · {a.confidence} confidence
                  </dd>
                  <dt className="font-semibold">Why</dt>
                  <dd>{a.reason}</dd>
                  <dt className="font-semibold">Summary</dt>
                  <dd>{a.summary}</dd>
                  <dt className="font-semibold">When</dt>
                  <dd>{a.incident_date ? formatDate(a.incident_date, a.date_precision ?? 'day') : 'Not stated'}</dd>
                  <dt className="font-semibold">Where</dt>
                  <dd>{[a.city, a.state_code ? (stateByCode(a.state_code)?.name ?? a.state_code) : null].filter(Boolean).join(', ') || 'Not stated'}</dd>
                  <dt className="font-semibold">Type</dt>
                  <dd>{a.incident_types.length ? a.incident_types.map((t) => INCIDENT_TYPE_META[t].label).join(', ') : 'None given'}</dd>
                  <dt className="font-semibold">Target</dt>
                  <dd>{a.target_type ? TARGET_TYPE_META[a.target_type].label : 'Not stated'}</dd>
                  <dt className="font-semibold">Legal status</dt>
                  <dd>
                    {a.legal_status ? LEGAL_STATUS_META[a.legal_status].label : 'Not stated'} · hate-crime charge: {a.hate_crime_charged}
                  </dd>
                  <dt className="font-semibold">Possible duplicates</dt>
                  <dd>
                    {a.possible_duplicates.length
                      ? a.possible_duplicates.map((d, i) => (
                          <span key={d}>
                            {i ? ', ' : ''}
                            <Link href={`/admin/incidents/${d}`}>{d}</Link>
                          </span>
                        ))
                      : 'None in the same place within a week'}
                  </dd>
                </dl>
              ) : (
                <p className="mt-2">{scan.note ?? 'No reading stored.'}</p>
              )}
            </section>
          ) : null}
          {lead.url ? (
            <p>
              Link:{' '}
              <a href={lead.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all">
                {lead.url}
              </a>
            </p>
          ) : null}
          <section aria-labelledby="dupes-h" className="card p-4">
            <h2 id="dupes-h" className="mb-2 text-lg">
              Possible duplicates (±3 days, same city or similar text)
            </h2>
            {dupes.length ? (
              <ul className="space-y-1 text-base">
                {dupes.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/incidents/${d.id}`}>{d.id}</Link> — {d.title} <span className="text-sm text-muted">({d.dateStart}{d.sameCity ? ', same city' : ''})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{s?.incidentDate && s.stateFips ? 'None found.' : 'Needs a date and state to check.'}</p>
            )}
          </section>
        </div>
        {lead.status === 'new' ? (
          <aside className="card h-fit p-4">
            <h2 className="mb-3 text-xl">Triage</h2>
            <ActionForm action={triageAction} submitLabel="Save triage decision" className="space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <fieldset className="space-y-1">
                <legend className="label">Decision</legend>
                {(['new_incident', 'update', 'duplicate', 'out_of_scope'] as const).map((d) => (
                  <label key={d} className="flex min-h-9 items-center gap-2 text-base">
                    <input type="radio" name="decision" value={d} required className="h-4 w-4 accent-accent" /> {LEAD_STATUS_META[d].label}
                  </label>
                ))}
              </fieldset>
              <div>
                <label htmlFor="incidentId" className="label">
                  Existing record id (for update or duplicate)
                </label>
                <input id="incidentId" name="incidentId" className="control tabular" placeholder="US-2026-0412" />
              </div>
              <div>
                <label htmlFor="stateFips" className="label">
                  State (for a new incident)
                </label>
                <select id="stateFips" name="stateFips" className="control" defaultValue={s?.stateFips ?? suggestedFips ?? ''}>
                  <option value="">Choose</option>
                  {US_STATES.map((st) => (
                    <option key={st.fips} value={st.fips}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="incidentType" className="label">
                  Incident type (for a new incident)
                </label>
                <select id="incidentType" name="incidentType" className="control" defaultValue={a?.incident_types[0] ?? ''}>
                  <option value="">Choose</option>
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t} — {INCIDENT_TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reason" className="label">
                  Reason (required for out of scope)
                </label>
                <input id="reason" name="reason" className="control" />
              </div>
            </ActionForm>
          </aside>
        ) : null}
      </div>
    </>
  )
}

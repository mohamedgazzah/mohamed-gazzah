import Link from 'next/link'
import { ActionForm } from '@/components/admin/ActionForm'
import { LEAD_SOURCES, LEAD_SOURCE_META, LEAD_STATUSES, LEAD_STATUS_META, type LeadStatus } from '@/db/enums'
import { formatDate, formatTimestamp } from '@/lib/format'
import { stateByFips } from '@/lib/states'
import { listLeads } from '@/server/admin/leads'
import { requireUser } from '@/server/admin/session'
import { addLeadAction } from '../../_actions/manage'

export const metadata = { title: 'Leads' }

export default async function LeadsPage(props: PageProps<'/admin/leads'>) {
  await requireUser('editor')
  const sp = await props.searchParams
  const status = typeof sp.status === 'string' && (LEAD_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as LeadStatus) : sp.status === 'all' ? 'all' : 'new'
  const rows = await listLeads(status)
  return (
    <>
      <h1 className="text-2xl">Leads inbox</h1>
      <p className="mt-2 hint">Public submissions and monitor matches. Nothing here is public. Triage each lead: new incident, update, duplicate, or out of scope.</p>
      <nav aria-label="Lead status" className="mt-4 flex flex-wrap gap-2">
        {(['new', ...LEAD_STATUSES.filter((s) => s !== 'new'), 'all'] as const).map((s) => (
          <Link key={s} href={`/admin/leads?status=${s}`} aria-current={status === s ? 'page' : undefined} className={status === s ? 'btn' : 'btn btn-secondary'}>
            {s === 'all' ? 'All' : LEAD_STATUS_META[s].label}
          </Link>
        ))}
      </nav>
      <ul className="mt-6 space-y-3">
        {rows.map((l) => (
          <li key={l.id} className="card p-4">
            <p className="text-sm text-muted tabular">
              {LEAD_SOURCE_META[l.source].label} · received {formatTimestamp(l.createdAt)}
              {l.publishedDate ? ` · date ${formatDate(l.publishedDate)}` : ''}
              {l.city ? ` · ${l.city}${l.stateFips ? `, ${stateByFips(l.stateFips)?.code}` : ''}` : ''} · {LEAD_STATUS_META[l.status].label}
              {l.incidentId ? ` · ${l.incidentId}` : ''}
            </p>
            <p className="mt-1 font-semibold">
              <Link href={`/admin/leads/${l.id}`}>{l.headline}</Link>
            </p>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="card mt-6 p-4">No leads with this status.</p> : null}
      <details className="mt-8 max-w-xl">
        <summary className="cursor-pointer font-semibold">Add a lead by hand</summary>
        <ActionForm action={addLeadAction} submitLabel="Add lead" className="mt-3 space-y-3">
          <div>
            <label htmlFor="headline" className="label">
              Headline
            </label>
            <input id="headline" name="headline" required className="control" />
          </div>
          <div>
            <label htmlFor="url" className="label">
              Link
            </label>
            <input id="url" name="url" type="url" className="control" />
          </div>
          <div>
            <label htmlFor="outlet" className="label">
              Outlet
            </label>
            <input id="outlet" name="outlet" className="control" />
          </div>
          <div>
            <label htmlFor="source" className="label">
              Where it came from
            </label>
            <select id="source" name="source" className="control" defaultValue="manual">
              {LEAD_SOURCES.filter((s) => s !== 'submission').map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_META[s].label}
                </option>
              ))}
            </select>
          </div>
        </ActionForm>
      </details>
    </>
  )
}

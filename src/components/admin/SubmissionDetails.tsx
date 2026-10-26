import { REPORTER_RELATION_META } from '@/db/enums'
import { formatDate, formatTimestamp } from '@/lib/format'
import { stateName } from '@/lib/states'
import type { loadSubmission } from '@/server/admin/leads'

type Sub = NonNullable<Awaited<ReturnType<typeof loadSubmission>>>

/** Private submission details. Admin area only. */
export function SubmissionDetails({ data }: { data: Sub }) {
  const s = data.submission
  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm text-muted tabular">
        Received {formatTimestamp(s.createdAt)} · reference {s.id.slice(0, 8).toUpperCase()}
        {s.purgedAt ? ` · private details deleted ${formatTimestamp(s.purgedAt)} under the retention rule` : ''}
      </p>
      <p className="reading whitespace-pre-wrap">{s.whatHappened}</p>
      <dl className="grid gap-x-4 gap-y-1 text-base sm:grid-cols-[10rem_1fr]">
        {s.incidentDate ? (
          <>
            <dt className="font-semibold">Date</dt>
            <dd>{formatDate(s.incidentDate)}</dd>
          </>
        ) : null}
        <dt className="font-semibold">Place</dt>
        <dd>
          {[s.city, s.stateFips ? stateName(s.stateFips) : null].filter(Boolean).join(', ') || '—'}
        </dd>
        {data.address ? (
          <>
            <dt className="font-semibold">Exact address</dt>
            <dd>{data.address} <span className="text-sm text-muted">(never published)</span></dd>
          </>
        ) : null}
        <dt className="font-semibold">Reporter</dt>
        <dd>{s.reporterRelation ? REPORTER_RELATION_META[s.reporterRelation].label : 'Not stated'}</dd>
        <dt className="font-semibold">Links</dt>
        <dd>
          {s.links.length ? (
            <ul>
              {s.links.map((l) => (
                <li key={l} className="break-all">
                  <a href={l} target="_blank" rel="noopener noreferrer nofollow">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            '—'
          )}
        </dd>
        <dt className="font-semibold">Contact</dt>
        <dd>
          {data.contact
            ? [data.contact.name, data.contact.email, data.contact.phone].filter(Boolean).join(' · ')
            : s.hasContact
              ? 'Hidden for your role'
              : 'None given'}
          {s.keepConsent ? <span className="block text-sm text-muted">Agreed to keep details past 12 months</span> : null}
        </dd>
        <dt className="font-semibold">Files</dt>
        <dd>
          {data.files.length ? (
            <ul>
              {data.files.map((f, i) => (
                <li key={f.id}>
                  <a href={`/admin/files/${f.id}`}>
                    File {i + 1} ({f.mimeType}, {Math.round(f.sizeBytes / 1024)} KB)
                  </a>
                  {f.metadataStripped ? <span className="text-sm text-muted"> · location data removed</span> : <span className="text-sm text-muted"> · PDF: check for metadata before sharing</span>}
                </li>
              ))}
            </ul>
          ) : (
            'None'
          )}
        </dd>
      </dl>
    </div>
  )
}

import Link from 'next/link'
import { INCIDENT_TYPE_META, SEVERITY_META } from '@/db/enums'
import { formatDateRange, formatPlace } from '@/lib/format'
import { incidentPath } from '@/lib/slug'
import type { IncidentListItem } from '@/server/public/incidents'
import { Arrow } from './Arrow'
import { legalLabel, verificationLabel } from './Badges'
import { VerificationMark } from './VerificationMark'
import { Highlight } from './Highlight'
import { TableKeyboardNav } from './TableKeyboardNav'

type SortLink = { label: string; href: string; active: boolean; direction: 'ascending' | 'descending' | 'none' }

// The arrow is drawn: the text faces have no ↑ or ↓, and asking for one fetches
// a second copy of the font to look (src/fonts/README.md). aria-sort carries the state.
function SortHeader({ sort }: { sort: SortLink }) {
  return (
    <Link href={sort.href} className="inline-flex items-center gap-1">
      {sort.label}
      {sort.active && sort.direction !== 'none' ? <Arrow direction={sort.direction === 'ascending' ? 'up' : 'down'} size={10} /> : null}
    </Link>
  )
}

export function IncidentTable({
  rows,
  query,
  caption,
  dateSort,
  severitySort,
}: {
  rows: IncidentListItem[]
  query?: string | null
  caption: string
  dateSort?: SortLink
  severitySort?: SortLink
}) {
  return (
    <TableKeyboardNav>
      <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={dateSort?.active ? dateSort.direction : undefined}>
                {dateSort ? <SortHeader sort={dateSort} /> : 'Date'}
                <span className="text-muted"> · place</span>
              </th>
              <th scope="col">Incident</th>
              <th scope="col" className="num" aria-sort={severitySort?.active ? severitySort.direction : undefined}>
                {severitySort ? <SortHeader sort={severitySort} /> : 'Severity'}
              </th>
              <th scope="col">Verification</th>
              <th scope="col">Legal status</th>
              <th scope="col" className="num">
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-record-id={r.id}>
                <td className="whitespace-nowrap">
                  <span className="tabular">{formatDateRange(r.dateStart, r.dateEnd, r.datePrecision)}</span>
                  <span className="block text-muted">{formatPlace(r.city, r.stateCode)}</span>
                </td>
                <td className="min-w-60">
                  <Link href={incidentPath(r.id, r.slug)} className="font-serif text-[17px] leading-snug text-text no-underline hover:underline">
                    <Highlight text={r.title} query={query} />
                  </Link>
                  <span className="mono mt-1 block text-muted">
                    {r.id} · {r.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(', ')}
                    {r.isDemo ? ' · demo record' : ''}
                  </span>
                </td>
                <td className="num" title={SEVERITY_META[r.severity].label}>
                  {r.severity}
                  <span className="sr-only">: {SEVERITY_META[r.severity].label}</span>
                </td>
                <td className="min-w-36">
                  <span className={r.verificationLevel === 'V3' ? 'text-confirmed' : 'text-reported'}>
                    <VerificationMark level={r.verificationLevel} />
                  </span>{' '}
                  {verificationLabel(r.verificationLevel, r.sourceTypes)}
                </td>
                <td className="min-w-32">{legalLabel(r.legalStatus, r.hateCrimeCharged)}</td>
                <td className="num">{r.sourceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableKeyboardNav>
  )
}

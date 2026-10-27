import Link from 'next/link'
import { INCIDENT_TYPE_META, SEVERITY_META } from '@/db/enums'
import { formatDateRange, formatPlace, plural } from '@/lib/format'
import { incidentPath } from '@/lib/slug'
import type { IncidentListItem } from '@/server/public/incidents'
import { Arrow } from './Arrow'
import { legalLabel, verificationLabel } from './Badges'
import { VerificationMark } from './VerificationMark'
import { Highlight } from './Highlight'
import { TableKeyboardNav } from './TableKeyboardNav'

type SortLink = { label: string; href: string; active: boolean; direction: 'ascending' | 'descending' | 'none' }

// The arrow is drawn: the text face has no ↑ or ↓, and asking for one fetches
// a second copy of the font to look (src/fonts/README.md). aria-sort carries the state.
function SortHeader({ sort }: { sort: SortLink }) {
  return (
    <Link href={sort.href} className="inline-flex items-center gap-1">
      {sort.label}
      {sort.active && sort.direction !== 'none' ? <Arrow direction={sort.direction === 'ascending' ? 'up' : 'down'} size={10} /> : null}
    </Link>
  )
}

/**
 * The records as a table: the date and place, then the incident with its
 * status on a line under the title, so verification and legal status are
 * never scrolled out of sight. (The column is never wide enough for status
 * columns of their own.) The whole row opens the record.
 */
export function IncidentTable({
  rows,
  query,
  caption,
  dateSort,
  sticky = false,
}: {
  rows: IncidentListItem[]
  query?: string | null
  caption: string
  dateSort?: SortLink
  /** Keep the column names in view while scrolling a long table (wide screens). */
  sticky?: boolean
}) {
  return (
    <TableKeyboardNav>
      <div className={sticky ? 'table-scroll sticky-head' : 'table-scroll'} role="region" aria-label={caption} tabIndex={0}>
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-px" aria-sort={dateSort?.active ? dateSort.direction : undefined}>
                {dateSort ? <SortHeader sort={dateSort} /> : 'Date'}
                <span className="text-muted"> · place</span>
              </th>
              <th scope="col">Incident and status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-record-id={r.id} className="row-link">
                <td className="w-px">
                  <span className="tabular whitespace-nowrap">{formatDateRange(r.dateStart, r.dateEnd, r.datePrecision)}</span>
                  <span className="block text-muted sm:whitespace-nowrap">{formatPlace(r.city, r.stateCode)}</span>
                </td>
                <td>
                  <Link href={incidentPath(r.id, r.slug)} className="text-base leading-snug font-semibold text-text no-underline hover:underline">
                    <Highlight text={r.title} query={query} />
                  </Link>
                  <span className="mono mt-1 block text-muted">
                    {r.id} · {r.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(', ')}
                    {r.isDemo ? ' · demo record' : ''}
                  </span>
                  {/* Each item keeps its separator with it, so a line never starts with a dot. */}
                  <span className="meta-line mt-1.5 text-xs">
                    <span className={r.verificationLevel === 'V3' ? 'text-confirmed' : 'text-reported'}>
                      <VerificationMark level={r.verificationLevel} />
                      <span className="ms-1 text-text">{verificationLabel(r.verificationLevel, r.sourceTypes)}</span>
                    </span>
                    <span>{legalLabel(r.legalStatus, r.hateCrimeCharged)}</span>
                    <span className="text-muted">
                      Severity {r.severity}, {SEVERITY_META[r.severity].label.toLowerCase()}
                    </span>
                    <span className="text-muted">{plural(r.sourceCount, 'source')}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableKeyboardNav>
  )
}

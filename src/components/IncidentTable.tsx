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
 * The records as a table. On narrower screens the status columns fold into
 * a line under each title, so verification and legal status are never
 * scrolled out of sight. The whole row opens the record.
 */
export function IncidentTable({
  rows,
  query,
  caption,
  dateSort,
  severitySort,
  sticky = false,
}: {
  rows: IncidentListItem[]
  query?: string | null
  caption: string
  dateSort?: SortLink
  severitySort?: SortLink
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
              <th scope="col" aria-sort={dateSort?.active ? dateSort.direction : undefined}>
                {dateSort ? <SortHeader sort={dateSort} /> : 'Date'}
                <span className="text-muted"> · place</span>
              </th>
              <th scope="col">Incident</th>
              <th scope="col" className="num max-xl:hidden" aria-sort={severitySort?.active ? severitySort.direction : undefined}>
                {severitySort ? <SortHeader sort={severitySort} /> : 'Severity'}
              </th>
              <th scope="col" className="max-xl:hidden">
                Verification
              </th>
              <th scope="col" className="max-xl:hidden">
                Legal status
              </th>
              <th scope="col" className="num max-xl:hidden">
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-record-id={r.id} className="row-link">
                <td className="whitespace-nowrap">
                  <span className="tabular">{formatDateRange(r.dateStart, r.dateEnd, r.datePrecision)}</span>
                  <span className="block text-muted">{formatPlace(r.city, r.stateCode)}</span>
                </td>
                <td className="w-[44%] min-w-60 max-sm:min-w-0">
                  <Link href={incidentPath(r.id, r.slug)} className="text-[15.5px] leading-snug font-semibold text-text no-underline hover:underline">
                    <Highlight text={r.title} query={query} />
                  </Link>
                  <span className="mono mt-1 block text-muted">
                    {r.id} · {r.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(', ')}
                    {r.isDemo ? ' · demo record' : ''}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] xl:hidden">
                    <span className={r.verificationLevel === 'V3' ? 'inline-flex items-center gap-1 text-confirmed' : 'inline-flex items-center gap-1 text-reported'}>
                      <VerificationMark level={r.verificationLevel} />
                      <span className="text-text">{verificationLabel(r.verificationLevel, r.sourceTypes)}</span>
                    </span>
                    <span aria-hidden="true" className="text-muted">·</span>
                    <span>{legalLabel(r.legalStatus, r.hateCrimeCharged)}</span>
                    <span aria-hidden="true" className="text-muted">·</span>
                    <span className="text-muted">
                      Severity {r.severity}, {SEVERITY_META[r.severity].label.toLowerCase()} · {plural(r.sourceCount, 'source')}
                    </span>
                  </span>
                </td>
                <td className="num min-w-28 max-xl:hidden">
                  <span className="tabular font-semibold">{r.severity}</span>
                  <span className="block text-[12.5px] text-muted">{SEVERITY_META[r.severity].label}</span>
                </td>
                <td className="min-w-36 max-xl:hidden">
                  <span className={r.verificationLevel === 'V3' ? 'text-confirmed' : 'text-reported'}>
                    <VerificationMark level={r.verificationLevel} />
                  </span>{' '}
                  {verificationLabel(r.verificationLevel, r.sourceTypes)}
                </td>
                <td className="min-w-32 max-xl:hidden">{legalLabel(r.legalStatus, r.hateCrimeCharged)}</td>
                <td className="num max-xl:hidden">{r.sourceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableKeyboardNav>
  )
}

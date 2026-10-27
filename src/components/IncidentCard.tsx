import Link from 'next/link'
import { formatDateRange, formatPlace, plural } from '@/lib/format'
import { firstSentence } from '@/lib/summary'
import { incidentPath } from '@/lib/slug'
import type { IncidentListItem } from '@/server/public/incidents'
import { DemoBadge, LegalStatusBadges, SeverityMarker, VerificationBadge } from './Badges'
import { Highlight } from './Highlight'

/**
 * One entry in a register of records: reference data in the margin, the
 * title in the serif, one sentence, the badges and the source count.
 */
export function IncidentCard({ item, query, headingLevel = 3 }: { item: IncidentListItem; query?: string | null; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const idPrefix = `card-${item.id}`
  return (
    <article className="grid gap-x-8 gap-y-2 py-6 md:grid-cols-[9.5rem_minmax(0,1fr)_auto]">
      <p className="mono leading-relaxed text-muted">
        <span className="md:block">{item.id}</span>
        <span aria-hidden="true" className="md:hidden"> · </span>
        <span className="md:block">{formatDateRange(item.dateStart, item.dateEnd, item.datePrecision)}</span>
        <span aria-hidden="true" className="md:hidden"> · </span>
        <span className="md:block">{formatPlace(item.city, item.stateCode)}</span>
      </p>
      <div className="min-w-0">
        {item.severity === 5 ? <hr className="mb-3 border-t border-ink" aria-hidden="true" /> : null}
        <H className="text-[23px] leading-[1.2] md:text-[25px]">
          <Link href={incidentPath(item.id, item.slug)} className="text-text no-underline hover:underline hover:decoration-1">
            <Highlight text={item.title} query={query} />
          </Link>
        </H>
        <p className="mt-2 line-clamp-2 max-w-[62ch] text-[15.5px] text-text">
          <Highlight text={firstSentence(item.summary)} query={query} />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <VerificationBadge level={item.verificationLevel} sourceTypes={item.sourceTypes} idPrefix={idPrefix} />
          <LegalStatusBadges status={item.legalStatus} hateCrimeCharged={item.hateCrimeCharged} idPrefix={idPrefix} />
          <SeverityMarker severity={item.severity} idPrefix={idPrefix} />
          {item.isDemo ? <DemoBadge /> : null}
        </div>
      </div>
      <p className="mono text-muted md:text-end">{plural(item.sourceCount, 'source')}</p>
    </article>
  )
}

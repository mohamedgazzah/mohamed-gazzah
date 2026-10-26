import Link from 'next/link'
import { formatDateRange, formatPlace, plural } from '@/lib/format'
import { firstSentence } from '@/lib/summary'
import { incidentPath } from '@/lib/slug'
import type { IncidentListItem } from '@/server/public/incidents'
import { DemoBadge, LegalStatusBadges, SeverityMarker, VerificationBadge } from './Badges'
import { Highlight } from './Highlight'

export function IncidentCard({ item, query, headingLevel = 3 }: { item: IncidentListItem; query?: string | null; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const idPrefix = `card-${item.id}`
  return (
    <article className="card flex h-full flex-col gap-2 p-4">
      {item.severity === 5 ? <hr className="border-t-2 border-text" aria-hidden="true" /> : null}
      <p className="text-sm text-muted tabular">
        {formatDateRange(item.dateStart, item.dateEnd, item.datePrecision)} · {formatPlace(item.city, item.stateCode)}
      </p>
      <H className="text-lg leading-snug">
        <Link href={incidentPath(item.id, item.slug)} className="text-text no-underline hover:underline">
          <Highlight text={item.title} query={query} />
        </Link>
      </H>
      <p className="line-clamp-2 text-base text-text">
        <Highlight text={firstSentence(item.summary)} query={query} />
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <VerificationBadge level={item.verificationLevel} sourceTypes={item.sourceTypes} idPrefix={idPrefix} />
        <LegalStatusBadges status={item.legalStatus} hateCrimeCharged={item.hateCrimeCharged} idPrefix={idPrefix} />
        <SeverityMarker severity={item.severity} idPrefix={idPrefix} />
        {item.isDemo ? <DemoBadge /> : null}
        <span className="ms-auto text-sm text-muted tabular">{plural(item.sourceCount, 'source')}</span>
      </div>
    </article>
  )
}

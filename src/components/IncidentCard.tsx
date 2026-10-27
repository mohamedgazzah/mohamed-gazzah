import { Link2, MapPin } from 'lucide-react'
import Link from 'next/link'
import { INCIDENT_TYPE_META } from '@/db/enums'
import { formatDateRange, formatPlace, plural } from '@/lib/format'
import { firstSentence } from '@/lib/summary'
import { incidentPath } from '@/lib/slug'
import type { IncidentListItem } from '@/server/public/incidents'
import { DemoBadge, LegalStatusBadges, SeverityMarker, VerificationBadge } from './Badges'
import { Highlight } from './Highlight'

/**
 * One record in a list. On wide screens the date and place sit in a column
 * of their own, so a list reads as a timeline; the whole card opens the
 * record, while the status badges keep their own links.
 */
export function IncidentCard({ item, query, headingLevel = 3 }: { item: IncidentListItem; query?: string | null; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const idPrefix = `card-${item.id}`
  return (
    <article className="grid gap-x-6 gap-y-2 px-4 py-5 sm:px-5 md:px-6 md:py-5 lg:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-muted lg:block lg:pt-1">
        <p className="tabular text-base font-semibold text-text">{formatDateRange(item.dateStart, item.dateEnd, item.datePrecision)}</p>
        <p className="inline-flex items-center gap-1 lg:mt-1">
          <MapPin aria-hidden="true" size={13} className="shrink-0" />
          {formatPlace(item.city, item.stateCode)}
        </p>
        <p className="hidden lg:mt-3 lg:flex lg:items-center lg:gap-1">
          <Link2 aria-hidden="true" size={13} className="shrink-0" />
          {plural(item.sourceCount, 'source')}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{item.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(' · ')}</p>
        <H className="mt-1 text-lg leading-[1.3] tracking-[-0.015em] md:text-xl">
          <Link href={incidentPath(item.id, item.slug)} className="text-text no-underline hover:underline hover:decoration-1">
            <Highlight text={item.title} query={query} />
          </Link>
        </H>
        <p className="mt-1.5 line-clamp-2 max-w-[72ch] text-base text-muted">
          <Highlight text={firstSentence(item.summary)} query={query} />
        </p>
        <div className="relative mt-3.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
          <VerificationBadge level={item.verificationLevel} sourceTypes={item.sourceTypes} idPrefix={idPrefix} />
          <SeverityMarker severity={item.severity} idPrefix={idPrefix} />
          <LegalStatusBadges status={item.legalStatus} hateCrimeCharged={item.hateCrimeCharged} idPrefix={idPrefix} />
          {item.isDemo ? <DemoBadge /> : null}
          <span className="tabular ms-auto text-xs text-muted">
            <span className="lg:hidden">{plural(item.sourceCount, 'source')} · </span>
            {item.id}
          </span>
        </div>
      </div>
    </article>
  )
}

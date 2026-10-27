import { CalendarDays, Link2, MapPin } from 'lucide-react'
import Link from 'next/link'
import { INCIDENT_TYPE_META } from '@/db/enums'
import { formatDateRange, formatPlace, plural } from '@/lib/format'
import { firstSentence } from '@/lib/summary'
import { incidentPath } from '@/lib/slug'
import type { IncidentListItem } from '@/server/public/incidents'
import { DemoBadge, LegalStatusBadges, SeverityMarker, VerificationBadge } from './Badges'
import { Highlight } from './Highlight'

/**
 * One record in a list: when, where and what on the first line, the title,
 * one sentence, then the status badges and the number of sources.
 */
export function IncidentCard({ item, query, headingLevel = 3 }: { item: IncidentListItem; query?: string | null; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const idPrefix = `card-${item.id}`
  return (
    <article className="p-5 md:px-6 md:py-5">
      <p className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" size={14} />
          {formatDateRange(item.dateStart, item.dateEnd, item.datePrecision)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden="true" size={14} />
          {formatPlace(item.city, item.stateCode)}
        </span>
        <span>{item.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(', ')}</span>
      </p>
      <H className="mt-2.5 text-[20px] leading-[1.28] tracking-[-0.015em] md:text-[22px]">
        <Link href={incidentPath(item.id, item.slug)} className="text-text no-underline hover:underline hover:decoration-1">
          <Highlight text={item.title} query={query} />
        </Link>
      </H>
      <p className="mt-2 line-clamp-2 max-w-[70ch] text-[15.5px] text-muted">
        <Highlight text={firstSentence(item.summary)} query={query} />
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <VerificationBadge level={item.verificationLevel} sourceTypes={item.sourceTypes} idPrefix={idPrefix} />
        <LegalStatusBadges status={item.legalStatus} hateCrimeCharged={item.hateCrimeCharged} idPrefix={idPrefix} />
        <SeverityMarker severity={item.severity} idPrefix={idPrefix} />
        {item.isDemo ? <DemoBadge /> : null}
        <span className="mono ms-auto inline-flex items-center gap-1.5 text-muted">
          <Link2 aria-hidden="true" size={14} />
          {plural(item.sourceCount, 'source')} · {item.id}
        </span>
      </div>
    </article>
  )
}

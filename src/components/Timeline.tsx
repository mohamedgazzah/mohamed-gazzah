import { LEGAL_EVENT_META, LEGAL_EVENT_TYPES, type LegalEventType } from '@/db/enums'
import { formatDate } from '@/lib/format'
import { SourceRef } from './SourceRef'

type Event = { date: string; event_type: LegalEventType; description: string; source_n: number | null; case_id: string | null }

/**
 * Vertical legal timeline: dated nodes, each with its label and source. The
 * latest step is marked, and a scheduled court date closes the line as a
 * hollow node on a dashed segment, so an open case reads as open. Steps on
 * the same day keep the legal order (charges before a hate-crime charge).
 */
export function Timeline({
  events,
  sourceIdPrefix = 'source',
  showCase = true,
  nextDate = null,
}: {
  events: Event[]
  sourceIdPrefix?: string
  /** Name the case on each step (only useful when a record has several cases). */
  showCase?: boolean
  nextDate?: string | null
}) {
  const order = (t: LegalEventType) => LEGAL_EVENT_TYPES.indexOf(t)
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || order(a.event_type) - order(b.event_type))
  return (
    <ol className="timeline">
      {sorted.map((e, i) => {
        const latest = i === sorted.length - 1
        return (
          <li key={i} className="grid gap-x-6 sm:grid-cols-[8.5rem_1fr]">
            <span aria-hidden="true" className={latest ? 'timeline-node timeline-node-latest' : 'timeline-node'} />
            <p className="tabular pt-0.5 text-sm whitespace-nowrap text-muted">
              <time dateTime={e.date}>{formatDate(e.date)}</time>
            </p>
            <div>
              <p className="font-semibold">
                {LEGAL_EVENT_META[e.event_type].label}
                {latest ? <span className="ms-2 align-[1px] text-2xs font-semibold text-accent">Latest</span> : null}
              </p>
              {e.description ? <p className="mt-0.5 text-base">{e.description}</p> : null}
              {e.source_n ? (
                <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                  <SourceRef n={e.source_n} href={`#${sourceIdPrefix}-${e.source_n}`} />
                  {showCase && e.case_id ? <span>Case {e.case_id}</span> : null}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
      {nextDate ? (
        <li className="timeline-next grid gap-x-6 sm:grid-cols-[8.5rem_1fr]">
          <span aria-hidden="true" className="timeline-node timeline-node-next" />
          <p className="tabular pt-0.5 text-sm whitespace-nowrap text-muted">
            <time dateTime={nextDate}>{formatDate(nextDate)}</time>
          </p>
          <p className="font-semibold">
            Next court date
            <span className="ms-2 align-[1px] text-2xs font-semibold text-muted">Scheduled</span>
          </p>
        </li>
      ) : null}
    </ol>
  )
}

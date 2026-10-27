import { LEGAL_EVENT_META, type LegalEventType } from '@/db/enums'
import { formatDate } from '@/lib/format'
import { SourceRef } from './SourceRef'

type Event = { date: string; event_type: LegalEventType; description: string; source_n: number | null; case_id: string | null }

/**
 * Vertical legal timeline: dated nodes, each with its label and source. The
 * latest step is marked, and a scheduled court date closes the line as a
 * hollow node, so an open case reads as open.
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
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <ol className="relative ms-2 border-s-2 border-rule">
      {sorted.map((e, i) => {
        const latest = i === sorted.length - 1
        return (
          <li key={i} className="relative grid gap-x-6 ps-6 pb-7 last:pb-0 sm:grid-cols-[8.5rem_1fr] sm:ps-7">
            <span
              aria-hidden="true"
              className={`absolute -start-[7px] top-[5px] h-3 w-3 rounded-full border-2 border-surface bg-accent ${latest ? 'shadow-[0_0_0_4px_var(--accent-tint)]' : ''}`}
            />
            <p className="tabular pt-0.5 text-[14px] text-muted">
              <time dateTime={e.date}>{formatDate(e.date)}</time>
            </p>
            <div>
              <p className="font-semibold">
                {LEGAL_EVENT_META[e.event_type].label}
                {latest ? <span className="ms-2 align-[1px] text-[12px] font-semibold text-accent">Latest</span> : null}
              </p>
              {e.description ? <p className="mt-0.5 text-[15.5px]">{e.description}</p> : null}
              {e.source_n ? (
                <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-muted">
                  <SourceRef n={e.source_n} href={`#${sourceIdPrefix}-${e.source_n}`} />
                  {showCase && e.case_id ? <span>Case {e.case_id}</span> : null}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
      {nextDate ? (
        <li className="relative grid gap-x-6 ps-6 pt-7 sm:grid-cols-[8.5rem_1fr] sm:ps-7">
          <span aria-hidden="true" className="absolute -start-[7px] top-[33px] h-3 w-3 rounded-full border-2 border-accent bg-surface" />
          <p className="tabular pt-0.5 text-[14px] text-muted">
            <time dateTime={nextDate}>{formatDate(nextDate)}</time>
          </p>
          <p className="font-semibold">Next court date</p>
        </li>
      ) : null}
    </ol>
  )
}

import { LEGAL_EVENT_META, type LegalEventType } from '@/db/enums'
import { formatDate } from '@/lib/format'

type Event = { date: string; event_type: LegalEventType; description: string; source_n: number | null; case_id: string | null }

/** Vertical legal timeline: dated nodes, each with its label and source. */
export function Timeline({ events, sourceIdPrefix = 'source' }: { events: Event[]; sourceIdPrefix?: string }) {
  return (
    <ol className="relative ms-2 border-s-2 border-rule">
      {events.map((e, i) => (
        <li key={i} className="relative ps-6 pb-6 last:pb-0">
          <span aria-hidden="true" className="absolute -start-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-accent bg-surface" />
          <p className="text-sm text-muted tabular">
            <time dateTime={e.date}>{formatDate(e.date)}</time>
          </p>
          <p className="font-semibold">{LEGAL_EVENT_META[e.event_type].label}</p>
          {e.description ? <p className="text-base">{e.description}</p> : null}
          {e.source_n ? (
            <p className="text-sm">
              <a href={`#${sourceIdPrefix}-${e.source_n}`}>Source {e.source_n}</a>
              {e.case_id ? <span className="text-muted"> · Case {e.case_id}</span> : null}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

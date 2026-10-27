import { LEGAL_EVENT_META, type LegalEventType } from '@/db/enums'
import { formatDate } from '@/lib/format'

type Event = { date: string; event_type: LegalEventType; description: string; source_n: number | null; case_id: string | null }

/** Vertical legal timeline: dated nodes, each with its label and source. */
export function Timeline({ events, sourceIdPrefix = 'source' }: { events: Event[]; sourceIdPrefix?: string }) {
  return (
    <ol className="relative ms-1 border-s border-ink">
      {events.map((e, i) => (
        <li key={i} className="relative grid gap-x-6 ps-6 pb-7 last:pb-0 sm:grid-cols-[8.5rem_1fr] sm:ps-7">
          <span aria-hidden="true" className="absolute -start-[4.5px] top-[7px] h-2 w-2 bg-text" />
          <p className="mono pt-0.5 text-muted">
            <time dateTime={e.date}>{formatDate(e.date)}</time>
          </p>
          <div>
            <p className="font-semibold">{LEGAL_EVENT_META[e.event_type].label}</p>
            {e.description ? <p className="mt-0.5 text-[15.5px]">{e.description}</p> : null}
            {e.source_n ? (
              <p className="mono mt-1">
                <a href={`#${sourceIdPrefix}-${e.source_n}`}>Source {e.source_n}</a>
                {e.case_id ? <span className="text-muted"> · Case {e.case_id}</span> : null}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

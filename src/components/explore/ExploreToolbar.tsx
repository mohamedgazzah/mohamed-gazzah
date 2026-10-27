import { CalendarDays, CalendarRange, Search, Tags } from 'lucide-react'
import Link from 'next/link'
import { INCIDENT_TYPES, INCIDENT_TYPE_META, type IncidentType } from '@/db/enums'
import { activePreset, datePresets, describeDates, explorePath, serializeFilters, type Filters, type ViewState } from '@/lib/filters'
import { formatNumber } from '@/lib/format'

/** Hidden inputs that carry every filter except the ones a form sets itself. */
function Carry({ filters, view, except }: { filters: Filters; view: ViewState; except: string[] }) {
  const params = new URLSearchParams(serializeFilters(filters, { ...view, page: 1 }))
  return (
    <>
      {[...params.entries()]
        .filter(([k]) => !except.includes(k))
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
    </>
  )
}

/**
 * The filters people reach for first, above the map and list: search, a
 * date range (presets, or a custom range) and incident types, each type
 * showing how many records it would add with the other filters as they are.
 * Plain links and GET forms, so it all works without JavaScript.
 */
export function ExploreToolbar({
  filters,
  view,
  today,
  typeCounts,
}: {
  filters: Filters
  view: ViewState
  today: string
  typeCounts: Record<IncidentType, number>
}) {
  const base = { ...view, page: 1 }
  const preset = activePreset(filters, today)
  const toggle = (t: IncidentType) =>
    explorePath({ ...filters, type: filters.type.includes(t) ? filters.type.filter((x) => x !== t) : [...filters.type, t] }, base)

  return (
    <div className="glass toolbar">
      <form method="get" action="/incidents" role="search" aria-label="Search incidents" className="toolbar-row">
        <label htmlFor="f-q" className="kicker toolbar-label">
          <Search aria-hidden="true" />
          Search
        </label>
        <div className="toolbar-controls">
          <Carry filters={filters} view={view} except={['q']} />
          <div className="relative min-w-0 flex-1 basis-60">
            <input
              id="f-q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ''}
              className="control min-h-10 py-1.5"
              placeholder="City, place, case name or words"
              aria-describedby="f-q-hint"
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            Search
          </button>
          <p id="f-q-hint" className="sr-only">
            Searches titles, summaries, places and case names. Small typos are fine.
          </p>
        </div>
      </form>

      <div className="toolbar-row">
        <span className="kicker toolbar-label" id="tb-dates">
          <CalendarRange aria-hidden="true" />
          Dates
        </span>
        <div className="toolbar-controls">
          <nav aria-labelledby="tb-dates" className="segmented">
            {datePresets(today).map((p) => (
              <Link key={p.key} href={explorePath({ ...filters, from: p.from, to: p.to }, base)} aria-current={preset?.key === p.key ? 'true' : undefined}>
                {p.label.startsWith('Last ') ? (
                  <span>
                    <span className="max-sm:sr-only">Last </span>
                    {p.label.slice(5)}
                  </span>
                ) : (
                  p.label
                )}
              </Link>
            ))}
          </nav>
          <details className="custom-range">
            <summary data-active={preset ? undefined : 'true'}>
              <CalendarDays aria-hidden="true" />
              {preset ? 'Custom range' : describeDates(filters, today)}
            </summary>
            <form method="get" action="/incidents" className="glass-strong custom-range-form">
              <Carry filters={filters} view={view} except={['from', 'to']} />
              <label>
                <span className="label">From</span>
                <input name="from" type="date" min="2020-01-01" max={today} defaultValue={filters.from ?? ''} className="control" />
              </label>
              <label>
                <span className="label">To</span>
                <input name="to" type="date" min="2020-01-01" max={today} defaultValue={filters.to ?? ''} className="control" />
              </label>
              <button type="submit" className="btn">
                Apply dates
              </button>
            </form>
          </details>
        </div>
      </div>

      <div className="toolbar-row">
        <span className="kicker toolbar-label" id="tb-types">
          <Tags aria-hidden="true" />
          Incident type
        </span>
        <ul aria-labelledby="tb-types" className="type-toggles">
          <li>
            <Link href={explorePath({ ...filters, type: [] }, base)} className="toggle toggle-all" aria-current={filters.type.length ? undefined : 'true'}>
              All types
            </Link>
          </li>
          {INCIDENT_TYPES.map((t) => {
            const on = filters.type.includes(t)
            const n = typeCounts[t]
            return (
              <li key={t}>
                <Link
                  href={toggle(t)}
                  className="toggle"
                  aria-current={on ? 'true' : undefined}
                  // Starts with the visible text ("Threat 1"), so speech input can say what it sees.
                  aria-label={`${INCIDENT_TYPE_META[t].label} ${formatNumber(n)} ${n === 1 ? 'record' : 'records'}${on ? ', selected' : ''}`}
                  data-empty={n === 0 && !on ? 'true' : undefined}
                >
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="toggle-check">
                    <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                  </svg>
                  {INCIDENT_TYPE_META[t].label}{' '}
                  <span className="toggle-count tabular">{formatNumber(n)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { SEVERITY_META } from '@/db/enums'
import { EMPTY_FILTERS, explorePath } from '@/lib/filters'
import { formatDate, formatPlace, plural } from '@/lib/format'
import { incidentPath } from '@/lib/slug'
import type { TimelinePoint } from '@/server/public/incidents'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const W = 1000
const BASE = 100

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
const dayOfYear = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000
}

/**
 * The year so far as a strip: one line per record on its date, taller for
 * more severe incidents. A chart with an axis, not a sparkline: each month
 * links to Explore filtered to exactly that month, and each line opens its
 * record. The month links and the list below are the accessible version.
 */
export function YearStrip({ year, today, points }: { year: number; today: string; points: TimelinePoint[] }) {
  const yearDays = dayOfYear(iso(year, 11, 31)) + 1
  const x = (date: string) => ((dayOfYear(date) + 0.5) / yearDays) * W
  const todayX = today.startsWith(String(year)) ? x(today) : null
  const perMonth = MONTHS.map((_, m) => points.filter((p) => Number(p.dateStart.slice(5, 7)) === m + 1).length)
  const summary = points.length
    ? `${plural(points.length, 'verified record')} in ${year} to date. By month: ${MONTHS.map((name, m) => (perMonth[m] ? `${name} ${perMonth[m]}` : null))
        .filter(Boolean)
        .join(', ')}.`
    : `No verified records yet in ${year}.`

  return (
    <figure aria-labelledby="strip-title" className="border-t border-ink pt-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span id="strip-title" className="kicker text-text">
          {year} so far · {plural(points.length, 'record')}
        </span>
        <span className="kicker">One line per record, on its date · taller lines are more severe</span>
      </figcaption>
      <p className="sr-only">{summary}</p>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} 112`} preserveAspectRatio="none" aria-hidden="true" className="block h-[112px] w-full overflow-visible">
          <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="var(--rule)" vectorEffect="non-scaling-stroke" />
          {MONTHS.map((_, m) => {
            const mx = (dayOfYear(iso(year, m, 1)) / yearDays) * W
            return <line key={m} x1={mx} y1={BASE} x2={mx} y2={BASE + 8} stroke="var(--text-muted)" vectorEffect="non-scaling-stroke" />
          })}
          {todayX !== null ? (
            <line x1={todayX} y1={6} x2={todayX} y2={BASE} stroke="var(--text)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          ) : null}
          {points.map((p, i) => {
            const px = x(p.dateStart)
            const h = 18 + (p.severity - 1) * 16
            return (
              <a key={p.id} href={incidentPath(p.id, p.slug)} tabIndex={-1}>
                <title>{`${formatDate(p.dateStart)} · ${formatPlace(p.city, p.stateCode)}: ${p.title} (${SEVERITY_META[p.severity].label})`}</title>
                <rect x={px - 4} y={BASE - 92} width={8} height={92} fill="transparent" />
                <line
                  x1={px}
                  y1={BASE}
                  x2={px}
                  y2={BASE - h}
                  stroke="var(--accent)"
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                  className="draw-up"
                  style={{ animationDelay: `${Math.min(i * 14, 700)}ms` }}
                />
              </a>
            )
          })}
        </svg>
        {todayX !== null ? (
          <span className="kicker absolute top-0 text-text" style={{ insetInlineStart: `calc(${(todayX / W) * 100}% + 6px)` }}>
            Today
          </span>
        ) : null}
        {points.length === 0 ? (
          <p className="mono absolute inset-x-0 top-9 text-center text-muted">No verified records yet in {year}.</p>
        ) : null}
      </div>
      <ol className="relative mt-1 h-8" aria-label={`Records by month, ${year}`}>
        {MONTHS.map((name, m) => {
          const start = iso(year, m, 1)
          const end = iso(year, m, daysIn(year, m))
          const left = `${(dayOfYear(start) / yearDays) * 100}%`
          const label = (
            <>
              <span aria-hidden="true" className="md:hidden">
                {name.slice(0, 1)}
              </span>
              <span aria-hidden="true" className="hidden md:inline">
                {name.slice(0, 3)}
              </span>
              <span className="sr-only">
                {name} {year}
              </span>
            </>
          )
          return (
            <li key={name} className="absolute top-0" style={{ insetInlineStart: left }}>
              {start <= today ? (
                <Link
                  href={explorePath({ ...EMPTY_FILTERS, from: start, to: end < today ? end : today })}
                  className="kicker inline-flex min-h-6 items-center pe-2 text-muted no-underline hover:text-accent hover:underline"
                >
                  {label}
                  {/* No visible count: "Aug 1" would read as a date. The lines show the records. */}
                  <span className="sr-only">, {perMonth[m] ? plural(perMonth[m]!, 'record') : 'no records'}</span>
                </Link>
              ) : (
                <span className="kicker inline-flex min-h-6 items-center">{label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </figure>
  )
}

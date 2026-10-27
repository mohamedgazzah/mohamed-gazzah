import Link from 'next/link'
import { formatDate, formatNumber, plural } from '@/lib/format'
import { ChartTips } from './ChartTips'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export type MonthBar = { month: string; count: number; href: string; partial?: boolean }

/** Up to four round ticks from zero that cover the maximum. */
export function columnTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag)
  const ticks = [0]
  while (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step)
  return ticks
}

const monthName = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

/**
 * Records per month as columns on a zero baseline, with round ticks. The
 * tallest and the latest columns carry their value; the rest show it on hover
 * or focus, and in the table that goes with the chart. Each column opens
 * Explore for its month.
 */
export function MonthColumns({ bars, noun = 'incident', asOf }: { bars: MonthBar[]; noun?: string; asOf?: string }) {
  const max = Math.max(0, ...bars.map((b) => b.count))
  const ticks = columnTicks(max)
  const top = ticks[ticks.length - 1]!
  const last = bars[bars.length - 1]
  return (
    <ChartTips>
      <div className="cols" style={{ ['--cols' as string]: bars.length }}>
        <div className="cols-plot" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="cols-grid" style={{ insetBlockEnd: `${(t / top) * 100}%` }}>
              <span className="tabular">{formatNumber(t)}</span>
            </span>
          ))}
        </div>
        <ol className="cols-bars" aria-label={`${noun[0]!.toUpperCase() + noun.slice(1)}s per month`}>
          {bars.map((b, i) => (
            <li key={b.month}>
              <Link href={b.href} className="col" data-tip={`${monthName(b.month)}${b.partial ? ' (to date)' : ''}`} data-tip-value={plural(b.count, noun)}>
                <span className={b.partial ? 'col-bar col-bar-partial' : 'col-bar'} style={{ blockSize: `${(b.count / top) * 100}%` }}>
                  {/* Every peak and the latest month carry their value; the rest are in the tooltip and the table. */}
                  {b.count > 0 && (b.count === max || i === bars.length - 1) ? <span className="col-value tabular">{formatNumber(b.count)}</span> : null}
                </span>
                <span className="sr-only">
                  {monthName(b.month)}
                  {b.partial ? ' to date' : ''}: {plural(b.count, noun)}
                </span>
              </Link>
              <span className="col-axis" aria-hidden="true">
                <span className="hidden min-[30rem]:inline">{MONTHS[Number(b.month.slice(5, 7)) - 1]}</span>
                <span className="min-[30rem]:hidden">{MONTHS[Number(b.month.slice(5, 7)) - 1]![0]}</span>
                {b.partial ? '*' : ''}
                {b.month.endsWith('-01') || i === 0 ? <span className="block text-muted">{b.month.slice(0, 4)}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {last?.partial && asOf ? (
        <p className="mt-2 text-xs text-muted">
          * {MONTH_NAMES[Number(last.month.slice(5, 7)) - 1]} to date: counts run to {formatDate(asOf)}.
        </p>
      ) : null}
    </ChartTips>
  )
}

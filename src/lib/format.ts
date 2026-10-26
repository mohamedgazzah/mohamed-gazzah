import type { DatePrecision } from '@/db/enums'
import { stateByCode, stateByFips } from './states'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y: y!, m: m!, d: d! }
}

/** "Oct. 26, 2026", "October 2026" or "2026", by precision. Dates are calendar dates: no time zone shift. */
export function formatDate(iso: string | null | undefined, precision: DatePrecision = 'day', style: 'short' | 'long' = 'short'): string {
  if (!iso) return ''
  const { y, m, d } = parts(iso)
  if (precision === 'year') return String(y)
  if (precision === 'month') return `${MONTHS[m - 1]} ${y}`
  const month = style === 'long' ? MONTHS[m - 1] : MONTHS_SHORT[m - 1]
  return `${month} ${d}, ${y}`
}

export function formatDateRange(start: string, end: string | null | undefined, precision: DatePrecision = 'day'): string {
  if (!end || end === start) return formatDate(start, precision)
  return `${formatDate(start, precision)} – ${formatDate(end, precision)}`
}

/** Postgres or JS timestamp to ISO 8601 UTC ("2026-10-26T03:36:38.766Z"). */
export function isoTimestamp(ts: string | Date): string {
  if (ts instanceof Date) return ts.toISOString()
  const s = ts.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? ts : d.toISOString()
}

/** Timestamp to "Oct. 26, 2026" (UTC date). */
export function formatTimestamp(ts: string | Date | null | undefined): string {
  if (!ts) return ''
  return formatDate(isoTimestamp(ts).slice(0, 10))
}

export function formatPlace(city: string | null | undefined, state: string | null | undefined): string {
  const s = stateByCode(state ?? '') ?? stateByFips(state ?? '')
  const st = s?.code ?? state ?? ''
  return [city, st].filter(Boolean).join(', ')
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`
}

/** Today's calendar date in US Eastern time, as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

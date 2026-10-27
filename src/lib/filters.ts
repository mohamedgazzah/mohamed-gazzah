/**
 * Explore filters ⇄ URL query string.
 *
 * All filter state lives in the URL so any view can be shared and cited:
 *   /incidents?state=MI&type=VAND,THRT&from=2026-01-01&v=2,3
 *
 * parseFilters() accepts loose input (repeated keys, any order, unknown
 * values) and serializeFilters() writes one canonical form: fixed key order,
 * values in taxonomy order, defaults omitted. The Explore page redirects to
 * the canonical form, so one view has exactly one URL.
 *
 * Stability contract (documented on /methodology): a URL without `v` means
 * verification levels V2 and V3, and without `sort` means newest first.
 */
import {
  DEFAULT_VERIFICATION_LEVELS,
  INCIDENT_TYPES,
  INCIDENT_TYPE_META,
  LEGAL_STATUSES,
  LEGAL_STATUS_META,
  PERPETRATOR_TYPES,
  PERPETRATOR_TYPE_META,
  PUBLIC_VERIFICATION_LEVELS,
  SEVERITIES,
  SEVERITY_META,
  SOURCE_TYPES,
  SOURCE_TYPE_META,
  TARGET_TYPES,
  TARGET_TYPE_META,
  VERIFICATION_META,
  YES_NO_UNKNOWN,
  type IncidentType,
  type LegalStatus,
  type PerpetratorType,
  type PublicVerificationLevel,
  type Severity,
  type SourceType,
  type TargetType,
  type YesNoUnknown,
} from '@/db/enums'
import { US_STATES, stateByCode } from './states'
import { addDays, formatDate, formatDateRange } from './format'

export const SORTS = ['newest', 'oldest', 'severity'] as const
export type Sort = (typeof SORTS)[number]
export const SORT_LABELS: Record<Sort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  severity: 'Most severe first',
}

// The list under the map. (A former "map" view is now always shown; old
// view=map links redirect to the canonical URL without it.)
export const VIEWS = ['table', 'cards'] as const
export type View = (typeof VIEWS)[number]

export const PAGE_SIZE = 50
const MAX_QUERY_LENGTH = 200

export type Filters = {
  q: string | null
  from: string | null
  to: string | null
  state: string[]
  city: string | null
  type: IncidentType[]
  target: TargetType[]
  severity: Severity[]
  v: PublicVerificationLevel[]
  status: LegalStatus[]
  perp: PerpetratorType[]
  source: SourceType[]
  hc: YesNoUnknown[]
}

export type ViewState = { sort: Sort; page: number; view: View }

export const EMPTY_FILTERS: Filters = {
  q: null,
  from: null,
  to: null,
  state: [],
  city: null,
  type: [],
  target: [],
  severity: [],
  v: [...DEFAULT_VERIFICATION_LEVELS],
  status: [],
  perp: [],
  source: [],
  hc: [],
}

export const DEFAULT_VIEW_STATE: ViewState = { sort: 'newest', page: 1, view: 'table' }

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams

function getAll(params: RawParams, key: string): string[] {
  const raw = params instanceof URLSearchParams ? params.getAll(key) : params[key]
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  return list.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
}

/** Last raw value of a key, without splitting on commas (for free text). */
function getRaw(params: RawParams, key: string): string | null {
  const raw = params instanceof URLSearchParams ? params.getAll(key) : params[key]
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  return list.length ? list[list.length - 1]! : null
}

function getOne(params: RawParams, key: string): string | null {
  const all = getAll(params, key)
  return all.length ? all[all.length - 1]! : null
}

function cleanText(value: string | null, max: number): string | null {
  return value?.replace(/\s+/g, ' ').trim().slice(0, max).trim() || null
}

/** Keep known values, in canonical (taxonomy) order, without duplicates. */
function pick<T extends string | number>(values: string[], allowed: readonly T[], normalize: (v: string) => string = (v) => v): T[] {
  const wanted = new Set(values.map(normalize))
  return allowed.filter((a) => wanted.has(String(a)))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
function parseDate(value: string | null): string | null {
  if (!value || !ISO_DATE.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null
  return value
}

export function parseFilters(params: RawParams): Filters {
  const query = cleanText(getRaw(params, 'q'), MAX_QUERY_LENGTH)

  let from = parseDate(getOne(params, 'from'))
  let to = parseDate(getOne(params, 'to'))
  if (from && to && from > to) [from, to] = [to, from]

  const vRaw = getAll(params, 'v')
  const v = vRaw.length
    ? pick(vRaw, PUBLIC_VERIFICATION_LEVELS, (x) => (x.toUpperCase().startsWith('V') ? x.toUpperCase() : `V${x}`))
    : [...DEFAULT_VERIFICATION_LEVELS]

  const city = cleanText(getRaw(params, 'city'), 100)

  return {
    q: query,
    from,
    to,
    state: pick(getAll(params, 'state'), US_STATES.map((s) => s.code), (x) => x.toUpperCase()),
    city,
    type: pick(getAll(params, 'type'), INCIDENT_TYPES, (x) => x.toUpperCase()),
    target: pick(getAll(params, 'target'), TARGET_TYPES),
    severity: pick(getAll(params, 'sev'), SEVERITIES),
    v: v.length ? v : [...DEFAULT_VERIFICATION_LEVELS],
    status: pick(getAll(params, 'status'), LEGAL_STATUSES),
    perp: pick(getAll(params, 'perp'), PERPETRATOR_TYPES),
    source: pick(getAll(params, 'src'), SOURCE_TYPES),
    hc: pick(getAll(params, 'hc'), YES_NO_UNKNOWN),
  }
}

export function parseViewState(params: RawParams): ViewState {
  const sort = (pick(getAll(params, 'sort'), SORTS)[0] ?? 'newest') as Sort
  const view = (pick(getAll(params, 'view'), VIEWS)[0] ?? 'table') as View
  const pageRaw = Number.parseInt(getOne(params, 'page') ?? '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 100000) : 1
  return { sort, page, view }
}

function isDefaultV(v: readonly string[]): boolean {
  return v.length === DEFAULT_VERIFICATION_LEVELS.length && DEFAULT_VERIFICATION_LEVELS.every((x) => v.includes(x))
}

/** Canonical query string (no leading "?"). Empty string when nothing is set. */
export function serializeFilters(f: Filters, view: Partial<ViewState> = {}): string {
  const out: [string, string][] = []
  if (f.q) out.push(['q', f.q])
  if (f.from) out.push(['from', f.from])
  if (f.to) out.push(['to', f.to])
  if (f.state.length) out.push(['state', f.state.join(',')])
  if (f.city) out.push(['city', f.city])
  if (f.type.length) out.push(['type', f.type.join(',')])
  if (f.target.length) out.push(['target', f.target.join(',')])
  if (f.severity.length) out.push(['sev', f.severity.join(',')])
  if (!isDefaultV(f.v)) out.push(['v', f.v.map((x) => x.slice(1)).join(',')])
  if (f.status.length) out.push(['status', f.status.join(',')])
  if (f.perp.length) out.push(['perp', f.perp.join(',')])
  if (f.source.length) out.push(['src', f.source.join(',')])
  if (f.hc.length) out.push(['hc', f.hc.join(',')])
  if (view.sort && view.sort !== 'newest') out.push(['sort', view.sort])
  if (view.view && view.view !== 'table') out.push(['view', view.view])
  if (view.page && view.page > 1) out.push(['page', String(view.page)])
  // Commas stay readable in canonical URLs; everything else is encoded.
  return out.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ',')}`).join('&')
}

export function explorePath(f: Partial<Filters> = {}, view: Partial<ViewState> = {}): string {
  const qs = serializeFilters({ ...EMPTY_FILTERS, ...f }, view)
  return qs ? `/incidents?${qs}` : '/incidents'
}

/** Normalize a raw query string the way the browser would send it, for comparison. */
export function normalizeIncomingQuery(params: RawParams): string {
  const entries: [string, string][] = []
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => entries.push([k, v]))
  } else {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue
      for (const item of Array.isArray(v) ? v : [v]) entries.push([k, item])
    }
  }
  return entries.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ',')}`).join('&')
}

export function hasActiveFilters(f: Filters): boolean {
  return chips(f).length > 0
}

export type Chip = { key: string; label: string; removeHref: string }

/** Active-filter chips, each with a link that removes just that value. */
export function chips(f: Filters, view: Partial<ViewState> = {}, today?: string): Chip[] {
  const base = { ...view, page: 1 }
  const without = (patch: Partial<Filters>) => explorePath({ ...f, ...patch }, base)
  const list: Chip[] = []
  if (f.q) list.push({ key: 'q', label: `Search: “${f.q}”`, removeHref: without({ q: null }) })
  // One chip for the date range: removing half a range is never what anyone means.
  if (f.from || f.to) {
    const preset = today ? activePreset(f, today) : null
    const label = preset ? preset.label : rangeLabel(f.from, f.to)
    list.push({ key: 'dates', label, removeHref: without({ from: null, to: null }) })
  }
  for (const s of f.state)
    list.push({ key: `state-${s}`, label: stateByCode(s)?.name ?? s, removeHref: without({ state: f.state.filter((x) => x !== s) }) })
  if (f.city) list.push({ key: 'city', label: `City: ${f.city}`, removeHref: without({ city: null }) })
  for (const t of f.type)
    list.push({ key: `type-${t}`, label: INCIDENT_TYPE_META[t].label, removeHref: without({ type: f.type.filter((x) => x !== t) }) })
  for (const t of f.target)
    list.push({ key: `target-${t}`, label: `Target: ${TARGET_TYPE_META[t].label}`, removeHref: without({ target: f.target.filter((x) => x !== t) }) })
  for (const s of f.severity)
    list.push({ key: `sev-${s}`, label: `Severity ${s}: ${SEVERITY_META[s].label}`, removeHref: without({ severity: f.severity.filter((x) => x !== s) }) })
  if (!isDefaultV(f.v)) {
    for (const v of f.v)
      list.push({
        key: `v-${v}`,
        label: VERIFICATION_META[v].label,
        removeHref: without({ v: f.v.length > 1 ? f.v.filter((x) => x !== v) : [...DEFAULT_VERIFICATION_LEVELS] }),
      })
  }
  for (const s of f.status)
    list.push({ key: `status-${s}`, label: LEGAL_STATUS_META[s].label, removeHref: without({ status: f.status.filter((x) => x !== s) }) })
  for (const p of f.perp)
    list.push({ key: `perp-${p}`, label: `Perpetrator: ${PERPETRATOR_TYPE_META[p].label}`, removeHref: without({ perp: f.perp.filter((x) => x !== p) }) })
  for (const s of f.source)
    list.push({ key: `src-${s}`, label: `Source: ${SOURCE_TYPE_META[s].label}`, removeHref: without({ source: f.source.filter((x) => x !== s) }) })
  for (const h of f.hc)
    list.push({ key: `hc-${h}`, label: `Hate-crime charge: ${h}`, removeHref: without({ hc: f.hc.filter((x) => x !== h) }) })
  return list
}

export type DatePreset = { key: 'all' | 'year' | '12m' | '30d'; label: string; from: string | null; to: string | null }

/**
 * Date ranges offered above the map, ending today (US Eastern). They match
 * the home page's stat tiles, so a tile opens Explore with its preset selected.
 */
export function datePresets(today: string): DatePreset[] {
  const year = today.slice(0, 4)
  return [
    { key: 'all', label: 'All dates', from: null, to: null },
    { key: 'year', label: year, from: `${year}-01-01`, to: today },
    { key: '12m', label: 'Last 12 months', from: addDays(today, -364), to: today },
    { key: '30d', label: 'Last 30 days', from: addDays(today, -29), to: today },
  ]
}

/** The preset matching the filters' dates, or null for a custom range. */
export function activePreset(f: Pick<Filters, 'from' | 'to'>, today: string): DatePreset | null {
  return datePresets(today).find((p) => p.from === f.from && p.to === f.to) ?? null
}

/** A custom range in the site's date style: "June 1 – Aug. 31, 2026", "Feb. 1, 2026 to today", "Up to Aug. 31, 2026". */
export function rangeLabel(from: string | null, to: string | null): string {
  if (from && to) return formatDateRange(from, to, 'day')
  if (from) return `${formatDate(from)} to today`
  return to ? `Up to ${formatDate(to)}` : 'All dates'
}

/** The filters' date range in words: "all dates", "2026", "the last 30 days", "Jan. 1, 2026 to today". */
export function describeDates(f: Pick<Filters, 'from' | 'to'>, today: string): string {
  const preset = activePreset(f, today)
  if (preset?.key === 'all') return 'all dates'
  if (preset) return preset.label.replace(/^Last/, 'the last')
  return rangeLabel(f.from, f.to)
}

/** "threat or vandalism", "physical assault, threat or vandalism": the chosen types, in words. */
function typesInWords(types: readonly IncidentType[]): string {
  const words = types.map((t) => INCIDENT_TYPE_META[t].label.toLowerCase())
  if (words.length <= 2) return words.join(' or ')
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`
}

/**
 * The line under a result count: what it covers, in the order of the filters
 * ("Matching “mosque” · Threat or vandalism · 2 states · all dates"). Three or
 * more types are counted ("3 types"), so the line fits the one-line bar on
 * wide screens; `full` names them all.
 */
export function describeScope(f: Filters, today: string, place: string | null): { short: string; full: string } {
  const line = (types: string | null) => {
    const text = [f.q ? `matching “${f.q}”` : null, types, place, describeDates(f, today)].filter(Boolean).join(' · ')
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  const named = f.type.length ? typesInWords(f.type) : null
  return { short: line(f.type.length > 2 ? `${f.type.length} types` : named), full: line(named) }
}


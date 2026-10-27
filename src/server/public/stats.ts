/**
 * Totals for the map and charts. Every function takes the same Filters and
 * uses the same WHERE clause as Explore and the CSV, so clicking a state, a
 * bar or a month opens Explore showing exactly the number it was drawn from.
 */
import 'server-only'
import { count, desc, sql } from 'drizzle-orm'
import { publicDb } from '@/db/public'
import { publicIncidents as pi } from '@/db/schema'
import { INCIDENT_TYPES, type IncidentType } from '@/db/enums'
import type { Filters } from '@/lib/filters'
import { whereClause } from './incidents'

/** Records per state code (states with none are absent). */
export async function countsByState(f: Filters): Promise<Record<string, number>> {
  const rows = await publicDb().select({ state: pi.stateCode, n: count() }).from(pi).where(whereClause(f)).groupBy(pi.stateCode)
  return Object.fromEntries(rows.map((r) => [r.state, r.n]))
}

/**
 * Records per incident type. A record with two types counts under both, as it
 * does when Explore is filtered to either one.
 */
export async function countsByType(f: Filters): Promise<Record<IncidentType, number>> {
  const columns = Object.fromEntries(
    INCIDENT_TYPES.map((t) => [t, sql<number>`count(*) filter (where ${pi.incidentTypes} @> array[${t}]::text[])`.mapWith(Number)]),
  ) as Record<IncidentType, ReturnType<typeof sql<number>>>
  const [row] = await publicDb().select(columns).from(pi).where(whereClause(f))
  return Object.fromEntries(INCIDENT_TYPES.map((t) => [t, row?.[t] ?? 0])) as Record<IncidentType, number>
}

export type CityCount = { city: string; stateCode: string; lat: number; lng: number; count: number }

/**
 * Records per city within the filters (normally one state), at the city's
 * position. Cities match case-insensitively, as Explore's city filter does.
 * Records shown only at state level have no city and are counted in `stateOnly`.
 */
export async function countsByCity(f: Filters): Promise<{ cities: CityCount[]; stateOnly: number }> {
  const cityKey = sql`lower(${pi.city})`
  const hasPlace = sql`${pi.city} IS NOT NULL AND ${pi.lat} IS NOT NULL AND ${pi.lng} IS NOT NULL`
  const rows = await publicDb()
    .select({
      city: sql<string>`min(${pi.city})`,
      stateCode: pi.stateCode,
      lat: sql<number>`avg(${pi.lat})`.mapWith(Number),
      lng: sql<number>`avg(${pi.lng})`.mapWith(Number),
      n: count(),
    })
    .from(pi)
    .where(sql`${whereClause(f)} AND ${hasPlace}`)
    .groupBy(pi.stateCode, cityKey)
    .orderBy(desc(count()), sql`min(${pi.city})`)
  const [rest] = await publicDb()
    .select({ n: count() })
    .from(pi)
    .where(sql`${whereClause(f)} AND NOT (${hasPlace})`)
  return { cities: rows.map((r) => ({ city: r.city, stateCode: r.stateCode, lat: r.lat, lng: r.lng, count: r.n })), stateOnly: rest?.n ?? 0 }
}

export type MonthCount = { month: string; from: string; to: string; count: number }

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Calendar months from `from` through `to` (YYYY-MM-DD), inclusive. */
export function monthsBetween(from: string, to: string): { month: string; from: string; to: string }[] {
  const out: { month: string; from: string; to: string }[] = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7)) - 1
  const endKey = to.slice(0, 7)
  for (;;) {
    const start = new Date(Date.UTC(y, m, 1))
    const end = new Date(Date.UTC(y, m + 1, 0))
    const month = iso(start).slice(0, 7)
    if (month > endKey) break
    out.push({ month, from: iso(start), to: iso(end) })
    m += 1
    if (m === 12) {
      m = 0
      y += 1
    }
  }
  return out
}

/**
 * Records per calendar month from `from` to `to`, within any date range the
 * filters already have. A record counts in every month its dates touch, which
 * is how Explore's date filter selects it, so each bar opens Explore filtered
 * to its month with the same count. The first and last months are clipped to
 * the window.
 */
export async function countsByMonth(f: Filters, from: string, to: string): Promise<MonthCount[]> {
  const lo = f.from && f.from > from ? f.from : from
  const hi = f.to && f.to < to ? f.to : to
  if (lo > hi) return []
  const months = monthsBetween(lo, hi)
  months[0]!.from = lo
  months[months.length - 1]!.to = hi
  const rows = await publicDb()
    .select({ start: pi.dateStart, end: pi.dateEnd })
    .from(pi)
    .where(whereClause({ ...f, from: lo, to: hi }))
  return months.map((m) => ({
    ...m,
    count: rows.filter((r) => (r.end ?? r.start) >= m.from && r.start <= m.to).length,
  }))
}

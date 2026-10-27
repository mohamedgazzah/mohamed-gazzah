/**
 * Every public number and list comes from these functions, all built on one
 * WHERE clause (whereClause). Explore, stat tiles, CSV downloads and the
 * sitemap therefore count the same records for the same filters.
 */
import 'server-only'
import { and, asc, count, countDistinct, desc, eq, getViewSelectedFields, max, ne, or, sql, type SQL } from 'drizzle-orm'
import { publicDb } from '@/db/public'
import { publicIncidents as pi, type PublicIncident } from '@/db/schema'
import { PAGE_SIZE, type Filters, type Sort } from '@/lib/filters'

const list = (values: readonly (string | number)[]) => sql.param(values)

/** Minimum trigram word similarity for a typo-tolerant match. */
export const FUZZY_THRESHOLD = 0.5

export function whereClause(f: Filters): SQL {
  const conds: SQL[] = [sql`${pi.verificationLevel} = ANY(${list(f.v)}::text[])`]
  if (f.from) conds.push(sql`coalesce(${pi.dateEnd}, ${pi.dateStart}) >= ${f.from}::date`)
  if (f.to) conds.push(sql`${pi.dateStart} <= ${f.to}::date`)
  if (f.state.length) conds.push(sql`${pi.stateCode} = ANY(${list(f.state)}::text[])`)
  if (f.city) conds.push(sql`lower(${pi.city}) = lower(${f.city})`)
  if (f.type.length) conds.push(sql`${pi.incidentTypes} && ${list(f.type)}::text[]`)
  if (f.target.length) conds.push(sql`${pi.targetType} = ANY(${list(f.target)}::text[])`)
  if (f.severity.length) conds.push(sql`${pi.severity} = ANY(${list(f.severity)}::int[])`)
  if (f.status.length) conds.push(sql`${pi.legalStatus} = ANY(${list(f.status)}::text[])`)
  if (f.perp.length) conds.push(sql`${pi.perpetratorType} = ANY(${list(f.perp)}::text[])`)
  if (f.source.length) conds.push(sql`${pi.sourceTypes} && ${list(f.source)}::text[]`)
  if (f.hc.length) conds.push(sql`${pi.hateCrimeCharged} = ANY(${list(f.hc)}::text[])`)
  if (f.q) {
    conds.push(
      sql`(${pi.searchDocument} @@ websearch_to_tsquery('english', ${f.q}) OR word_similarity(${f.q}, ${pi.searchText}) >= ${FUZZY_THRESHOLD})`,
    )
  }
  return and(...conds)!
}

function orderBy(sort: Sort) {
  switch (sort) {
    case 'oldest':
      return [asc(pi.dateStart), asc(pi.id)]
    case 'severity':
      return [desc(pi.severity), desc(pi.dateStart), desc(pi.id)]
    default:
      return [desc(pi.dateStart), desc(pi.id)]
  }
}

const listColumns = {
  id: pi.id,
  slug: pi.slug,
  title: pi.title,
  summary: pi.summary,
  dateStart: pi.dateStart,
  dateEnd: pi.dateEnd,
  datePrecision: pi.datePrecision,
  city: pi.city,
  stateCode: pi.stateCode,
  incidentTypes: pi.incidentTypes,
  targetType: pi.targetType,
  severity: pi.severity,
  deaths: pi.deaths,
  injuries: pi.injuries,
  verificationLevel: pi.verificationLevel,
  legalStatus: pi.legalStatus,
  hateCrimeCharged: pi.hateCrimeCharged,
  perpetratorType: pi.perpetratorType,
  sourceCount: pi.sourceCount,
  sourceTypes: pi.sourceTypes,
  isDemo: pi.isDemo,
}
export type IncidentListItem = { [K in keyof typeof listColumns]: PublicIncident[K] }

export async function searchIncidents(f: Filters, opts: { sort: Sort; page: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? PAGE_SIZE
  const where = whereClause(f)
  const [totalRow] = await publicDb().select({ n: count() }).from(pi).where(where)
  const total = totalRow?.n ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, opts.page), pages)
  const rows: IncidentListItem[] = await publicDb()
    .select(listColumns)
    .from(pi)
    .where(where)
    .orderBy(...orderBy(opts.sort))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return { total, page, pages, pageSize, rows }
}

export async function countIncidents(f: Filters): Promise<{ incidents: number; states: number }> {
  const [row] = await publicDb()
    .select({ incidents: count(), states: countDistinct(pi.stateCode) })
    .from(pi)
    .where(whereClause(f))
  return { incidents: row?.incidents ?? 0, states: row?.states ?? 0 }
}

export type PublicIncidentDetail = Omit<PublicIncident, 'searchText' | 'searchDocument'>

const { searchText: _searchText, searchDocument: _searchDocument, ...detailColumns } = getViewSelectedFields(pi)

export async function getIncident(id: string): Promise<PublicIncidentDetail | null> {
  const rows = await publicDb().select(detailColumns).from(pi).where(eq(pi.id, id)).limit(1)
  return rows[0] ?? null
}

export type RelatedGroups = { sameCity: IncidentListItem[]; samePerpetrator: IncidentListItem[]; sameCase: IncidentListItem[] }

export async function getRelated(inc: PublicIncidentDetail): Promise<RelatedGroups> {
  const db = publicDb()
  const sameCity = inc.city
    ? await db
        .select(listColumns)
        .from(pi)
        .where(and(ne(pi.id, inc.id), eq(pi.stateCode, inc.stateCode), sql`lower(${pi.city}) = lower(${inc.city})`))
        .orderBy(desc(pi.dateStart), desc(pi.id))
        .limit(5)
    : []
  const samePerpetrator = await db
    .select(listColumns)
    .from(pi)
    .where(
      and(
        ne(pi.id, inc.id),
        or(
          sql`${pi.id} = ANY(${list(inc.relatedIncidentIds.length ? inc.relatedIncidentIds : [''])}::text[])`,
          sql`${inc.id} = ANY(${pi.relatedIncidentIds})`,
        ),
      ),
    )
    .orderBy(desc(pi.dateStart), desc(pi.id))
    .limit(10)
  const sameCase = inc.caseIds.length
    ? await db
        .select(listColumns)
        .from(pi)
        .where(and(ne(pi.id, inc.id), sql`${pi.caseIds} && ${list(inc.caseIds)}::text[]`))
        .orderBy(desc(pi.dateStart), desc(pi.id))
        .limit(10)
    : []
  return { sameCity, samePerpetrator, sameCase }
}

export async function latestIncidents(f: Filters, n = 10): Promise<IncidentListItem[]> {
  return publicDb().select(listColumns).from(pi).where(whereClause(f)).orderBy(desc(pi.dateStart), desc(pi.id)).limit(n)
}

/** Every public record path, for static generation and the sitemap. */
export async function allRecordPaths(): Promise<{ id: string; slug: string; updatedAt: string }[]> {
  return publicDb().select({ id: pi.id, slug: pi.slug, updatedAt: pi.updatedAt }).from(pi).orderBy(asc(pi.id))
}

export async function lastUpdated(): Promise<string | null> {
  const [row] = await publicDb().select({ at: max(pi.updatedAt) }).from(pi)
  return row?.at ?? null
}

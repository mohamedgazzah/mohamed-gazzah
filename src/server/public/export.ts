/**
 * Public downloads. Built from the same view and the same WHERE clause as
 * Explore, so a CSV always has exactly the rows Explore counts.
 */
import 'server-only'
import { asc, getViewSelectedFields, sql, type SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { publicDb } from '@/db/public'
import { publicIncidents as pi } from '@/db/schema'
import { METHODOLOGY_VERSION, PUBLIC_VERIFICATION_LEVELS } from '@/db/enums'
import { EXPORT_FIELDS } from '@/lib/dictionary'
import { toCsv } from '@/lib/csv'
import { isoTimestamp } from '@/lib/format'
import { SITE } from '@/lib/site'
import type { Filters } from '@/lib/filters'
import { whereClause } from './incidents'

const allColumns = getViewSelectedFields(pi)
const exportColumns = Object.fromEntries(EXPORT_FIELDS.map((f) => [f.key, allColumns[f.key]])) as typeof allColumns

type Row = Record<string, unknown>

function normalize(row: Row): Row {
  const out: Row = {}
  for (const f of EXPORT_FIELDS) {
    const v = row[f.key]
    out[f.column] = typeof v === 'string' && /timestamp|datetime/.test(f.type) ? isoTimestamp(v) : v
  }
  return out
}

/** Rows for a filter set, or every public record (V1–V3) when filters is null. */
export async function exportRows(filters: Filters | null, db: NodePgDatabase = publicDb()): Promise<Row[]> {
  const where: SQL = filters ? whereClause(filters) : sql`${pi.verificationLevel} = ANY(${sql.param([...PUBLIC_VERIFICATION_LEVELS])}::text[])`
  const rows = await db.select(exportColumns).from(pi).where(where).orderBy(asc(pi.dateStart), asc(pi.id))
  return rows.map((r) => normalize(r as Row))
}

export function rowsToCsv(rows: Row[]): string {
  const header = EXPORT_FIELDS.map((f) => f.column)
  return toCsv(header, rows.map((r) => header.map((h) => r[h] as never)))
}

export function rowsToJson(rows: Row[], meta: { version: string; generatedAt: string }): string {
  return `${JSON.stringify(
    {
      dataset: SITE.fullName,
      version: meta.version,
      generated_at: meta.generatedAt,
      methodology_version: METHODOLOGY_VERSION,
      license: SITE.dataLicense.name,
      license_url: SITE.dataLicense.url,
      record_count: rows.length,
      records: rows,
    },
    null,
    2,
  )}\n`
}

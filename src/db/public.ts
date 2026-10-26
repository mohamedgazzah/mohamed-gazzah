/**
 * Database access for public pages, downloads and the sitemap. Connects as
 * record_public, which can read only the record_public views: editor notes,
 * drafts, V0 records and submitter data are unreachable from here by
 * construction, not by convention.
 */
import 'server-only'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { getPool } from './pool'

let db: NodePgDatabase | undefined

export function publicDb(): NodePgDatabase {
  db ??= drizzle(getPool('public', 'PUBLIC_DATABASE_URL'))
  return db
}

/**
 * Database access for the admin area and jobs. Connects as record_app.
 * Every write goes through withActor(), which names the acting user for the
 * database triggers (attribution, change log, two-person review).
 */
import 'server-only'
import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { getPool } from './pool'

let db: NodePgDatabase | undefined

export function adminDb(): NodePgDatabase {
  db ??= drizzle(getPool('app', 'DATABASE_URL'))
  return db
}

export type AdminTx = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0]

export async function withActor<T>(actorId: string, reason: string, fn: (tx: AdminTx) => Promise<T>): Promise<T> {
  return adminDb().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.actor_id', ${actorId}, true), set_config('app.change_reason', ${reason.slice(0, 500)}, true)`,
    )
    return fn(tx)
  })
}

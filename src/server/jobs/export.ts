/**
 * Nightly dataset release: record-vYYYY.MM.DD.csv and .json, with SHA-256
 * checksums and a changelog against the previous release. Built from the
 * public view, so it contains exactly what the public site shows.
 */
import 'server-only'
import { desc, lt, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { datasetReleases } from '@/db/schema'
import { METHODOLOGY_VERSION } from '@/db/enums'
import { sha256Hex } from '@/lib/crypto'
import { todayIso } from '@/lib/format'
import { exportRows, rowsToCsv, rowsToJson } from '../public/export'

export function releaseVersion(now: Date): string {
  return todayIso(now).replaceAll('-', '.')
}

type Snapshot = Map<string, string>

function snapshotOf(rows: Record<string, unknown>[]): Snapshot {
  return new Map(rows.map((r) => [String(r.id), String(r.updated_at)]))
}

export function diffReleases(prev: Snapshot | null, next: Snapshot) {
  const added: string[] = []
  const updated: string[] = []
  const removed: string[] = []
  for (const [id, at] of next) {
    const before = prev?.get(id)
    if (before === undefined) added.push(id)
    else if (before !== at) updated.push(id)
  }
  if (prev) for (const id of prev.keys()) if (!next.has(id)) removed.push(id)
  return { added: added.sort(), updated: updated.sort(), removed: removed.sort() }
}

export async function buildRelease(now = new Date()) {
  const db = adminDb()
  const version = releaseVersion(now)
  const rows = await exportRows(null, db)
  const csv = rowsToCsv(rows)
  const json = rowsToJson(rows, { version, generatedAt: now.toISOString() })

  const [prev] = await db
    .select({ version: datasetReleases.version, json: datasetReleases.json })
    .from(datasetReleases)
    .where(lt(datasetReleases.version, version))
    .orderBy(desc(datasetReleases.version))
    .limit(1)
  const prevSnapshot = prev ? snapshotOf((JSON.parse(prev.json) as { records: Record<string, unknown>[] }).records) : null
  const changelog = diffReleases(prevSnapshot, snapshotOf(rows))

  const values = {
    version,
    methodologyVersion: METHODOLOGY_VERSION,
    recordCount: rows.length,
    csv,
    json,
    csvSha256: sha256Hex(csv),
    jsonSha256: sha256Hex(json),
    previousVersion: prev?.version ?? null,
    changelog,
  }
  await db
    .insert(datasetReleases)
    .values(values)
    .onConflictDoUpdate({ target: datasetReleases.version, set: { ...values, createdAt: sql`now()` } })
  return { version, recordCount: rows.length, csvSha256: values.csvSha256, changelog }
}

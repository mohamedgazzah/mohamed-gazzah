import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { publicDb } from '@/db/public'
import { publicDatasetFiles, publicDatasetReleases } from '@/db/schema'

export async function listReleases(limit = 30) {
  return publicDb().select().from(publicDatasetReleases).orderBy(desc(publicDatasetReleases.version)).limit(limit)
}

export async function releaseFile(version: string) {
  const [row] = await publicDb().select().from(publicDatasetFiles).where(eq(publicDatasetFiles.version, version)).limit(1)
  return row ?? null
}

export function releaseFileName(version: string, ext: 'csv' | 'json') {
  return `record-v${version}.${ext}`
}

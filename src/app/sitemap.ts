import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import { incidentPath } from '@/lib/slug'
import { isoTimestamp } from '@/lib/format'
import { allRecordPaths } from '@/server/public/incidents'

export const revalidate = 3600

/** Public pages and every published record. Built from the public view only. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['/', '/incidents', '/methodology', '/data', '/report', '/about'].map((p) => ({ url: absoluteUrl(p) }))
  let records: MetadataRoute.Sitemap = []
  try {
    records = (await allRecordPaths()).map((r) => ({ url: absoluteUrl(incidentPath(r.id, r.slug)), lastModified: isoTimestamp(r.updatedAt) }))
  } catch (err) {
    console.error('[sitemap] could not list records', (err as Error).message)
  }
  return [...pages, ...records]
}

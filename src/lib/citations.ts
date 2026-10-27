import { absoluteUrl, SITE } from './site'
import { formatDate } from './format'
import { incidentPath } from './slug'

export type CitableRecord = { id: string; slug: string; title: string; updatedAt: string }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function ymd(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y: y!, m: m!, d: d! }
}

/** Citations for one record. `accessed` is the reader's access date (YYYY-MM-DD). */
export function citations(rec: CitableRecord, accessed: string) {
  const url = absoluteUrl(incidentPath(rec.id, rec.slug))
  const u = ymd(rec.updatedAt)
  const a = ymd(accessed)
  const apa = `${SITE.publisher}. (${u.y}, ${MONTHS[u.m - 1]} ${u.d}). ${rec.title} (Record ${rec.id}). ${SITE.fullName}. ${url}`
  const chicago = `${SITE.publisher}. “${rec.title}.” Record ${rec.id}. ${SITE.fullName}. Last updated ${MONTHS[u.m - 1]} ${u.d}, ${u.y}. Accessed ${MONTHS[a.m - 1]} ${a.d}, ${a.y}. ${url}.`
  const key = `record_${rec.id.replace(/[^A-Za-z0-9]/g, '')}`
  const bibtex = [
    `@misc{${key},`,
    `  author       = {{${SITE.publisher}}},`,
    `  title        = {{${rec.title.replace(/[{}]/g, '')}}},`,
    `  howpublished = {${SITE.fullName}, record ${rec.id}},`,
    `  year         = {${u.y}},`,
    `  month        = {${u.m}},`,
    `  url          = {${url}},`,
    `  note         = {Accessed ${formatDate(accessed, 'day', 'long')}}`,
    `}`,
  ].join('\n')
  return { url, apa, chicago, bibtex }
}

/**
 * APA 7 for a data set. Before the first release there is no version or
 * year: "n.d." and the date it was retrieved instead.
 */
export function datasetCitation(version: string | null, today?: string) {
  const url = absoluteUrl('/data')
  if (version && /^\d{4}/.test(version)) return `${SITE.publisher}. (${version.slice(0, 4)}). ${SITE.fullName} (Version ${version}) [Data set]. ${url}`
  const retrieved = today ? `Retrieved ${formatDate(today, 'day', 'long')}, from ` : ''
  return `${SITE.publisher}. (n.d.). ${SITE.fullName} [Data set]. ${retrieved}${url}`
}

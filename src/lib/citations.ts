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

export function datasetCitation(version: string) {
  // Before the first release the version is "latest", which has no year: APA's "n.d.".
  const year = /^\d{4}/.test(version) ? version.slice(0, 4) : 'n.d.'
  return `${SITE.publisher}. (${year}). ${SITE.fullName} [Data set, version ${version}]. ${absoluteUrl('/data')}. License: ${SITE.dataLicense.name}.`
}

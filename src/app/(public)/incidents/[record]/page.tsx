import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { CopyButton } from '@/components/CopyButton'
import { IncidentCard } from '@/components/IncidentCard'
import { IncidentView } from '@/components/IncidentView'
import { citations } from '@/lib/citations'
import { isoTimestamp, todayIso } from '@/lib/format'
import { incidentPath, parseRecordParam } from '@/lib/slug'
import { stripMarkers } from '@/lib/summary'
import { allRecordPaths, getIncident, getRelated, type IncidentListItem } from '@/server/public/incidents'

// Statically generated at build time and refreshed in the background. If the
// database is unreachable, the last good copy keeps being served.
export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const rows = await allRecordPaths()
    return rows.map((r) => ({ record: `${r.id}-${r.slug}` }))
  } catch (err) {
    console.warn('[incident] could not list records at build time; pages will render on first request:', (err as Error).message)
    return []
  }
}

export async function generateMetadata(props: PageProps<'/incidents/[record]'>): Promise<Metadata> {
  const { record } = await props.params
  const parsed = parseRecordParam(record)
  if (!parsed) return {}
  const inc = await getIncident(parsed.id)
  if (!inc) return {}
  return {
    title: inc.title,
    description: stripMarkers(inc.summary).slice(0, 300),
    alternates: { canonical: incidentPath(inc.id, inc.slug) },
    openGraph: { type: 'article', title: inc.title, description: stripMarkers(inc.summary).slice(0, 300) },
    robots: inc.isDemo ? { index: false, follow: false } : undefined,
  }
}

function RelatedList({ title, items }: { title: string; items: IncidentListItem[] }) {
  if (!items.length) return null
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-lg">{title}</h3>
      <ul className="grid gap-3">
        {items.map((i) => (
          <li key={i.id}>
            <IncidentCard item={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function IncidentPage(props: PageProps<'/incidents/[record]'>) {
  const { record } = await props.params
  const parsed = parseRecordParam(record)
  if (!parsed) notFound()
  const inc = await getIncident(parsed.id)
  if (!inc) notFound()
  if (parsed.slug !== inc.slug) permanentRedirect(incidentPath(inc.id, inc.slug))

  const related = await getRelated(inc)
  const cite = citations({ id: inc.id, slug: inc.slug, title: inc.title, updatedAt: isoTimestamp(inc.updatedAt) }, todayIso())
  const hasRelated = related.sameCity.length + related.samePerpetrator.length + related.sameCase.length > 0

  return (
    <main className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/incidents">All incidents</Link>
        <span aria-hidden="true" className="text-muted">
          {' '}
          /{' '}
        </span>
        <span className="text-muted tabular">{inc.id}</span>
      </nav>
      <div className="mx-auto max-w-reading">
        {inc.isDemo ? (
          <p className="card mb-6 border-dashed p-3 text-base" role="note">
            This is a fictional demonstration record used for development. It describes no real event.
          </p>
        ) : null}
        <IncidentView data={{ ...inc, updatedAt: inc.updatedAt }} />

        <section aria-labelledby="actions-heading" className="mb-10 border-t border-rule pt-6">
          <h2 id="actions-heading" className="mb-3 text-xl">
            Cite or correct this record
          </h2>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={cite.url} label="Copy link" />
            <Link href={`/report?mode=correction&record=${encodeURIComponent(inc.id)}`} className="btn btn-secondary">
              Report a correction
            </Link>
          </div>
          <details className="mt-4">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Cite this record (APA, Chicago, BibTeX)</summary>
            <div className="space-y-4 pt-2">
              {(
                [
                  ['APA', cite.apa],
                  ['Chicago', cite.chicago],
                  ['BibTeX', cite.bibtex],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <p className="label">{label}</p>
                  <pre className="card overflow-x-auto p-3 text-sm whitespace-pre-wrap">{text}</pre>
                  <CopyButton text={text} label={`Copy ${label}`} className="btn btn-quiet mt-1" />
                </div>
              ))}
            </div>
          </details>
        </section>

        {hasRelated ? (
          <section aria-labelledby="related-heading" className="mb-10">
            <h2 id="related-heading" className="mb-4 text-xl">
              Related records
            </h2>
            <RelatedList title="Same case" items={related.sameCase} />
            <RelatedList title="Same perpetrator or series" items={related.samePerpetrator} />
            <RelatedList title={`Also in ${inc.city ?? 'this city'}`} items={related.sameCity} />
          </section>
        ) : null}
      </div>
    </main>
  )
}

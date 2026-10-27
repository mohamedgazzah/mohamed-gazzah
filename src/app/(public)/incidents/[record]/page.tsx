import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { CopyButton } from '@/components/CopyButton'
import { IncidentCard } from '@/components/IncidentCard'
import { IncidentView } from '@/components/IncidentView'
import { citations } from '@/lib/citations'
import { formatTimestamp, isoTimestamp, todayIso } from '@/lib/format'
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
    <div className="mb-8">
      <h3 className="kicker mb-3 text-text">{title}</h3>
      <ul className="ledger">
        {items.map((i) => (
          <li key={i.id}>
            <IncidentCard item={i} headingLevel={3} />
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

  const idPrefix = `rec-${inc.id}`
  const contents = [
    { id: `${idPrefix}-facts`, label: 'Key facts', show: true },
    { id: `${idPrefix}-legal`, label: 'Legal timeline', show: inc.legalEvents.length > 0 },
    { id: `${idPrefix}-statements`, label: 'Statements', show: inc.statements.length > 0 },
    { id: `${idPrefix}-sources`, label: 'Sources', show: true },
    { id: `${idPrefix}-changes`, label: 'Change log', show: true },
    { id: 'actions-heading', label: 'Cite or correct', show: true },
  ].filter((c) => c.show)

  return (
    <main className="wrap pt-8 pb-4 md:pt-10">
      <nav aria-label="Breadcrumb" className="mono mb-8 md:mb-12">
        <Link href="/incidents">All incidents</Link>
        <span aria-hidden="true" className="text-muted">
          {' '}
          /{' '}
        </span>
        <span className="text-muted">{inc.id}</span>
      </nav>
      <div className="grid gap-x-6 gap-y-8 md:grid-cols-12">
        <aside aria-label="About this record" className="md:col-span-3">
          <div className="border-t border-ink pt-3 md:sticky md:top-8">
            <p className="kicker">Record</p>
            <p className="mono mt-2 text-[15px] text-text">{inc.id}</p>
            {inc.updatedAt ? <p className="mono mt-1 text-muted">Updated {formatTimestamp(inc.updatedAt)}</p> : null}
            <nav aria-label="On this page" className="mt-8 hidden md:block">
              <p className="kicker">On this page</p>
              <ol className="mt-3 space-y-1.5 text-[14.5px]">
                {contents.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="text-text no-underline hover:text-accent hover:underline">
                      {c.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>
        <div className="min-w-0 md:col-span-9 lg:col-span-8">
          <div className="max-w-reading">
            {inc.isDemo ? (
              <p className="mb-8 border border-dashed border-control p-3 text-[15px] text-muted" role="note">
                This is a fictional demonstration record used for development. It describes no real event.
              </p>
            ) : null}
            <IncidentView data={{ ...inc, updatedAt: inc.updatedAt }} />

            <section aria-labelledby="actions-heading" className="mb-12">
              <h2 id="actions-heading" className="section-head mb-5 scroll-mt-6 text-[28px] leading-tight">
                Cite or correct this record
              </h2>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={cite.url} label="Copy link" />
                <Link href={`/report?mode=correction&record=${encodeURIComponent(inc.id)}`} className="btn btn-secondary">
                  Report a correction
                </Link>
              </div>
              <details className="mt-4">
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent">Cite this record (APA, Chicago, BibTeX)</summary>
                <div className="space-y-5 pt-3">
                  {(
                    [
                      ['APA', cite.apa],
                      ['Chicago', cite.chicago],
                      ['BibTeX', cite.bibtex],
                    ] as const
                  ).map(([label, text]) => (
                    <div key={label}>
                      <p className="kicker mb-2">{label}</p>
                      <pre className="overflow-x-auto border-s border-ink bg-surface p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{text}</pre>
                      <CopyButton text={text} label={`Copy ${label}`} className="btn btn-quiet mt-1" />
                    </div>
                  ))}
                </div>
              </details>
            </section>

            {hasRelated ? (
              <section aria-labelledby="related-heading" className="mb-12">
                <h2 id="related-heading" className="section-head mb-5 text-[28px] leading-tight">
                  Related records
                </h2>
                <RelatedList title="Same case" items={related.sameCase} />
                <RelatedList title="Same perpetrator or series" items={related.samePerpetrator} />
                <RelatedList title={`Also in ${inc.city ?? 'this city'}`} items={related.sameCity} />
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}

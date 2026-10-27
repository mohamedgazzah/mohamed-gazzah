import type { Metadata } from 'next'
import { ChevronRight, Copy, FileWarning, Hash, Quote, RefreshCw } from 'lucide-react'
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
      <h3 className="mb-3 text-[15px] font-semibold text-muted">{title}</h3>
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
    <main className="wrap pt-6 pb-4 md:pt-8">
      <nav aria-label="Breadcrumb" className="mb-8 md:mb-10">
        <p className="glass eyebrow">
          <Link href="/incidents" className="font-semibold">
            All incidents
          </Link>
          <ChevronRight aria-hidden="true" className="text-muted" />
          <span className="tabular text-muted">{inc.id}</span>
        </p>
      </nav>
      <div className="grid gap-x-8 gap-y-8 md:grid-cols-12">
        <aside aria-label="About this record" className="md:order-last md:col-span-4 lg:col-span-3 lg:col-start-10">
          <div className="glass rounded-[var(--radius-md)] p-4 md:sticky md:top-24">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
              <Hash aria-hidden="true" size={15} />
              Record
            </p>
            <p className="tabular mt-1 text-[16px] font-semibold">{inc.id}</p>
            {inc.updatedAt ? (
              <p className="mono mt-1 flex items-center gap-1.5 text-muted">
                <RefreshCw aria-hidden="true" size={13} />
                Updated {formatTimestamp(inc.updatedAt)}
              </p>
            ) : null}
            <nav aria-label="On this page" className="mt-5 hidden border-t border-rule pt-4 md:block">
              <p className="kicker px-2">On this page</p>
              <ol className="mt-2 space-y-0.5 text-[14.5px]">
                {contents.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="block rounded-[10px] px-2 py-1.5 text-text no-underline hover:bg-row-hover hover:no-underline">
                      {c.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>
        <div className="min-w-0 md:col-span-8 lg:col-span-8">
          <div className="max-w-reading">
            {inc.isDemo ? (
              <p className="note mb-8 text-[15px]" role="note">
                This is a fictional demonstration record used for development. It describes no real event.
              </p>
            ) : null}
            <IncidentView data={{ ...inc, updatedAt: inc.updatedAt }} />

            <section aria-labelledby="actions-heading" className="mb-12">
              <h2 id="actions-heading" className="section-head mb-4 scroll-mt-24 text-[26px] leading-tight">
                Cite or correct this record
              </h2>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={cite.url} label="Copy link" icon={<Copy aria-hidden="true" />} />
                <Link href={`/report?mode=correction&record=${encodeURIComponent(inc.id)}`} className="btn btn-secondary">
                  <FileWarning aria-hidden="true" />
                  Report a correction
                </Link>
              </div>
              <details className="card mt-4 px-5 py-1">
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold text-accent">
                  <Quote aria-hidden="true" size={16} />
                  Cite this record (APA, Chicago, BibTeX)
                </summary>
                <div className="space-y-5 pt-2 pb-4">
                  {(
                    [
                      ['APA', cite.apa],
                      ['Chicago', cite.chicago],
                      ['BibTeX', cite.bibtex],
                    ] as const
                  ).map(([label, text]) => (
                    <div key={label}>
                      <p className="kicker mb-2">{label}</p>
                      <pre className="overflow-x-auto rounded-[var(--radius-sm)] border border-rule bg-row-alt p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{text}</pre>
                      <CopyButton text={text} label={`Copy ${label}`} className="btn btn-quiet mt-1" />
                    </div>
                  ))}
                </div>
              </details>
            </section>

            {hasRelated ? (
              <section aria-labelledby="related-heading" className="mb-12">
                <h2 id="related-heading" className="section-head mb-4 text-[26px] leading-tight">
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

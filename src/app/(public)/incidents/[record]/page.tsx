import type { Metadata } from 'next'
import { ChevronDown, ChevronRight, Copy, FileWarning, Hash, Link2, Quote, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ContentsNav } from '@/components/ContentsNav'
import { CopyButton } from '@/components/CopyButton'
import { OpenOnHash } from '@/components/OpenOnHash'
import { IncidentCard } from '@/components/IncidentCard'
import { IncidentView } from '@/components/IncidentView'
import { citations } from '@/lib/citations'
import { SOURCE_TYPE_META } from '@/db/enums'
import { formatTimestamp, isoTimestamp, plural, todayIso } from '@/lib/format'
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
  // A missing record keeps a title of its own, not the site's.
  const missing: Metadata = { title: 'Record not found', robots: { index: false } }
  if (!parsed) return missing
  const inc = await getIncident(parsed.id)
  if (!inc) return missing
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
      <h3 className="mb-3 text-sm font-semibold text-muted">{title}</h3>
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
    { id: 'cite', label: 'Cite or correct', show: true },
  ].filter((c) => c.show)

  const sourceKinds = [...new Set(inc.sources.map((src) => SOURCE_TYPE_META[src.source_type].label.toLowerCase()))]

  return (
    <main className="record-page wrap pt-6 md:pt-8">
      <nav aria-label="Breadcrumb" className="mb-8 md:mb-10">
        <p className="glass eyebrow">
          <Link href="/incidents" className="font-semibold">
            Explore
          </Link>
          <ChevronRight aria-hidden="true" className="text-muted" />
          <span className="tabular text-muted">{inc.id}</span>
        </p>
      </nav>
      <div className="grid gap-x-8 gap-y-8 md:grid-cols-12">
        <div className="min-w-0 md:col-span-8 lg:col-span-8">
          <div className="max-w-reading">
            {inc.isDemo ? (
              <p className="note mb-8 text-base" role="note">
                This is a fictional demonstration record used for development. It describes no real event.
              </p>
            ) : null}
            <IncidentView
              data={{ ...inc, updatedAt: inc.updatedAt }}
              contents={
                <div className="sticky top-[calc(var(--header-h)+0.25rem)] z-20 -mt-4 mb-10 md:hidden">
                  <ContentsNav items={contents.map((c) => ({ id: c.id, title: c.label }))} variant="disclosure" />
                </div>
              }
            />

            <section id="cite" aria-labelledby="actions-heading" className="mb-12">
              <h2 id="actions-heading" className="section-head mb-4 text-2xl leading-tight">
                Cite or correct this record
              </h2>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <CopyButton text={cite.url} label="Copy link" icon={<Copy aria-hidden="true" />} />
                <Link href={`/report?mode=correction&record=${encodeURIComponent(inc.id)}`} className="btn btn-secondary">
                  <FileWarning aria-hidden="true" />
                  Request a correction
                </Link>
              </div>
              {/* Printed instead of the formats box. */}
              <p className="print-only mt-3 text-sm">
                Cite as: {cite.apa}
                <br />
                Record address: {cite.url}
              </p>
              <OpenOnHash id="cite-formats" />
              <details id="cite-formats" className="card group mt-4 px-5 py-1">
                <summary className="cite-summary">
                  <Quote aria-hidden="true" size={16} />
                  Cite this record (APA, Chicago, BibTeX)
                  <ChevronDown aria-hidden="true" size={18} className="ms-auto transition-transform group-open:rotate-180" />
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
                      {label === 'BibTeX' ? (
                        <pre className="rounded-[var(--radius-sm)] border border-rule bg-row-alt p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">{text}</pre>
                      ) : (
                        <p className="rounded-[var(--radius-sm)] border border-rule bg-row-alt p-3 text-base leading-relaxed">{text}</p>
                      )}
                      <CopyButton text={text} label={`Copy ${label}`} className="btn btn-quiet btn-sm mt-1" icon={<Copy aria-hidden="true" />} />
                    </div>
                  ))}
                </div>
              </details>
            </section>

            {hasRelated ? (
              <section aria-labelledby="related-heading" className="mb-12">
                <h2 id="related-heading" className="section-head mb-4 text-2xl leading-tight">
                  Related records
                </h2>
                <RelatedList title="Same case" items={related.sameCase} />
                <RelatedList title="Same perpetrator or series" items={related.samePerpetrator} />
                <RelatedList title={`Also in ${inc.city ?? 'this city'}`} items={related.sameCity} />
              </section>
            ) : null}
          </div>
        </div>
        <aside aria-label="About this record" className="record-aside hidden md:col-span-4 md:block lg:col-span-3 lg:col-start-10">
          <div className="space-y-4 md:sticky md:top-[calc(var(--header-h)+1rem)]">
            <div className="card p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted">
                <Hash aria-hidden="true" size={15} />
                Record
              </p>
              <p className="tabular mt-1 text-base font-semibold">{inc.id}</p>
              {inc.updatedAt ? (
                <p className="mono mt-1 flex items-center gap-1.5 text-muted">
                  <RefreshCw aria-hidden="true" size={13} />
                  Updated {formatTimestamp(inc.updatedAt)}
                </p>
              ) : null}
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
                <Link2 aria-hidden="true" size={14} className="mt-[3px] shrink-0" />
                <span>
                  {plural(inc.sources.length, 'source')}
                  {sourceKinds.length ? `: ${sourceKinds.join(', ')}` : ''}
                </span>
              </p>
              <div className="mt-4 grid gap-1.5 border-t border-rule pt-3 text-sm">
                <a href="#cite-formats" className="menu-item">
                  <Quote aria-hidden="true" size={16} className="text-accent" /> Cite this record
                </a>
                <Link href={`/report?mode=correction&record=${encodeURIComponent(inc.id)}`} className="menu-item">
                  <FileWarning aria-hidden="true" size={16} className="text-accent" /> Request a correction
                </Link>
              </div>
            </div>
            <ContentsNav items={contents.map((c) => ({ id: c.id, title: c.label }))} variant="card" />
          </div>
        </aside>
      </div>
    </main>
  )
}

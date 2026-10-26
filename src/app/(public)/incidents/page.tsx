import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { IncidentCard } from '@/components/IncidentCard'
import { IncidentTable } from '@/components/IncidentTable'
import { Pagination } from '@/components/Pagination'
import { legalLabel, verificationLabel } from '@/components/Badges'
import { FilterDrawer } from '@/components/explore/FilterDrawer'
import { FilterRail } from '@/components/explore/FilterRail'
import { MapLoader } from '@/components/explore/MapLoader'
import {
  PAGE_SIZE,
  SORTS,
  SORT_LABELS,
  chips,
  explorePath,
  normalizeIncomingQuery,
  parseFilters,
  parseViewState,
  serializeFilters,
  type View,
} from '@/lib/filters'
import { formatDateRange, formatNumber, formatPlace } from '@/lib/format'
import { mapPoints, searchIncidents } from '@/server/public/incidents'

export const metadata: Metadata = {
  title: 'Explore incidents',
  description: 'Search and filter every published record. Filters are kept in the URL, so any view can be shared and cited.',
}

const VIEW_LABELS: Record<View, string> = { table: 'Table', cards: 'Cards', map: 'Map' }

export default async function ExplorePage(props: PageProps<'/incidents'>) {
  const sp = await props.searchParams
  const filters = parseFilters(sp)
  const vs = parseViewState(sp)

  // One view, one URL: redirect loose or repeated parameters to the canonical form.
  const canonical = serializeFilters(filters, vs)
  if (canonical !== normalizeIncomingQuery(sp)) redirect(canonical ? `/incidents?${canonical}` : '/incidents')

  const result = await searchIncidents(filters, { sort: vs.sort, page: vs.page })
  if (result.page !== vs.page && result.total > 0) redirect(explorePath(filters, { ...vs, page: result.page }))
  const points = vs.view === 'map' ? await mapPoints(filters) : []

  const active = chips(filters, vs)
  const includesV1 = filters.v.includes('V1')
  const noun = includesV1 ? 'incident' : 'verified incident'
  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0
  const last = Math.min(result.page * result.pageSize, result.total)
  const downloadQs = serializeFilters(filters)
  const dateDesc = vs.sort === 'newest'

  const mapLabels: Record<string, string> = {}
  for (const p of points) {
    mapLabels[`date:${p.id}`] = formatDateRange(p.dateStart, null, p.datePrecision)
    mapLabels[`place:${p.id}`] = formatPlace(p.city, p.stateCode)
    mapLabels[`badges:${p.id}`] = `${verificationLabel(p.verificationLevel, p.sourceTypes)} · ${legalLabel(p.legalStatus, p.hateCrimeCharged)}`
  }

  return (
    <main className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <h1 className="text-2xl sm:text-3xl">Explore incidents</h1>
      <p className="mt-2 max-w-[72ch] text-base text-muted">
        Every published record, with its sources and legal status. Filters are kept in the page address, so any view can be shared or
        cited. <Link href="/methodology#inclusion">What is included</Link>.
      </p>

      <div className="mt-6 grid gap-8 md:grid-cols-[17rem_1fr]">
        <aside aria-label="Filters" className="md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto md:pe-1">
          <FilterDrawer activeCount={active.length}>
            <FilterRail filters={filters} view={vs} />
          </FilterDrawer>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
            <h2 id="results-heading" className="font-sans text-lg font-semibold tabular" aria-live="polite">
              {formatNumber(result.total)} {result.total === 1 ? noun : `${noun}s`}
              {result.total > result.pageSize ? (
                <span className="font-normal text-muted">
                  {' '}
                  · showing {formatNumber(first)}–{formatNumber(last)}
                </span>
              ) : null}
            </h2>
            <a href={`/incidents/download${downloadQs ? `?${downloadQs}` : ''}`} className="text-base font-semibold" download>
              Download these results (CSV)
            </a>
          </div>

          {active.length ? (
            <ul aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
              {active.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.removeHref}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-control bg-surface px-3 text-sm text-text no-underline hover:border-accent"
                    aria-label={`Remove filter: ${c.label}`}
                  >
                    {c.label}
                    <span aria-hidden="true" className="text-base leading-none">
                      ×
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-base">
            <nav aria-label="Sort order" className="flex flex-wrap items-center gap-1">
              <span className="text-muted">Sort:</span>
              {SORTS.map((s) => (
                <Link
                  key={s}
                  href={explorePath(filters, { ...vs, sort: s, page: 1 })}
                  aria-current={vs.sort === s ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center rounded px-2 ${vs.sort === s ? 'font-semibold text-text no-underline' : ''}`}
                >
                  {SORT_LABELS[s]}
                </Link>
              ))}
            </nav>
            <nav aria-label="View" className="flex items-center gap-1">
              <span className="text-muted">View:</span>
              {(['table', 'cards', 'map'] as const).map((v) => (
                <Link
                  key={v}
                  href={explorePath(filters, { ...vs, view: v, page: 1 })}
                  aria-current={vs.view === v ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center rounded px-2 ${vs.view === v ? 'font-semibold text-text no-underline' : ''}`}
                >
                  {VIEW_LABELS[v]}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-4">
            {result.total === 0 ? (
              <EmptyState>
                {includesV1 ? 'No incidents match these filters.' : 'No verified incidents match these filters.'} Try widening the date
                range or removing a filter.
              </EmptyState>
            ) : vs.view === 'cards' ? (
              <ul className="grid gap-4 lg:grid-cols-2">
                {result.rows.map((r) => (
                  <li key={r.id}>
                    <IncidentCard item={r} query={filters.q} />
                  </li>
                ))}
              </ul>
            ) : (
              <>
                {vs.view === 'map' ? (
                  <div className="mb-6">
                    <MapLoader
                      points={points}
                      labels={mapLabels}
                      styleLight={process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? 'https://tiles.openfreemap.org/styles/positron'}
                      styleDark={process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? 'https://tiles.openfreemap.org/styles/dark'}
                    />
                    <h3 className="mt-6 mb-2 font-sans text-base font-semibold">The same incidents as a list</h3>
                  </div>
                ) : null}
                <IncidentTable
                  rows={result.rows}
                  query={filters.q}
                  caption={`Incidents ${formatNumber(first)} to ${formatNumber(last)} of ${formatNumber(result.total)}`}
                  dateSort={{
                    label: dateDesc ? 'Date ↓' : vs.sort === 'oldest' ? 'Date ↑' : 'Date',
                    href: explorePath(filters, { ...vs, sort: dateDesc ? 'oldest' : 'newest', page: 1 }),
                    active: vs.sort !== 'severity',
                    direction: vs.sort === 'oldest' ? 'ascending' : 'descending',
                  }}
                  severitySort={{
                    label: vs.sort === 'severity' ? 'Severity ↓' : 'Severity',
                    href: explorePath(filters, { ...vs, sort: 'severity', page: 1 }),
                    active: vs.sort === 'severity',
                    direction: 'descending',
                  }}
                />
              </>
            )}
          </div>

          <Pagination page={result.page} pages={result.pages} hrefFor={(n) => explorePath(filters, { ...vs, page: n })} />
          <p className="mt-6 text-sm text-muted">
            {PAGE_SIZE} records per page, in a stable order, so a page number can be cited. Counts include V2 and V3 records unless V1 is
            selected.
          </p>
        </section>
      </div>
    </main>
  )
}

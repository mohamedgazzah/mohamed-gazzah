import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Arrow } from '@/components/Arrow'
import { EmptyState } from '@/components/EmptyState'
import { IncidentCard } from '@/components/IncidentCard'
import { IncidentTable } from '@/components/IncidentTable'
import { Pagination } from '@/components/Pagination'
import { BarList } from '@/components/charts/BarList'
import { StateMap } from '@/components/charts/StateMap'
import { ExploreToolbar } from '@/components/explore/ExploreToolbar'
import { FilterDrawer } from '@/components/explore/FilterDrawer'
import { FilterRail } from '@/components/explore/FilterRail'
import {
  PAGE_SIZE,
  SORTS,
  SORT_LABELS,
  chips,
  describeDates,
  explorePath,
  normalizeIncomingQuery,
  parseFilters,
  parseViewState,
  serializeFilters,
  type View,
} from '@/lib/filters'
import { formatNumber, plural, todayIso } from '@/lib/format'
import { stateByCode } from '@/lib/states'
import { stateShape } from '@/server/public/geo'
import { searchIncidents } from '@/server/public/incidents'
import { countsByCity, countsByState, countsByType } from '@/server/public/stats'

export const metadata: Metadata = {
  title: 'Explore incidents',
  description: 'A map and list of every published record, filtered by date, place and type. Filters are kept in the URL, so any view can be shared, printed and downloaded.',
}

const VIEW_LABELS: Record<View, string> = { table: 'Table', cards: 'Cards' }

export default async function ExplorePage(props: PageProps<'/incidents'>) {
  const sp = await props.searchParams
  const filters = parseFilters(sp)
  const vs = parseViewState(sp)

  // One view, one URL: redirect loose or repeated parameters to the canonical form.
  const canonical = serializeFilters(filters, vs)
  if (canonical !== normalizeIncomingQuery(sp)) redirect(canonical ? `/incidents?${canonical}` : '/incidents')

  const today = todayIso()
  const focusCode = filters.state.length === 1 ? filters.state[0]! : null
  const [result, byState, typeCounts, focusData] = await Promise.all([
    searchIncidents(filters, { sort: vs.sort, page: vs.page }),
    countsByState(filters),
    countsByType({ ...filters, type: [] }),
    // Zoomed into one state: every city in it, so another city is one click away.
    focusCode ? countsByCity({ ...filters, city: null }) : null,
  ])
  if (result.page !== vs.page && result.total > 0) redirect(explorePath(filters, { ...vs, page: result.page }))

  const base = { ...vs, page: 1 }
  const active = chips(filters, vs)
  const includesV1 = filters.v.includes('V1')
  const noun = includesV1 ? 'incident' : 'verified incident'
  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0
  const last = Math.min(result.page * result.pageSize, result.total)
  const qs = serializeFilters(filters)
  const withQs = (path: string) => (qs ? `${path}?${qs}` : path)
  const dateDesc = vs.sort === 'newest'

  const when = describeDates(filters, today)
  const stateCount = Object.keys(byState).length
  const focusName = focusCode ? (stateByCode(focusCode)?.name ?? focusCode) : null
  const stateHref = (code: string) => explorePath({ ...filters, state: [code], city: null }, base)
  const allStatesHref = explorePath({ ...filters, state: [], city: null }, base)
  const ranked = Object.entries(byState)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, n]) => ({ key: code, label: stateByCode(code)?.name ?? code, value: n, href: stateHref(code) }))
  const cities = focusData
  const cityRows = (cities?.cities ?? []).map((c) => ({ key: c.city, label: c.city, value: c.count, href: explorePath({ ...filters, city: c.city }, base) }))

  return (
    <main className="wrap pt-10 pb-4 md:pt-14">
      <div className="grid gap-x-6 gap-y-4 pb-6 md:grid-cols-12">
        <div className="md:col-span-8">
          <p className="kicker">The record · Explore</p>
          <h1 className="display mt-3 text-4xl">Explore incidents</h1>
        </div>
        <p className="max-w-[46ch] self-end text-[15.5px] text-muted md:col-span-4">
          Every published record, by date, place and type. Filters are kept in the page address, so any view can be shared, printed or
          downloaded. <Link href="/methodology#inclusion">What is included</Link>.
        </p>
      </div>

      <ExploreToolbar key={canonical} filters={filters} view={vs} today={today} typeCounts={typeCounts} />

      <div className="mt-8 grid gap-10 md:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside aria-label="More filters" className="no-print md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto md:pe-1">
          <FilterDrawer activeCount={active.length}>
            {/* Keyed by the filters, so after a link changes them the form shows the new values. */}
            <FilterRail key={canonical} filters={filters} view={vs} />
          </FilterDrawer>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <h2 id="results-heading" className="text-[34px] leading-none" aria-live="polite">
              {plural(result.total, noun)}
              <span className="mt-2 block text-[15.5px] leading-snug text-muted">
                {focusName ? `in ${filters.city ? `${filters.city}, ` : ''}${focusName}` : `in ${plural(stateCount, 'state')}`}, {when}
              </span>
            </h2>
            <div className="no-print flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
              <a href={withQs('/incidents/download')} className="arrow-link" download>
                Download incidents (CSV) <Arrow direction="down" />
              </a>
              <a href={withQs('/incidents/download/states')} className="arrow-link" download>
                Download totals by state (CSV) <Arrow direction="down" />
              </a>
              <Link href={withQs('/incidents/print')} className="arrow-link">
                Print or save as PDF <Arrow />
              </Link>
            </div>
          </div>

          {active.length ? (
            <ul aria-label="Active filters" className="no-print mt-4 flex flex-wrap gap-2">
              {active.map((c) => (
                <li key={c.key}>
                  <Link href={c.removeHref} className="chip" aria-label={`Remove filter: ${c.label}`}>
                    {c.label}
                    <span aria-hidden="true" className="text-base leading-none text-muted">
                      ×
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <section id="map" aria-labelledby="map-heading" className="mt-8 border-t border-ink pt-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h3 id="map-heading" className="text-[24px] leading-tight">
                {focusName ? `${focusName}, by city` : 'By state'}
              </h3>
              {focusName ? (
                <Link href={allStatesHref} className="arrow-link no-print text-[15px]">
                  <span className="rotate-180">
                    <Arrow />
                  </span>
                  All states
                </Link>
              ) : (
                <p className="no-print text-sm text-muted">Select a state on the map or in the list to zoom in.</p>
              )}
            </div>
            <p className="sr-only">
              {focusName
                ? `Map of ${focusName} with a circle for each city, sized by the number of records. The list below gives each city's count.`
                : 'Map of the United States with each state shaded by its number of records, darker for more. The list below gives every state with records.'}
            </p>
            {focusCode && !stateShape(focusCode) ? (
              <p className="mb-4 text-muted">{focusName} is not drawn on this map. Its records are listed below.</p>
            ) : null}
            <StateMap
              counts={byState}
              stateHref={stateHref}
              focus={
                focusCode && stateShape(focusCode)
                  ? {
                      code: focusCode,
                      name: focusName!,
                      cities: cities?.cities ?? [],
                      cityHref: (city) => explorePath({ ...filters, city }, base),
                      selectedCity: filters.city,
                    }
                  : null
              }
              noun={includesV1 ? 'incident' : 'record'}
            />

            <div className="mt-8 grid gap-x-10 gap-y-6 lg:grid-cols-2">
              <div>
                <h4 className="kicker mb-2 text-text">{focusName ? 'Cities with the most records' : 'States with the most records'}</h4>
                {(focusName ? cityRows : ranked).length ? (
                  <BarList rows={(focusName ? cityRows : ranked).slice(0, 10)} label={focusName ? `Records by city in ${focusName}` : 'Records by state'} noun="records" />
                ) : (
                  <p className="text-muted">None for these filters.</p>
                )}
                {focusName && cities?.stateOnly ? (
                  <p className="mono mt-2 text-muted">{plural(cities.stateOnly, 'record')} shown at state level only, without a city.</p>
                ) : null}
              </div>
              {!focusName && ranked.length > 10 ? (
                <details className="self-start">
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent">All {formatNumber(ranked.length)} states as a table</summary>
                  <div className="table-scroll mt-2" role="region" aria-label="Records by state" tabIndex={0}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">State</th>
                          <th scope="col" className="num">
                            Records
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((r) => (
                          <tr key={r.key}>
                            <td>
                              <Link href={r.href}>{r.label}</Link>
                            </td>
                            <td className="num">{formatNumber(r.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="list-heading" className="mt-12 border-t border-ink pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="list-heading" className="text-[24px] leading-tight">
                The records
                {result.total > result.pageSize ? (
                  <span className="mono ms-3 align-middle text-[13px] text-muted">
                    {formatNumber(first)}–{formatNumber(last)} of {formatNumber(result.total)}
                  </span>
                ) : null}
              </h3>
              <div className="no-print flex flex-wrap items-center gap-3">
                <nav aria-label="Sort order" className="flex flex-wrap items-center gap-3">
                  <span className="kicker">Sort</span>
                  <span className="segmented">
                    {SORTS.map((s) => (
                      <Link key={s} href={explorePath(filters, { ...vs, sort: s, page: 1 })} aria-current={vs.sort === s ? 'true' : undefined} scroll={false}>
                        {SORT_LABELS[s]}
                      </Link>
                    ))}
                  </span>
                </nav>
                <nav aria-label="View" className="flex items-center gap-3">
                  <span className="kicker">View</span>
                  <span className="segmented">
                    {(['table', 'cards'] as const).map((v) => (
                      <Link key={v} href={explorePath(filters, { ...vs, view: v, page: 1 })} aria-current={vs.view === v ? 'page' : undefined} scroll={false}>
                        {VIEW_LABELS[v]}
                      </Link>
                    ))}
                  </span>
                </nav>
              </div>
            </div>

            <div className="mt-5">
              {result.total === 0 ? (
                <EmptyState>
                  {includesV1 ? 'No incidents match these filters.' : 'No verified incidents match these filters.'} Try widening the date
                  range or removing a filter.
                </EmptyState>
              ) : vs.view === 'cards' ? (
                <ul className="ledger">
                  {result.rows.map((r) => (
                    <li key={r.id}>
                      <IncidentCard item={r} query={filters.q} headingLevel={3} />
                    </li>
                  ))}
                </ul>
              ) : (
                <IncidentTable
                  rows={result.rows}
                  query={filters.q}
                  caption={`Incidents ${formatNumber(first)} to ${formatNumber(last)} of ${formatNumber(result.total)}`}
                  dateSort={{
                    label: 'Date',
                    href: explorePath(filters, { ...vs, sort: dateDesc ? 'oldest' : 'newest', page: 1 }),
                    active: vs.sort !== 'severity',
                    direction: vs.sort === 'oldest' ? 'ascending' : 'descending',
                  }}
                  severitySort={{
                    label: 'Severity',
                    href: explorePath(filters, { ...vs, sort: 'severity', page: 1 }),
                    active: vs.sort === 'severity',
                    direction: 'descending',
                  }}
                />
              )}
            </div>

            <Pagination page={result.page} pages={result.pages} hrefFor={(n) => explorePath(filters, { ...vs, page: n })} />
            <p className="mono mt-8 max-w-[80ch] text-muted">
              {PAGE_SIZE} records per page, in a stable order, so a page number can be cited. Counts include V2 and V3 records unless V1 is
              selected. The CSV and the printable version include every matching record, not just this page.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

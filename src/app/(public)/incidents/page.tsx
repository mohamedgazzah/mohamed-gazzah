import { ArrowLeft, ArrowRight, ChevronDown, Download, FileSpreadsheet, Printer, SearchX, Table2, X } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { IncidentCard } from '@/components/IncidentCard'
import { IncidentTable } from '@/components/IncidentTable'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { BarList } from '@/components/charts/BarList'
import { StateMap } from '@/components/charts/StateMap'
import { ExploreToolbar } from '@/components/explore/ExploreToolbar'
import { FilterDrawer } from '@/components/explore/FilterDrawer'
import { FilterRail } from '@/components/explore/FilterRail'
import { DEFAULT_VERIFICATION_LEVELS, INCIDENT_TYPE_META } from '@/db/enums'
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

/** "threats or vandalism": the chosen types, in words, for the results sentence. */
function typesInWords(types: readonly string[]): string {
  const words = types.map((t) => INCIDENT_TYPE_META[t as keyof typeof INCIDENT_TYPE_META].label.toLowerCase())
  if (words.length <= 2) return words.join(' or ')
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`
}

export default async function ExplorePage(props: PageProps<'/incidents'>) {
  const sp = await props.searchParams
  const filters = parseFilters(sp)
  const vs = parseViewState(sp)

  // One view, one URL: redirect loose or repeated parameters to the canonical form.
  const canonical = serializeFilters(filters, vs)
  if (canonical !== normalizeIncomingQuery(sp)) redirect(canonical ? `/incidents?${canonical}` : '/incidents')

  const today = todayIso()
  const focusCode = filters.state.length === 1 ? filters.state[0]! : null
  const [result, byState, typeCounts, focusData, everyCity] = await Promise.all([
    searchIncidents(filters, { sort: vs.sort, page: vs.page }),
    countsByState(filters),
    countsByType({ ...filters, type: [] }),
    // Zoomed into one state: every city in it, so another city is one click away.
    focusCode ? countsByCity({ ...filters, city: null }) : null,
    // …and the largest city anywhere for the same filters, so circle sizes compare across states.
    focusCode ? countsByCity({ ...filters, state: [], city: null }) : null,
  ])
  if (result.page !== vs.page && result.total > 0) redirect(explorePath(filters, { ...vs, page: result.page }))

  const base = { ...vs, page: 1 }
  const active = chips(filters, vs, today)
  // The phone's "Filters" button counts only what is set inside its sheet.
  const railCount = active.filter((c) => !c.key.startsWith('type-') && c.key !== 'dates' && c.key !== 'q').length
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
  const sizeMax = Math.max(0, ...(everyCity?.cities ?? []).map((c) => c.count))
  const slice = filters.type.length ? ` (${typesInWords(filters.type)})` : ''
  const where = focusName ? `in ${filters.city ? `${filters.city}, ` : ''}${focusName}` : `in ${plural(stateCount, 'state')}`

  const listRows = focusName ? cityRows : ranked
  const listLabel = focusName ? `Records by city in ${focusName}` : 'Records by state'

  return (
    <main className="wrap pt-6 pb-4 md:pt-8">
      <a href="#results-heading" className="sr-only-focusable rounded-full bg-surface px-4 py-2 font-semibold text-accent shadow">
        Skip to results
      </a>
      <PageHeader compact title="Explore incidents">
        Every published record, by date, place and type. <Link href="/methodology#inclusion">What is included</Link>.
      </PageHeader>

      <div className="no-print mt-5">
        <ExploreToolbar key={canonical} filters={filters} view={vs} today={today} typeCounts={typeCounts} />
      </div>

      <div className="explore-grid mt-8 grid gap-8 md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside aria-label="More filters" className="no-print md:sticky md:top-24 md:self-start">
          <FilterDrawer activeCount={railCount}>
            {/* Keyed by the filters, so after a link changes them the form shows the new values. */}
            <FilterRail key={canonical} filters={filters} view={vs} />
          </FilterDrawer>
        </aside>

        <div className="min-w-0">
          <div className="results-bar glass">
            <h2 id="results-heading" tabIndex={-1} className="text-[24px] leading-tight outline-none md:text-[26px]" aria-live="polite">
              {result.total ? plural(result.total, noun) : `No ${noun}s`}
              <span className="mt-1 block text-[15px] leading-snug font-normal text-muted">
                {slice ? `${slice.slice(2, -1)}, ` : ''}
                {where}, {when}
              </span>
            </h2>
            <div className="no-print hidden flex-wrap items-center gap-2 sm:flex">
              <a href={withQs('/incidents/download')} className="btn btn-secondary btn-sm" download>
                <Download aria-hidden="true" className="nudge-down" />
                Download incidents (CSV)
              </a>
              <a href={withQs('/incidents/download/states')} className="btn btn-secondary btn-sm" download>
                <FileSpreadsheet aria-hidden="true" />
                Download totals by state (CSV)
              </a>
              <Link href={withQs('/incidents/print')} className="btn btn-secondary btn-sm">
                <Printer aria-hidden="true" />
                Print or save as PDF
              </Link>
            </div>
            <details className="no-print relative sm:hidden">
              <summary className="btn btn-secondary btn-sm list-none">
                <Download aria-hidden="true" />
                Download or print
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="glass-strong absolute end-0 z-30 mt-2 grid w-64 gap-1 rounded-[var(--radius-md)] p-2">
                <a href={withQs('/incidents/download')} className="menu-item" download>
                  <Download aria-hidden="true" size={16} /> Incidents (CSV)
                </a>
                <a href={withQs('/incidents/download/states')} className="menu-item" download>
                  <FileSpreadsheet aria-hidden="true" size={16} /> Totals by state (CSV)
                </a>
                <Link href={withQs('/incidents/print')} className="menu-item">
                  <Printer aria-hidden="true" size={16} /> Print or save as PDF
                </Link>
              </div>
            </details>
          </div>

          {active.length ? (
            <ul aria-label="Active filters" className="no-print mt-4 flex flex-wrap items-center gap-2">
              {active.map((c) => (
                <li key={c.key}>
                  <Link href={c.removeHref} className="chip" aria-label={`Remove filter: ${c.label}`}>
                    {c.label}
                    <X aria-hidden="true" />
                  </Link>
                </li>
              ))}
              {active.length > 1 ? (
                <li>
                  <Link href="/incidents" className="ms-1 text-[14px] font-semibold text-accent">
                    Clear all
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
          <p className="print-only mt-3 text-[13px]">
            <strong>Filters:</strong> {active.length ? active.map((c) => c.label).join(' · ') : 'none (all published records, V2 and V3)'}
          </p>

          {result.total === 0 ? (
            <section aria-labelledby="empty-heading" className="panel mt-6">
              <div className="flex items-start gap-4">
                <span className="icon-chip" aria-hidden="true">
                  <SearchX />
                </span>
                <div>
                  <h3 id="empty-heading" className="text-[20px]">
                    {focusName && !filters.q
                      ? `No published records for ${filters.city ? `${filters.city}, ` : ''}${focusName}${when === 'all dates' ? '' : `, ${when}`}`
                      : filters.q
                        ? `Nothing matches “${filters.q}”`
                        : includesV1
                          ? 'No incidents match these filters.'
                          : 'No verified incidents match these filters.'}
                  </h3>
                  <p className="mt-2 max-w-[62ch] text-muted">
                    {filters.q ? 'Search looks in titles, summaries, places and case names. Check the spelling, or try a city or case name. ' : ''}
                    The Record lists only incidents with published sources, so an empty result is not evidence that nothing happened.
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {focusName ? (
                      <li>
                        <Link href={allStatesHref} className="btn btn-secondary btn-sm">
                          Show all states
                        </Link>
                      </li>
                    ) : null}
                    {filters.q ? (
                      <li>
                        <Link href={explorePath({ ...filters, q: null }, base)} className="btn btn-secondary btn-sm">
                          Clear search
                        </Link>
                      </li>
                    ) : null}
                    {filters.from || filters.to ? (
                      <li>
                        <Link href={explorePath({ ...filters, from: null, to: null }, base)} className="btn btn-secondary btn-sm">
                          Show all dates
                        </Link>
                      </li>
                    ) : null}
                    {!includesV1 ? (
                      <li>
                        <Link href={explorePath({ ...filters, v: ['V1', ...DEFAULT_VERIFICATION_LEVELS] }, base)} className="btn btn-secondary btn-sm">
                          Include single-source (V1) reports
                        </Link>
                      </li>
                    ) : null}
                    {active.length ? (
                      <li>
                        <Link href="/incidents" className="btn btn-quiet btn-sm">
                          Clear all filters
                        </Link>
                      </li>
                    ) : null}
                    <li>
                      <Link href="/report" className="btn btn-quiet btn-sm">
                        Report an incident <ArrowRight aria-hidden="true" className="nudge" />
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          ) : (
            <section id="map" aria-labelledby="map-heading" className="map-card mt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <h3 id="map-heading" tabIndex={-1} className="text-[22px] leading-tight outline-none">
                  {focusName ? `${focusName}, by city` : 'By state'}
                </h3>
                {focusName ? (
                  <Link href={allStatesHref} className="btn btn-secondary btn-sm no-print" scroll={false}>
                    <ArrowLeft aria-hidden="true" className="nudge-back" />
                    All states
                  </Link>
                ) : (
                  <p className="no-print text-sm text-muted">Select a state on the map or in the list to zoom in.</p>
                )}
              </div>
              <p className="sr-only">
                {focusName
                  ? `Map of ${focusName} with a circle for each city, sized by the number of records. The list gives each city's count.`
                  : 'Map of the United States with each state shaded by its number of records. The list gives every state with records.'}
              </p>
              <div className="grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
                <div className="min-w-0">
                  {focusCode && !stateShape(focusCode) ? (
                    <p className="text-muted">{focusName} is not drawn on this map. Its records are listed beside it.</p>
                  ) : (
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
                              stateOnly: cities?.stateOnly ?? 0,
                              sizeMax,
                            }
                          : null
                      }
                      noun={includesV1 ? 'incident' : 'record'}
                    />
                  )}
                </div>
                <div className="min-w-0 border-t border-rule pt-5 xl:border-t-0 xl:border-s xl:ps-6 xl:pt-0">
                  <h4 className="mb-2 text-[15px] font-semibold">{focusName ? 'Cities with the most records' : 'States with the most records'}</h4>
                  {listRows.length ? (
                    focusName && listRows.length <= 2 ? (
                      <p className="text-[15px]">
                        {listRows.map((r, i) => (
                          <span key={r.key}>
                            {i ? '; ' : ''}
                            {plural(r.value, 'record')}, in <Link href={r.href}>{r.label}</Link>
                          </span>
                        ))}
                        .
                      </p>
                    ) : (
                      <BarList rows={listRows.slice(0, 10)} label={listLabel} noun="records" scroll={false} />
                    )
                  ) : (
                    <p className="text-muted">None for these filters.</p>
                  )}
                  {focusName && cities?.stateOnly ? (
                    <p className="mt-2 text-sm text-muted">{plural(cities.stateOnly, 'record')} shown at state level only, without a city.</p>
                  ) : null}
                  {listRows.length > 10 ? (
                    <details className="mt-3">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
                        <Table2 aria-hidden="true" size={16} />
                        All {formatNumber(listRows.length)} {focusName ? `cities in ${focusName}` : 'states'} as a table
                      </summary>
                      <div className="table-scroll mt-2" role="region" aria-label={listLabel} tabIndex={0}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th scope="col">{focusName ? 'City' : 'State'}</th>
                              <th scope="col" className="num">
                                Records
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {listRows.map((r) => (
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
              </div>
            </section>
          )}

          <section aria-labelledby="list-heading" className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="list-heading" className="text-[24px] leading-tight">
                The records
                {result.total > result.pageSize ? (
                  <span className="mono ms-3 align-middle text-[14px] font-normal text-muted">
                    {formatNumber(first)}–{formatNumber(last)} of {formatNumber(result.total)}
                  </span>
                ) : null}
              </h3>
              <div className="no-print flex flex-wrap items-center gap-3">
                <nav aria-label="Sort order" className="flex flex-wrap items-center gap-2">
                  <span className="kicker max-sm:sr-only">Sort</span>
                  <span className="segmented">
                    {SORTS.map((s) => (
                      <Link key={s} href={explorePath(filters, { ...vs, sort: s, page: 1 })} aria-current={vs.sort === s ? 'true' : undefined} scroll={false}>
                        {SORT_LABELS[s]}
                      </Link>
                    ))}
                  </span>
                </nav>
                <nav aria-label="View" className="flex items-center gap-2">
                  <span className="kicker max-sm:sr-only">View</span>
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
                <p className="text-muted">No records to list.</p>
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
                  sticky
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
            <p className="mt-8 max-w-[80ch] text-sm text-muted">
              {PAGE_SIZE} records per page, in a stable order, so a page number can be cited. Counts include V2 and V3 records unless V1 is
              selected. The CSV and the printable version include every matching record, not just this page.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { legalLabel, verificationLabel } from '@/components/Badges'
import { PrintButton } from '@/components/PrintButton'
import { StateMap } from '@/components/charts/StateMap'
import { INCIDENT_TYPES, INCIDENT_TYPE_META, type IncidentType } from '@/db/enums'
import { chips, describeDates, explorePath, parseFilters, parseViewState, serializeFilters } from '@/lib/filters'
import { formatDate, formatDateRange, formatNumber, formatPlace, plural, todayIso } from '@/lib/format'
import { SITE, absoluteUrl } from '@/lib/site'
import { incidentPath } from '@/lib/slug'
import { stateByCode } from '@/lib/states'
import { stateShape } from '@/server/public/geo'
import { searchIncidents } from '@/server/public/incidents'
import { countsByCity, countsByState, countsByType } from '@/server/public/stats'

export const metadata: Metadata = {
  title: 'Printable report',
  robots: { index: false, follow: false },
}

/** Rows a printed report lists before pointing to the CSV. */
const MAX_ROWS = 2000
/** More places than this, and the map takes the full width with the places in two columns under it. */
const SIDE_BY_SIDE_PLACES = 12

/** What the headline calls a record of each type: "1 verified threat", "No verified homicides". */
const TYPE_NOUNS: Record<IncidentType, string> = {
  HOM: 'homicide',
  ASLT: 'physical assault',
  THRT: 'threat',
  HARS: 'harassment incident',
  VAND: 'vandalism incident',
  ARSN: 'arson or explosive incident',
  DESC: 'desecration',
  MASS: 'mass-casualty attack',
  PLOT: 'disrupted plot',
  OFCL: 'official misconduct incident',
  SCHL: 'school or campus bullying incident',
  EMPL: 'workplace incident',
}

/** "a", "a or b", "a, b or c" (and the same with "and"). */
function list(words: string[], joiner: 'or' | 'and'): string {
  return words.length <= 2 ? words.join(` ${joiner} `) : `${words.slice(0, -1).join(', ')} ${joiner} ${words.at(-1)}`
}

/**
 * The current Explore filters as a report to print or save as PDF: the map,
 * the totals, and every matching record rather than one page of them.
 */
export default async function PrintPage(props: PageProps<'/incidents/print'>) {
  const sp = await props.searchParams
  const filters = parseFilters(sp)
  const vs = parseViewState(sp)
  const today = todayIso()
  const qs = serializeFilters(filters)
  const focusCode = filters.state.length === 1 && stateShape(filters.state[0]!) ? filters.state[0]! : null

  const [result, byState, byType, focusData] = await Promise.all([
    searchIncidents(filters, { sort: vs.sort, page: 1, pageSize: MAX_ROWS }),
    countsByState(filters),
    countsByType(filters),
    focusCode ? countsByCity({ ...filters, city: null }) : null,
  ])
  const includesV1 = filters.v.includes('V1')
  const focusName = focusCode ? (stateByCode(focusCode)?.name ?? focusCode) : null
  const active = chips(filters)
  const states = Object.entries(byState).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const types = INCIDENT_TYPES.filter((t) => byType[t] > 0).sort((a, b) => byType[b] - byType[a])
  const exploreUrl = absoluteUrl(explorePath(filters, vs))
  const places = focusName
    ? (focusData?.cities ?? []).map((c) => ({ key: c.city, name: c.city, n: c.count }))
    : states.map(([code, n]) => ({ key: code, name: stateByCode(code)?.name ?? code, n }))
  const wide = places.length > SIDE_BY_SIDE_PLACES

  // The headline says what was counted, so read or copied on its own it never overstates the record:
  // "1 verified threat matching “mosque” in 1 state, all dates".
  const one = result.total === 1
  const things = filters.type.length ? list(filters.type.map((t) => `${TYPE_NOUNS[t]}${one ? '' : 's'}`), 'or') : one ? 'incident' : 'incidents'
  const counted = `${result.total ? formatNumber(result.total) : 'No'} ${includesV1 ? '' : 'verified '}${things}`
  const where = focusName
    ? `${filters.city ? `${filters.city}, ` : ''}${focusName}`
    : result.total
      ? plural(states.length, 'state')
      : filters.state.length > 3
        ? `${filters.state.length} chosen states`
        : filters.state.length
          ? list(filters.state.map((s) => stateByCode(s)?.name ?? s), 'or')
          : null
  // Filters the sentence cannot name in a word: it says the count is narrowed by them, and the list below gives their values.
  const others = Object.entries({
    target: filters.target.length,
    severity: filters.severity.length,
    'verification level': filters.v.length < (includesV1 ? 3 : 2),
    'legal status': filters.status.length,
    perpetrator: filters.perp.length,
    'source type': filters.source.length,
    'hate-crime charge': filters.hc.length,
  })
    .filter(([, on]) => on)
    .map(([word]) => word)
  const title = [
    counted,
    filters.q ? ` matching “${filters.q}”` : '',
    where ? ` in ${where}` : '',
    `, ${describeDates(filters, today)}`,
    others.length ? `, filtered by ${list(others, 'and')}` : '',
  ].join('')

  return (
    <main className="wrap print-report pt-8 pb-12">
      <div className="no-print print-toolbar mb-6 flex flex-wrap items-center gap-4">
        <PrintButton />
        <Link href={explorePath(filters, vs)} className="arrow-link">
          <ArrowLeft aria-hidden="true" size={16} className="nudge-back" />
          Back to Explore
        </Link>
        <p className="text-sm text-muted">The printout lists every matching record. Use “Save as PDF” in the print dialog for a file.</p>
      </div>

      {/* On screen the report is shown as the sheet it prints on, in the light theme. */}
      <div className="paper print-sheet">
      <header className="border-b border-rule pb-5">
        <p className="kicker">{SITE.fullName} · Report</p>
        <h1 className="mt-2 text-2xl leading-tight">{title}</h1>
        <p className="mono mt-3 text-muted">
          Printed {formatDate(today)} from {exploreUrl}
        </p>
        <p className="mt-3 text-base">
          <span className="font-semibold">Filters: </span>
          {active.length ? active.map((c) => c.label).join(' · ') : 'none (all published records, verification levels V2 and V3)'}
        </p>
      </header>

      {result.total === 0 ? (
        <p className="mt-6 text-lg">No published records match these filters as of {formatDate(today)}.</p>
      ) : (
      <>
      <div className={`print-summary mt-6 ${wide ? 'print-summary-wide' : ''}`}>
      <section aria-labelledby="print-map" className="break-inside-avoid">
        <h2 id="print-map" className="mb-2 text-base font-semibold">
          {focusName ? `${focusName}, by city` : 'By state'}
        </h2>
        <StateMap
          counts={byState}
          stateHref={(code) => explorePath({ ...filters, state: [code], city: null }, vs)}
          focus={
            focusCode
              ? {
                  code: focusCode,
                  name: focusName!,
                  cities: focusData?.cities ?? [],
                  cityHref: (city) => explorePath({ ...filters, city }, vs),
                  selectedCity: filters.city,
                }
              : null
          }
          noun={includesV1 ? 'incident' : 'record'}
        />
      </section>

      <div className="print-totals">
        {/* A long list of places may run on to the next page (a row never splits); the map and the types stay whole. */}
        <section aria-labelledby="print-states">
          <h2 id="print-states" className="mb-2 text-base font-semibold">
            {focusName ? 'Records by city' : 'Records by state'}
          </h2>
          <div className={wide ? 'print-places-columns' : undefined}>
          <table className="data-table print-table">
            <thead>
              <tr>
                <th scope="col">{focusName ? 'City' : 'State'}</th>
                <th scope="col" className="num">
                  Records
                </th>
              </tr>
            </thead>
            <tbody>
              {places.map((p) => (
                <tr key={p.key}>
                  <td>{p.name}</td>
                  <td className="num">{formatNumber(p.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
        <section aria-labelledby="print-types" className="break-inside-avoid">
          <h2 id="print-types" className="mb-2 text-base font-semibold">
            Records by incident type
          </h2>
          <table className="data-table print-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col" className="num">
                  Records
                </th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t}>
                  <td>{INCIDENT_TYPE_META[t].label}</td>
                  <td className="num">{formatNumber(byType[t])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">A record can have more than one type, so these can add up to more than the total.</p>
        </section>
      </div>
      </div>

      <section aria-labelledby="print-records" className="mt-10">
        <h2 id="print-records" className="mb-2 text-base font-semibold">
          The records
        </h2>
        <div className="table-scroll">
        <table className="data-table print-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Place</th>
              <th scope="col">Incident</th>
              <th scope="col">Verification</th>
              <th scope="col">Legal status</th>
              <th scope="col" className="num">
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.id}>
                {/* One line on paper and on a sheet as wide as paper; a narrower sheet lets them wrap, so every column still fits. */}
                <td className="lg:whitespace-nowrap print:whitespace-nowrap">{formatDateRange(r.dateStart, r.dateEnd, r.datePrecision)}</td>
                <td className="lg:whitespace-nowrap print:whitespace-nowrap">{formatPlace(r.city, r.stateCode)}</td>
                <td>
                  <Link href={incidentPath(r.id, r.slug)} className="text-text">
                    {r.title}
                  </Link>
                  <span className="mono block text-muted">
                    {r.id} · {r.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(', ')}
                  </span>
                </td>
                <td>{verificationLabel(r.verificationLevel, r.sourceTypes)}</td>
                <td>{legalLabel(r.legalStatus, r.hateCrimeCharged)}</td>
                <td className="num">{formatNumber(r.sourceCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {result.total > MAX_ROWS ? (
          <p className="mt-3">
            The first {formatNumber(MAX_ROWS)} of {formatNumber(result.total)} records are listed. The{' '}
            <a href={qs ? `/incidents/download?${qs}` : '/incidents/download'}>CSV download</a> has all of them.
          </p>
        ) : null}
      </section>
      </>
      )}

      <p className="mono mt-10 border-t border-rule pt-4 text-muted">
        Source: {SITE.fullName}, {absoluteUrl('/')}. Data licensed {SITE.dataLicense.name}. Allegations are not convictions; each record shows its
        legal status. Records and counts change as cases develop.
      </p>
      </div>
    </main>
  )
}

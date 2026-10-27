import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { legalLabel, verificationLabel } from '@/components/Badges'
import { PrintButton } from '@/components/PrintButton'
import { StateMap } from '@/components/charts/StateMap'
import { INCIDENT_TYPES, INCIDENT_TYPE_META } from '@/db/enums'
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
  const noun = includesV1 ? 'incident' : 'verified incident'
  const focusName = focusCode ? (stateByCode(focusCode)?.name ?? focusCode) : null
  const active = chips(filters)
  const states = Object.entries(byState).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const types = INCIDENT_TYPES.filter((t) => byType[t] > 0).sort((a, b) => byType[b] - byType[a])
  const exploreUrl = absoluteUrl(explorePath(filters, vs))

  return (
    <main className="wrap print-report pt-8 pb-12">
      <div className="no-print mb-8 flex flex-wrap items-center gap-4 border-b border-rule pb-6">
        <PrintButton />
        <Link href={explorePath(filters, vs)} className="arrow-link">
          <ArrowLeft aria-hidden="true" size={16} className="nudge-back" />
          Back to Explore
        </Link>
        <p className="text-sm text-muted">The printout lists every matching record. Use “Save as PDF” in the print dialog for a file.</p>
      </div>

      <header className="border-b border-rule pb-5">
        <p className="kicker">{SITE.fullName} · Report</p>
        <h1 className="mt-2 text-[34px] leading-tight">
          {plural(result.total, noun)}
          {focusName ? ` in ${filters.city ? `${filters.city}, ` : ''}${focusName}` : ` in ${plural(states.length, 'state')}`}, {describeDates(filters, today)}
        </h1>
        <p className="mono mt-3 text-muted">
          Printed {formatDate(today)} from {exploreUrl}
        </p>
        <p className="mt-3 text-[15px]">
          <span className="font-semibold">Filters: </span>
          {active.length ? active.map((c) => c.label).join(' · ') : 'none (all published records, verification levels V2 and V3)'}
        </p>
      </header>

      <div className="print-summary mt-6">
      <section aria-labelledby="print-map" className="break-inside-avoid">
        <h2 id="print-map" className="mb-2 text-[15px] font-semibold">
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

      <div className="print-totals mt-8 grid gap-8 sm:grid-cols-2">
        <section aria-labelledby="print-states" className="break-inside-avoid">
          <h2 id="print-states" className="mb-2 text-[15px] font-semibold">
            {focusName ? 'Records by city' : 'Records by state'}
          </h2>
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
              {focusName
                ? (focusData?.cities ?? []).map((c) => (
                    <tr key={c.city}>
                      <td>{c.city}</td>
                      <td className="num">{formatNumber(c.count)}</td>
                    </tr>
                  ))
                : states.map(([code, n]) => (
                    <tr key={code}>
                      <td>{stateByCode(code)?.name ?? code}</td>
                      <td className="num">{formatNumber(n)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </section>
        <section aria-labelledby="print-types" className="break-inside-avoid">
          <h2 id="print-types" className="mb-2 text-[15px] font-semibold">
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
        <h2 id="print-records" className="mb-2 text-[15px] font-semibold">
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
                <td className="whitespace-nowrap">{formatDateRange(r.dateStart, r.dateEnd, r.datePrecision)}</td>
                <td>{formatPlace(r.city, r.stateCode)}</td>
                <td className="min-w-60 print:min-w-0">
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

      <p className="mono mt-10 border-t border-rule pt-4 text-muted">
        Source: {SITE.fullName}, {absoluteUrl('/')}. Data licensed {SITE.dataLicense.name}. Allegations are not convictions; each record shows its
        legal status. Records and counts change as cases develop.
      </p>
    </main>
  )
}

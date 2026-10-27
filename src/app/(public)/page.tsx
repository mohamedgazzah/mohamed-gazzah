import Link from 'next/link'
import { Arrow } from '@/components/Arrow'
import { EmptyState } from '@/components/EmptyState'
import { IncidentCard } from '@/components/IncidentCard'
import { StatTile } from '@/components/StatTile'
import { VerificationMark } from '@/components/VerificationMark'
import { BarList } from '@/components/charts/BarList'
import { MonthColumns } from '@/components/charts/MonthColumns'
import { StateMap } from '@/components/charts/StateMap'
import { CHARGED_OR_LATER, INCIDENT_TYPES, INCIDENT_TYPE_META, VERIFICATION_META } from '@/db/enums'
import { EMPTY_FILTERS, explorePath, type Filters } from '@/lib/filters'
import { addDays, formatNumber, plural, todayIso } from '@/lib/format'
import { stateByCode } from '@/lib/states'
import { countIncidents, latestIncidents } from '@/server/public/incidents'
import { countsByMonth, countsByState, countsByType } from '@/server/public/stats'

export const revalidate = 3600

function SectionLabel({ n, children }: { n: string; children: string }) {
  return (
    <p className="kicker">
      <span className="text-text">{n}</span> — {children}
    </p>
  )
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default async function HomePage() {
  const asOf = todayIso()
  const year = Number(asOf.slice(0, 4))
  const thisYear: Filters = { ...EMPTY_FILTERS, from: `${year}-01-01`, to: asOf }
  const last30: Filters = { ...EMPTY_FILTERS, from: addDays(asOf, -29), to: asOf }
  const charged: Filters = { ...thisYear, status: [...CHARGED_OR_LATER] }
  // Twelve calendar months, the current one to date.
  const monthStart = new Date(Date.UTC(year, Number(asOf.slice(5, 7)) - 12, 1)).toISOString().slice(0, 10)

  const [yearCount, month, chargedCount, latest, byState, byType, months] = await Promise.all([
    countIncidents(thisYear),
    countIncidents(last30),
    countIncidents(charged),
    latestIncidents(EMPTY_FILTERS, 5),
    countsByState(EMPTY_FILTERS),
    countsByType(EMPTY_FILTERS),
    countsByMonth(EMPTY_FILTERS, monthStart, asOf),
  ])

  const total = Object.values(byState).reduce((a, b) => a + b, 0)
  const topStates = Object.entries(byState)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([code, n]) => ({ key: code, label: stateByCode(code)?.name ?? code, value: n, href: `${explorePath({ state: [code] })}#map` }))
  const types = INCIDENT_TYPES.filter((t) => byType[t] > 0)
    .sort((a, b) => byType[b] - byType[a])
    .map((t) => ({ key: t, label: INCIDENT_TYPE_META[t].label, value: byType[t], href: explorePath({ type: [t] }) }))
  const bars = months.map((m, i) => ({
    month: m.month,
    count: m.count,
    href: explorePath({ from: m.from, to: m.to }),
    partial: i === months.length - 1,
  }))

  return (
    <main className="wrap pt-12 pb-4 md:pt-16">
      <section aria-labelledby="intro" className="grid gap-x-6 gap-y-8 md:grid-cols-12">
        <p className="kicker md:col-span-12">Public record · United States · 2020 onward</p>
        <h1 id="intro" className="display text-5xl md:col-span-8">
          Anti-Muslim incidents in the United States, <em className="text-accent">each one sourced and tracked through its legal outcome.</em>
        </h1>
        <div className="max-w-[40ch] self-end md:col-span-4 md:col-start-9">
          <p className="text-[15.5px] text-muted">
            Counts include records confirmed by authorities or independently reported. Allegations are never presented as convictions.{' '}
            <Link href="/methodology">How records are verified</Link>.
          </p>
          <p className="mt-5 flex flex-wrap gap-2">
            <Link href="/incidents" className="btn">
              Explore the map and records
            </Link>
            <Link href="/report" className="btn btn-secondary">
              Report an incident
            </Link>
          </p>
        </div>
      </section>

      <section aria-label={`Headline numbers, ${year}`} className="mt-14">
        <p className="kicker mb-1 text-text">{year} so far</p>
        <ul className="register">
          <li>
            <StatTile value={yearCount.incidents} label={`Verified incidents in ${year}`} asOf={asOf} href={explorePath(thisYear)} />
          </li>
          <li>
            <StatTile value={month.incidents} label="In the last 30 days" asOf={asOf} href={explorePath(last30)} />
          </li>
          <li>
            <StatTile value={yearCount.states} label={`States with incidents in ${year}`} asOf={asOf} href={explorePath(thisYear)} />
          </li>
          <li>
            <StatTile value={chargedCount.incidents} label={`Incidents with charges filed, ${year}`} asOf={asOf} href={explorePath(charged)} />
          </li>
        </ul>
      </section>

      <section aria-labelledby="where" className="mt-20 grid gap-x-6 gap-y-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <SectionLabel n="01">Where</SectionLabel>
          <h2 id="where" className="mt-3 text-[34px] leading-[1.05]">
            Incidents by state
          </h2>
          <p className="mt-4 text-[15px] text-muted">
            {plural(total, 'verified record')} since 2020. Darker states have more. Select a state to see its cities and records.
          </p>
          <p className="mt-5">
            <Link href="/incidents#map" className="arrow-link">
              Open the full map <Arrow />
            </Link>
          </p>
        </div>
        <div className="border-t border-ink pt-4 md:col-span-9">
          <p className="sr-only">Map of the United States with each state shaded by its number of records. The five states with the most are listed below the map.</p>
          <StateMap counts={byState} stateHref={(code) => `${explorePath({ state: [code] })}#map`} noun="record" />
          {topStates.length ? (
            <div className="mt-6 max-w-xl">
              <h3 className="kicker mb-2 text-text">Most records</h3>
              <BarList rows={topStates} label="States with the most records" noun="records" />
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="when" className="mt-20 grid gap-x-6 gap-y-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <SectionLabel n="02">When and what</SectionLabel>
          <h2 id="when" className="mt-3 text-[34px] leading-[1.05]">
            By month and by type
          </h2>
          <p className="mt-4 text-[15px] text-muted">Select a month or a type to see its records.</p>
        </div>
        <div className="grid gap-x-10 gap-y-12 border-t border-ink pt-4 md:col-span-9 lg:grid-cols-2">
          <figure>
            <figcaption className="kicker mb-1 text-text">Records per month, last 12 months</figcaption>
            <MonthColumns bars={bars} noun="record" />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-accent">Show as a table</summary>
              <table className="data-table mt-2">
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col" className="num">
                      Records
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bars.map((b) => (
                    <tr key={b.month}>
                      <td>
                        {MONTH_NAMES[Number(b.month.slice(5, 7)) - 1]} {b.month.slice(0, 4)}
                        {b.partial ? ' (to date)' : ''}
                      </td>
                      <td className="num">{formatNumber(b.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <p className="mt-2 text-sm text-muted">A record whose dates span two months counts in both.</p>
          </figure>
          <figure>
            <figcaption className="kicker mb-2 text-text">Records by type, since 2020</figcaption>
            {types.length ? <BarList rows={types} label="Records by incident type" noun="records" /> : <p className="text-muted">No records yet.</p>}
            <p className="mt-2 text-sm text-muted">A record can have more than one type.</p>
          </figure>
        </div>
      </section>

      <section aria-labelledby="latest" className="mt-20 grid gap-x-6 gap-y-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <div className="md:sticky md:top-8">
            <SectionLabel n="03">Latest</SectionLabel>
            <h2 id="latest" className="mt-3 text-[34px] leading-[1.05]">
              Latest verified incidents
            </h2>
            <p className="mt-4 text-sm text-muted">Newest first, by the date of the incident.</p>
            <p className="mt-5 text-[15px]">
              <Link href="/incidents" className="arrow-link">
                See all incidents <Arrow />
              </Link>
            </p>
          </div>
        </div>
        <div className="md:col-span-9">
          {latest.length ? (
            <ul className="ledger">
              {latest.map((i) => (
                <li key={i.id}>
                  <IncidentCard item={i} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No verified incidents have been published yet.</EmptyState>
          )}
        </div>
      </section>

      <section aria-labelledby="context" className="mt-20 grid gap-x-6 gap-y-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <SectionLabel n="04">Context</SectionLabel>
          <h2 id="context" className="mt-3 text-[34px] leading-[1.05]">
            How this count relates to others
          </h2>
        </div>
        <div className="border-t border-ink pt-6 md:col-span-9">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div>
              <p className="max-w-[60ch] font-serif text-[22px] leading-[1.5]">
                The FBI counts hate crimes reported by police agencies, CAIR counts complaints made to it, and surveys measure experiences.
                This record lists individual incidents with public sources, so its totals differ from all three.
              </p>
              <p className="mt-5">
                <Link href="/methodology#comparison" className="arrow-link">
                  Why the counts differ <Arrow />
                </Link>
              </p>
            </div>
            <div>
              <p className="kicker">Reading a record</p>
              <ul className="mt-3 space-y-3 text-sm">
                {(['V3', 'V2', 'V1'] as const).map((v) => (
                  <li key={v} className="flex gap-3">
                    <span className={`mt-1 ${v === 'V3' ? 'text-confirmed' : 'text-reported'}`}>
                      <VerificationMark level={v} size={11} />
                    </span>
                    <span>
                      <span className="font-semibold">{VERIFICATION_META[v].label}</span>
                      <span className="mono block text-muted">{v}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

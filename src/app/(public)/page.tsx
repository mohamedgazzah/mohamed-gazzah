import { ArrowRight, CalendarDays, Clock3, FileSearch, Gavel, MapPinned, MessageSquarePlus, Scale, Table2, UsersRound } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { IncidentCard } from '@/components/IncidentCard'
import { StatTile } from '@/components/StatTile'
import { VerificationMark } from '@/components/VerificationMark'
import { BarList } from '@/components/charts/BarList'
import { MonthColumns } from '@/components/charts/MonthColumns'
import { StateMap } from '@/components/charts/StateMap'
import { CHARGED_OR_LATER, DEFAULT_VERIFICATION_LEVELS, INCIDENT_TYPES, INCIDENT_TYPE_META, VERIFICATION_META } from '@/db/enums'
import { EMPTY_FILTERS, explorePath, type Filters } from '@/lib/filters'
import { addDays, formatDate, formatDateRange, formatNumber, formatTimestamp, isoTimestamp, plural, todayIso } from '@/lib/format'
import { stateByCode } from '@/lib/states'
import { countIncidents, latestIncidents } from '@/server/public/incidents'
import { lastUpdatedSafe } from '@/server/public/site-status'
import { countsByMonth, countsByState, countsByType } from '@/server/public/stats'

export const revalidate = 3600

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** A section opening: title, one line of explanation, and an optional link to the full view. */
function SectionHead({ id, title, children, link }: { id: string; title: string; children?: ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="max-w-[62ch]">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {children ? <div className="mt-2 text-base text-muted">{children}</div> : null}
      </div>
      {link ? (
        <Link href={link.href} className="btn btn-secondary btn-sm">
          {link.label} <ArrowRight aria-hidden="true" className="nudge" />
        </Link>
      ) : null}
    </div>
  )
}

const PRINCIPLES = [
  {
    Icon: FileSearch,
    title: 'Sourced and archived',
    text: 'Every record cites public sources — news reports, police statements, court filings — and keeps an archived copy of each.',
    href: '/methodology#standards',
    link: 'How sources are kept',
  },
  {
    Icon: UsersRound,
    title: 'Checked by a second editor',
    text: 'Nothing is published until an editor who did not write the record reviews it. The database enforces the rule.',
    href: '/methodology#process',
    link: 'How review works',
  },
  {
    Icon: Scale,
    title: 'Allegations stay allegations',
    text: 'Verification and legal status are shown separately. Anyone charged is presumed innocent until a court rules.',
    href: '/methodology#language',
    link: 'How allegations are worded',
  },
]

export default async function HomePage() {
  const asOf = todayIso()
  const year = Number(asOf.slice(0, 4))
  const thisYear: Filters = { ...EMPTY_FILTERS, from: `${year}-01-01`, to: asOf }
  const last30: Filters = { ...EMPTY_FILTERS, from: addDays(asOf, -29), to: asOf }
  const charged: Filters = { ...thisYear, status: [...CHARGED_OR_LATER] }
  // Twelve calendar months, the current one to date.
  const monthStart = new Date(Date.UTC(year, Number(asOf.slice(5, 7)) - 12, 1)).toISOString().slice(0, 10)

  const [yearCount, month, chargedCount, latest, byState, byType, months, updated] = await Promise.all([
    countIncidents(thisYear),
    countIncidents(last30),
    countIncidents(charged),
    latestIncidents(EMPTY_FILTERS, 5),
    countsByState(EMPTY_FILTERS),
    countsByType(EMPTY_FILTERS),
    countsByMonth(EMPTY_FILTERS, monthStart, asOf),
    lastUpdatedSafe(),
  ])

  const total = Object.values(byState).reduce((a, b) => a + b, 0)
  const ranked = Object.entries(byState).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  // The 50 states and D.C. with no record: said in words, so a short list never reads as the whole country.
  const withRecords = new Set(ranked.map(([code]) => code))
  const quietStates = 50 - [...withRecords].filter((c) => c !== 'DC' && stateByCode(c) && !stateByCode(c)!.territory).length
  const quietDc = !withRecords.has('DC')
  const topStates = ranked
    .slice(0, 10)
    .map(([code, n]) => ({ key: code, label: stateByCode(code)?.name ?? code, value: n, href: `${explorePath({ state: [code] })}#map` }))
  const types = INCIDENT_TYPES.filter((t) => byType[t] > 0)
    .sort((a, b) => byType[b] - byType[a])
    .map((t) => ({ key: t, label: INCIDENT_TYPE_META[t].label, value: byType[t], href: explorePath({ type: [t] }) }))
  // The chart's partial month runs to the last update, the same date as the hero says.
  const updatedDay = updated ? todayIso(new Date(isoTimestamp(updated))) : null
  const through = updatedDay && updatedDay.slice(0, 7) === asOf.slice(0, 7) ? updatedDay : asOf
  const bars = months.map((m, i) => ({
    month: m.month,
    count: m.count,
    href: explorePath({ from: m.from, to: m.to }),
    partial: i === months.length - 1,
  }))

  return (
    <main>
      <section aria-labelledby="intro" className="wrap pt-8 md:pt-12">
        <p className="tabular text-sm text-muted">
          {updated ? `Updated ${formatTimestamp(updated)}` : 'A public record'} · {plural(total, 'verified record')}
        </p>
        <h1 id="intro" className="display mt-4 max-w-[21ch] text-4xl tracking-[-0.03em]">
          Anti-Muslim incidents in the United States, documented and sourced.
        </h1>
        <p className="lede mt-5 max-w-[54ch] text-pretty">
          A public record of incidents since 2020. Every entry links to its sources, is checked by a second editor, and follows the case through
          the courts.
        </p>
        <p className="mt-7 flex flex-wrap gap-3">
          <Link href="/incidents" className="btn btn-lg w-full sm:w-auto">
            Explore the map and records <ArrowRight aria-hidden="true" className="nudge" />
          </Link>
          <Link href="/report" className="btn btn-secondary btn-lg w-full sm:w-auto">
            <MessageSquarePlus aria-hidden="true" />
            Report an incident
          </Link>
        </p>
      </section>

      <section aria-label={`Headline numbers, ${year}`} className="wrap mt-10 md:mt-12">
        <ul className="register">
          <li>
            <StatTile icon={<CalendarDays />} value={yearCount.incidents} label={`Incidents in ${year}`} href={explorePath(thisYear)} />
          </li>
          <li>
            <StatTile
              icon={<Clock3 />}
              value={month.incidents}
              label="Incidents in the last 30 days"
              href={explorePath(last30)}
              // A zero needs its context: when the latest one was, not a blank.
              note={
                <span className="whitespace-nowrap">
                  {month.incidents === 0 && latest[0] ? `Latest: ${formatDate(latest[0].dateStart)}` : formatDateRange(last30.from!, last30.to!, 'day')}
                </span>
              }
            />
          </li>
          <li>
            <StatTile icon={<MapPinned />} value={yearCount.states} label={`States with incidents in ${year}`} href={`${explorePath(thisYear)}#map`} />
          </li>
          <li>
            <StatTile icon={<Gavel />} value={chargedCount.incidents} label={`Incidents with charges in ${year}`} href={explorePath(charged)} />
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">Verified incidents only. Select a number to see its records.</p>
      </section>

      <section aria-labelledby="where" className="wrap mt-16 md:mt-24">
        <SectionHead id="where" title="Where incidents happened" link={{ href: '/incidents#map', label: 'Open the full map' }}>
          Verified records since 2020, shaded by state. Select a state to see its cities and records.
        </SectionHead>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="map-card">
            <p className="sr-only">Map of the United States with each state shaded by its number of records. The states with the most are listed with the map.</p>
            <StateMap counts={byState} stateHref={(code) => `${explorePath({ state: [code] })}#map`} noun="record" />
          </div>
          {topStates.length ? (
            <div className="panel">
              <h3 className="text-lg">States with the most records</h3>
              <p className="mt-1 text-sm text-muted">Since 2020</p>
              <div className="mt-4">
                <BarList rows={topStates} label="States with the most records" noun="records" />
              </div>
              {ranked.length < 10 ? (
                <p className="mt-4 text-sm text-muted">
                  No verified records in the other {plural(quietStates, 'state')}
                  {quietDc ? ' or D.C.' : '.'} That is not evidence that nothing happened there.
                </p>
              ) : null}
              {ranked.length > topStates.length ? (
                <p className="mt-5">
                  <Link href="/incidents#map" className="arrow-link text-base">
                    All {plural(ranked.length, 'state')} with records <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="when" className="wrap mt-16 md:mt-24">
        <SectionHead id="when" title="When and what happened">
          Select a month or an incident type to see its records.
        </SectionHead>
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <figure className="panel">
            <figcaption>
              <h3 className="text-lg">Records per month</h3>
              <span className="block text-sm text-muted">Last 12 months</span>
            </figcaption>
            <div className="mt-4">
              <MonthColumns bars={bars} noun="record" asOf={through} />
            </div>
            <p className="mt-3 text-sm text-muted">A record whose dates span two months counts in both.</p>
            <div className="mt-3">
              <details className="group">
                <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
                  <Table2 aria-hidden="true" size={16} />
                  <span className="group-open:hidden">Show as a table</span>
                  <span className="hidden group-open:inline">Hide the table</span>
                </summary>
                <table className="data-table data-table-plain data-table-static mt-2">
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
                          <Link href={b.href} className="inline-block py-1">
                            {MONTH_NAMES[Number(b.month.slice(5, 7)) - 1]} {b.month.slice(0, 4)}
                          </Link>
                          {b.partial ? ' (to date)' : ''}
                        </td>
                        <td className="num">{formatNumber(b.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          </figure>
          <figure className="panel">
            <figcaption>
              <h3 className="text-lg">Records by incident type</h3>
              <span className="block text-sm text-muted">Since 2020</span>
            </figcaption>
            <div className="mt-4">
              {types.length ? <BarList rows={types} label="Records by incident type" noun="records" /> : <p className="text-muted">No records yet.</p>}
            </div>
            <p className="mt-4 text-sm text-muted">A record can have more than one type.</p>
          </figure>
        </div>
      </section>

      <section aria-labelledby="latest" className="wrap mt-16 md:mt-24">
        <SectionHead id="latest" title="Latest verified incidents" link={{ href: '/incidents', label: 'See all incidents' }}>
          <p>Newest first, by the date of the incident.</p>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="font-semibold text-text">Verification:</span>
            {(['V3', 'V2'] as const).filter((v) => DEFAULT_VERIFICATION_LEVELS.includes(v)).map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5">
                <span className={v === 'V3' ? 'text-confirmed' : 'text-reported'}>
                  <VerificationMark level={v} size={11} />
                </span>
                {VERIFICATION_META[v].label}
              </span>
            ))}
            <span className="text-muted">Single-source reports are left out here.</span>
          </p>
        </SectionHead>
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
      </section>

      <section aria-labelledby="method" className="wrap mt-16 md:mt-24">
        <SectionHead id="method" title="How the record is kept" link={{ href: '/methodology', label: 'Read the methodology' }}>
          The rules every record follows before it appears here.
        </SectionHead>
        <ul className="grid gap-3 lg:grid-cols-3 lg:gap-4">
          {PRINCIPLES.map(({ Icon, title, text, href, link }, i) => (
            <li key={title}>
              <Link
                href={href}
                className="feature lift group h-full text-text no-underline hover:no-underline"
                aria-describedby={`principle-${i}`}
              >
                <span className="icon-chip icon-chip-lg" aria-hidden="true">
                  <Icon />
                </span>
                <span className="text-lg font-semibold tracking-[-0.015em]">{title}</span>
                <span id={`principle-${i}`} className="text-base leading-relaxed text-muted">
                  {text}
                </span>
                <span className="feature-link text-base font-semibold text-accent" aria-hidden="true">
                  {link.split(' ').slice(0, -1).join(' ')}{' '}
                  <span className="whitespace-nowrap">
                    {link.split(' ').at(-1)} <ArrowRight aria-hidden="true" size={16} className="nudge inline align-[-2px]" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* A quiet comparison, not a fourth card: four sources, four different things counted. */}
        <div className="compare mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h3 className="text-lg">What each source counts</h3>
            <Link href="/methodology#comparison" className="arrow-link text-sm">
              Why the counts differ <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['FBI', 'Hate crimes reported by police agencies'],
              ['CAIR', 'Complaints made to CAIR'],
              ['Surveys', 'Experiences people report'],
              ['This record', 'Individual incidents with public sources'],
            ].map(([term, text], i, all) => (
              <div key={term}>
                <dt className={i === all.length - 1 ? 'font-semibold text-accent' : 'font-semibold'}>{term}</dt>
                <dd className="mt-0.5 text-sm text-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  )
}

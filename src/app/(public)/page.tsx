import { ArrowRight, CalendarDays, Clock3, FileSearch, Gavel, Landmark, MapPinned, MessageSquarePlus, Scale, Table2, UsersRound } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { IncidentCard } from '@/components/IncidentCard'
import { StatTile } from '@/components/StatTile'
import { VerificationMark } from '@/components/VerificationMark'
import { BarList } from '@/components/charts/BarList'
import { MonthColumns } from '@/components/charts/MonthColumns'
import { StateMap } from '@/components/charts/StateMap'
import { CHARGED_OR_LATER, INCIDENT_TYPES, INCIDENT_TYPE_META, VERIFICATION_META } from '@/db/enums'
import { EMPTY_FILTERS, explorePath, type Filters } from '@/lib/filters'
import { addDays, formatDate, formatNumber, formatTimestamp, plural, todayIso } from '@/lib/format'
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
        <h2 id={id} className="text-[28px] leading-[1.12] md:text-[34px]">
          {title}
        </h2>
        {children ? <div className="mt-2 text-[16px] text-muted">{children}</div> : null}
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
  const topStates = ranked
    .slice(0, 10)
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
    <main className="pb-4">
      <section aria-labelledby="intro" className="wrap pt-8 md:pt-12">
        <p className="tabular text-[14px] text-muted">
          {updated ? `Updated ${formatTimestamp(updated)}` : 'A public record'} · {plural(total, 'verified record')} since 2020
        </p>
        <h1 id="intro" className="display mt-4 max-w-[21ch] text-4xl tracking-[-0.03em]">
          Anti-Muslim incidents in the United States, documented and sourced.
        </h1>
        <p className="lede mt-5 max-w-[54ch] text-pretty md:text-[19px]">
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
            <StatTile icon={<CalendarDays />} value={yearCount.incidents} label={`Verified incidents in ${year}`} href={explorePath(thisYear)} />
          </li>
          <li>
            <StatTile icon={<Clock3 />} value={month.incidents} label="In the last 30 days" href={explorePath(last30)} />
          </li>
          <li>
            <StatTile icon={<MapPinned />} value={yearCount.states} label={`States with incidents in ${year}`} href={explorePath(thisYear)} />
          </li>
          <li>
            <StatTile icon={<Gavel />} value={chargedCount.incidents} label={`With charges filed, ${year}`} href={explorePath(charged)} />
          </li>
        </ul>
        <p className="mt-3 text-[13.5px] text-muted">Counts as of {formatDate(asOf)}. Select a number to see its records.</p>
      </section>

      <section aria-labelledby="where" className="wrap mt-16 md:mt-24">
        <SectionHead id="where" title="Where incidents happened" link={{ href: '/incidents#map', label: 'Open the full map' }}>
          {plural(total, 'verified record')} since 2020, shaded by state (key below the map). Select a state to see its cities and records.
        </SectionHead>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="map-card">
            <p className="sr-only">Map of the United States with each state shaded by its number of records. The states with the most are listed beside the map.</p>
            <StateMap counts={byState} stateHref={(code) => `${explorePath({ state: [code] })}#map`} noun="record" />
          </div>
          {topStates.length ? (
            <div className="panel flex flex-col">
              <h3 className="text-[17px]">States with the most records</h3>
              <p className="mt-1 text-sm text-muted">Since 2020</p>
              <div className="mt-4">
                <BarList rows={topStates} label="States with the most records" noun="records" />
              </div>
              <p className="mt-auto pt-5">
                <Link href="/incidents#map" className="arrow-link text-[15px]">
                  All {plural(ranked.length, 'state')} with records <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="when" className="wrap mt-16 md:mt-24">
        <SectionHead id="when" title="When and what happened">
          Select a month or an incident type to see its records.
        </SectionHead>
        <div className="grid gap-4 lg:grid-cols-2">
          <figure className="panel flex flex-col">
            <figcaption>
              <span className="block text-[17px] font-semibold">Records per month</span>
              <span className="block text-sm text-muted">Last 12 months</span>
            </figcaption>
            <div className="mt-4">
              <MonthColumns bars={bars} noun="record" asOf={asOf} />
            </div>
            <div className="mt-auto pt-4">
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
                          {MONTH_NAMES[Number(b.month.slice(5, 7)) - 1]} {b.month.slice(0, 4)}
                          {b.partial ? ' (to date)' : ''}
                        </td>
                        <td className="num">{formatNumber(b.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <p className="mt-1 text-sm text-muted">A record whose dates span two months counts in both.</p>
            </div>
          </figure>
          <figure className="panel flex flex-col">
            <figcaption>
              <span className="block text-[17px] font-semibold">Records by incident type</span>
              <span className="block text-sm text-muted">Since 2020</span>
            </figcaption>
            <div className="mt-4">
              {types.length ? <BarList rows={types} label="Records by incident type" noun="records" /> : <p className="text-muted">No records yet.</p>}
            </div>
            <p className="mt-auto pt-4 text-sm text-muted">A record can have more than one type.</p>
          </figure>
        </div>
      </section>

      <section aria-labelledby="latest" className="wrap mt-16 md:mt-24">
        <SectionHead id="latest" title="Latest verified incidents" link={{ href: '/incidents', label: 'See all incidents' }}>
          <p>Newest first, by the date of the incident.</p>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
            {(['V3', 'V2', 'V1'] as const).map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5">
                <span className={v === 'V3' ? 'text-confirmed' : 'text-reported'}>
                  <VerificationMark level={v} size={11} />
                </span>
                {VERIFICATION_META[v].label}
              </span>
            ))}
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
        <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
          {PRINCIPLES.map(({ Icon, title, text, href, link }) => (
            <li key={title}>
              <Link href={href} className="feature lift group h-full text-text no-underline hover:no-underline">
                <span className="icon-chip icon-chip-lg" aria-hidden="true">
                  <Icon />
                </span>
                <span className="text-[19px] font-semibold tracking-[-0.015em]">{title}</span>
                <span className="text-[15.5px] leading-relaxed text-muted">{text}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent">
                  {link} <ArrowRight aria-hidden="true" size={16} className="nudge" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="panel mt-4 flex gap-4">
          <span className="icon-chip hidden sm:inline-grid" aria-hidden="true">
            <Landmark />
          </span>
          <div>
            <h3 className="text-[19px]">How this count relates to others</h3>
            <p className="mt-2 max-w-[66ch] text-[16px] leading-relaxed text-muted">
              The FBI counts hate crimes reported by police agencies, CAIR counts complaints made to it, and surveys measure experiences. This
              record lists individual incidents with public sources, so its totals differ from all three.
            </p>
            <p className="mt-4">
              <Link href="/methodology#comparison" className="arrow-link">
                Why the counts differ <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

import Link from 'next/link'
import { EmptyState } from '@/components/EmptyState'
import { IncidentCard } from '@/components/IncidentCard'
import { StatTile } from '@/components/StatTile'
import { CHARGED_OR_LATER } from '@/db/enums'
import { EMPTY_FILTERS, explorePath, type Filters } from '@/lib/filters'
import { addDays, todayIso } from '@/lib/format'
import { countIncidents, latestIncidents } from '@/server/public/incidents'

export const revalidate = 3600

export default async function HomePage() {
  const asOf = todayIso()
  const yearStart = `${asOf.slice(0, 4)}-01-01`
  const thisYear: Filters = { ...EMPTY_FILTERS, from: yearStart, to: asOf }
  const last30: Filters = { ...EMPTY_FILTERS, from: addDays(asOf, -29), to: asOf }
  const charged: Filters = { ...thisYear, status: [...CHARGED_OR_LATER] }

  const [year, month, chargedCount, latest] = await Promise.all([
    countIncidents(thisYear),
    countIncidents(last30),
    countIncidents(charged),
    latestIncidents(EMPTY_FILTERS, 10),
  ])

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <section aria-labelledby="intro">
        <h1 id="intro" className="max-w-[24ch] text-3xl">
          A public, sourced record of anti-Muslim incidents in the United States.
        </h1>
        <p className="mt-4 max-w-[72ch] text-lg text-muted">
          Each incident is linked to its sources and followed through its legal outcome. Counts include records confirmed by authorities or
          independently reported. <Link href="/methodology">How records are verified</Link>.
        </p>
      </section>

      <section aria-label="Headline numbers" className="mt-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <StatTile value={year.incidents} label={`Verified incidents in ${asOf.slice(0, 4)}`} asOf={asOf} href={explorePath(thisYear)} />
          </li>
          <li>
            <StatTile value={month.incidents} label="In the last 30 days" asOf={asOf} href={explorePath(last30)} />
          </li>
          <li>
            <StatTile value={year.states} label={`States with incidents in ${asOf.slice(0, 4)}`} asOf={asOf} href={explorePath(thisYear)} />
          </li>
          <li>
            <StatTile value={chargedCount.incidents} label={`Incidents with charges filed, ${asOf.slice(0, 4)}`} asOf={asOf} href={explorePath(charged)} />
          </li>
        </ul>
      </section>

      <section aria-labelledby="latest" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="latest" className="text-2xl">
            Latest verified incidents
          </h2>
          <p className="flex flex-wrap gap-4 text-base">
            <Link href="/incidents">See all incidents</Link>
            <Link href={explorePath({}, { view: 'map' })}>See them on a map</Link>
          </p>
        </div>
        {latest.length ? (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {latest.map((i) => (
              <li key={i.id}>
                <IncidentCard item={i} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState>No verified incidents have been published yet.</EmptyState>
          </div>
        )}
      </section>

      <section aria-labelledby="context" className="mt-12 card p-5">
        <h2 id="context" className="text-xl">
          How this count relates to others
        </h2>
        <p className="mt-2 max-w-[72ch] text-base">
          The FBI counts hate crimes reported by police agencies, CAIR counts complaints made to it, and surveys measure experiences. This record
          lists individual incidents with public sources, so its totals differ from all three.{' '}
          <Link href="/methodology#comparison">Why the counts differ</Link>.
        </p>
      </section>
    </main>
  )
}

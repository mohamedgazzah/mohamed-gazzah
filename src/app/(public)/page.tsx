import Link from 'next/link'
import { Arrow } from '@/components/Arrow'
import { EmptyState } from '@/components/EmptyState'
import { IncidentCard } from '@/components/IncidentCard'
import { StatTile } from '@/components/StatTile'
import { VerificationMark } from '@/components/VerificationMark'
import { YearStrip } from '@/components/YearStrip'
import { CHARGED_OR_LATER, VERIFICATION_META } from '@/db/enums'
import { EMPTY_FILTERS, explorePath, type Filters } from '@/lib/filters'
import { addDays, todayIso } from '@/lib/format'
import { countIncidents, latestIncidents, timelinePoints } from '@/server/public/incidents'

export const revalidate = 3600

function SectionLabel({ n, children }: { n: string; children: string }) {
  return (
    <p className="kicker">
      <span className="text-text">{n}</span> — {children}
    </p>
  )
}

export default async function HomePage() {
  const asOf = todayIso()
  const year = Number(asOf.slice(0, 4))
  const yearStart = `${year}-01-01`
  const thisYear: Filters = { ...EMPTY_FILTERS, from: yearStart, to: asOf }
  const last30: Filters = { ...EMPTY_FILTERS, from: addDays(asOf, -29), to: asOf }
  const charged: Filters = { ...thisYear, status: [...CHARGED_OR_LATER] }

  const [yearCount, month, chargedCount, latest, points] = await Promise.all([
    countIncidents(thisYear),
    countIncidents(last30),
    countIncidents(charged),
    latestIncidents(EMPTY_FILTERS, 6),
    timelinePoints(thisYear),
  ])

  return (
    <main className="wrap pt-12 pb-4 md:pt-20">
      <section aria-labelledby="intro" className="grid gap-x-6 gap-y-8 md:grid-cols-12">
        <p className="kicker md:col-span-12">Public record · United States · 2020 onward</p>
        <h1 id="intro" className="display text-5xl md:col-span-9">
          Anti-Muslim incidents in the United States, <em className="text-accent">each one sourced and tracked through its legal outcome.</em>
        </h1>
        <div className="max-w-[40ch] self-end text-[15.5px] text-muted md:col-span-3 md:col-start-10">
          <p>
            Counts include records confirmed by authorities or independently reported. Allegations are never presented as convictions.
          </p>
          <p className="mt-4">
            <Link href="/methodology" className="arrow-link">
              How records are verified <Arrow />
            </Link>
          </p>
        </div>
      </section>

      <div className="mt-16 md:mt-20">
        <YearStrip year={year} today={asOf} points={points} />
      </div>

      <section aria-label="Headline numbers" className="mt-8">
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

      <section aria-labelledby="latest" className="mt-24 grid gap-x-6 gap-y-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <div className="md:sticky md:top-8">
            <SectionLabel n="01">Latest</SectionLabel>
            <h2 id="latest" className="mt-3 text-[34px] leading-[1.05]">
              Latest verified incidents
            </h2>
            <p className="mt-4 text-sm text-muted">Newest first, by the date of the incident.</p>
            <ul className="mt-5 space-y-2 text-[15px]">
              <li>
                <Link href="/incidents" className="arrow-link">
                  See all incidents <Arrow />
                </Link>
              </li>
              <li>
                <Link href={explorePath({}, { view: 'map' })} className="arrow-link">
                  See them on a map <Arrow />
                </Link>
              </li>
            </ul>
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

      <section aria-labelledby="context" className="mt-24 grid gap-x-6 gap-y-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <SectionLabel n="02">Context</SectionLabel>
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

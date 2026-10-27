import Link from 'next/link'
import { METHODOLOGY_VERSION } from '@/db/enums'
import { formatTimestamp } from '@/lib/format'
import { SITE } from '@/lib/site'
import { Arrow } from './Arrow'

const NAV = [
  { href: '/incidents', label: 'Explore' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/data', label: 'Data' },
  { href: '/about', label: 'About' },
]

/** Masthead: a dateline with the record's state, then the name and the sections. */
export function SiteHeader({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <header role="banner" className="border-b border-ink">
      <div className="wrap">
        <div className="mono hidden items-center justify-between gap-6 border-b border-rule py-2 text-muted md:flex">
          <span>
            {lastUpdated ? `Updated ${formatTimestamp(lastUpdated)}` : 'A public record'} · Methodology {METHODOLOGY_VERSION}
          </span>
          <span>Every entry sourced · Data {SITE.dataLicense.name}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3 pt-4 pb-3 md:py-5">
          <Link href="/" className="text-text no-underline hover:no-underline">
            <span className="block font-serif text-[28px] leading-none font-medium tracking-[-0.018em] md:text-[34px]">{SITE.name}</span>
            <span className="mono mt-1.5 block text-muted">Anti-Muslim incidents in the United States</span>
            <span className="sr-only">, home</span>
          </Link>
          <nav aria-label="Main" className="-mx-2 w-[calc(100%+1rem)] overflow-x-auto md:mx-0 md:w-auto">
            <ul className="flex whitespace-nowrap text-[15px]">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="inline-flex min-h-11 items-center px-1.5 font-medium text-text no-underline hover:underline sm:px-2 md:px-3">
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/report" className="arrow-link min-h-11 px-1.5 text-accent sm:px-2 md:ps-4 md:pe-0">
                  <span className="md:hidden">Report</span>
                  <span className="hidden md:inline">Report an incident</span>
                  <Arrow />
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  )
}

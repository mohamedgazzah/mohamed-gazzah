import Link from 'next/link'
import { METHODOLOGY_VERSION } from '@/db/enums'
import { formatTimestamp } from '@/lib/format'
import { SITE } from '@/lib/site'
import { Arrow } from './Arrow'
import { ThemeToggle } from './ThemeToggle'

const LINKS = [
  { href: '/incidents', label: 'Explore the record' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/data', label: 'Data and downloads' },
  { href: '/report?mode=correction', label: 'Request a correction' },
  { href: '/about#privacy', label: 'Privacy' },
  { href: '/about', label: 'About' },
]

export function SiteFooter({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <footer className="band mt-24">
      <div className="wrap pt-14 pb-6">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="kicker">About this record</p>
            <p className="mt-3 max-w-[34ch] font-serif text-[22px] leading-snug">
              A public record. Every entry is sourced, and allegations are never presented as convictions.
            </p>
            <p className="mt-5">
              <Link href="/report" className="arrow-link">
                Tell us about an incident <Arrow />
              </Link>
            </p>
          </div>
          <nav aria-label="Footer" className="md:col-span-3 md:col-start-7">
            <p className="kicker">The record</p>
            <ul className="mt-3 space-y-1.5">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="no-underline hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-5 md:col-span-3">
            <div>
              <p className="kicker">Colophon</p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                <li>
                  Data{' '}
                  <a href={SITE.dataLicense.url} rel="license noopener">
                    {SITE.dataLicense.name}
                  </a>
                  . Code{' '}
                  <a href={SITE.codeLicense.url} rel="license noopener">
                    {SITE.codeLicense.name}
                  </a>
                  .
                </li>
                <li className="mono">{lastUpdated ? `Last updated ${formatTimestamp(lastUpdated)}` : 'Last updated: not available'}</li>
                <li className="mono">Methodology {METHODOLOGY_VERSION}</li>
                <li>Set in Newsreader, Libre Franklin and IBM Plex Mono.</li>
              </ul>
            </div>
            <ThemeToggle />
          </div>
        </div>
        <p aria-hidden="true" className="mt-14 pt-2 font-serif text-[clamp(60px,16vw,224px)] leading-[0.86] font-medium tracking-[-0.045em] whitespace-nowrap select-none">
          {SITE.name}
        </p>
      </div>
    </footer>
  )
}

import { ArrowRight, MessageSquarePlus } from 'lucide-react'
import Link from 'next/link'
import { METHODOLOGY_VERSION } from '@/db/enums'
import { formatTimestamp } from '@/lib/format'
import { SITE } from '@/lib/site'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'

const RECORD_LINKS = [
  { href: '/incidents', label: 'Explore the record' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/data', label: 'Data and downloads' },
]

const PROJECT_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/report?mode=correction', label: 'Request a correction' },
  { href: '/about#privacy', label: 'Privacy' },
  { href: '/about#contact', label: 'Contact' },
]

export function SiteFooter({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <footer className="band mt-16 rounded-t-[32px] md:mt-24">
      <div className="wrap pt-14 pb-8 md:pt-16">
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-12">
          <div className="md:col-span-6 lg:col-span-5">
            <p className="flex items-center gap-3 text-lg font-semibold tracking-[-0.02em]">
              <span className="brand-mark brand-mark-band">
                <BrandMark />
              </span>
              {SITE.name}
            </p>
            <p className="mt-4 max-w-[38ch] text-base leading-relaxed">
              A public record of anti-Muslim incidents in the United States. Every entry is sourced, and allegations are never presented as
              convictions.
            </p>
            <p className="mt-6">
              <Link href="/report" className="btn btn-sm">
                <MessageSquarePlus aria-hidden="true" />
                Report an incident
              </Link>
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 md:col-span-6 lg:col-span-5 lg:col-start-8">
            <div>
              <p className="kicker">The record</p>
              <ul className="mt-3 space-y-2">
                {RECORD_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="group inline-flex items-center gap-1.5 no-underline hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="kicker">The project</p>
              <ul className="mt-3 space-y-2">
                {PROJECT_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="no-underline hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-t border-band-rule pt-6 text-sm text-muted">
          <div className="space-y-1.5">
          <p className="tabular">
            {lastUpdated ? `Last updated ${formatTimestamp(lastUpdated)}` : 'Last updated: not available'} · Methodology {METHODOLOGY_VERSION}
          </p>
          <p>
            Data{' '}
            <a href={SITE.dataLicense.url} rel="license noopener">
              {SITE.dataLicense.name}
            </a>{' '}
            · Code{' '}
            <a href={SITE.codeLicense.url} rel="license noopener">
              {SITE.codeLicense.name}
            </a>{' '}
            ·{' '}
            <Link href="/methodology" className="inline-flex items-center gap-1">
              How records are verified <ArrowRight aria-hidden="true" size={14} className="nudge" />
            </Link>
          </p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}

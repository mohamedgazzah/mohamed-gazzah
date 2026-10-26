import Link from 'next/link'
import { SITE } from '@/lib/site'
import { formatTimestamp } from '@/lib/format'
import { ThemeToggle } from './ThemeToggle'

export function SiteFooter({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <footer className="mt-16 border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-content gap-6 px-4 py-8 text-sm sm:grid-cols-2 sm:px-6">
        <div className="space-y-2">
          <p className="font-serif text-lg font-semibold">{SITE.fullName}</p>
          <p className="text-muted">
            A public record. Every entry is sourced, and allegations are never presented as convictions.
          </p>
          <p>
            Data{' '}
            <a href={SITE.dataLicense.url} rel="license noopener">
              {SITE.dataLicense.name}
            </a>
            . Code{' '}
            <a href={SITE.codeLicense.url} rel="license noopener">
              {SITE.codeLicense.name}
            </a>
            .
          </p>
          <p className="text-muted tabular">{lastUpdated ? `Last updated ${formatTimestamp(lastUpdated)}` : 'Last updated: not available'}</p>
        </div>
        <div className="space-y-3">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Link href="/methodology">Methodology</Link>
            </li>
            <li>
              <Link href="/report?mode=correction">Request a correction</Link>
            </li>
            <li>
              <Link href="/data">Data and downloads</Link>
            </li>
            <li>
              <Link href="/about#privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/about">About</Link>
            </li>
          </ul>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}

import Link from 'next/link'
import { SITE } from '@/lib/site'

const NAV = [
  { href: '/incidents', label: 'Explore' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/data', label: 'Data' },
  { href: '/report', label: 'Report' },
  { href: '/about', label: 'About' },
]

export function SiteHeader() {
  return (
    <header role="banner" className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-xl font-bold text-text no-underline hover:no-underline">
          {SITE.name}
          <span className="sr-only">: {SITE.fullName}, home</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-1 gap-y-1 text-base">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="inline-flex min-h-11 items-center rounded px-2 font-medium text-text no-underline hover:underline">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

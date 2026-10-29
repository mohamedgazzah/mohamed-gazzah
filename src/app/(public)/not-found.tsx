import { ArrowRight, Compass } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Page not found' }

/** Inside the public layout, so a missing page keeps the header, footer and theme switch. */
export default function NotFound() {
  return (
    <main className="wrap py-20 md:py-28">
      <span className="icon-chip icon-chip-lg" aria-hidden="true">
        <Compass />
      </span>
      <p className="kicker mt-6">Error 404</p>
      <h1 className="display mt-2 max-w-[18ch] text-5xl">There is no page at this address.</h1>
      <p className="lede mt-6 max-w-[56ch]">Check the address for a typo. If a link brought you here, the page may have moved or been removed.</p>
      <p className="mt-8 flex flex-wrap gap-3">
        <Link href="/incidents" className="btn max-sm:w-full">
          Explore all incidents <ArrowRight aria-hidden="true" className="nudge" />
        </Link>
        <Link href="/" className="btn btn-secondary max-sm:w-full">
          Go to the home page
        </Link>
      </p>
      <p className="mt-5">
        <Link href="/about#contact" className="arrow-link">
          Report a broken link <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </p>
    </main>
  )
}

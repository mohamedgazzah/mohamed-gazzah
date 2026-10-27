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
      <p className="lede mt-6 max-w-[56ch]">If you followed a link to a record, it may have been removed on a legal or factual basis.</p>
      <p className="mt-8 flex flex-wrap gap-3">
        <Link href="/incidents" className="btn">
          Explore all incidents <ArrowRight aria-hidden="true" className="nudge" />
        </Link>
        <Link href="/" className="btn btn-secondary">
          Go to the home page
        </Link>
        <Link href="/report?mode=correction" className="btn btn-quiet">
          Request a correction
        </Link>
      </p>
    </main>
  )
}

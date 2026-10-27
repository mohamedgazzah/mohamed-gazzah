import { ArrowRight, Compass } from 'lucide-react'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'

export default function NotFound() {
  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="ambient" />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="wrap py-20 outline-none md:py-28">
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
        </p>
      </main>
    </div>
  )
}

import { ArrowRight, FileX2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Record not found' }

/** A record address with no published record behind it: say so specifically, and why that can happen. */
export default function RecordNotFound() {
  return (
    <main className="wrap py-20 md:py-28">
      <span className="icon-chip icon-chip-lg" aria-hidden="true">
        <FileX2 />
      </span>
      <p className="kicker mt-6">Error 404</p>
      <h1 className="display mt-2 max-w-[20ch] text-5xl">No published record at this address.</h1>
      <p className="lede mt-6 max-w-[58ch]">
        Check the record id in the address. A record can also be removed on a legal or factual basis; when that happens, its address stops
        working.
      </p>
      <p className="mt-8 flex flex-wrap gap-3">
        <Link href="/incidents" className="btn max-sm:w-full">
          Search the record <ArrowRight aria-hidden="true" className="nudge" />
        </Link>
        <Link href="/" className="btn btn-secondary max-sm:w-full">
          Go to the home page
        </Link>
      </p>
      <p className="mt-5">
        <Link href="/report?mode=correction" className="arrow-link">
          Request a correction <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </p>
    </main>
  )
}

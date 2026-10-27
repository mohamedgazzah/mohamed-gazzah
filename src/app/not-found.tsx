import Link from 'next/link'
import { Arrow } from '@/components/Arrow'
import { SiteHeader } from '@/components/SiteHeader'

export default function NotFound() {
  return (
    <>
      <SiteHeader lastUpdated={null} />
      <main id="main" tabIndex={-1} className="wrap py-20 outline-none md:py-28">
        <p className="kicker">Error 404</p>
        <h1 className="display mt-4 max-w-[16ch] text-5xl">There is no page at this address.</h1>
        <p className="mt-6 max-w-[56ch] font-serif text-[21px] leading-normal">
          If you followed a link to a record, it may have been removed on a legal or factual basis.
        </p>
        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
          <li>
            <Link href="/incidents" className="arrow-link">
              Explore all incidents <Arrow />
            </Link>
          </li>
          <li>
            <Link href="/" className="arrow-link">
              Go to the home page <Arrow />
            </Link>
          </li>
        </ul>
      </main>
    </>
  )
}

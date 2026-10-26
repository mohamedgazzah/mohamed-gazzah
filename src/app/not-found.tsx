import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-reading px-4 py-16 outline-none sm:px-6">
        <h1 className="text-3xl">Page not found</h1>
        <p className="mt-3 reading">
          There is no page at this address. If you followed a link to a record, it may have been removed on a legal or factual basis.
        </p>
        <p className="mt-3 reading">
          <Link href="/incidents">Explore all incidents</Link> or <Link href="/">go to the home page</Link>.
        </p>
      </main>
    </>
  )
}

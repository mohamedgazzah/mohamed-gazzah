import type { Metadata } from 'next'
import PublicLayout from './(public)/layout'
import PublicNotFound from './(public)/not-found'

export const metadata: Metadata = { title: 'Page not found' }

/** Fallback for addresses outside the public pages: the public 404, in the same header and footer. */
export default function NotFound() {
  return (
    <PublicLayout>
      <PublicNotFound />
    </PublicLayout>
  )
}

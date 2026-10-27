import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// Set here as well as on the 404 page, so the title stays "Page not found" after the page loads.
export const metadata: Metadata = { title: 'Page not found', robots: { index: false } }

/** Any address no other route matches: answered by the public 404 page, inside the site's layout. */
export default function Missing() {
  notFound()
}

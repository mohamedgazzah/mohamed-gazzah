import { notFound } from 'next/navigation'

/** Any address no other route matches: answered by the public 404 page, inside the site's layout. */
export default function Missing() {
  notFound()
}

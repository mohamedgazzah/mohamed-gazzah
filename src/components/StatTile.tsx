import Link from 'next/link'
import { formatDate, formatNumber } from '@/lib/format'

/** Big number, label underneath, as-of date. Links to the records it counts. */
export function StatTile({ value, label, asOf, href }: { value: number; label: string; asOf: string; href: string }) {
  return (
    <Link href={href} className="card group block p-4 text-text no-underline hover:border-accent hover:no-underline">
      <span className="block font-serif text-3xl font-semibold tabular">{formatNumber(value)}</span>
      <span className="mt-1 block text-base font-semibold group-hover:underline">{label}</span>
      <span className="mt-1 block text-sm text-muted">As of {formatDate(asOf)}</span>
    </Link>
  )
}

import Link from 'next/link'
import { formatDate, formatNumber } from '@/lib/format'

/** Big number, label underneath, as-of date. Links to the records it counts. */
export function StatTile({ value, label, asOf, href }: { value: number; label: string; asOf: string; href: string }) {
  return (
    <Link href={href} className="group block h-full py-6 pe-4 text-text no-underline hover:no-underline">
      <span className="figure block text-[clamp(48px,5.4vw,76px)] group-hover:text-accent">{formatNumber(value)}</span>
      <span className="mt-4 block text-[15px] leading-snug font-semibold group-hover:underline">{label}</span>
      <span className="mono mt-1.5 block text-muted">As of {formatDate(asOf)}</span>
    </Link>
  )
}

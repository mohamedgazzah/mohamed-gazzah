import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatDate, formatNumber } from '@/lib/format'

/** Big number on glass, label underneath, as-of date. Links to the records it counts. */
export function StatTile({ value, label, asOf, href, icon }: { value: number; label: string; asOf: string; href: string; icon?: ReactNode }) {
  return (
    <Link href={href} className="glass lift group flex h-full flex-col rounded-[var(--radius-md)] p-5 text-text no-underline hover:no-underline md:p-6">
      <span className="flex items-start justify-between gap-3">
        {icon ? (
          <span className="icon-chip" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <ArrowUpRight aria-hidden="true" size={18} className="text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
      <span className="figure mt-6 block text-[clamp(40px,4.2vw,56px)]">{formatNumber(value)}</span>
      <span className="mt-2.5 block text-[15px] leading-snug font-semibold">{label}</span>
      <span className="mono mt-1 block text-muted">As of {formatDate(asOf)}</span>
    </Link>
  )
}

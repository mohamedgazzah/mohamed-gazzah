import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatNumber } from '@/lib/format'

/** A headline number on glass with its label. Links to the records it counts. */
export function StatTile({ value, label, href, icon }: { value: number; label: string; href: string; icon?: ReactNode }) {
  return (
    <Link href={href} className="glass lift hover-icon group flex h-full flex-col rounded-[var(--radius-md)] p-5 text-text no-underline hover:no-underline md:p-6">
      <span className="flex items-center justify-between gap-3 text-accent">
        {icon ? (
          <span className="stat-icon" aria-hidden="true">
            {icon}
          </span>
        ) : (
          <span />
        )}
        <ArrowUpRight aria-hidden="true" size={18} className="text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
      <span data-stat-value="" className="figure mt-4 block text-[clamp(40px,4.2vw,56px)]">
        {formatNumber(value)}
      </span>
      <span data-stat-label="" className="mt-2 block text-[15px] leading-snug font-semibold">
        {label}
      </span>
    </Link>
  )
}

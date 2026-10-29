import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatNumber } from '@/lib/format'

/** A headline number on glass with its label, and an optional line of context. Links to the records it counts. */
export function StatTile({ value, label, href, icon, note }: { value: number; label: string; href: string; icon?: ReactNode; note?: ReactNode }) {
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
        <ArrowRight aria-hidden="true" size={18} className="nudge text-muted" />
      </span>
      <span data-stat-value="" className="figure mt-4 block text-figure">
        {formatNumber(value)}
      </span>
      <span data-stat-label="" className="mt-2 block text-base leading-snug font-semibold">
        {label}
      </span>
      {note ? <span className="mt-1 block text-xs text-muted">{note}</span> : null}
    </Link>
  )
}

import Link from 'next/link'
import { formatNumber } from '@/lib/format'

export type BarRow = { key: string; label: string; value: number; href?: string }

/**
 * Horizontal bars for a ranked list (states, cities, types). One series, so
 * one color and no legend; every value is printed at the end of its bar, and
 * each row opens the matching records.
 */
export function BarList({ rows, label, noun = 'incidents' }: { rows: BarRow[]; label: string; noun?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ol className="bar-list" aria-label={label}>
      {rows.map((r) => {
        const content = (
          <>
            <span className="bar-label">{r.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar" style={{ inlineSize: `${(r.value / max) * 100}%` }} />
            </span>
            <span className="bar-value tabular">
              {formatNumber(r.value)}
              <span className="sr-only"> {noun}</span>
            </span>
          </>
        )
        return (
          <li key={r.key}>
            {r.href ? (
              <Link href={r.href} className="bar-row">
                {content}
              </Link>
            ) : (
              <span className="bar-row">{content}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

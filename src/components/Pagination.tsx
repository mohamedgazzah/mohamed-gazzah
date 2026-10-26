import Link from 'next/link'
import { formatNumber } from '@/lib/format'

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
  const sorted = [...nums].sort((a, b) => a - b)
  return (
    <nav aria-label="Pages" className="mt-6 flex flex-wrap items-center gap-2 text-base">
      {page > 1 ? (
        <Link className="btn btn-secondary" href={hrefFor(page - 1)} rel="prev">
          Previous
        </Link>
      ) : null}
      {sorted.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - sorted[i - 1]! > 1 ? <span aria-hidden="true">…</span> : null}
          {n === page ? (
            <span aria-current="page" className="btn pointer-events-none">
              {formatNumber(n)}
            </span>
          ) : (
            <Link className="btn btn-secondary" href={hrefFor(n)} aria-label={`Page ${n}`}>
              {formatNumber(n)}
            </Link>
          )}
        </span>
      ))}
      {page < pages ? (
        <Link className="btn btn-secondary" href={hrefFor(page + 1)} rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  )
}

import { SOURCE_TYPE_META, type SourceType } from '@/db/enums'
import { formatDate } from '@/lib/format'
import { Tooltip } from './Tooltip'

type Src = { n: number; outlet: string; title: string; url: string; archived_url: string | null; published_date: string | null; source_type: SourceType }

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2.5" width="12" height="3" rx="0.5" />
      <path d="M3 5.5v7.5h10V5.5M6.5 8.5h3" />
    </svg>
  )
}

/** Outlet and date; the title shows on hover or focus. A second link opens the archived copy. */
export function SourceChip({ source, idPrefix }: { source: Src; idPrefix: string }) {
  const tipId = `${idPrefix}-src-${source.n}`
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-control bg-surface ps-2.5 pe-1 text-sm">
      <Tooltip id={tipId} tip={<>“{source.title}” · {SOURCE_TYPE_META[source.source_type].label}</>}>
        <a href={source.url} rel="noopener noreferrer nofollow" target="_blank" aria-describedby={tipId} className="inline-flex min-h-8 items-center gap-1 text-text">
          <span className="font-semibold">{source.outlet}</span>
          {source.published_date ? <span className="text-muted tabular">{formatDate(source.published_date)}</span> : null}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </Tooltip>
      {source.archived_url ? (
        <a
          href={source.archived_url}
          rel="noopener noreferrer nofollow"
          target="_blank"
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-accent"
          aria-label={`Archived copy of “${source.title}” (opens in a new tab)`}
        >
          <ArchiveIcon />
        </a>
      ) : null}
    </span>
  )
}

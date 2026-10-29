import { Archive, ExternalLink } from 'lucide-react'
import { SOURCE_TYPE_META, type SourceType } from '@/db/enums'
import { formatDate } from '@/lib/format'
import { Tooltip } from './Tooltip'

type Src = { n: number; outlet: string; title: string; url: string; archived_url: string | null; published_date: string | null; source_type: SourceType }

/** Outlet and date; the title shows on hover or focus. A second link opens the archived copy. */
export function SourceChip({ source, idPrefix }: { source: Src; idPrefix: string }) {
  const tipId = `${idPrefix}-src-${source.n}`
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-sm">
      <Tooltip id={tipId} tip={<>“{source.title}” · {SOURCE_TYPE_META[source.source_type].label}</>}>
        <a href={source.url} rel="noopener noreferrer nofollow" target="_blank" aria-describedby={tipId} className="inline-flex min-h-7 items-center gap-2 text-text">
          <span className="font-semibold">{source.outlet}</span>
          {source.published_date ? <span className="mono text-muted">{formatDate(source.published_date)}</span> : null}
          <ExternalLink aria-hidden="true" size={14} className="text-muted" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </Tooltip>
      {source.archived_url ? (
        <a
          href={source.archived_url}
          rel="noopener noreferrer nofollow"
          target="_blank"
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-accent transition-colors hover:bg-accent-tint"
          aria-label={`Archived copy of “${source.title}” (opens in a new tab)`}
        >
          <Archive aria-hidden="true" size={16} />
        </a>
      ) : null}
    </span>
  )
}

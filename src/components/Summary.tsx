import { parseSummary } from '@/lib/summary'
import { Highlight } from './Highlight'
import { SourceRef } from './SourceRef'

/** Summary text with numbered source markers linking to the sources list. */
export function Summary({ text, idPrefix = 'source', query }: { text: string; idPrefix?: string; query?: string | null; sources?: unknown[] }) {
  return (
    <>
      {parseSummary(text).map((seg, i) =>
        seg.kind === 'text' ? (
          <Highlight key={i} text={seg.text} query={query} />
        ) : (
          <span key={i} className="ms-0.5">
            {/* A word joiner keeps the marker on the line of the word before it. */}
            {'\u2060'}
            <SourceRef n={seg.n} href={`#${idPrefix}-${seg.n}`} />
          </span>
        ),
      )}
    </>
  )
}

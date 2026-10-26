import { parseSummary } from '@/lib/summary'
import { Highlight } from './Highlight'

/** Summary text with superscript source markers linking to the sources list. */
export function Summary({ text, idPrefix = 'source', query }: { text: string; idPrefix?: string; query?: string | null }) {
  return (
    <>
      {parseSummary(text).map((seg, i) =>
        seg.kind === 'text' ? (
          <Highlight key={i} text={seg.text} query={query} />
        ) : (
          <sup key={i} className="ms-px">
            <a href={`#${idPrefix}-${seg.n}`} aria-label={`Source ${seg.n}`} className="px-px no-underline hover:underline">
              {seg.n}
            </a>
          </sup>
        ),
      )}
    </>
  )
}

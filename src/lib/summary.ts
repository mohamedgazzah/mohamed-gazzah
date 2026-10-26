/**
 * Summaries are 2–4 neutral sentences, each ending in a source marker like
 * [1] or [1][3] that points at the numbered sources list.
 */
export type SummarySegment = { kind: 'text'; text: string } | { kind: 'marker'; n: number }

const MARKER = /\[(\d{1,3})\]/g

export function parseSummary(summary: string): SummarySegment[] {
  const out: SummarySegment[] = []
  let last = 0
  for (const m of summary.matchAll(MARKER)) {
    if (m.index! > last) out.push({ kind: 'text', text: summary.slice(last, m.index) })
    out.push({ kind: 'marker', n: Number(m[1]) })
    last = m.index! + m[0].length
  }
  if (last < summary.length) out.push({ kind: 'text', text: summary.slice(last) })
  return out
}

/** Plain text without markers, for cards, meta descriptions and search. */
export function stripMarkers(summary: string): string {
  return summary.replace(MARKER, '').replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim()
}

export function firstSentence(summary: string): string {
  const plain = stripMarkers(summary)
  const m = /^(.+?[.!?])(\s|$)/.exec(plain)
  return m ? m[1]! : plain
}

/** Split into sentences, keeping trailing markers with the sentence they end. */
export function splitSentences(summary: string): string[] {
  const parts = summary
    .trim()
    .split(/(?<=[.!?](?:\[\d{1,3}\])*)\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts
}

export type SummaryIssue = { kind: 'sentence_without_marker' | 'unknown_source' | 'sentence_count'; detail: string }

/** Checks the review checklist relies on: every sentence cites a source that exists. */
export function lintSummary(summary: string, sourceCount: number): SummaryIssue[] {
  const issues: SummaryIssue[] = []
  const sentences = splitSentences(summary)
  if (sentences.length < 2 || sentences.length > 4) {
    issues.push({ kind: 'sentence_count', detail: `The summary has ${sentences.length} sentence(s); the standard is 2–4.` })
  }
  for (const s of sentences) {
    if (!/(\[\d{1,3}\])+$/.test(s)) {
      issues.push({ kind: 'sentence_without_marker', detail: `No source marker at the end of: “${s.slice(0, 80)}”` })
    }
  }
  for (const m of summary.matchAll(MARKER)) {
    const n = Number(m[1])
    if (n < 1 || n > sourceCount) issues.push({ kind: 'unknown_source', detail: `Marker [${n}] does not match a source.` })
  }
  return issues
}

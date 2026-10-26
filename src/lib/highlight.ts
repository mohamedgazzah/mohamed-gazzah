/**
 * Mark the words in a text that match a search query: exact words, prefixes
 * (vandal → vandalized) and one-letter typos for longer words, mirroring
 * the typo tolerance of the database search.
 */
export type HighlightPart = { text: string; match: boolean }

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export function queryTerms(query: string | null | undefined): string[] {
  if (!query) return []
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/["“”]/g, ' ')
        .split(/[^\p{L}\p{N}'-]+/u)
        .map((t) => t.replace(/^-+/, ''))
        .filter((t) => t.length >= 2 && !['and', 'or', 'the', 'of', 'in', 'at', 'a', 'an'].includes(t)),
    ),
  )
}

function wordMatches(word: string, terms: string[]): boolean {
  const w = word.toLowerCase()
  return terms.some((t) => {
    if (w === t) return true
    if (t.length >= 4 && w.startsWith(t)) return true
    if (t.length >= 5 && w.length >= 5) {
      const stem = w.slice(0, t.length + 1)
      return editDistanceAtMost1(w, t) || editDistanceAtMost1(stem, t) || editDistanceAtMost1(w.slice(0, t.length), t)
    }
    return false
  })
}

export function highlight(text: string, query: string | null | undefined): HighlightPart[] {
  const terms = queryTerms(query)
  if (!terms.length || !text) return [{ text, match: false }]
  const parts: HighlightPart[] = []
  for (const token of text.split(/(\p{L}[\p{L}\p{N}'’-]*)/u)) {
    if (!token) continue
    const match = /^\p{L}/u.test(token) && wordMatches(token, terms)
    const prev = parts[parts.length - 1]
    if (prev && prev.match === match && !match) prev.text += token
    else parts.push({ text: token, match })
  }
  return parts
}

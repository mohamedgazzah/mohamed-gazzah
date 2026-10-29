import { describe, expect, it } from 'vitest'
import { citations } from '@/lib/citations'
import { csvCell, toCsv } from '@/lib/csv'
import { formatDate, formatDateRange, formatTimestamp, isoTimestamp } from '@/lib/format'
import { highlight, queryTerms } from '@/lib/highlight'
import { parseRecordParam, slugify } from '@/lib/slug'
import { firstSentence, lintSummary, parseSummary, splitSentences, stripMarkers } from '@/lib/summary'

describe('summaries and source markers', () => {
  const s = 'Police said the van was damaged.[1] A man was charged.[2][3] He pleaded not guilty.[3]'
  it('parses markers into segments', () => {
    expect(parseSummary(s).filter((x) => x.kind === 'marker').map((x) => (x as { n: number }).n)).toEqual([1, 2, 3, 3])
  })
  it('strips markers for plain text', () => {
    expect(stripMarkers(s)).toBe('Police said the van was damaged. A man was charged. He pleaded not guilty.')
    expect(firstSentence(s)).toBe('Police said the van was damaged.')
  })
  it('splits sentences keeping trailing markers', () => {
    expect(splitSentences(s)).toHaveLength(3)
  })
  it('flags sentences without a source and unknown sources', () => {
    expect(lintSummary(s, 3)).toEqual([])
    const issues = lintSummary('One sentence without a source. Another one.[4]', 3)
    expect(issues.map((i) => i.kind).sort()).toEqual(['sentence_without_marker', 'unknown_source'])
    expect(lintSummary('Only one.[1]', 1).map((i) => i.kind)).toEqual(['sentence_count'])
  })
})

describe('formatting', () => {
  it('formats dates by precision without time-zone drift', () => {
    expect(formatDate('2026-01-01')).toBe('Jan. 1, 2026')
    expect(formatDate('2026-03-15', 'month')).toBe('March 2026')
    expect(formatDate('2026-03-15', 'year')).toBe('2026')
    expect(formatDateRange('2026-08-01', '2026-08-02')).toBe('Aug. 1–2, 2026')
    expect(formatDateRange('2026-08-30', '2026-09-02')).toBe('Aug. 30 – Sept. 2, 2026')
    expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('Dec. 30, 2025 – Jan. 2, 2026')
    expect(formatDateRange('2026-06-01', '2026-07-31', 'month')).toBe('June–July 2026')
    expect(formatDateRange('2026-06-01', '2026-06-30', 'month')).toBe('June 2026')
    expect(formatDateRange('2025-01-01', '2026-12-31', 'year')).toBe('2025–2026')
  })
  it('normalizes Postgres timestamps', () => {
    expect(isoTimestamp('2026-10-26 03:36:38.766+00')).toBe('2026-10-26T03:36:38.766Z')
  })
  it('dates timestamps on the US Eastern calendar, like "today"', () => {
    // 01:30 UTC on Oct. 27 is still the evening of Oct. 26 in New York.
    expect(formatTimestamp('2026-10-27 01:30:00+00')).toBe('Oct. 26, 2026')
    expect(formatTimestamp('2026-10-27T15:00:00Z')).toBe('Oct. 27, 2026')
    expect(formatTimestamp(new Date('2027-01-01T04:59:00Z'))).toBe('Dec. 31, 2026')
    expect(formatTimestamp(null)).toBe('')
  })
})

describe('slugs and record ids', () => {
  it('slugifies titles', () => {
    expect(slugify('Man charged with hate crime after threats at Des Plaines park')).toBe('man-charged-with-hate-crime-after-threats-at-des-plaines-park')
    expect(slugify('Qur’an burned — mosque in São Paulo?')).toBe('quran-burned-mosque-in-sao-paulo')
    expect(slugify('!!!')).toBe('record')
  })
  it('splits id and slug from the URL segment', () => {
    expect(parseRecordParam('US-2026-0412-man-charged')).toEqual({ id: 'US-2026-0412', slug: 'man-charged' })
    expect(parseRecordParam('US-2026-0412')).toEqual({ id: 'US-2026-0412', slug: null })
    expect(parseRecordParam('../../etc')).toBeNull()
  })
})

describe('search highlighting', () => {
  it('marks exact, prefix and one-typo matches', () => {
    const parts = highlight('Graffiti was found on the mosque wall; vandalized again.', 'grafiti mosque vandal')
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(['Graffiti', 'mosque', 'vandalized'])
    expect(queryTerms('the "mosque" and a fire')).toEqual(['mosque', 'fire'])
  })
})

describe('CSV', () => {
  it('quotes, joins lists, JSON-encodes nested values and blocks formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(['VAND', 'THRT'])).toBe('VAND; THRT')
    expect(csvCell([{ n: 1 }])).toBe('"[{""n"":1}]"')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell(-83.2)).toBe('-83.2')
    expect(csvCell(null)).toBe('')
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n')
  })
})

describe('citations', () => {
  it('produces APA, Chicago and BibTeX', () => {
    const c = citations({ id: 'US-2026-0412', slug: 'man-charged', title: 'Man charged after threats', updatedAt: '2026-10-26T10:00:00Z' }, '2026-10-27')
    expect(c.url).toMatch(/\/incidents\/US-2026-0412-man-charged$/)
    expect(c.apa).toContain('(2026, October 26). Man charged after threats (Record US-2026-0412).')
    expect(c.chicago).toContain('Accessed October 27, 2026.')
    expect(c.bibtex).toMatch(/^@misc\{record_US20260412,/)
  })
})

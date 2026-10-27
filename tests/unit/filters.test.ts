import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, activePreset, chips, datePresets, describeDates, explorePath, normalizeIncomingQuery, parseFilters, parseViewState, serializeFilters } from '@/lib/filters'

const parse = (qs: string) => parseFilters(new URLSearchParams(qs))

describe('URL filters', () => {
  it('parses the example URL from the specification', () => {
    const f = parse('state=MI&type=VAND,THRT&from=2026-01-01&v=2,3')
    expect(f.state).toEqual(['MI'])
    expect(f.type).toEqual(['THRT', 'VAND'])
    expect(f.from).toBe('2026-01-01')
    expect(f.v).toEqual(['V2', 'V3'])
  })

  it('writes one canonical form: fixed key order, taxonomy order, defaults omitted', () => {
    const a = serializeFilters(parse('v=3,2&type=VAND&type=THRT&from=2026-01-01&state=mi'))
    const b = serializeFilters(parse('state=MI&from=2026-01-01&type=THRT,VAND'))
    expect(a).toBe('from=2026-01-01&state=MI&type=THRT,VAND')
    expect(b).toBe(a)
  })

  it('round-trips every filter', () => {
    const qs = 'q=mosque%20fire&from=2025-01-01&to=2026-06-30&state=CA,MI&city=Dearborn&type=ARSN&target=mosque_islamic_center&sev=4,5&v=1,2,3&status=charged,in_court&perp=individual&src=police&hc=yes'
    const f = parse(qs)
    expect(serializeFilters(f)).toBe(qs)
    expect(parse(serializeFilters(f))).toEqual(f)
  })

  it('drops unknown values instead of failing', () => {
    const f = parse('type=XXX,VAND&state=ZZ&sev=9&v=7&status=nope&from=2026-13-40')
    expect(f).toEqual({ ...EMPTY_FILTERS, type: ['VAND'] })
  })

  it('swaps a reversed date range', () => {
    const f = parse('from=2026-05-01&to=2026-01-01')
    expect([f.from, f.to]).toEqual(['2026-01-01', '2026-05-01'])
  })

  it('keeps commas in free-text search', () => {
    expect(parse('q=Springfield,%20IL').q).toBe('Springfield, IL')
  })

  it('omits view defaults and keeps others', () => {
    expect(serializeFilters(EMPTY_FILTERS, { sort: 'newest', page: 1, view: 'table' })).toBe('')
    expect(serializeFilters(EMPTY_FILTERS, { sort: 'oldest', page: 3, view: 'cards' })).toBe('sort=oldest&view=cards&page=3')
    expect(parseViewState(new URLSearchParams('page=-2&sort=bogus&view=cards'))).toEqual({ sort: 'newest', page: 1, view: 'cards' })
    // The map is always shown now; old view=map links fall back to the default list.
    expect(parseViewState(new URLSearchParams('view=map')).view).toBe('table')
  })

  it('offers date presets that end today and recognizes them', () => {
    const presets = datePresets('2026-10-26')
    expect(presets.map((p) => [p.key, p.from, p.to])).toEqual([
      ['all', null, null],
      ['year', '2026-01-01', '2026-10-26'],
      ['12m', '2025-10-27', '2026-10-26'],
      ['30d', '2026-09-27', '2026-10-26'],
    ])
    expect(activePreset({ from: '2026-09-27', to: '2026-10-26' }, '2026-10-26')?.key).toBe('30d')
    expect(activePreset({ from: null, to: null }, '2026-10-26')?.key).toBe('all')
    expect(activePreset({ from: '2026-02-01', to: null }, '2026-10-26')).toBeNull()
    expect(describeDates({ from: '2026-09-27', to: '2026-10-26' }, '2026-10-26')).toBe('the last 30 days')
    expect(describeDates({ from: '2026-02-01', to: null }, '2026-10-26')).toBe('Feb. 1, 2026 to today')
  })

  it('detects non-canonical incoming queries', () => {
    const sp = { type: ['VAND', 'THRT'], v: '2,3' }
    expect(normalizeIncomingQuery(sp)).not.toBe(serializeFilters(parseFilters(sp)))
    const canonical = new URLSearchParams(serializeFilters(parseFilters(sp)))
    expect(normalizeIncomingQuery(canonical)).toBe(serializeFilters(parseFilters(canonical)))
  })

  it('gives each active filter a chip that removes only that value', () => {
    const f = parse('type=VAND,THRT&state=MI')
    const list = chips(f)
    expect(list.map((c) => c.label)).toEqual(['Michigan', 'Threat', 'Vandalism'])
    expect(list.find((c) => c.label === 'Threat')?.removeHref).toBe('/incidents?state=MI&type=VAND')
    expect(explorePath()).toBe('/incidents')
  })
})

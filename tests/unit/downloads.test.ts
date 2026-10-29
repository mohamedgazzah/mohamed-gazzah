import { describe, expect, it } from 'vitest'
import { downloadScope } from '@/app/(public)/incidents/download/scope'
import { parseFilters } from '@/lib/filters'

const scope = (qs: string) => downloadScope(parseFilters(new URLSearchParams(qs)))

describe('download file names', () => {
  it('say which records a file holds, in the words the Data page labels use', () => {
    expect(scope('')).toBe('verified')
    expect(scope('v=2,3')).toBe('verified')
    expect(scope('v=1,2,3')).toBe('all')
  })
  it('call any other selection "results", so it is never mistaken for the full set', () => {
    expect(scope('state=MI')).toBe('results')
    expect(scope('state=MI&v=1,2,3')).toBe('results')
    expect(scope('v=1')).toBe('results')
    expect(scope('v=3')).toBe('results')
  })
})

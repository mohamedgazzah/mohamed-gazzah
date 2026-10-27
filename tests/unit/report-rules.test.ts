import { describe, expect, it } from 'vitest'
import { MAX_LENGTH, linksProblem, splitLinks, tooLong, whatHappenedMessage } from '@/lib/report-rules'

describe('report form rules', () => {
  it('reads links one per line or pasted as a list, without the punctuation after them', () => {
    expect(splitLinks('www.freep.com/a, www.wxyz.com/b')).toEqual(['https://www.freep.com/a', 'https://www.wxyz.com/b'])
    expect(splitLinks('https://a.org/x,https://b.org/y\nfreep.com/story.')).toEqual(['https://a.org/x', 'https://b.org/y', 'https://freep.com/story'])
    // A comma inside an address is part of it.
    expect(splitLinks('https://en.wikipedia.org/wiki/Dearborn,_Michigan')).toEqual(['https://en.wikipedia.org/wiki/Dearborn,_Michigan'])
    expect(linksProblem('www.freep.com/a, www.wxyz.com/b')).toBeNull()
    expect(linksProblem('see the news story')).not.toBeNull()
  })

  it('asks for the account when the box is empty, and for a little more when it is short', () => {
    expect(whatHappenedMessage('report', 0)).toMatch(/^Tell us what happened\./)
    expect(whatHappenedMessage('report', 9)).toMatch(/^Tell us a little more\./)
    expect(whatHappenedMessage('correction', 0)).toBe(whatHappenedMessage('correction', 9))
  })

  it('says where to send the rest of an account that is too long', () => {
    expect(tooLong(5400, MAX_LENGTH.whatHappened, 'editors@example.org')).toBe(
      'That’s 5,400 characters; the limit is 5,000. Shorten it, or email the rest to editors@example.org.',
    )
    expect(tooLong(120, MAX_LENGTH.city)).toMatch(/send the rest by email\.$/)
  })
})

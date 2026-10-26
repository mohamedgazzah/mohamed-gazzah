import { describe, expect, it } from 'vitest'
import { decryptBytes, decryptText, encryptBytes, encryptText } from '@/lib/crypto'
import { hashPassword, passwordProblems, verifyPassword } from '@/lib/passwords'
import { base32Decode, base32Encode, totpAt, verifyTotp } from '@/lib/totp'
import { isPrivateAddress, parseMetadata } from '@/server/admin/source-metadata'

process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
process.env.SUBMISSIONS_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64')

describe('TOTP (RFC 6238 test vectors)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'))
  it('matches the published SHA-1 vectors', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(totpAt(secret, Math.floor(59 / 30))).toBe('287082')
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe('081804')
    expect(totpAt(secret, Math.floor(1234567890 / 30))).toBe('005924')
  })
  it('accepts the adjacent step and rejects reuse', () => {
    const now = 1111111109 * 1000
    const step = verifyTotp(secret, '081804', { now })
    expect(step).toBe(Math.floor(1111111109 / 30))
    expect(verifyTotp(secret, '081804', { now, lastStep: step })).toBeNull()
    expect(verifyTotp(secret, '000000', { now })).toBeNull()
    expect(verifyTotp(secret, 'abc', { now })).toBeNull()
  })
  it('base32 round-trips', () => {
    const b = Buffer.from([1, 2, 3, 250, 251, 252, 253])
    expect(base32Decode(base32Encode(b))).toEqual(b)
  })
})

describe('encryption at rest', () => {
  it('round-trips text and files, and detects tampering or the wrong context', () => {
    const t = encryptText('pat@example.com', 'SUBMISSIONS_ENCRYPTION_KEY', 'contact:1')
    expect(t).not.toContain('pat')
    expect(decryptText(t, 'SUBMISSIONS_ENCRYPTION_KEY', 'contact:1')).toBe('pat@example.com')
    expect(() => decryptText(t, 'SUBMISSIONS_ENCRYPTION_KEY', 'contact:2')).toThrow()
    expect(() => decryptText(t, 'APP_ENCRYPTION_KEY', 'contact:1')).toThrow()
    const tampered = t.slice(0, -2) + (t.endsWith('A') ? 'BB' : 'AA')
    expect(() => decryptText(tampered, 'SUBMISSIONS_ENCRYPTION_KEY', 'contact:1')).toThrow()
    const bytes = encryptBytes(Buffer.from('file'), 'SUBMISSIONS_ENCRYPTION_KEY', 'k')
    expect(decryptBytes(bytes, 'SUBMISSIONS_ENCRYPTION_KEY', 'k').toString()).toBe('file')
  })
  it('refuses a key of the wrong length', () => {
    const saved = process.env.APP_ENCRYPTION_KEY
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64')
    expect(() => encryptText('x', 'APP_ENCRYPTION_KEY')).toThrow(/32 bytes/)
    process.env.APP_ENCRYPTION_KEY = saved
  })
})

describe('passwords', () => {
  it('hashes with scrypt and verifies', async () => {
    const h = await hashPassword('correct horse battery staple')
    expect(h.startsWith('scrypt$32768$8$1$')).toBe(true)
    expect(await verifyPassword('correct horse battery staple', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
    expect(passwordProblems('short')).not.toHaveLength(0)
  })
})

describe('source metadata fetcher', () => {
  it('blocks private and loopback addresses (SSRF)', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0']) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']) expect(isPrivateAddress(ip), ip).toBe(false)
  })
  it('reads title, outlet, author and date from page metadata', () => {
    const html = `<html><head><title>Fallback &amp; title</title>
      <meta property="og:title" content="Man charged after threats &#8212; police">
      <meta property="og:site_name" content="Daily Example">
      <meta name="author" content="A. Reporter">
      <meta property="article:published_time" content="2026-08-04T10:00:00Z"></head></html>`
    expect(parseMetadata(html, new URL('https://www.example.com/a'))).toEqual({
      title: 'Man charged after threats — police',
      outlet: 'Daily Example',
      author: 'A. Reporter',
      publishedDate: '2026-08-04',
    })
    expect(parseMetadata('<title>Only</title>', new URL('https://www.example.com/a'))).toEqual({ title: 'Only', outlet: 'example.com', author: null, publishedDate: null })
  })
})

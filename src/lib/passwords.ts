/** scrypt password hashing: "scrypt$N$r$p$salt$hash". */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>

const N = 32768
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 128 * 1024 * 1024

export const MIN_PASSWORD_LENGTH = 12

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function passwordProblems(password: string, email?: string): string[] {
  const problems: string[] = []
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  if (email && password.toLowerCase().includes(email.split('@')[0]!.toLowerCase())) {
    problems.push('Do not include your email name in the password.')
  }
  if (/^(.)\1+$/.test(password)) problems.push('Do not repeat one character.')
  return problems
}

/** Random temporary password for new accounts, shown once. */
export function temporaryPassword(): string {
  return randomBytes(15).toString('base64url')
}

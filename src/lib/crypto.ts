/**
 * Encryption at rest (AES-256-GCM) and hashing helpers. Server only.
 *
 * Two keys, so a leak of one does not expose the other:
 *   APP_ENCRYPTION_KEY          admin TOTP secrets
 *   SUBMISSIONS_ENCRYPTION_KEY  submitter contact details, addresses, files
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export type KeyName = 'APP_ENCRYPTION_KEY' | 'SUBMISSIONS_ENCRYPTION_KEY' | 'RATE_LIMIT_SECRET'

function keyBytes(name: KeyName): Buffer {
  const raw = process.env[name]
  if (!raw) throw new Error(`${name} is not set`)
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded (openssl rand -base64 32)`)
  return key
}

const FILE_MAGIC = Buffer.from('RC1')

function seal(plain: Buffer, name: KeyName, aad?: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(name), iv)
  if (aad) cipher.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([cipher.update(plain), cipher.final()])
  return { iv, tag: cipher.getAuthTag(), ct }
}

function open(iv: Buffer, tag: Buffer, ct: Buffer, name: KeyName, aad?: string): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(name), iv)
  if (aad) decipher.setAAD(Buffer.from(aad))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

/** Encrypt a string to "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encryptText(plain: string, name: KeyName, aad?: string): string {
  const { iv, tag, ct } = seal(Buffer.from(plain, 'utf8'), name, aad)
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.')
}

export function decryptText(token: string, name: KeyName, aad?: string): string {
  const [v, iv, tag, ct] = token.split('.')
  if (v !== 'v1' || !iv || !tag || ct === undefined) throw new Error('Unrecognized ciphertext')
  return open(Buffer.from(iv, 'base64url'), Buffer.from(tag, 'base64url'), Buffer.from(ct, 'base64url'), name, aad).toString('utf8')
}

/** Encrypt file bytes: "RC1" | iv(12) | tag(16) | ciphertext. */
export function encryptBytes(plain: Buffer, name: KeyName, aad?: string): Buffer {
  const { iv, tag, ct } = seal(plain, name, aad)
  return Buffer.concat([FILE_MAGIC, iv, tag, ct])
}

export function decryptBytes(blob: Buffer, name: KeyName, aad?: string): Buffer {
  if (!blob.subarray(0, 3).equals(FILE_MAGIC)) throw new Error('Unrecognized encrypted file')
  return open(blob.subarray(3, 15), blob.subarray(15, 31), blob.subarray(31), name, aad)
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

export function hmacHex(name: KeyName, data: string): string {
  return createHmac('sha256', keyBytes(name)).update(data).digest('hex')
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/**
 * Private evidence storage. Files are encrypted before they leave the app,
 * so the bucket only ever holds ciphertext. Two drivers:
 *   local  .data/uploads (development and tests)
 *   s3     any private S3-compatible bucket (Supabase Storage, R2, AWS S3)
 */
import 'server-only'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AwsClient } from 'aws4fetch'

function driver(): 'local' | 's3' {
  return process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local'
}

function localPath(key: string): string {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes('..')) throw new Error('Invalid storage key')
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_LOCAL_DIR ?? '.data/uploads', key)
}

function s3() {
  const endpoint = process.env.S3_ENDPOINT
  const bucket = process.env.S3_BUCKET
  if (!endpoint || !bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error('S3 storage is not configured (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)')
  }
  const client = new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION ?? 'auto',
    service: 's3',
  })
  const url = (key: string) => `${endpoint.replace(/\/$/, '')}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
  return { client, url }
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  if (driver() === 'local') {
    const p = localPath(key)
    await mkdir(/* turbopackIgnore: true */ path.dirname(p), { recursive: true })
    await writeFile(/* turbopackIgnore: true */ p, body, { mode: 0o600 })
    return
  }
  const { client, url } = s3()
  const res = await client.fetch(url(key), { method: 'PUT', body: new Uint8Array(body), headers: { 'Content-Type': 'application/octet-stream' } })
  if (!res.ok) throw new Error(`Storage upload failed: ${res.status}`)
}

export async function getObject(key: string): Promise<Buffer> {
  // The local driver is for development; the path is runtime-configured, so keep it out of build tracing.
  if (driver() === 'local') return readFile(/* turbopackIgnore: true */ localPath(key))
  const { client, url } = s3()
  const res = await client.fetch(url(key))
  if (!res.ok) throw new Error(`Storage download failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function deleteObject(key: string): Promise<void> {
  if (driver() === 'local') {
    await rm(/* turbopackIgnore: true */ localPath(key), { force: true })
    return
  }
  const { client, url } = s3()
  const res = await client.fetch(url(key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed: ${res.status}`)
}

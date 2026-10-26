import 'server-only'
import { headers } from 'next/headers'

/** Client IP as reported by the edge (Cloudflare, then Vercel). Used only to derive HMAC rate-limit keys. */
export async function clientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-real-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

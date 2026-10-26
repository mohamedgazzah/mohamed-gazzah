import 'server-only'
import { sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { hmacHex } from '@/lib/crypto'

/**
 * Fixed-window rate limit in Postgres, shared by every server instance.
 * The identifier (usually an IP) is HMAC'd; raw IPs are never stored.
 */
export async function rateLimit(bucket: string, identifier: string, limit: number, windowSeconds: number) {
  const key = `${bucket}:${hmacHex('RATE_LIMIT_SECRET', identifier).slice(0, 32)}`
  const windowStart = new Date(Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds * 1000)
  const result = await adminDb().execute<{ count: number }>(sql`
    INSERT INTO record.rate_limits (key, window_start, count) VALUES (${key}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = record.rate_limits.count + 1
    RETURNING count`)
  const used = Number(result.rows[0]?.count ?? 1)
  if (Math.random() < 0.02) {
    await adminDb().execute(sql`DELETE FROM record.rate_limits WHERE window_start < now() - interval '2 days'`)
  }
  return { ok: used <= limit, remaining: Math.max(0, limit - used) }
}

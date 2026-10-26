import 'server-only'
import { safeEqual } from '@/lib/crypto'

/** Scheduled jobs send `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this automatically). */
export function authorizedJob(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return safeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
}

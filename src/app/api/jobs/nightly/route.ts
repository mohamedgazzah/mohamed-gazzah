import { authorizedJob } from '@/server/jobs/auth'
import { archivePending } from '@/server/jobs/archive'
import { buildRelease } from '@/server/jobs/export'
import { runRetention } from '@/server/jobs/retention'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** One daily entry point (Vercel's free plan allows few cron jobs): release, retention, an archive pass. */
export async function GET(request: Request) {
  if (!authorizedJob(request)) return new Response('Unauthorized', { status: 401 })
  const release = await buildRelease()
  const retention = await runRetention()
  const archive = await archivePending({ limit: 25 })
  return Response.json({ ok: true, job: 'nightly', release, retention, archive })
}

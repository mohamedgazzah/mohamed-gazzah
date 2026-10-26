import { authorizedJob } from '@/server/jobs/auth'
import { runRetention } from '@/server/jobs/retention'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizedJob(request)) return new Response('Unauthorized', { status: 401 })
  const result = await runRetention()
  return Response.json({ ok: true, job: 'retention', ...result })
}

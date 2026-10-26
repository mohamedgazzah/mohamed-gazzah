import { authorizedJob } from '@/server/jobs/auth'
import { archivePending } from '@/server/jobs/archive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizedJob(request)) return new Response('Unauthorized', { status: 401 })
  const result = await archivePending({ limit: 25 })
  return Response.json({ ok: true, job: 'archive', ...result })
}

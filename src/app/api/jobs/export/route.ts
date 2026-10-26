import { authorizedJob } from '@/server/jobs/auth'
import { buildRelease } from '@/server/jobs/export'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizedJob(request)) return new Response('Unauthorized', { status: 401 })
  const result = await buildRelease()
  return Response.json({ ok: true, job: 'export', ...result })
}

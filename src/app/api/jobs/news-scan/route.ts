import { authorizedJob } from '@/server/jobs/auth'
import { runNewsScan } from '@/server/jobs/news/scan'

export const dynamic = 'force-dynamic'
// Five minutes: the most Vercel's free plan allows (with its default fluid compute).
export const maxDuration = 300

/**
 * The morning news scan (src/server/jobs/news/scan.ts). `?collect=0` skips
 * fetching the feeds and only reads articles still waiting from earlier.
 */
export async function GET(request: Request) {
  if (!authorizedJob(request)) return new Response('Unauthorized', { status: 401 })
  const collect = new URL(request.url).searchParams.get('collect') !== '0'
  const result = await runNewsScan({ collect, deadline: Date.now() + 270_000 })
  // A run that could reach no source at all reports failure, so the scheduler shows it.
  return Response.json({ ok: !result.allFeedsFailed, job: 'news-scan', ...result }, { status: result.allFeedsFailed ? 502 : 200 })
}

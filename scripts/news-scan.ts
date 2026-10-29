/**
 * Run the morning news scan once from the command line, to completion:
 *   npm run news:scan
 * Uses DATABASE_URL and, if set, ANTHROPIC_API_KEY from .env. The same scan
 * runs every morning from /api/jobs/news-scan (vercel.json).
 */
import { loadEnv } from './lib/env'

loadEnv()
const { runNewsScan } = await import('@/server/jobs/news/scan')
const result = await runNewsScan({ deadline: Date.now() + 30 * 60_000 })
console.log(JSON.stringify(result, null, 2))
process.exit(0)

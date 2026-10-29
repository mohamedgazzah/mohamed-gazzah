import type { NextRequest } from 'next/server'
import { parseFilters } from '@/lib/filters'
import { todayIso } from '@/lib/format'
import { exportRows, rowsToCsv } from '@/server/public/export'
import { downloadScope } from './scope'

/** "Download these results": the current Explore filters as CSV. */
export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams)
  const csv = rowsToCsv(await exportRows(filters))
  // Named for what it holds, as the Data page's labels are: record-verified-…, record-all-… or record-results-….
  const name = `record-${downloadScope(filters)}-${todayIso()}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

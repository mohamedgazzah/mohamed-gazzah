import type { NextRequest } from 'next/server'
import { parseFilters } from '@/lib/filters'
import { todayIso } from '@/lib/format'
import { exportRows, rowsToCsv } from '@/server/public/export'

/** "Download these results": the current Explore filters as CSV. */
export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams)
  const csv = rowsToCsv(await exportRows(filters))
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="record-results-${todayIso()}.csv"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

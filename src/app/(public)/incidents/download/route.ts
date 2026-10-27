import type { NextRequest } from 'next/server'
import { EMPTY_FILTERS, parseFilters, serializeFilters } from '@/lib/filters'
import { todayIso } from '@/lib/format'
import { exportRows, rowsToCsv } from '@/server/public/export'

/** "Download these results": the current Explore filters as CSV. */
export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams)
  const csv = rowsToCsv(await exportRows(filters))
  // Named for what it holds: every published record ("all"), every verified one (the site's counts), or a filtered set.
  const unfiltered = serializeFilters({ ...filters, v: EMPTY_FILTERS.v }) === ''
  const kind = !unfiltered ? 'results' : filters.v.length === 3 ? 'all' : serializeFilters(filters) === '' ? 'verified' : 'results'
  const name = `record-${kind}-${todayIso()}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

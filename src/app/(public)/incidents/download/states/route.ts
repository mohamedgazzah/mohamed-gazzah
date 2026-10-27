import type { NextRequest } from 'next/server'
import { toCsv } from '@/lib/csv'
import { parseFilters } from '@/lib/filters'
import { todayIso } from '@/lib/format'
import { US_STATES } from '@/lib/states'
import { countsByState } from '@/server/public/stats'
import { downloadScope } from '../scope'

/** "Totals by state": the current Explore filters, one row per state and territory. */
export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams)
  const counts = await countsByState(filters)
  const csv = toCsv(
    ['state_code', 'state_name', 'state_fips', 'records'],
    US_STATES.map((s) => [s.code, s.name, s.fips, counts[s.code] ?? 0]),
  )
  // Named for its scope like the records file, so totals from two files are never mixed up.
  const name = `record-${downloadScope(filters)}-totals-by-state-${todayIso()}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

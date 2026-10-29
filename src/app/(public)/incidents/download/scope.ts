import { PUBLIC_VERIFICATION_LEVELS } from '@/db/enums'
import { EMPTY_FILTERS, serializeFilters, type Filters } from '@/lib/filters'

/**
 * The word a download's file name uses for what it holds: every published
 * record ("all"), every verified one, as the site counts ("verified"), or a
 * filtered set ("results").
 */
export function downloadScope(filters: Filters): 'all' | 'verified' | 'results' {
  if (serializeFilters({ ...filters, v: EMPTY_FILTERS.v }) !== '') return 'results'
  if (filters.v.length === PUBLIC_VERIFICATION_LEVELS.length) return 'all'
  return serializeFilters(filters) === '' ? 'verified' : 'results'
}

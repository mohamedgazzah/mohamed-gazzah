import 'server-only'
import { cache } from 'react'
import { lastUpdated } from './incidents'

/** Footer timestamp. A database outage must never break page rendering. */
export const lastUpdatedSafe = cache(async (): Promise<string | null> => {
  try {
    return await lastUpdated()
  } catch (err) {
    console.error('[site-status] could not read last update time', (err as Error).message)
    return null
  }
})

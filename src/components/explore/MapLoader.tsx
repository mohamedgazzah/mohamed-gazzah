'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type ExploreMapType from './ExploreMap'

// MapLibre is large and browser-only: load it only when the map view is open.
const ExploreMap = dynamic(() => import('./ExploreMap'), {
  ssr: false,
  loading: () => <div className="card flex h-[60vh] min-h-80 items-center justify-center text-muted">Loading map…</div>,
})

export function MapLoader(props: ComponentProps<typeof ExploreMapType>) {
  return <ExploreMap {...props} />
}

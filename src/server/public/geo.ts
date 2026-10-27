/**
 * The state map's geography (scripts/build-geo.mjs, from us-atlas: US Census
 * Bureau boundaries). Shapes are SVG sprites in public/geo/<version>/, drawn
 * with <use>, so pages carry references rather than path data. Cities are
 * placed with the projection the shapes were made with: d3.geoAlbersUsa at
 * scale 1300 in a 975 × 610 frame, Alaska and Hawaii inset. Territories fall
 * outside it and are listed instead.
 */
import 'server-only'
import { geoAlbersUsa } from 'd3-geo'
import us from '@/geo/us-states.json'
import { US_STATES } from '@/lib/states'

export type StateShape = { fips: string; code: string; name: string; bbox: [number, number, number, number]; href: string }

const codeByFips = new Map(US_STATES.map((s) => [s.fips, s.code]))

export const MAP_WIDTH = us.width
export const MAP_HEIGHT = us.height
export const STATE_SHAPES: StateShape[] = us.states.map((s) => ({
  fips: s.fips,
  name: s.name,
  code: codeByFips.get(s.fips)!,
  bbox: s.bbox as [number, number, number, number],
  href: `${us.base}/us-states.svg#s-${s.fips}`,
}))
const shapeByCode = new Map(STATE_SHAPES.map((s) => [s.code, s]))

export function stateShape(code: string): StateShape | undefined {
  return shapeByCode.get(code)
}

/** The sprite with a state's outline (#outline) and county lines (#counties). */
export function stateDetailHref(code: string): string | null {
  const shape = shapeByCode.get(code)
  return shape ? `${us.base}/states/${shape.fips}.svg` : null
}

/** States and territories that are not drawn on the map. */
export const UNMAPPED_STATES = US_STATES.filter((s) => !shapeByCode.has(s.code))

const projection = geoAlbersUsa().scale(1300).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])

/** Map position of a longitude/latitude, or null outside the map (territories). */
export function project(lng: number, lat: number): [number, number] | null {
  const p = projection([lng, lat])
  return p ? [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100] : null
}

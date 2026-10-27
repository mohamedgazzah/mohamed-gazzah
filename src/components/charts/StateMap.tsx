import Link from 'next/link'
import { bubbleRadius, frameAround, mapClasses, stepFor } from '@/lib/choropleth'
import { plural } from '@/lib/format'
import { MAP_HEIGHT, MAP_WIDTH, STATE_SHAPES, UNMAPPED_STATES, project, stateDetailHref, stateShape } from '@/server/public/geo'
import type { CityCount } from '@/server/public/stats'
import { ChartTips } from './ChartTips'
import { MapFrame } from './MapFrame'

/** A state the map is zoomed into, with its cities. */
export type MapFocus = {
  code: string
  name: string
  cities: CityCount[]
  cityHref: (city: string) => string
  selectedCity?: string | null
}

// The map's usual width on screen, for sizing bubbles and labels in map units.
const FRAME_PX = 900

type Box = [number, number, number, number]
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

/**
 * Incidents by state: a choropleth of the counts, five classes on the
 * --chart-seq ramp, zero drawn empty. Each state links to the same filters
 * narrowed to that state, where the map zooms in and shows cities as circles
 * sized by area. The map is a picture for sighted readers; the totals are
 * also in the table that goes with it.
 */
export function StateMap({
  counts,
  stateHref,
  focus,
  noun = 'incident',
}: {
  counts: Record<string, number>
  stateHref: (code: string) => string
  focus?: MapFocus | null
  noun?: string
}) {
  const shape = focus ? stateShape(focus.code) : undefined
  const detail = focus ? stateDetailHref(focus.code) : null
  const viewBox = shape ? frameAround(shape.bbox) : ([0, 0, MAP_WIDTH, MAP_HEIGHT] as const)
  const unit = viewBox[2] / FRAME_PX
  const classes = mapClasses(Math.max(0, ...Object.values(counts)))

  const placed = (focus?.cities ?? [])
    .map((c) => ({ c, p: project(c.lng, c.lat) }))
    .filter((x): x is { c: CityCount; p: [number, number] } => x.p !== null)
    .sort((a, b) => b.c.count - a.c.count)
  const maxCity = Math.max(0, ...placed.map((x) => x.c.count))

  // Name the largest few cities, skipping any label that would collide.
  const labels: { x: number; y: number; text: string; anchor: 'start' | 'end' }[] = []
  const taken: Box[] = placed.map(({ c, p }) => {
    const r = bubbleRadius(c.count, maxCity) * unit
    return [p[0] - r, p[1] - r, p[0] + r, p[1] + r]
  })
  const fontSize = 12.5 * unit
  for (const { c, p } of placed.slice(0, 10)) {
    if (labels.length === 5) break
    const r = bubbleRadius(c.count, maxCity) * unit
    const width = c.city.length * fontSize * 0.56
    const right = p[0] + r + 3 * unit + width < viewBox[0] + viewBox[2]
    const x = right ? p[0] + r + 3 * unit : p[0] - r - 3 * unit
    const box: Box = right ? [x, p[1] - fontSize * 0.7, x + width, p[1] + fontSize * 0.5] : [x - width, p[1] - fontSize * 0.7, x, p[1] + fontSize * 0.5]
    if (taken.some((t) => overlaps(t, box) && !(t[0] <= p[0] && p[0] <= t[2] && t[1] <= p[1] && p[1] <= t[3]))) continue
    taken.push(box)
    labels.push({ x, y: p[1] + fontSize * 0.35, text: c.city, anchor: right ? 'start' : 'end' })
  }

  const unmapped = UNMAPPED_STATES.filter((s) => (counts[s.code] ?? 0) > 0)

  return (
    <figure className="state-map">
      <ChartTips>
        <MapFrame viewBox={viewBox.join(' ')}>
          <g className="map-states">
            {STATE_SHAPES.map((s) => {
              const n = counts[s.code] ?? 0
              const fill = focus ? (s.code === focus.code ? 'map-fill-focus' : 'map-fill-context') : `map-fill-${stepFor(n, classes)}`
              return (
                <a key={s.code} href={stateHref(s.code)} tabIndex={-1} data-state={s.code} data-tip={s.name} data-tip-value={focus && s.code !== focus.code ? '' : plural(n, noun)}>
                  <use href={s.href} className={fill} />
                </a>
              )
            })}
          </g>
          {detail ? (
            <g pointerEvents="none">
              <use href={`${detail}#counties`} className="map-counties" />
              <use href={`${detail}#outline`} className="map-outline" />
            </g>
          ) : null}
          {placed.length ? (
            <g className="map-bubbles">
              {placed.map(({ c, p }) => {
                const r = bubbleRadius(c.count, maxCity) * unit
                const selected = focus?.selectedCity?.toLowerCase() === c.city.toLowerCase()
                return (
                  <a key={c.city} href={focus!.cityHref(c.city)} tabIndex={-1} data-tip={c.city} data-tip-value={plural(c.count, noun)}>
                    <circle cx={p[0]} cy={p[1]} r={Math.max(r, 12 * unit)} className="map-hit" />
                    <circle cx={p[0]} cy={p[1]} r={r} className={selected ? 'map-bubble map-bubble-selected' : 'map-bubble'} />
                  </a>
                )
              })}
            </g>
          ) : null}
          {labels.map((l) => (
            <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={fontSize} strokeWidth={3.5 * unit} className="map-label">
              {l.text}
            </text>
          ))}
        </MapFrame>
      </ChartTips>

      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {focus ? (
          <span className="flex items-center gap-2 text-sm text-muted">
            <svg aria-hidden="true" width="34" height="24" viewBox="0 0 34 24" className="shrink-0">
              <circle cx="6" cy="17" r="5" className="map-bubble" />
              <circle cx="23" cy="12" r="10" className="map-bubble" />
            </svg>
            Circle area shows the number of {noun}s in each city.
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted">{noun[0]!.toUpperCase() + noun.slice(1)}s per state</span>
            <span className="legend-key">
              <span className="swatch map-fill-0" aria-hidden="true" />
              None
            </span>
            {classes.map((c) => (
              <span key={c.label} className="legend-key tabular">
                <span className={`swatch map-fill-${c.step}`} aria-hidden="true" />
                {c.label}
              </span>
            ))}
          </span>
        )}
        {unmapped.length && !focus ? (
          <span className="text-sm text-muted">
            Not on the map:{' '}
            {unmapped.map((s, i) => (
              <span key={s.code}>
                {i ? ', ' : ''}
                <Link href={stateHref(s.code)}>
                  {s.name} ({counts[s.code]})
                </Link>
              </span>
            ))}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

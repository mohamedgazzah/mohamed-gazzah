import Link from 'next/link'
import { bubbleRadius, frameAround, mapClasses, stepFor } from '@/lib/choropleth'
import { formatNumber, plural } from '@/lib/format'
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
  /** Records in the state with no city: not on the map, counted in the key. */
  stateOnly?: number
  /** The largest city count for the same filters in any state, so circle sizes compare across states. */
  sizeMax?: number
}

// The map's usual width on screen. Pins are drawn in screen pixels and scaled
// by --u (map units per pixel), which MapFrame keeps current; this is its
// value until then (and without JavaScript).
const FRAME_PX = 900
// Labels are placed for the narrowest map that shows them, so they never
// collide on a phone: the top three show from 320px (where pins are drawn at
// 0.8 size), the next three from 520px (globals.css, .state-map).
const NARROW_PX = 320 / 0.8
const MID_PX = 520
// Smallest map width a zoomed view shows, so tiny states keep some context.
const MIN_FRAME = 120
const LABEL_PX = 13
const MAX_LABELS = 6
// Circle sizes never stretch a handful of records to the largest circle: one record is a dot until a city reaches 20.
const SIZE_FLOOR = 20

type Box = [number, number, number, number]
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

/** Up to three circle sizes for the key: 1, a round middle value, and the largest. */
function keySizes(max: number): number[] {
  if (max <= 1) return [1]
  const mid = max >= 6 ? Number(String(Math.round(max / 2)).replace(/^(\d)\d*/, (m, d) => d + '0'.repeat(m.length - 1))) : 0
  return [...new Set([1, mid, max])].filter((v) => v > 0 && v <= max).sort((a, b) => a - b)
}

/**
 * Incidents by state: a choropleth of the counts, five classes on the
 * --chart-seq ramp, zero drawn lighter than every class. Each state links to
 * the same filters narrowed to that state, where the map zooms in and shows
 * cities as circles sized by area, labeled with their counts. The map is a
 * picture for sighted readers; the totals are also in the list and table
 * that go with it.
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
  const viewBox = shape ? frameAround(shape.bbox, MAP_WIDTH / MAP_HEIGHT, 0.08, MIN_FRAME) : ([0, 0, MAP_WIDTH, MAP_HEIGHT] as const)
  const unit = viewBox[2] / FRAME_PX
  const classes = mapClasses(Math.max(0, ...Object.values(counts)))
  // Alaska and Hawaii are insets: zoomed into one, the other shapes are not its neighbors, and zoomed into
  // any other state, the insets are not either (Hawaii's box sits where Mexico would be).
  const inset = (code: string) => code === 'AK' || code === 'HI'
  const shapes = !focus
    ? STATE_SHAPES
    : inset(focus.code)
      ? STATE_SHAPES.filter((s) => s.code === focus.code)
      : STATE_SHAPES.filter((s) => !inset(s.code))

  const placed = (focus?.cities ?? [])
    .map((c) => ({ c, p: project(c.lng, c.lat) }))
    .filter((x): x is { c: CityCount; p: [number, number] } => x.p !== null)
    .sort((a, b) => b.c.count - a.c.count)
  const maxCity = Math.max(0, ...placed.map((x) => x.c.count))
  const sizeMax = Math.max(maxCity, focus?.sizeMax ?? 0, SIZE_FLOOR)
  const radius = (n: number) => bubbleRadius(n, sizeMax, 22, 4)
  const selectedKey = focus?.selectedCity?.toLowerCase() ?? null
  const isSelected = (city: string) => selectedKey === city.toLowerCase()

  // Name the selected city and the largest ones, with their counts: the top
  // three always (with a halo where they cannot avoid a circle), then others
  // while they fit. Each label tries the right, left, top and bottom of its
  // circle, avoiding every circle and every label placed before it, at the
  // size it has on the narrowest map that shows it.
  const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle'; rank: number }>()
  const circleBox = ({ c, p }: (typeof placed)[number], u: number): Box => {
    const r = radius(c.count) * u
    return [p[0] - r, p[1] - r, p[0] + r, p[1] + r]
  }
  const order = [...placed.filter((x) => isSelected(x.c.city)), ...placed.filter((x) => !isSelected(x.c.city))]
  const takenAt = new Map<number, Box[]>()
  for (const x of order.slice(0, 12)) {
    if (labels.size === MAX_LABELS) break
    const { c, p } = x
    const rank = labels.size + 1
    const u = viewBox[2] / (rank <= 3 ? NARROW_PX : MID_PX)
    if (!takenAt.has(u)) takenAt.set(u, placed.map((o) => circleBox(o, u)))
    const taken = takenAt.get(u)!
    const r = radius(c.count)
    const w = (c.city.length + String(c.count).length + 1) * LABEL_PX * 0.56
    const h = LABEL_PX
    const options: { x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: Box }[] = [
      { x: r + 4, y: 4, anchor: 'start', box: [r + 4, -h * 0.7, r + 4 + w, h * 0.5] },
      { x: -r - 4, y: 4, anchor: 'end', box: [-r - 4 - w, -h * 0.7, -r - 4, h * 0.5] },
      { x: 0, y: -r - 5, anchor: 'middle', box: [-w / 2, -r - 5 - h, w / 2, -r - 3] },
      { x: 0, y: r + h + 2, anchor: 'middle', box: [-w / 2, r + 2, w / 2, r + h + 4] },
    ]
    const inMap = (b: Box): Box => [p[0] + b[0] * u, p[1] + b[1] * u, p[0] + b[2] * u, p[1] + b[3] * u]
    const inside = (b: Box) => b[0] >= viewBox[0] && b[2] <= viewBox[0] + viewBox[2] && b[1] >= viewBox[1] && b[3] <= viewBox[1] + viewBox[3]
    const fit = options.find((o) => {
      const b = inMap(o.box)
      return inside(b) && !taken.some((t) => overlaps(t, b))
    })
    const chosen = fit ?? (rank <= 3 || isSelected(c.city) ? options.find((o) => inside(inMap(o.box))) ?? options[0]! : null)
    if (!chosen) continue
    for (const list of takenAt.values()) list.push(inMap(chosen.box))
    labels.set(c.city, { x: chosen.x, y: chosen.y, anchor: chosen.anchor, rank })
  }

  const unmapped = UNMAPPED_STATES.filter((s) => (counts[s.code] ?? 0) > 0)
  const sizes = keySizes(sizeMax)
  const keyMax = radius(sizes[sizes.length - 1] ?? 1)

  // Largest first, so smaller circles sit on top; the selected city last of all. Labels go in a layer of
  // their own above every circle, so no circle drawn later covers a name.
  const drawn = [...placed.filter((x) => !isSelected(x.c.city)), ...placed.filter((x) => isSelected(x.c.city))]
  const pins = placed.length ? (
    <>
      <g className="map-bubbles" data-selected={selectedKey ? '' : undefined}>
        {drawn.map(({ c, p }) => {
          const r = radius(c.count)
          return (
            <g key={c.city} transform={`translate(${p[0]} ${p[1]})`}>
              <g className="map-pin">
                <a href={focus!.cityHref(c.city)} tabIndex={-1} data-tip={c.city} data-tip-value={plural(c.count, noun)}>
                  <circle r={Math.max(r + 4, 12)} className="map-hit" />
                  <circle r={r} className={isSelected(c.city) ? 'map-bubble map-bubble-selected' : 'map-bubble'} />
                </a>
              </g>
            </g>
          )
        })}
      </g>
      <g className="map-labels" aria-hidden="true">
        {drawn.map(({ c, p }) => {
          const label = labels.get(c.city)
          if (!label) return null
          return (
            <g key={c.city} transform={`translate(${p[0]} ${p[1]})`}>
              <g className="map-pin">
                <text x={label.x} y={label.y} textAnchor={label.anchor} className={isSelected(c.city) ? 'map-label-selected' : `map-label-rank-${label.rank}`}>
                  {c.city}
                  <tspan dx="4">{formatNumber(c.count)}</tspan>
                </text>
              </g>
            </g>
          )
        })}
      </g>
    </>
  ) : null

  return (
    <figure className="state-map">
      <ChartTips>
        <MapFrame viewBox={viewBox.join(' ')} unit={unit} overlay={pins}>
          <g className="map-states">
            {shapes.map((s) => {
              const n = counts[s.code] ?? 0
              const fill = focus ? (s.code === focus.code ? 'map-fill-focus' : 'map-fill-context') : `map-fill-${stepFor(n, classes)}`
              return (
                <a
                  key={s.code}
                  href={stateHref(s.code)}
                  tabIndex={-1}
                  data-state={s.code}
                  data-tip={s.name}
                  data-tip-value={plural(n, noun)}
                  data-tip-hint={focus && s.code !== focus.code ? 'Select to view' : undefined}
                >
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
        </MapFrame>
      </ChartTips>

      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {focus ? (
          <span className="map-legend">
            {placed.length ? (
              <>
                {/* Drawn at the pins' scale (--pin-scale), so the key's circles match the map's. */}
                <svg
                  aria-hidden="true"
                  viewBox={`0 0 ${keyMax * 2 + 2} ${keyMax * 2 + 2}`}
                  className="map-key-circles shrink-0"
                  style={{ ['--key' as string]: `${keyMax * 2 + 2}px` }}
                >
                  {[...sizes].reverse().map((v) => {
                    const r = radius(v)
                    return <circle key={v} cx={keyMax + 1} cy={keyMax * 2 + 1 - r} r={r} className="map-bubble" />
                  })}
                </svg>
                <span className="tabular">
                  {sizes.length > 1 ? `Circles: ${sizes.map((v) => formatNumber(v)).join(' · ')} ${noun}s` : `Circle: 1 ${noun}`}
                </span>
              </>
            ) : focus.stateOnly ? (
              <span>None of these {noun}s has a city.</span>
            ) : (
              <span>
                No {noun}s in {focus.name} for these filters.
              </span>
            )}
            {focus.stateOnly ? <span className="text-muted">+ {plural(focus.stateOnly, noun)} with no city</span> : null}
          </span>
        ) : (
          <span className="map-legend">
            <span className="font-semibold">{noun[0]!.toUpperCase() + noun.slice(1)}s per state</span>
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

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
// Smallest map width a zoomed view shows, so tiny states keep some context.
const MIN_FRAME = 120
// Circle sizes never stretch a handful of records to the largest circle: one record is a dot until a city reaches 20.
const SIZE_FLOOR = 20

// City labels have one layout for phones and one for wider maps, each checked at several widths the
// map is drawn at: from a 320px phone (254px inside the card) to 520px, where pins are 0.8 size and a
// zoomed state is framed to its own shape; then to the widest Explore column (790px). Phones show
// three labels, wider maps six, and four more from 760px (globals.css, .map-labels-*).
type Layout = { widths: number[]; pin: number; bands: { from: number; size: number }[] }
export const PHONE_LAYOUT: Layout = { widths: [254, 300, 360, 440, 520], pin: 0.8, bands: [{ from: 254, size: 3 }] }
export const WIDE_LAYOUT: Layout = {
  widths: [521, 600, 680, 760, 800],
  pin: 1,
  bands: [
    { from: 521, size: 6 },
    { from: 760, size: 4 },
  ],
}
// Labels go to the selected city and the largest ones: this many are tried.
const TRY_LABELS = 20
// Labels are 13px on screen at every width. Their letters reach 0.76em above the baseline and 0.22em
// below it, inside a 1.5px halo, and they sit 3 pin px from their circle.
const LABEL_PX = 13
const ASCENT = 0.76
const DESCENT = 0.22
const HALO = 1.5
const GAP = 3
// How far one of the first three labels may move out on a leader line when nothing beside its circle
// is free (pin px). Further out, a label reads as another circle's.
const LEADS = [8, 16, 26]
const D = Math.SQRT1_2
// Right, left, above, below, then the diagonals.
const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [D, -D], [D, D], [-D, -D], [-D, D]] as const
// Advance widths in the labels' typeface (Instrument Sans, semibold), in em: other capitals are about 0.7, anything else 0.6.
const EM: Record<string, number> = { ' ': 0.21, "'": 0.23, '.': 0.24, ',': 0.24, i: 0.26, j: 0.26, l: 0.26, I: 0.26, f: 0.38, r: 0.39, '1': 0.39, t: 0.41, J: 0.42, '-': 0.45, s: 0.5, z: 0.5, w: 0.72, M: 0.9, m: 0.94, W: 1.08 }

type Box = [number, number, number, number]
type Line = [number, number, number, number]

/**
 * A city to label: its place on the map (map units), its circle's radius (pin px), its label's width
 * (screen px), and whether it is always named (the selected city and the largest).
 */
export type LabelPin = { city: string; p: readonly [number, number]; r: number; w: number; must?: boolean }

/** Where a city's label goes, beside its circle in pin px, and which of its layout's widths show it (band 1: all). */
export type CityLabel = { x: number; y: number; dy: number; anchor: 'start' | 'end' | 'middle'; leader: Line | null; band: number; rank: number }

type Spot = Omit<CityLabel, 'band' | 'rank'>

const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
/** Whether a circle reaches into a box. */
const touches = (b: Box, x: number, y: number, r: number) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3])) < r
/** Whether a line passes within r of a point. */
function passes([x1, y1, x2, y2]: Line, x: number, y: number, r: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x1 + t * dx - x, y1 + t * dy - y) < r
}
/** Points along a line, at most 2px apart. */
function along([x1, y1, x2, y2]: Line): [number, number][] {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2))
  return Array.from({ length: n + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n])
}
const crosses = (l: Line, b: Box) => along(l).some(([x, y]) => touches(b, x, y, 0.5))

const em = (s: string) => [...s].reduce((n, ch) => n + (EM[ch] ?? (ch >= 'A' && ch <= 'Z' ? 0.7 : 0.6)), 0)
/** A label's width on screen: the city, a 0.3em space and the count, a little over (bold, rounding). */
export const labelWidth = (city: string, count: number) => (em(city) + 0.3 + em(formatNumber(count))) * LABEL_PX * 1.04

const round = (n: number) => Math.round(n * 100) / 100

/** A spot for a label beside a circle of radius r (pin px), in one direction, `lead` px out on a leader line. */
function spot(r: number, [ux, uy]: readonly [number, number], lead: number): Spot {
  const q = r + GAP + lead
  return {
    x: round(ux * q),
    y: round(uy * q),
    // Beside the circle the letters are centred on it; above it they end at the spot, below it they start there.
    dy: uy < 0 ? -DESCENT : uy > 0 ? ASCENT : (ASCENT - DESCENT) / 2,
    anchor: ux > 0 ? 'start' : ux < 0 ? 'end' : 'middle',
    leader: lead ? [round(ux * (r + 1)), round(uy * (r + 1)), round(ux * (q - 1.5)), round(uy * (q - 1.5))] : null,
  }
}

type Placed = { box: Box; line: Line | null }
/** Whether a label (its box and leader) meets one already placed. */
const clash = (box: Box, line: Line | null, o: Placed) =>
  overlaps(box, o.box) ||
  (!!o.line && crosses(o.line, box)) ||
  (!!line && (crosses(line, o.box) || (!!o.line && along(line).some(([x, y]) => passes(o.line!, x, y, 1)))))

/**
 * Labels for the first cities in `pins` (the selected city, then the largest) in one layout, on the
 * part of the map `frame` shows, while they fit. Each tries the right, left, top, bottom and diagonals
 * of its circle, clear of every circle, label and edge at each of the layout's widths that show it.
 * One of the first three that fits nowhere moves out on a short leader line. A city that is always
 * named and fits nowhere takes the spot that covers the fewest circles (its halo keeps both
 * readable). No label ever covers another.
 */
export function placeLabels(pins: LabelPin[], [fx, fy, fw, fh]: readonly [number, number, number, number], layout: Layout): Map<string, CityLabel> {
  const k = layout.pin
  // At each width: the map's height on screen and each circle's place on it.
  const views = layout.widths.map((w) => {
    const s = w / fw
    return { w, h: fh * s, at: pins.map(({ p }) => [(p[0] - fx) * s, (p[1] - fy) * s] as const) }
  })
  type View = (typeof views)[number]
  // A label's box and leader on screen at one width.
  const onScreen = (v: View, i: number, c: Spot): Placed => {
    const [x, y] = v.at[i]!
    const w = pins[i]!.w
    const ax = x + c.x * k
    const base = y + c.y * k + c.dy * LABEL_PX
    const left = c.anchor === 'start' ? ax : c.anchor === 'end' ? ax - w : ax - w / 2
    const box: Box = [left - HALO, base - ASCENT * LABEL_PX - HALO, left + w + HALO, base + DESCENT * LABEL_PX + HALO]
    const line = c.leader ? ([x + c.leader[0] * k, y + c.leader[1] * k, x + c.leader[2] * k, y + c.leader[3] * k] as Line) : null
    return { box, line }
  }
  // The labels placed so far, on screen at each width (null where their band is hidden).
  const taken: (Placed | null)[][] = []
  // How many circles a label covers over the widths that show it (counting stops at `enough`), or
  // Infinity where it would leave the map or meet another label.
  const cover = (i: number, c: Spot, from: number, enough: number) => {
    let n = 0
    for (const [at, v] of views.entries()) {
      if (v.w < from) continue
      const { box, line } = onScreen(v, i, c)
      if (box[0] < 0 || box[1] < 0 || box[2] > v.w || box[3] > v.h) return Infinity
      if (taken.some((t) => !!t[at] && clash(box, line, t[at]!))) return Infinity
      for (const [j, o] of pins.entries()) {
        if (n >= enough) return n
        const [x, y] = v.at[j]!
        if (touches(box, x, y, o.r * k) || (line && j !== i && passes(line, x, y, o.r * k))) n++
      }
    }
    return n
  }
  const labels = new Map<string, CityLabel>()
  const filled = layout.bands.map(() => 0)
  const most = layout.bands.reduce((n, b) => n + b.size, 0)
  for (let i = 0; i < Math.min(pins.length, TRY_LABELS) && labels.size < most; i++) {
    const { r, must } = pins[i]!
    const near = DIRS.map((d) => spot(r, d, 0))
    const far = i < 3 || must ? LEADS.flatMap((lead) => DIRS.map((d) => spot(r, d, lead))) : []
    for (const [band, { from, size }] of layout.bands.entries()) {
      if (filled[band] === size) continue
      const clear = (s: Spot) => cover(i, s, from, 1) === 0
      let c = near.find(clear) ?? far.find(clear)
      if (!c && must) {
        // Nowhere is clear: the spot that covers the fewest circles, nearest its own first.
        let best = Infinity
        for (const s of [...near, ...far]) {
          const n = cover(i, s, from, best)
          if (n < best) [best, c] = [n, s]
        }
      }
      if (!c) continue
      const chosen = c
      filled[band]!++
      taken.push(views.map((v) => (v.w < from ? null : onScreen(v, i, chosen))))
      labels.set(pins[i]!.city, { ...chosen, band: band + 1, rank: labels.size + 1 })
      break
    }
  }
  return labels
}

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
  // On a phone, a zoomed state is framed closer to its own shape (square for a tall one), so it fills
  // more of the map: the box takes this shape and MapFrame's "slice" crops the sides. Wide states keep the frame.
  const ownAspect = shape ? Math.max(1, (shape.bbox[2] - shape.bbox[0]) / (shape.bbox[3] - shape.bbox[1])) : Infinity
  const phoneAspect = ownAspect < MAP_WIDTH / MAP_HEIGHT - 0.05 ? round(ownAspect) : null
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

  // Name the selected city and the largest ones, with their counts: one layout for phones (on the
  // part of the frame a phone shows), one for wider maps.
  const order = [...placed.filter((x) => isSelected(x.c.city)), ...placed.filter((x) => !isSelected(x.c.city))]
  const labelPins = order.map(({ c, p }) => ({ city: c.city, p, r: radius(c.count), w: labelWidth(c.city, c.count), must: isSelected(c.city) || c === placed[0]?.c }))
  const [vx, vy, vw, vh] = viewBox
  const layouts = [
    { name: 'phone', labels: placeLabels(labelPins, phoneAspect ? [vx + (vw - vh * phoneAspect) / 2, vy, vh * phoneAspect, vh] : viewBox, PHONE_LAYOUT) },
    { name: 'wide', labels: placeLabels(labelPins, viewBox, WIDE_LAYOUT) },
  ]

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
      {layouts.map(({ name, labels }) => (
        <g key={name} className={`map-labels map-labels-${name}`} aria-hidden="true">
          {/* The largest city's label is drawn last, on top, and the selected city's (placed first) last of all. */}
          {order
            .filter((x) => labels.has(x.c.city))
            .sort((a, b) => labels.get(b.c.city)!.rank - labels.get(a.c.city)!.rank)
            .map(({ c, p }) => {
              const label = labels.get(c.city)!
              return (
                <g key={c.city} transform={`translate(${p[0]} ${p[1]})`} className={label.band > 1 ? `map-label-band-${label.band}` : undefined}>
                  <g className="map-pin">
                    {label.leader ? <line x1={label.leader[0]} y1={label.leader[1]} x2={label.leader[2]} y2={label.leader[3]} className="map-leader" /> : null}
                    <text x={label.x} y={label.y} dy={`${label.dy}em`} textAnchor={label.anchor} className={isSelected(c.city) ? 'map-label-selected' : undefined}>
                      {c.city}
                      <tspan dx="0.3em">{formatNumber(c.count)}</tspan>
                    </text>
                  </g>
                </g>
              )
            })}
        </g>
      ))}
    </>
  ) : null

  // What the map's marks mean. A zoom with no records has nothing to explain (the list below says so).
  const legend = !focus ? (
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
  ) : placed.length ? (
    <span className="map-legend">
      {/* Drawn at the pins' scale (--pin-scale), so the key's circles match the map's. */}
      <svg aria-hidden="true" viewBox={`0 0 ${keyMax * 2 + 2} ${keyMax * 2 + 2}`} className="map-key-circles shrink-0" style={{ ['--key' as string]: `${keyMax * 2 + 2}px` }}>
        {[...sizes].reverse().map((v) => {
          const r = radius(v)
          return <circle key={v} cx={keyMax + 1} cy={keyMax * 2 + 1 - r} r={r} className="map-bubble" />
        })}
      </svg>
      <span className="tabular">{sizes.length > 1 ? `Circles: ${sizes.map((v) => formatNumber(v)).join(' · ')} ${noun}s` : `Circle: 1 ${noun}`}</span>
      {focus.stateOnly ? <span className="text-muted">+ {plural(focus.stateOnly, noun)} with no city</span> : null}
    </span>
  ) : null
  // Records that have no place on this map: territories, or records with no city.
  const offMap =
    !focus && unmapped.length ? (
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
    ) : focus && !placed.length && focus.stateOnly ? (
      <span className="text-sm text-muted">Not on the map: {plural(focus.stateOnly, noun)} with no city</span>
    ) : null

  return (
    <figure className="state-map">
      <ChartTips>
        <MapFrame viewBox={viewBox.join(' ')} unit={unit} phoneAspect={phoneAspect} overlay={pins}>
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

      {legend || offMap ? (
        <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {legend}
          {offMap}
        </figcaption>
      ) : null}
    </figure>
  )
}

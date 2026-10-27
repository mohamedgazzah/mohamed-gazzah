/**
 * Classes for the state map: whole-number ranges on a rough log scale, so a
 * few states with many records do not wash out the rest, and the legend reads
 * as plain ranges ("1–3", "4–9", "10–39"). Colors are the five-step
 * --chart-seq ramp (Section 5); zero is drawn as an empty state.
 */
const NICE = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100]

function niceAtLeast(t: number): number {
  for (let scale = 1; ; scale *= 10) {
    for (const n of NICE.slice(0, -1)) if (n * scale >= t) return n * scale
  }
}

/** Lower bounds of each class, starting at 1, at most five classes. */
export function classBounds(max: number): number[] {
  if (max < 1) return []
  if (max <= 5) return Array.from({ length: max }, (_, i) => i + 1)
  const bounds = [1]
  for (let k = 1; k < 5; k++) {
    const b = niceAtLeast(max ** (k / 5))
    if (b > bounds[bounds.length - 1]! && b <= max) bounds.push(b)
  }
  return bounds
}

/** Ramp steps (1–5) for n classes, spread so the top class is always dark. */
const STEPS: Record<number, number[]> = { 1: [4], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] }

export type MapClass = { min: number; max: number; step: number; label: string }

/** The legend: one entry per class, with the range it covers. */
export function mapClasses(max: number): MapClass[] {
  const bounds = classBounds(max)
  const steps = STEPS[bounds.length] ?? []
  return bounds.map((min, i) => {
    const hi = i + 1 < bounds.length ? bounds[i + 1]! - 1 : max
    return { min, max: hi, step: steps[i]!, label: min === hi ? String(min) : `${min}–${hi}` }
  })
}

/** Ramp step for a value, or 0 for none. */
export function stepFor(value: number, classes: MapClass[]): number {
  if (value < 1) return 0
  for (let i = classes.length - 1; i >= 0; i--) if (value >= classes[i]!.min) return classes[i]!.step
  return 0
}

/**
 * A viewBox around a bounding box, padded and widened to the map's aspect
 * ratio so the frame keeps its shape from state to state.
 */
export function frameAround(bbox: readonly [number, number, number, number], aspect = 975 / 610, pad = 0.08): [number, number, number, number] {
  const [x0, y0, x1, y1] = bbox
  let w = (x1 - x0) * (1 + 2 * pad)
  let h = (y1 - y0) * (1 + 2 * pad)
  if (w / h < aspect) w = h * aspect
  else h = w / aspect
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const r = (n: number) => Math.round(n * 100) / 100
  return [r(cx - w / 2), r(cy - h / 2), r(w), r(h)]
}

/** Bubble radius in screen pixels: area proportional to the count. */
export function bubbleRadius(count: number, maxCount: number, maxRadius = 22, minRadius = 5): number {
  if (count <= 0 || maxCount <= 0) return 0
  return Math.max(minRadius, Math.sqrt(count / maxCount) * maxRadius)
}

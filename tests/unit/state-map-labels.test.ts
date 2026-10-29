import { describe, expect, it } from 'vitest'
import { PHONE_LAYOUT, WIDE_LAYOUT, labelWidth, placeLabels, type CityLabel, type LabelPin } from '@/components/charts/StateMap'
import { bubbleRadius, frameAround } from '@/lib/choropleth'
import { MAP_HEIGHT, MAP_WIDTH, project, stateShape } from '@/server/public/geo'

type City = [name: string, lng: number, lat: number, count: number]

// Dense metro areas, where labels used to pile up (the critique's Detroit, New York and Chicago cases).
const MICHIGAN: City[] = [
  ['Dearborn', -83.1763, 42.3223, 21], ['Detroit', -83.0458, 42.3314, 12], ['Hamtramck', -83.0496, 42.3928, 7], ['Dearborn Heights', -83.2733, 42.337, 6],
  ['Ann Arbor', -83.743, 42.2808, 5], ['Canton', -83.4822, 42.3086, 3], ['Troy', -83.1499, 42.6064, 3], ['Sterling Heights', -83.0302, 42.5803, 3],
  ['Grand Rapids', -85.6681, 42.9634, 2], ['Lansing', -84.5555, 42.7325, 2], ['Warren', -83.0147, 42.5145, 2], ['Flint', -83.6875, 43.0125, 1],
]
const NEW_YORK: City[] = [
  ['New York', -73.9712, 40.7831, 30], ['Brooklyn', -73.9442, 40.6782, 22], ['Queens', -73.7949, 40.7282, 18], ['Bronx', -73.8648, 40.8448, 9],
  ['Staten Island', -74.1502, 40.5795, 5], ['Buffalo', -78.8784, 42.8864, 4], ['Yonkers', -73.8988, 40.9312, 3], ['Hempstead', -73.6187, 40.7062, 3],
  ['Rochester', -77.6088, 43.1566, 2], ['Albany', -73.7562, 42.6526, 2], ['Syracuse', -76.1474, 43.0481, 1], ['White Plains', -73.7629, 41.034, 1],
]
const ILLINOIS: City[] = [
  ['Chicago', -87.6298, 41.8781, 34], ['Bridgeview', -87.8042, 41.75, 9], ['Oak Lawn', -87.7479, 41.7109, 7], ['Skokie', -87.7334, 42.0324, 6],
  ['Schaumburg', -88.0834, 42.0334, 5], ['Naperville', -88.1535, 41.7508, 5], ['Aurora', -88.3201, 41.7606, 4], ['Joliet', -88.0817, 41.525, 3],
  ['Evanston', -87.6877, 42.0451, 3], ['Orland Park', -87.8539, 41.6303, 3], ['Lombard', -88.0078, 41.88, 2], ['Springfield', -89.65, 39.7817, 2],
]
// Equal counts, where order alone used to decide (Oakland over San Francisco).
const BAY_AREA: City[] = [
  ['Los Angeles', -118.2437, 34.0522, 6], ['San Francisco', -122.4194, 37.7749, 6], ['San Diego', -117.1611, 32.7157, 6], ['San Jose', -121.8863, 37.3382, 6],
  ['Sacramento', -121.4944, 38.5816, 6], ['Anaheim', -117.9145, 33.8366, 6], ['Oakland', -122.2711, 37.8044, 6], ['Irvine', -117.7947, 33.6846, 6],
  ['Fremont', -121.9886, 37.5485, 6], ['Santa Ana', -117.8678, 33.7455, 6], ['Fresno', -119.7871, 36.7378, 6], ['Riverside', -117.3962, 33.9806, 6],
]

/** The pins StateMap would pass: the selected city first, then by count; the selected and the largest always named. */
function pinsFor(cities: City[], selected?: string): LabelPin[] {
  const max = Math.max(20, ...cities.map((c) => c[3]))
  const byCount = [...cities].sort((a, b) => b[3] - a[3])
  const order = [...byCount.filter((c) => c[0] === selected), ...byCount.filter((c) => c[0] !== selected)]
  return order.map(([city, lng, lat, n]) => ({ city, p: project(lng, lat)!, r: bubbleRadius(n, max, 22, 4), w: labelWidth(city, n), must: city === selected || city === byCount[0]![0] }))
}

/** A state's frame, and a phone's crop of it to about the state's shape. */
function frames(code: string) {
  const shape = stateShape(code)!
  const vb = frameAround(shape.bbox, MAP_WIDTH / MAP_HEIGHT, 0.08, 120)
  const aspect = Math.min(MAP_WIDTH / MAP_HEIGHT, Math.max(1, (shape.bbox[2] - shape.bbox[0]) / (shape.bbox[3] - shape.bbox[1])))
  const phone = [vb[0] + (vb[2] - vb[3] * aspect) / 2, vb[1], vb[3] * aspect, vb[3]] as const
  return { wide: vb, phone }
}

/** The letters of each label a width shows, in screen pixels: from the cap height to the descenders. */
function letters(pins: LabelPin[], labels: Map<string, CityLabel>, frame: readonly number[], layout: typeof WIDE_LAYOUT, width: number) {
  const s = width / frame[2]!
  return [...labels]
    .filter(([, l]) => width >= layout.bands[l.band - 1]!.from)
    .map(([city, l]) => {
      const pin = pins.find((p) => p.city === city)!
      const w = pin.w / 1.04
      const x = (pin.p[0] - frame[0]!) * s + l.x * layout.pin
      const base = (pin.p[1] - frame[1]!) * s + l.y * layout.pin + l.dy * 13
      const left = l.anchor === 'start' ? x : l.anchor === 'end' ? x - w : x - w / 2
      return { city, box: [left, base - 0.72 * 13, left + w, base + 0.2 * 13] as const, height: frame[3]! * s }
    })
}

const cases: [string, string, City[], string?][] = [
  ['Detroit area', 'MI', MICHIGAN],
  ['Detroit area, Hamtramck selected', 'MI', MICHIGAN, 'Hamtramck'],
  ['New York City', 'NY', NEW_YORK],
  ['Chicago area', 'IL', ILLINOIS],
  ['equal counts', 'CA', BAY_AREA],
]

describe('state map labels', () => {
  for (const [name, code, cities, selected] of cases) {
    const pins = pinsFor(cities, selected)
    const { wide, phone } = frames(code)
    for (const [layout, frame] of [
      [PHONE_LAYOUT, phone],
      [WIDE_LAYOUT, wide],
    ] as const) {
      const labels = placeLabels(pins, frame, layout)
      const which = layout === PHONE_LAYOUT ? 'phones' : 'wider maps'

      it(`${name}, ${which}: no label touches another, and all stay on the map`, () => {
        for (const width of layout.widths) {
          const shown = letters(pins, labels, frame, layout, width)
          for (const [i, a] of shown.entries()) {
            expect(a.box[0], `${a.city} at ${width}px`).toBeGreaterThanOrEqual(0)
            expect(a.box[2], `${a.city} at ${width}px`).toBeLessThanOrEqual(width)
            expect(a.box[1], `${a.city} at ${width}px`).toBeGreaterThanOrEqual(0)
            expect(a.box[3], `${a.city} at ${width}px`).toBeLessThanOrEqual(a.height)
            for (const b of shown.slice(i + 1)) {
              const apart = a.box[2] <= b.box[0] || b.box[2] <= a.box[0] || a.box[3] <= b.box[1] || b.box[3] <= a.box[1]
              expect(apart, `${a.city} and ${b.city} at ${width}px`).toBe(true)
            }
          }
        }
      })

      it(`${name}, ${which}: names the largest city${selected ? ' and the selected one, first' : ''}`, () => {
        expect(labels.has(cities.reduce((a, b) => (b[3] > a[3] ? b : a))[0])).toBe(true)
        if (selected) expect(labels.get(selected)?.rank).toBe(1)
      })
    }
  }

  it('names more cities on a wide map than on a phone, up to ten', () => {
    const pins = pinsFor(NEW_YORK)
    const { wide, phone } = frames('NY')
    expect(placeLabels(pins, phone, PHONE_LAYOUT).size).toBe(3)
    const many = placeLabels(pins, wide, WIDE_LAYOUT)
    expect(many.size).toBeGreaterThan(6)
    expect(many.size).toBeLessThanOrEqual(10)
  })
})

// Builds the state map's shapes from us-atlas (US Census Bureau cartographic
// boundaries, already projected with d3.geoAlbersUsa at scale 1300 into a
// 975 × 610 frame, Alaska and Hawaii inset). Run after upgrading us-atlas:
//   node scripts/build-geo.mjs
//
// Writes SVG sprites to public/geo/<hash>/ (the map draws them with <use>, so
// pages carry references, not path data, and the files cache for good) and
// src/geo/us-states.json with each state's name and bounding box. The output
// is committed, so builds and tests never depend on this script.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import { planarTriangleArea, presimplify, simplify } from 'topojson-simplify'

const read = (name) => JSON.parse(readFileSync(`node_modules/us-atlas/${name}`, 'utf8'))

/** An SVG path context that writes relative moves, rounded to `digits` decimals. */
function compactPath(digits) {
  const k = 10 ** digits
  const r = (n) => Math.round(n * k) / k
  let out = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let first = true
  const ctx = {
    moveTo(px, py) {
      const nx = r(px)
      const ny = r(py)
      out += `m${r(nx - x)} ${r(ny - y)}`.replace(/ -/g, '-')
      x = sx = nx
      y = sy = ny
      first = true
    },
    lineTo(px, py) {
      const nx = r(px)
      const ny = r(py)
      const dx = r(nx - x)
      const dy = r(ny - y)
      if (dx === 0 && dy === 0) return
      out += `${first ? 'l' : ' '}${dx} ${dy}`.replace(/ -/g, '-')
      x = nx
      y = ny
      first = false
    },
    closePath() {
      // After "z" the pen is back at the start of the subpath.
      out += 'z'
      x = sx
      y = sy
    },
    arc() {},
    result() {
      // The first move is relative to the origin, which equals absolute.
      const s = out
      out = ''
      x = sx = 0
      y = sy = 0
      return s
    },
  }
  return (f) => {
    geoPath(null, ctx)(f)
    return ctx.result()
  }
}

// Strokes keep their screen width when the map zooms.
const sprite = (paths) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><defs>${paths.map(([id, d]) => `<path id="${id}" d="${d}" vector-effect="non-scaling-stroke"/>`).join('')}</defs></svg>\n`

// National map: drop detail smaller than a fifth of a square pixel at full width.
const states = read('states-albers-10m.json')
const light = simplify(presimplify(states, planarTriangleArea), 0.2)
const national = compactPath(1)
const measure = geoPath()
const round = (n) => Math.round(n * 10) / 10
const shapes = feature(light, light.objects.states)
  .features.map((f) => {
    const [[x0, y0], [x1, y1]] = measure.bounds(f)
    return { fips: f.id, name: f.properties.name, bbox: [x0, y0, x1, y1].map(round), d: national(f) }
  })
  .sort((a, b) => a.fips.localeCompare(b.fips))
const files = { 'us-states.svg': sprite(shapes.map((s) => [`s-${s.fips}`, s.d])) }

// One sprite per state for the zoomed view: its outline and inner county lines
// at full detail and two decimals, since a small state fills the frame there.
const counties = read('counties-albers-10m.json')
const detail = compactPath(2)
for (const s of shapes) {
  const geometry = counties.objects.states.geometries.find((g) => g.id === s.fips)
  const inner = mesh(counties, counties.objects.counties, (a, b) => a !== b && a.id.slice(0, 2) === s.fips && b.id.slice(0, 2) === s.fips)
  files[`states/${s.fips}.svg`] = sprite([
    ['outline', detail(feature(counties, geometry))],
    ['counties', detail(inner)],
  ])
}

// One folder per build of the shapes, named by their content, so browsers can cache it forever.
const hash = createHash('sha256')
for (const [name, body] of Object.entries(files)) hash.update(name).update(body)
const version = hash.digest('hex').slice(0, 10)
rmSync('public/geo', { recursive: true, force: true })
mkdirSync(`public/geo/${version}/states`, { recursive: true })
for (const [name, body] of Object.entries(files)) writeFileSync(`public/geo/${version}/${name}`, body)

rmSync('src/geo', { recursive: true, force: true })
mkdirSync('src/geo', { recursive: true })
const index = { width: 975, height: 610, base: `/geo/${version}`, states: shapes.map(({ d: _d, ...s }) => s) }
writeFileSync('src/geo/us-states.json', `${JSON.stringify(index)}\n`)
console.log(`Wrote public/geo/${version}/ (${Object.keys(files).length} sprites) and src/geo/us-states.json.`)

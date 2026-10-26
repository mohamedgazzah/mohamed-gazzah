// Copies browser files that bundlers cannot follow into public/vendor (gitignored).
// MapLibre 6 loads its web worker from a separate module file.
import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('public/vendor', { recursive: true })
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/vendor/maplibre-gl-worker.mjs')
console.log('Copied MapLibre worker to public/vendor/')

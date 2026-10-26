export const dynamic = 'force-static'

/**
 * A basemap-free MapLibre style: no tiles, no colors, no network. Used in
 * tests and as a fallback when no basemap style is configured; incident
 * points still render on top.
 */
export function GET() {
  return Response.json({ version: 8, name: 'empty', sources: {}, layers: [] })
}

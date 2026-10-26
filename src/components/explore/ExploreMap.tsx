'use client'

import { Map as MLMap, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { MapPoint } from '@/server/public/incidents'

type Props = { points: MapPoint[]; styleLight: string; styleDark: string; labels: Record<string, string> }

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function isDark(): boolean {
  const t = document.documentElement.getAttribute('data-theme')
  if (t) return t === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Incident map. Points are clustered at national and state zoom. Fill shows
 * severity (muted palette); outline width and opacity show verification
 * level, so color is never the only signal. The list below the map is the
 * accessible alternative with the same filters.
 */
export default function ExploreMap({ points, styleLight, styleDark, labels }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    // The worker is served from public/vendor (copied by scripts/copy-vendor.mjs).
    setWorkerUrl('/vendor/maplibre-gl-worker.mjs')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const map = new MLMap({
      container: ref.current,
      style: isDark() ? styleDark : styleLight,
      center: [-96.5, 38.5],
      zoom: 3.1,
      minZoom: 2,
      maxZoom: 13,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      fadeDuration: reduced ? 0 : 300,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('error', (e) => {
      if (!map.isStyleLoaded()) setFailed(true)
      console.warn('[map]', e.error?.message)
    })
    map.on('load', () => {
      const accent = token('--accent')
      const severe = token('--status-severe')
      const surface = token('--surface')
      const text = token('--text')
      map.addSource('incidents', {
        type: 'geojson',
        cluster: true,
        clusterMaxZoom: 9,
        clusterRadius: 42,
        data: {
          type: 'FeatureCollection',
          features: points.map((p) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: { id: p.id, slug: p.slug, title: p.title, severity: p.severity, v: p.verificationLevel, date: labels[`date:${p.id}`] ?? p.dateStart, place: labels[`place:${p.id}`] ?? '', badges: labels[`badges:${p.id}`] ?? '' },
          })),
        },
      })
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'incidents',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': accent,
          'circle-opacity': 0.88,
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 25],
          'circle-stroke-color': surface,
          'circle-stroke-width': 2,
        },
      })
      // Text needs glyphs; a minimal style without them still shows the clusters.
      if (map.getStyle().glyphs) map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'incidents',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Bold', 'Noto Sans Regular'] },
        paint: { 'text-color': surface },
      })
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'incidents',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-color': ['case', ['>=', ['get', 'severity'], 4], severe, accent],
          'circle-opacity': ['match', ['get', 'v'], 'V1', 0.35, 0.9],
          'circle-stroke-color': text,
          'circle-stroke-width': ['match', ['get', 'v'], 'V3', 2.5, 'V2', 1.5, 1],
        },
      })
      map.on('click', 'clusters', async (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
        if (!feature) return
        const source = map.getSource('incidents') as GeoJSONSource
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number)
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom, duration: reduced ? 0 : 500 })
      })
      map.on('click', 'points', (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as Record<string, string>
        const box = document.createElement('div')
        box.className = 'space-y-1 text-sm'
        const meta = document.createElement('p')
        meta.className = 'text-muted'
        meta.textContent = `${p.date} · ${p.place}`
        const title = document.createElement('p')
        title.className = 'font-semibold'
        title.textContent = p.title ?? ''
        const badges = document.createElement('p')
        badges.textContent = p.badges ?? ''
        const link = document.createElement('a')
        link.href = `/incidents/${p.id}-${p.slug}`
        link.textContent = 'Open record'
        box.append(meta, title, badges, link)
        new Popup({ closeButton: true, maxWidth: '300px' })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setDOMContent(box)
          .addTo(map)
      })
      for (const layer of ['clusters', 'points']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }
    })
    return () => map.remove()
  }, [points, styleLight, styleDark, labels])

  return (
    <div className="card overflow-hidden">
      <div
        ref={ref}
        className="h-[60vh] min-h-80 w-full"
        role="region"
        aria-label={`Map of ${points.length} incidents. Use the list below the map for the same records.`}
      />
      {failed ? (
        <p className="p-4 text-base" role="status">
          The map could not load. The list below shows the same incidents.
        </p>
      ) : null}
      <p className="border-t border-rule px-4 py-2 text-sm text-muted">
        Positions are approximate: city-level records are placed near the city center with a small fixed offset. A thick outline marks V3,
        a thin outline V2, and a faint fill V1; a darker fill marks injury or death.
      </p>
    </div>
  )
}

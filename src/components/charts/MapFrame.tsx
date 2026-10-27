'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

// The view the map showed when a state or city was clicked, so the next map
// can zoom from it, also across pages (home to Explore).
let departure: { viewBox: string; at: number } | null = null

const ZOOM_MS = 450

/**
 * The map's <svg>. It zooms smoothly between views (all states, one state),
 * outlines the state under the pointer, and follows links inside the map
 * without reloading the page. Without JavaScript the links still work.
 */
export function MapFrame({ viewBox, children }: { viewBox: string; children: ReactNode }) {
  const svg = useRef<SVGSVGElement>(null)
  const hover = useRef<SVGUseElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useLayoutEffect(() => {
    const el = svg.current
    const from = departure && performance.now() - departure.at < 5000 ? departure.viewBox : null
    departure = null
    if (!el || !from || from === viewBox || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const a = from.split(' ').map(Number)
    const b = viewBox.split(' ').map(Number)
    if (a.length !== 4 || b.length !== 4) return
    el.setAttribute('viewBox', from)
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      // A frame's timestamp can precede `start`; clamp so the zoom never runs backward.
      const t = Math.min(1, Math.max(0, (now - start) / ZOOM_MS))
      const e = 1 - (1 - t) ** 3
      el.setAttribute('viewBox', a.map((v, i) => (v + (b[i]! - v) * e).toFixed(2)).join(' '))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      el.setAttribute('viewBox', viewBox)
    }
  }, [viewBox])

  return (
    <svg
      ref={svg}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      className="block h-auto w-full"
      onPointerOver={(e) => {
        // Outline the state under the pointer on top of its neighbors.
        const shape = (e.target as Element).closest('[data-state]')?.querySelector('use')?.getAttribute('href')
        if (shape) hover.current?.setAttribute('href', shape)
        else hover.current?.removeAttribute('href')
      }}
      onPointerLeave={() => hover.current?.removeAttribute('href')}
      // The map's links are for pointers (keyboards use the list beside it): no focus ring on click.
      onMouseDown={(e) => {
        if ((e.target as Element).closest('a')) e.preventDefault()
      }}
      onClick={(e) => {
        const link = (e.target as Element).closest('a')
        const href = link?.getAttribute('href')
        if (!href?.startsWith('/') || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        departure = { viewBox: svg.current?.getAttribute('viewBox') ?? viewBox, at: performance.now() }
        // Stay in place when zooming within a page; start at the map on a new page.
        const samePage = new URL(href, window.location.href).pathname === pathname
        router.push(href, { scroll: !samePage })
      }}
    >
      {children}
      <use ref={hover} className="map-hover" />
    </svg>
  )
}

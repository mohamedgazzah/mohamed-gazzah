'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useTransition, type ReactNode } from 'react'

// The view the map showed when a state, city or map link was clicked, so the
// next map can zoom from it, also across pages (home to Explore).
let departure: { viewBox: string; at: number } | null = null
let current: string | null = null
// A link in the map's section was activated from the keyboard: the link may be gone after the zoom,
// so focus moves to the map's heading instead of falling back to the page.
let refocus = false

const ZOOM_MS = 450

/** Map units per CSS pixel for a viewBox, so pins keep their size on screen. */
function setUnit(el: SVGSVGElement, viewBox: string) {
  const w = Number(viewBox.split(' ')[2])
  if (el.clientWidth > 0 && w > 0) el.style.setProperty('--u', String(w / el.clientWidth))
}

/**
 * The map's <svg>. It zooms smoothly between views (all states, one state),
 * outlines the state under the pointer (beneath the city circles), and
 * follows links inside the map without reloading the page, dimming the old
 * view while the new one loads. Without JavaScript the links still work.
 */
export function MapFrame({ viewBox, unit, overlay, children }: { viewBox: string; unit: number; overlay?: ReactNode; children: ReactNode }) {
  const svg = useRef<SVGSVGElement>(null)
  const hover = useRef<SVGUseElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()

  useLayoutEffect(() => {
    const el = svg.current
    current = viewBox
    const from = departure && performance.now() - departure.at < 5000 ? departure.viewBox : null
    departure = null
    if (el) setUnit(el, viewBox)
    if (refocus) {
      refocus = false
      const heading = el?.closest('section')?.querySelector<HTMLElement>('[id="map-heading"]')
      if (heading && !heading.contains(document.activeElement)) heading.focus({ preventScroll: true })
    }
    if (!el || !from || from === viewBox || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const a = from.split(' ').map(Number)
    const b = viewBox.split(' ').map(Number)
    if (a.length !== 4 || b.length !== 4) return
    el.setAttribute('viewBox', from)
    setUnit(el, from)
    const startAt = performance.now()
    let frame = 0
    const step = (now: number) => {
      // A frame's timestamp can precede the start; clamp so the zoom never runs backward.
      const t = Math.min(1, Math.max(0, (now - startAt) / ZOOM_MS))
      const e = 1 - (1 - t) ** 3
      const vb = a.map((v, i) => (v + (b[i]! - v) * e).toFixed(2)).join(' ')
      el.setAttribute('viewBox', vb)
      setUnit(el, vb)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      el.setAttribute('viewBox', viewBox)
      setUnit(el, viewBox)
    }
  }, [viewBox])

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const ro = new ResizeObserver(() => setUnit(el, el.getAttribute('viewBox') ?? viewBox))
    ro.observe(el)
    // Links elsewhere in the map's section (the state list, "All states") zoom from this view too.
    const section = el.closest('section')
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest('a')
      if (link && !el.contains(link) && link.getAttribute('href')?.startsWith('/')) {
        departure = { viewBox: current ?? viewBox, at: performance.now() }
        // A click from the keyboard (Enter) has no pointer position.
        refocus = e.detail === 0
      }
    }
    section?.addEventListener('click', onClick)
    return () => {
      ro.disconnect()
      section?.removeEventListener('click', onClick)
    }
  }, [viewBox])

  return (
    <svg
      ref={svg}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      className="block h-auto w-full"
      style={{ ['--u' as string]: unit }}
      data-pending={pending ? '' : undefined}
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
        hover.current?.removeAttribute('href')
        // Stay in place when zooming within a page; start at the map on a new page.
        const samePage = new URL(href, window.location.href).pathname === pathname
        start(() => router.push(href, { scroll: !samePage }))
      }}
    >
      {children}
      <use ref={hover} className="map-hover" />
      {overlay}
    </svg>
  )
}

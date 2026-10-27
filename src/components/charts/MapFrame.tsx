'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useTransition, type ReactNode } from 'react'

type Frame = [number, number, number, number]

// The part of the map on screen when a state, city or map link was clicked, so the
// next map can zoom from it, also across pages (home to Explore).
let departure: { frame: Frame; at: number } | null = null
// A link in the map's section was activated from the keyboard: the link may be gone after the zoom,
// so focus moves to the map's heading once the page has changed.
let refocus: { from: string; at: number } | null = null

const ZOOM_MS = 450

const parse = (viewBox: string) => viewBox.split(' ').map(Number) as Frame

/** The part of a view the map shows: all of it, or on a phone, where the box is a state's own shape, less the sides "slice" crops. */
function shown(el: SVGSVGElement, [x, y, w, h]: Frame): Frame {
  const box = el.getBoundingClientRect()
  const aspect = box.height > 0 ? box.width / box.height : w / h
  return w / h > aspect ? [x + (w - h * aspect) / 2, y, h * aspect, h] : [x, y + (h - w / aspect) / 2, w, w / aspect]
}

/** Map units per CSS pixel for a view, so pins keep their size on screen. */
function setUnit(el: SVGSVGElement, viewBox: string) {
  const frame = parse(viewBox)
  const width = el.getBoundingClientRect().width
  if (width > 0 && frame[2] > 0) el.style.setProperty('--u', String(shown(el, frame)[2] / width))
}

/**
 * The map's <svg>. It zooms smoothly between views (all states, one state),
 * outlines the state under the pointer (beneath the city circles), and
 * follows links inside the map without reloading the page, dimming the old
 * view while the new one loads. Without JavaScript the links still work.
 */
export function MapFrame({
  viewBox,
  unit,
  phoneAspect,
  overlay,
  children,
}: {
  viewBox: string
  unit: number
  /** The box's shape on a phone (StateMap), when a zoomed state is framed to its own shape. */
  phoneAspect?: number | null
  overlay?: ReactNode
  children: ReactNode
}) {
  const svg = useRef<SVGSVGElement>(null)
  const hover = useRef<SVGUseElement>(null)
  // What the map shows, also mid-zoom, so the next zoom starts from it.
  const onScreen = useRef<Frame | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()

  useLayoutEffect(() => {
    const el = svg.current
    if (!el) return
    // A click in the map's section left from a view; Back, Forward and the filters zoom from this map's own.
    const from = departure && performance.now() - departure.at < 5000 ? departure.frame : onScreen.current
    departure = null
    // React has written the new view, unless a zoom was under way: write it again, so the frame is always current.
    el.setAttribute('viewBox', viewBox)
    setUnit(el, viewBox)
    const to = shown(el, parse(viewBox))
    onScreen.current = to
    const width = el.getBoundingClientRect().width
    if (!from || width <= 0 || from.every((v, i) => Math.abs(v - to[i]!) < 0.5) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Start from the last view, at its scale, in this box's shape (a phone frames a state taller than the country).
    const a: Frame = [from[0], from[1], from[2], (from[2] * to[3]) / to[2]]
    const draw = (f: Frame) => {
      el.setAttribute('viewBox', f.map((v) => v.toFixed(2)).join(' '))
      el.style.setProperty('--u', String(f[2] / width))
      onScreen.current = f
    }
    draw(a)
    const startAt = performance.now()
    let frame = 0
    const step = (now: number) => {
      // A frame's timestamp can precede the start; clamp so the zoom never runs backward.
      const t = Math.min(1, Math.max(0, (now - startAt) / ZOOM_MS))
      const e = 1 - (1 - t) ** 3
      if (t < 1) {
        draw(a.map((v, i) => v + (to[i]! - v) * e) as Frame)
        frame = requestAnimationFrame(step)
      } else {
        el.setAttribute('viewBox', viewBox)
        setUnit(el, viewBox)
        onScreen.current = to
      }
    }
    frame = requestAnimationFrame(step)
    // Only stop the zoom: the next view (or React) writes the frame.
    return () => cancelAnimationFrame(frame)
  }, [viewBox])

  // After a keyboard zoom, once the page has changed (the view may not have): focus the map's heading,
  // and bring it into view below the sticky bars.
  useLayoutEffect(() => {
    if (!refocus || refocus.from === window.location.href) return
    const recent = performance.now() - refocus.at < 5000
    refocus = null
    const heading = svg.current?.closest('section')?.querySelector<HTMLElement>('[id="map-heading"]')
    if (!recent || !heading || heading.contains(document.activeElement)) return
    heading.focus({ preventScroll: true })
    heading.scrollIntoView({ block: 'nearest' })
  })

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
        departure = { frame: shown(el, parse(el.getAttribute('viewBox') ?? viewBox)), at: performance.now() }
        // A click from the keyboard (Enter) has no pointer position.
        refocus = e.detail === 0 ? { from: window.location.href, at: performance.now() } : null
      }
    }
    // A pointer anywhere means the reader has moved on: a keyboard zoom still loading no longer moves focus.
    const onPointer = () => {
      refocus = null
    }
    section?.addEventListener('click', onClick)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      ro.disconnect()
      section?.removeEventListener('click', onClick)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [viewBox])

  return (
    <svg
      ref={svg}
      viewBox={viewBox}
      // Fills the box; only a phone's state frame (a box of the state's shape) has sides to crop.
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className="map-frame block h-auto w-full"
      style={{ ['--u' as string]: unit, ['--phone-aspect' as string]: phoneAspect ?? undefined }}
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
        const el = e.currentTarget
        departure = { frame: shown(el, parse(el.getAttribute('viewBox') ?? viewBox)), at: performance.now() }
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

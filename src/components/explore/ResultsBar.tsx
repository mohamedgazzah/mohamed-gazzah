'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The count and the downloads above the map. On wide screens it sticks under
 * the header and the table's column names stick under it, so it reports its
 * real height (--results-bar-measured) for them to follow if a font setting
 * ever makes it taller than one line. Without JavaScript the CSS uses the
 * one-line --results-bar-h.
 */
export function ResultsBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = ref.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--results-bar-measured', `${bar.getBoundingClientRect().height}px`))
    observer.observe(bar, { box: 'border-box' })
    return () => {
      observer.disconnect()
      root.style.removeProperty('--results-bar-measured')
    }
  }, [])
  return (
    <div ref={ref} className="results-bar glass">
      {children}
    </div>
  )
}

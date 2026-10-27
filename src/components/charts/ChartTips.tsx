'use client'

import { useRef, useState, type ReactNode } from 'react'

type Tip = { x: number; y: number; label: string; value: string }

/**
 * One tooltip for every chart mark inside: any element with data-tip (the
 * label) and data-tip-value (the number). Hover and keyboard focus show the
 * same text. Tooltips only add convenience: every value is also in a label or
 * a table next to the chart.
 */
export function ChartTips({ children, className = '' }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)

  function show(target: EventTarget | null, clientX?: number, clientY?: number) {
    const host = box.current
    const mark = target instanceof Element ? target.closest('[data-tip]') : null
    if (!host || !mark || !host.contains(mark)) return setTip(null)
    const frame = host.getBoundingClientRect()
    let x = clientX
    let y = clientY
    if (x === undefined || y === undefined) {
      const r = mark.getBoundingClientRect()
      x = r.left + r.width / 2
      y = r.top
    }
    // Keep the tooltip inside the chart.
    const left = Math.min(Math.max(x - frame.left, 70), frame.width - 70)
    setTip({ x: left, y: y - frame.top, label: mark.getAttribute('data-tip') ?? '', value: mark.getAttribute('data-tip-value') ?? '' })
  }

  return (
    <div
      ref={box}
      className={`relative ${className}`}
      onPointerMove={(e) => show(e.target, e.clientX, e.clientY)}
      onPointerLeave={() => setTip(null)}
      // A click navigates (a state, a city, a month): the old tooltip must not outlive it.
      onClick={() => setTip(null)}
      onFocus={(e) => show(e.target)}
      onBlur={() => setTip(null)}
    >
      {children}
      {tip ? (
        <div className="chart-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
          {tip.value ? <strong>{tip.value}</strong> : null}
          <span>{tip.label}</span>
        </div>
      ) : null}
    </div>
  )
}

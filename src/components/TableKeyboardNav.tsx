'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Arrow-key navigation for data tables: ↑/↓ move between rows, Home/End jump
 * to the first or last row. Tab still works as normal.
 */
export function TableKeyboardNav({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const target = e.target as HTMLElement
      const row = target.closest('tbody tr')
      if (!row) return
      const rows = Array.from(el.querySelectorAll<HTMLTableRowElement>('tbody tr'))
      const idx = rows.indexOf(row as HTMLTableRowElement)
      const next =
        e.key === 'ArrowDown' ? rows[idx + 1] : e.key === 'ArrowUp' ? rows[idx - 1] : e.key === 'Home' ? rows[0] : rows[rows.length - 1]
      const link = next?.querySelector<HTMLElement>('a, button')
      if (link) {
        e.preventDefault()
        link.focus()
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [])
  return <div ref={ref}>{children}</div>
}

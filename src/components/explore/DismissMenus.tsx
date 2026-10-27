'use client'

import { useEffect } from 'react'

const OPEN_MENUS = 'details.results-menu[open], details.custom-range[open]'

/**
 * "Download or print" and "Custom range" are <details>, so they work without
 * JavaScript. With it they close as menus do: on Escape, with focus back on
 * their button, and on a press outside them while they float over the page
 * (on phones the custom range opens in the page, and scrolling must not shut it).
 */
export function DismissMenus() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(OPEN_MENUS)) {
        const hadFocus = menu.contains(document.activeElement)
        menu.open = false
        if (hadFocus) menu.querySelector('summary')?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(OPEN_MENUS)) {
        const sheet = menu.querySelector(':scope > :not(summary)')
        if (!menu.contains(e.target as Node) && sheet && getComputedStyle(sheet).position === 'absolute') menu.open = false
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [])
  return null
}

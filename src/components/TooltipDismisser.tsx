'use client'

import { useEffect } from 'react'

/** Escape hides any open tooltip until the pointer or focus moves. */
export function TooltipDismisser() {
  useEffect(() => {
    const root = document.documentElement
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') root.classList.add('tips-dismissed')
    }
    const reset = () => root.classList.remove('tips-dismissed')
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointermove', reset, { passive: true })
    document.addEventListener('focusin', reset)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointermove', reset)
      document.removeEventListener('focusin', reset)
    }
  }, [])
  return null
}

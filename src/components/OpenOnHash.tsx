'use client'

import { useEffect } from 'react'

/**
 * Opens the <details> with this id when a link points at it, or when the
 * page is opened at its address, so "Cite this record" lands on the formats
 * rather than on a closed box.
 */
export function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    const open = () => {
      const el = document.getElementById(id)
      if (el instanceof HTMLDetailsElement) el.open = true
    }
    const onHash = () => {
      if (location.hash === `#${id}`) open()
    }
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.(`a[href="#${id}"]`)) open()
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('click', onClick)
    }
  }, [id])
  return null
}

'use client'

import { SlidersHorizontal } from 'lucide-react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

type Sheet = { open: boolean; setOpen: (open: boolean) => void; button: RefObject<HTMLButtonElement | null> }
const SheetContext = createContext<Sheet | null>(null)

/** Shares the sheet's state between its button (in the toolbar) and the sheet itself (in the rail). */
export function FilterSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return <SheetContext value={{ open, setOpen, button }}>{children}</SheetContext>
}

function useSheet(): Sheet {
  const sheet = useContext(SheetContext)
  if (!sheet) throw new Error('FilterDrawer needs a <FilterSheet> around it')
  return sheet
}

/** Below 64rem: the button that opens the filter sheet. It counts only what is set inside the sheet. */
export function FilterSheetButton({ activeCount, className = '' }: { activeCount: number; className?: string }) {
  const { open, setOpen, button } = useSheet()
  return (
    <button
      ref={button}
      type="button"
      className={`filter-sheet-button btn btn-secondary btn-sm lg:hidden ${className}`}
      aria-expanded={open}
      aria-controls="filters"
      onClick={() => setOpen(true)}
    >
      <SlidersHorizontal aria-hidden="true" />
      Filters{activeCount ? ` (${activeCount} active)` : ''}
    </button>
  )
}

/**
 * Below 64rem the filter rail is a sheet opened from the toolbar (along the
 * bottom on phones, at the side from 48rem); on wider screens it is always
 * visible. Without JavaScript the rail is shown inline and the button is
 * hidden (see the <noscript> style), so filters always work.
 */
export function FilterDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen, button } = useSheet()
  const panelRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    // A modal sheet: the rest of the page is inert while it is open, so Tab and screen readers stay
    // inside it. That is every sibling of the sheet and of each of its ancestors, except the scrim.
    const inert: HTMLElement[] = []
    for (let el: HTMLElement = panel; el.parentElement && el !== document.body; el = el.parentElement) {
      for (const other of el.parentElement.children) {
        if (other !== el && other !== scrimRef.current && other instanceof HTMLElement && !other.inert) {
          other.inert = true
          inert.push(other)
        }
      }
    }
    panel.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Turned or widened to 64rem, the sheet becomes the rail beside the results: nothing to close then.
    const wide = window.matchMedia('(min-width: 64rem)')
    const onWide = () => {
      if (wide.matches) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
      document.body.style.overflow = ''
      for (const el of inert) el.inert = false
      // However it was closed (Close, Escape, the scrim), focus goes back to the button that opened it.
      if (!wide.matches) button.current?.focus()
    }
  }, [open, setOpen, button])

  return (
    <>
      <noscript>
        <style>{`.filter-panel{display:block !important;position:static !important;max-height:none !important}.filter-sheet-button{display:none !important}@media (max-width:63.99rem){.filter-panel{margin-bottom:2rem}}`}</style>
      </noscript>
      {open ? <div ref={scrimRef} className="fixed inset-0 z-40 bg-[var(--scrim)] lg:hidden" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <div
        ref={panelRef}
        id="filters"
        data-open={open}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Filters' : undefined}
        className="filter-panel"
      >
        {open ? (
          <div className="flex shrink-0 items-center justify-between px-4 py-3 lg:hidden">
            <p className="text-xl font-semibold">Filters</p>
            <button type="button" className="btn btn-secondary" data-autofocus onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  )
}

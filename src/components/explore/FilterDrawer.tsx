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
 * Below 64rem the filter rail is a bottom sheet opened from the toolbar; on
 * wider screens it is always visible. Without JavaScript the rail is shown
 * inline and the button is hidden (see the <noscript> style), so filters
 * always work.
 */
export function FilterDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen, button } = useSheet()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, setOpen, button])

  return (
    <>
      <noscript>
        <style>{`.filter-panel{display:block !important;position:static !important;max-height:none !important}.filter-sheet-button{display:none !important}`}</style>
      </noscript>
      {open ? <div className="fixed inset-0 z-40 bg-[var(--scrim)] lg:hidden" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <div
        ref={panelRef}
        id="filters"
        data-open={open}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Filters' : undefined}
        className="filter-panel max-lg:hidden max-lg:data-[open=true]:fixed max-lg:data-[open=true]:inset-x-0 max-lg:data-[open=true]:bottom-0 max-lg:data-[open=true]:z-50 max-lg:data-[open=true]:flex max-lg:data-[open=true]:max-h-[88dvh] max-lg:data-[open=true]:flex-col max-lg:data-[open=true]:overflow-hidden max-lg:data-[open=true]:rounded-t-[24px] max-lg:data-[open=true]:bg-surface max-lg:data-[open=true]:shadow-[var(--shadow-lg)]"
      >
        {open ? (
          <div className="flex shrink-0 items-center justify-between px-4 py-3 lg:hidden">
            <p className="text-xl font-semibold">Filters</p>
            <button
              type="button"
              className="btn btn-secondary"
              data-autofocus
              onClick={() => {
                setOpen(false)
                button.current?.focus()
              }}
            >
              Close
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  )
}

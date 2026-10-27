'use client'

import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * On small screens the filter rail becomes a bottom sheet opened by a button.
 * On wider screens it is always visible. Without JavaScript the rail is shown
 * inline (see the <noscript> style), so filters always work.
 */
export function FilterDrawer({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <noscript>
        <style>{`.filter-panel{display:block !important;position:static !important;max-height:none !important}`}</style>
      </noscript>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary w-full md:hidden"
        aria-expanded={open}
        aria-controls="filters"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal aria-hidden="true" />
        Filters{activeCount ? ` (${activeCount} active)` : ''}
      </button>
      {open ? <div className="fixed inset-0 z-40 bg-[var(--scrim)] md:hidden" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <div
        ref={panelRef}
        id="filters"
        data-open={open}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Filters' : undefined}
        className="filter-panel max-md:hidden max-md:data-[open=true]:fixed max-md:data-[open=true]:inset-x-0 max-md:data-[open=true]:bottom-0 max-md:data-[open=true]:z-50 max-md:data-[open=true]:flex max-md:data-[open=true]:max-h-[88dvh] max-md:data-[open=true]:flex-col max-md:data-[open=true]:overflow-hidden max-md:data-[open=true]:rounded-t-[24px] max-md:data-[open=true]:bg-surface max-md:data-[open=true]:shadow-[var(--shadow-lg)]"
      >
        {open ? (
          <div className="flex shrink-0 items-center justify-between border-b border-rule px-4 py-3 md:hidden">
            <p className="text-xl font-semibold">Filters</p>
            <button type="button" className="btn btn-secondary" data-autofocus onClick={() => { setOpen(false); buttonRef.current?.focus() }}>
              Close
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  )
}

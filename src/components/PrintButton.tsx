'use client'

import { Printer } from 'lucide-react'

/** Opens the browser's print dialog, where "Save as PDF" is also offered. */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      {label}
    </button>
  )
}

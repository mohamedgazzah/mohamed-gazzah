'use client'

/** Opens the browser's print dialog, where "Save as PDF" is also offered. */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      {label}
    </button>
  )
}

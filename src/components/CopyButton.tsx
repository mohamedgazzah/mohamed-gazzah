'use client'

import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'

/** Copies text; the label turns into "Copied" for two seconds and a screen reader hears it once. */
export function CopyButton({ text, label, className = 'btn btn-secondary', icon }: { text: string; label: string; className?: string; icon?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? <Check aria-hidden="true" className="pop-in" /> : icon}
        <span className="inline-grid justify-items-start text-start">
          {/* Both labels take up space, so the button never changes width; the label is only faded, so the button keeps its name. */}
          <span className={`col-start-1 row-start-1 ${copied ? 'opacity-0' : ''}`}>{label}</span>
          <span aria-hidden="true" className={`col-start-1 row-start-1 ${copied ? '' : 'opacity-0'}`}>
            Copied
          </span>
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied to the clipboard' : ''}
      </span>
    </>
  )
}

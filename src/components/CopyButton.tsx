'use client'

import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export function CopyButton({ text, label, className = 'btn btn-secondary', icon }: { text: string; label: string; className?: string; icon?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
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
      {copied ? <Check aria-hidden="true" /> : icon}
      {label}
      <span aria-live="polite" className="text-sm font-normal">
        {copied ? '— copied' : ''}
      </span>
    </button>
  )
}

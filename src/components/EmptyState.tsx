import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="card flex items-start gap-4 px-5 py-8 text-[17px] leading-snug md:px-7">
      <span className="icon-chip" aria-hidden="true">
        <SearchX />
      </span>
      <div className="pt-1.5">{children}</div>
    </div>
  )
}

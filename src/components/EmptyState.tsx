import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="border-y border-ink px-1 py-10 font-serif text-[22px] leading-snug text-text">{children}</div>
}

import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card px-5 py-8 text-base text-text">{children}</div>
}

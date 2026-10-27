import type { ReactNode } from 'react'

/** A page opening: a small label, the title, and an optional standfirst. */
export function PageHeader({ kicker, icon, title, children }: { kicker?: string; icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-4 pb-4 md:pt-8">
      {kicker ? (
        <p className="glass eyebrow">
          {icon}
          {kicker}
        </p>
      ) : null}
      <h1 className="display mt-5 max-w-[22ch] text-5xl">{title}</h1>
      {children ? <div className="lede mt-5 max-w-[64ch]">{children}</div> : null}
    </header>
  )
}

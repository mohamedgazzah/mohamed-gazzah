import type { ReactNode } from 'react'

/** A page opening: a small label, the title, and an optional standfirst. */
export function PageHeader({
  kicker,
  icon,
  title,
  compact = false,
  children,
}: {
  kicker?: string
  icon?: ReactNode
  title: ReactNode
  /** A smaller opening for working pages (Explore), so the data starts sooner. */
  compact?: boolean
  children?: ReactNode
}) {
  if (compact) {
    return (
      <header className="pt-2 pb-1 md:pt-4">
        <h1 className="display text-[32px] md:text-[40px]">{title}</h1>
        {children ? <div className="mt-2 max-w-[70ch] text-[16px] text-muted">{children}</div> : null}
      </header>
    )
  }
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

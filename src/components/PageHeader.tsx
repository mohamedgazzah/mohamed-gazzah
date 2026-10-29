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
  /** A smaller opening for working pages (Explore, Report), so the task starts sooner. */
  compact?: boolean
  children?: ReactNode
}) {
  if (compact) {
    return (
      <header className="pt-2 pb-1 md:pt-4">
        {kicker ? (
          <p className="glass eyebrow mb-4">
            {icon}
            {kicker}
          </p>
        ) : null}
        <h1 className="display text-h1">{title}</h1>
        {children ? <p className="page-lede mt-2 max-w-[70ch] text-base text-muted">{children}</p> : null}
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
      {children ? <p className="page-lede lede mt-5 max-w-[64ch]">{children}</p> : null}
    </header>
  )
}

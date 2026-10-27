import type { ReactNode } from 'react'

/** A page opening: kicker, title in display type, and an optional standfirst to the right. */
export function PageHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="grid gap-x-6 gap-y-5 border-b border-ink pb-8 md:grid-cols-12">
      <div className="md:col-span-8">
        <p className="kicker">{kicker}</p>
        <h1 className="display mt-3 text-4xl">{title}</h1>
      </div>
      {children ? <div className="max-w-[46ch] self-end text-[15.5px] text-muted md:col-span-4">{children}</div> : null}
    </header>
  )
}

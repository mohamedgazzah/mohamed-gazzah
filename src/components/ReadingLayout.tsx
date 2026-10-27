import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { ContentsNav } from './ContentsNav'

/** Section id, its title, and an optional shorter title for the contents list. */
export type Contents = readonly (readonly [id: string, title: string, short?: string])[]

/**
 * Long pages: a contents card (sticky on wide screens) beside a reading
 * column. On phones the contents fold into a closed disclosure. A rail can
 * come before the text (contents) or after it (notes beside a form), so the
 * reading order on small screens follows what matters most.
 */
export function ReadingLayout({
  contents,
  rail,
  railSide = 'start',
  children,
}: {
  contents?: Contents
  rail?: ReactNode
  railSide?: 'start' | 'end'
  children: ReactNode
}) {
  const items = contents?.map(([id, title, short]) => ({ id, title: short ?? title })) ?? []
  const aside = (
    <aside
      className={railSide === 'end' ? 'md:col-span-4 lg:col-span-3 lg:col-start-10' : 'md:col-span-4 lg:col-span-3'}
      aria-label={contents ? undefined : 'Notes'}
    >
      <div className="space-y-6 md:sticky md:top-24">
        {contents ? (
          <>
            <details className="glass contents-mobile rounded-[var(--radius-md)] md:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold">
                <span>
                  On this page <span className="font-normal text-muted">· {items.length} sections</span>
                </span>
                <ChevronDown aria-hidden="true" size={18} className="contents-chevron text-muted" />
              </summary>
              <nav aria-label="On this page" className="px-2 pb-3">
                <ContentsNav items={items} />
              </nav>
            </details>
            <nav aria-label="On this page" className="contents-card hidden md:block">
              <p className="kicker px-2 pt-1">On this page</p>
              <ContentsNav items={items} className="mt-2" />
            </nav>
          </>
        ) : null}
        {rail}
      </div>
    </aside>
  )
  return (
    <div className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-12">
      {railSide === 'start' ? aside : null}
      <div className={railSide === 'end' ? 'min-w-0 md:col-span-8 lg:col-span-8' : 'min-w-0 md:col-span-8 lg:col-span-8'}>
        <div className="max-w-reading">{children}</div>
      </div>
      {railSide === 'end' ? aside : null}
    </div>
  )
}

/** A numbered section of a reading page; an icon can stand in for the number. */
export function ReadingSection({ id, n, icon, title, children }: { id: string; n?: number; icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="reading-section">
      <div className="section-head flex items-start gap-3">
        {icon ? (
          <span aria-hidden="true" className="icon-chip mt-0.5">
            {icon}
          </span>
        ) : n ? (
          <span aria-hidden="true" className="tabular mt-1 inline-grid h-8 min-w-8 place-items-center rounded-full bg-accent-tint px-2 text-[13px] font-semibold text-accent">
            {n}
          </span>
        ) : null}
        <h2 id={`${id}-h`} className="text-[28px] leading-[1.15] md:text-[32px]">
          {title}
        </h2>
      </div>
      <div className="reading mt-5 space-y-4">{children}</div>
    </section>
  )
}

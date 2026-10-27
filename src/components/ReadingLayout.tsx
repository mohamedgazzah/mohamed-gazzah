import { Link2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { ContentsNav } from './ContentsNav'

/** Section id, its title, and an optional shorter title for the contents list. */
export type Contents = readonly (readonly [id: string, title: string, short?: string])[]

/**
 * Long pages: a contents card (sticky on wide screens) beside a reading
 * column. Below 64rem the contents fold into a disclosure that stays under
 * the header. A rail can
 * come before the text (contents) or after it (notes beside a form), so the
 * reading order on small screens follows what matters most.
 */
export function ReadingLayout({
  contents,
  icons,
  rail,
  railSide = 'start',
  railClassName,
  children,
}: {
  contents?: Contents
  /** Icons for the contents list, by section id, where the sections show icons instead of numbers. */
  icons?: Partial<Record<string, ReactNode>>
  rail?: ReactNode
  railSide?: 'start' | 'end'
  /** Extra classes for the rail's column, so a page can hide it in some states. */
  railClassName?: string
  children: ReactNode
}) {
  const items = contents?.map(([id, title, short]) => ({ id, title: short ?? title, icon: icons?.[id] })) ?? []
  // Below 64rem a contents-only rail is a pill that sticks under the header, so the list is always a tap
  // away and the text keeps the full width (a side column there squeezed it to about 30 characters).
  const sticky = contents && !rail ? 'reading-pill max-lg:sticky max-lg:top-[var(--sticky-top)] max-lg:z-20' : ''
  const aside = (
    <aside
      // min-w-0: a grid item's width would otherwise follow the pill's unwrapped label and widen the page on phones.
      className={['min-w-0', railSide === 'end' ? 'lg:col-span-3 lg:col-start-10' : 'lg:col-span-3', sticky, railClassName].filter(Boolean).join(' ')}
      aria-label={contents ? undefined : 'Notes'}
    >
      <div className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
        {contents ? <ContentsNav items={items} /> : null}
        {rail}
      </div>
    </aside>
  )
  return (
    <div className="mt-10 grid gap-x-8 gap-y-10 lg:grid-cols-12">
      {railSide === 'start' ? aside : null}
      <div className="min-w-0 lg:col-span-8">
        <div className="max-w-reading">{children}</div>
      </div>
      {railSide === 'end' ? aside : null}
    </div>
  )
}

/**
 * A section of a reading page. Its number is set as type before the title
 * (muted, the title's size); an icon can stand in for the number.
 */
export function ReadingSection({ id, n, icon, title, children }: { id: string; n?: number; icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="reading-section">
      <div className="section-head flex items-start gap-3">
        {icon ? (
          <span aria-hidden="true" className="icon-chip mt-0.5">
            {icon}
          </span>
        ) : null}
        <h2 id={`${id}-h`} className="text-h2">
          {n && !icon ? (
            <span aria-hidden="true" className="section-num tabular">
              {n}
            </span>
          ) : null}
          {title}
        </h2>
        {/* A link to the section, for citing it; shown on hover and focus. */}
        <a href={`#${id}`} className="heading-anchor" aria-label={`Link to this section: ${title}`}>
          <Link2 aria-hidden="true" />
        </a>
      </div>
      <div className="reading mt-5 space-y-4">{children}</div>
    </section>
  )
}

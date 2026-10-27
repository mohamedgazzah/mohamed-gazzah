import type { ReactNode } from 'react'

export type Contents = readonly (readonly [id: string, title: string])[]

/** Long pages: a contents card (sticky on wide screens) beside a 720px reading column. */
export function ReadingLayout({ contents, rail, children }: { contents?: Contents; rail?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-12">
      <aside className="md:col-span-4 lg:col-span-3" aria-label={contents ? undefined : 'Notes'}>
        <div className="space-y-6 md:sticky md:top-24">
          {contents ? (
            <nav aria-label="On this page" className="glass rounded-[var(--radius-md)] p-3">
              <p className="kicker px-2 pt-1">On this page</p>
              <ol className="mt-2 space-y-0.5 text-[14.5px]">
                {contents.map(([id, title], i) => (
                  <li key={id}>
                    <a href={`#${id}`} className="flex gap-3 rounded-[10px] px-2 py-1.5 text-text no-underline hover:bg-row-hover hover:no-underline">
                      <span aria-hidden="true" className="tabular w-4 shrink-0 text-muted">
                        {i + 1}
                      </span>
                      {title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          {rail}
        </div>
      </aside>
      <div className="min-w-0 md:col-span-8 lg:col-span-8">
        <div className="max-w-reading">{children}</div>
      </div>
    </div>
  )
}

/** A numbered section of a reading page. */
export function ReadingSection({ id, n, title, children }: { id: string; n?: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-16 scroll-mt-24 first:mt-0">
      <div className="section-head flex items-center gap-3">
        {n ? (
          <span aria-hidden="true" className="tabular inline-grid h-8 min-w-8 place-items-center rounded-full bg-accent-tint px-2 text-[13px] font-semibold text-accent">
            {n}
          </span>
        ) : null}
        <h2 id={`${id}-h`} className="text-[28px] leading-[1.12] md:text-[32px]">
          {title}
        </h2>
      </div>
      <div className="reading mt-5 space-y-4">{children}</div>
    </section>
  )
}

import type { ReactNode } from 'react'

export type Contents = readonly (readonly [id: string, title: string])[]

/** Long pages: a contents rail (sticky on wide screens) beside a 720px reading column. */
export function ReadingLayout({ contents, rail, children }: { contents?: Contents; rail?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-10 grid gap-x-6 gap-y-10 md:grid-cols-12">
      <aside className="md:col-span-3" aria-label={contents ? undefined : 'Notes'}>
        <div className="space-y-8 md:sticky md:top-8">
          {contents ? (
            <nav aria-label="On this page" className="border-t border-ink pt-3">
              <p className="kicker">On this page</p>
              <ol className="mt-3 space-y-1.5 text-[14.5px]">
                {contents.map(([id, title], i) => (
                  <li key={id} className="flex gap-3">
                    <span aria-hidden="true" className="mono w-5 shrink-0 pt-px text-muted">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <a href={`#${id}`} className="text-text no-underline hover:text-accent hover:underline">
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
      <div className="min-w-0 md:col-span-9 lg:col-span-8">
        <div className="max-w-reading">{children}</div>
      </div>
    </div>
  )
}

/** A numbered section of a reading page. */
export function ReadingSection({ id, n, title, children }: { id: string; n?: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-16 scroll-mt-6 first:mt-0">
      <div className="section-head">
        {n ? (
          <p aria-hidden="true" className="kicker">
            {String(n).padStart(2, '0')}
          </p>
        ) : null}
        <h2 id={`${id}-h`} className="mt-1 text-[34px] leading-[1.08]">
          {title}
        </h2>
      </div>
      <div className="reading mt-6 space-y-4">{children}</div>
    </section>
  )
}

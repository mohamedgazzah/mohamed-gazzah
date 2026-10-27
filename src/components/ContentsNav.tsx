'use client'

import { useEffect, useRef, useState } from 'react'

export type ContentsItem = { id: string; title: string }

/**
 * The "On this page" list. While reading, the section in view is marked
 * (aria-current="location"); without JavaScript it is a plain list of links.
 */
export function ContentsNav({ items, className = '' }: { items: ContentsItem[]; className?: string }) {
  const [active, setActive] = useState<string | null>(null)
  const visible = useRef(new Set<string>())

  useEffect(() => {
    const order = items.map((i) => i.id)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.current.add(e.target.id)
          else visible.current.delete(e.target.id)
        }
        const first = order.find((id) => visible.current.has(id))
        if (first) setActive(first)
      },
      // A band from just under the header to a third of the way down the screen.
      { rootMargin: '-96px 0px -65% 0px' },
    )
    for (const id of order) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  return (
    <ol className={`contents-list space-y-0.5 text-[14.5px] ${className}`}>
      {items.map((it, i) => (
        <li key={it.id}>
          <a href={`#${it.id}`} aria-current={active === it.id ? 'location' : undefined}>
            <span aria-hidden="true" className="tabular w-5 shrink-0 text-end text-muted">
              {i + 1}
            </span>
            <span>{it.title}</span>
          </a>
        </li>
      ))}
    </ol>
  )
}

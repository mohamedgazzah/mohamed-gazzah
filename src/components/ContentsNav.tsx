'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** A section of the page: its id, its title, and an icon to show instead of its number. */
export type ContentsItem = { id: string; title: string; icon?: ReactNode }

/**
 * The section being read: the last one whose top has passed a line a third of
 * the way down the screen. At the end of the page the last section counts,
 * even when its heading never reaches the line.
 */
function useCurrentSection(ids: string[]) {
  const [current, setCurrent] = useState<string | null>(null)
  const key = ids.join(' ')
  useEffect(() => {
    const order = key.split(' ')
    let frame = 0
    const update = () => {
      frame = 0
      const line = Math.max(window.innerHeight * 0.35, 140)
      let found: string | null = null
      for (const id of order) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top > line) break
        found = id
      }
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      const last = order.at(-1)
      if (atEnd && last && document.getElementById(last)) found = last
      setCurrent(found)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', schedule)
    }
  }, [key])
  return current
}

function List({ items, current, onNavigate, className = '' }: { items: ContentsItem[]; current: string | null; onNavigate?: () => void; className?: string }) {
  return (
    <ol className={`contents-list ${className}`}>
      {items.map((it, i) => (
        <li key={it.id}>
          <a href={`#${it.id}`} className="contents-link" aria-current={current === it.id ? 'location' : undefined} onClick={onNavigate}>
            <span aria-hidden="true" className="contents-num tabular">
              {it.icon ?? i + 1}
            </span>
            <span>{it.title}</span>
          </a>
        </li>
      ))}
    </ol>
  )
}

/**
 * "On this page". On wide screens, a card that keeps the section being read
 * in view inside it; on phones, a disclosure that sticks under the header,
 * names the section being read, and closes once a section is chosen.
 * Without JavaScript both are plain lists of links.
 */
export function ContentsNav({ items, variant = 'both' }: { items: ContentsItem[]; variant?: 'both' | 'card' | 'disclosure' }) {
  const current = useCurrentSection(items.map((i) => i.id))
  const card = useRef<HTMLElement>(null)
  const details = useRef<HTMLDetailsElement>(null)
  const index = items.findIndex((i) => i.id === current)

  // Keep the current entry visible inside a card that scrolls (short screens), without scrolling the page.
  useEffect(() => {
    const box = card.current
    const link = box?.querySelector<HTMLElement>('[aria-current]')
    if (!box || !link || box.scrollHeight <= box.clientHeight) return
    const b = box.getBoundingClientRect()
    const l = link.getBoundingClientRect()
    if (l.top < b.top + 8) box.scrollTop -= b.top + 8 - l.top
    else if (l.bottom > b.bottom - 8) box.scrollTop += l.bottom - (b.bottom - 8)
  }, [current])

  // The disclosure closes on Escape or a tap outside it, like the site menu.
  useEffect(() => {
    const el = details.current
    if (!el) return
    const close = (e: Event) => {
      if (!el.open) return
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return
        el.open = false
        el.querySelector('summary')?.focus()
        return
      }
      if (!el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])

  return (
    <>
      {variant !== 'card' ? (
        <details ref={details} className={`glass contents-mobile rounded-[var(--radius-md)] ${variant === 'both' ? 'md:hidden' : ''}`}>
          <summary className="contents-summary">
            <span className="min-w-0 truncate">
              On this page{' '}
              <span className="font-normal text-muted">
                · {index >= 0 ? `${items[index]!.icon ? '' : `${index + 1} `}${items[index]!.title}` : `${items.length} sections`}
              </span>
            </span>
            <ChevronDown aria-hidden="true" size={18} className="contents-chevron shrink-0 text-muted" />
          </summary>
          <nav aria-label="On this page" className="contents-sheet glass-strong">
            <List
              items={items}
              current={current}
              onNavigate={() => {
                if (details.current) details.current.open = false
              }}
            />
          </nav>
        </details>
      ) : null}
      {variant !== 'disclosure' ? (
        <nav ref={card} aria-label="On this page" className={`contents-card ${variant === 'both' ? 'hidden md:block' : ''}`}>
          <p className="kicker px-2 pt-1">On this page</p>
          <List items={items} current={current} className="mt-2" />
        </nav>
      ) : null}
    </>
  )
}

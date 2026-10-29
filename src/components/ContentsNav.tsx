'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** A section of the page: its id, its title, and an icon to show instead of its number. */
export type ContentsItem = { id: string; title: string; icon?: ReactNode }

/** The id in `order` that is `el` itself or the closest element around it. */
function sectionOf(el: Element | null, order: string[]): string | null {
  for (let n = el; n; n = n.parentElement) if (n.id && order.includes(n.id)) return n.id
  return null
}

/**
 * The section being read: the last one whose top has passed a line a third of
 * the way down the screen. At the end of the page the last section counts,
 * even when its heading never reaches the line. After a jump to an anchor (a
 * deep link, a contents entry, a badge's definition) the section holding the
 * anchor counts until the reader scrolls on by a third of a screen, so the
 * contents and the highlighted row never disagree.
 */
function useCurrentSection(ids: string[]) {
  const [current, setCurrent] = useState<string | null>(null)
  const key = ids.join(' ')
  useEffect(() => {
    const order = key.split(' ')
    let frame = 0
    let pin: { id: string; y: number; at: number } | null = null
    const pinHash = () => {
      const hash = decodeURIComponent(location.hash.slice(1))
      const id = hash ? sectionOf(document.getElementById(hash), order) : null
      pin = id ? { id, y: window.scrollY, at: performance.now() } : null
    }
    const update = () => {
      frame = 0
      if (pin) {
        // The jump can still settle for a moment (late layout); after that, scrolling on releases the pin.
        if (performance.now() - pin.at < 500) pin.y = window.scrollY
        else if (Math.abs(window.scrollY - pin.y) > window.innerHeight / 3) pin = null
      }
      if (pin) {
        setCurrent(pin.id)
        return
      }
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
    const onHash = () => {
      pinHash()
      schedule()
    }
    // A link to the anchor already in the address scrolls again but fires no hashchange.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('a[href^="#"]')) requestAnimationFrame(onHash)
    }
    pinHash()
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', onHash)
    document.addEventListener('click', onClick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('click', onClick)
    }
  }, [key])
  return current
}

/** Scrolls a box that holds the list (never the page) so the current entry is in view, or in the middle of it. */
function reveal(box: HTMLElement | null, middle = false) {
  const link = box?.querySelector<HTMLElement>('[aria-current]')
  if (!box || !link || box.scrollHeight <= box.clientHeight) return
  const b = box.getBoundingClientRect()
  const l = link.getBoundingClientRect()
  if (middle) box.scrollTop += l.top - b.top - (b.height - l.height) / 2
  else if (l.top < b.top + 8) box.scrollTop -= b.top + 8 - l.top
  else if (l.bottom > b.bottom - 8) box.scrollTop += l.bottom - (b.bottom - 8)
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
 * names the section being read, opens at that section, and closes once a
 * section is chosen, on Escape, on a tap outside or when focus leaves it.
 * Without JavaScript both are plain lists of links.
 */
export function ContentsNav({
  items,
  variant = 'both',
  cardClassName = '',
}: {
  items: ContentsItem[]
  variant?: 'both' | 'card' | 'disclosure'
  cardClassName?: string
}) {
  const current = useCurrentSection(items.map((i) => i.id))
  // Without JavaScript the open list sits in the page (it could not close itself over the text).
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const [open, setOpen] = useState(false)
  // A clear layer takes the tap outside the open list, so that tap presses nothing under it; it stays a moment after closing.
  const [scrim, setScrim] = useState(false)
  const card = useRef<HTMLElement>(null)
  const details = useRef<HTMLDetailsElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const index = items.findIndex((i) => i.id === current)

  // Keep the current entry visible inside a card that scrolls (short screens), without scrolling the page.
  useEffect(() => reveal(card.current), [current])

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setScrim(false), 300)
      return () => clearTimeout(t)
    }
    setScrim(true)
    // The list opens at the section being read, not at its top.
    reveal(sheet.current, true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !details.current) return
      details.current.open = false
      details.current.querySelector('summary')?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    if (details.current) details.current.open = false
  }

  return (
    <>
      {variant !== 'card' ? (
        <>
          {scrim ? <div className="menu-scrim" aria-hidden="true" onClick={close} /> : null}
          <details
            ref={details}
            data-ready={ready ? '' : undefined}
            className={`glass-strong contents-mobile rounded-[var(--radius-md)] ${variant === 'both' ? 'lg:hidden' : ''}`}
            onToggle={(e) => setOpen(e.currentTarget.open)}
            onBlur={(e) => {
              // Tabbing on past the last entry closes the list rather than leaving it over the next focused link.
              const next = e.relatedTarget as Node | null
              if (next && !e.currentTarget.contains(next)) e.currentTarget.open = false
            }}
          >
            <summary className="contents-summary">
              <span className="min-w-0 truncate">
                On this page{' '}
                <span className="font-normal text-muted">
                  · {index >= 0 ? `${items[index]!.icon ? '' : `${index + 1} `}${items[index]!.title}` : `${items.length} sections`}
                </span>
              </span>
              <ChevronDown aria-hidden="true" size={18} className="contents-chevron shrink-0 text-muted" />
            </summary>
            {/* The glass box stays still while the list inside it scrolls. */}
            <nav aria-label="On this page" className="contents-sheet glass-strong">
              <div ref={sheet} className="contents-scroll">
                <List items={items} current={current} onNavigate={close} />
              </div>
            </nav>
          </details>
        </>
      ) : null}
      {variant !== 'disclosure' ? (
        <nav ref={card} aria-label="On this page" className={`contents-card ${variant === 'both' ? 'hidden lg:block' : ''} ${cardClassName}`}>
          <p className="kicker px-2 pt-1">On this page</p>
          <List items={items} current={current} className="mt-2" />
        </nav>
      ) : null}
    </>
  )
}

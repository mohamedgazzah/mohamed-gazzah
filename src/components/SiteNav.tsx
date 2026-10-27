'use client'

import { ArrowRight, Menu, MessageSquarePlus, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { SITE } from '@/lib/site'
import { BrandMark } from './BrandMark'

const NAV = [
  { href: '/incidents', label: 'Explore' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/data', label: 'Data' },
  { href: '/about', label: 'About' },
]

/**
 * Brand, sections and the report button. On phones the sections fold into a
 * menu that closes when a link in it is chosen, on Escape, on a tap outside
 * it, or when focus leaves it. A tap outside lands on a clear scrim, which
 * stays a moment after the menu closes, so it never also presses whatever
 * was under the finger. The current section is marked.
 */
export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrim, setScrim] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (open) {
      setScrim(true)
      return
    }
    const t = setTimeout(() => setScrim(false), 300)
    return () => clearTimeout(t)
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined)

  return (
    <div
      ref={wrapper}
      className="relative"
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <div className="glass site-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BrandMark size={22} />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-[-0.02em]">{SITE.name}</span>
            {/* The home page's title already says it. */}
            {pathname === '/' ? null : <span className="hidden text-xs font-medium lg:block">Anti-Muslim incidents in the United States</span>}
          </span>
          <span className="sr-only">, home</span>
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="nav-link" aria-current={current(n.href)}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/report" className="btn btn-sm hidden sm:inline-flex" aria-current={current('/report')}>
          <MessageSquarePlus aria-hidden="true" />
          Report an incident
        </Link>
        <button
          ref={button}
          type="button"
          className="nav-link md:hidden"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          <span className="ms-1.5">{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>
      {scrim ? <div className="menu-scrim md:hidden" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <nav id="site-menu" aria-label="Main" className="glass-strong menu-sheet md:hidden">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                {/* Closes even when the link leads to the page already open (a filtered Explore view). */}
                <Link href={n.href} aria-current={current(n.href)} onClick={() => setOpen(false)}>
                  {n.label}
                  <ArrowRight aria-hidden="true" size={16} className="nudge text-muted" />
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-rule pt-1 sm:hidden">
              <Link href="/report" aria-current={current('/report')} onClick={() => setOpen(false)}>
                Report an incident
                <MessageSquarePlus aria-hidden="true" size={16} className="text-accent" />
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  )
}

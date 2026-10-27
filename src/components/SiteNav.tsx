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
 * menu that closes on navigation or Escape. The current section is marked.
 */
export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [pathname])
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
    <div className="glass site-nav">
      <Link href="/" className="brand">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span className="leading-tight">
          <span className="block text-[17px] font-semibold tracking-[-0.02em]">{SITE.name}</span>
          <span className="hidden text-[12.5px] font-medium lg:block">Anti-Muslim incidents in the United States</span>
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
        <span className="ms-1.5">Menu</span>
      </button>
      {open ? (
        <nav id="site-menu" aria-label="Main" className="glass-strong menu-sheet md:hidden">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={current(n.href)}>
                  {n.label}
                  <ArrowRight aria-hidden="true" size={16} className="text-muted" />
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-rule pt-1 sm:hidden">
              <Link href="/report">
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

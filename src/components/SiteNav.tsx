'use client'

import { ArrowRight, Menu, MessageSquarePlus, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type ComponentProps } from 'react'
import { SITE } from '@/lib/site'
import { BrandMark } from './BrandMark'

const NAV = [
  { href: '/incidents', label: 'Explore' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/data', label: 'Data' },
  { href: '/about', label: 'About' },
]

type ReportLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'aria-current'>

/** The report form is the current page on /report, but not when it is the correction form there. */
function CurrentReportLink(props: ReportLinkProps) {
  const pathname = usePathname()
  const mode = useSearchParams().get('mode')
  return <Link href="/report" aria-current={pathname === '/report' && mode !== 'correction' ? 'page' : undefined} {...props} />
}

/**
 * "Report an incident". Pages built ahead of time do not know the query, so
 * they show the link unmarked until the page loads; none of them is /report.
 */
function ReportLink(props: ReportLinkProps) {
  return (
    <Suspense fallback={<Link href="/report" {...props} />}>
      <CurrentReportLink {...props} />
    </Suspense>
  )
}

/**
 * Brand, sections and the report button. Below 56rem the sections fold into
 * a menu, a disclosure that opens without JavaScript too. With it, the menu
 * closes when a link in it is chosen, on Escape, on a tap outside it, or when
 * focus leaves it. A tap outside lands on a clear scrim, which stays a moment
 * after the menu closes, so it never also presses whatever was under the
 * finger. The current section is marked.
 */
export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrim, setScrim] = useState(false)
  const menu = useRef<HTMLDetailsElement>(null)

  const close = () => {
    if (menu.current) menu.current.open = false
  }
  // A menu opened before the script loaded stays open; pick up its state.
  useEffect(() => setOpen(menu.current?.open ?? false), [])
  // Another page (back and forward too) closes the menu; the first render is not another page.
  const shown = useRef(pathname)
  useEffect(() => {
    if (shown.current !== pathname && menu.current) menu.current.open = false
    shown.current = pathname
  }, [pathname])
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setScrim(false), 300)
      return () => clearTimeout(t)
    }
    setScrim(true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !menu.current) return
      menu.current.open = false
      menu.current.querySelector('summary')?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Closes even when the link leads to the page already open (a filtered Explore view); focus moves to the page, not to nowhere.
  const choose = () => {
    close()
    document.getElementById('main')?.focus({ preventScroll: true })
  }
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined)

  return (
    <>
      {scrim ? <div className="menu-scrim min-[56rem]:hidden" aria-hidden="true" onClick={close} /> : null}
      <div className="glass site-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BrandMark size={22} />
          </span>
          <span>
            <span className="block text-lg leading-snug font-semibold tracking-[-0.02em]">{SITE.name}</span>
            {/* The home page's title already says it. */}
            {pathname === '/' ? null : <span className="hidden text-xs leading-snug font-medium lg:block">Anti-Muslim incidents in the United States</span>}
          </span>
          <span className="sr-only">, home</span>
        </Link>
        <nav aria-label="Main" className="hidden min-[56rem]:block">
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
        <ReportLink className="btn btn-sm hidden sm:inline-flex">
          <MessageSquarePlus aria-hidden="true" />
          Report an incident
        </ReportLink>
        <details
          ref={menu}
          className="site-menu min-[56rem]:hidden"
          onToggle={(e) => setOpen(e.currentTarget.open)}
          onBlur={(e) => {
            // Tabbing on past the last link closes the menu rather than leaving it over the page.
            const next = e.relatedTarget as Node | null
            if (next && !e.currentTarget.contains(next)) e.currentTarget.open = false
          }}
        >
          {/* Named "Menu" open or closed; the icon and the expanded state say which. */}
          <summary className="nav-link">
            <Menu aria-hidden="true" size={20} className="site-menu-open" />
            <X aria-hidden="true" size={20} className="site-menu-close" />
            <span className="ms-1.5">Menu</span>
          </summary>
          <nav id="site-menu" aria-label="Main" className="glass-strong menu-sheet">
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} aria-current={current(n.href)} onClick={choose}>
                    {n.label}
                    <ArrowRight aria-hidden="true" size={16} className="nudge text-muted" />
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-rule pt-1 sm:hidden">
                <ReportLink onClick={choose}>
                  Report an incident
                  <MessageSquarePlus aria-hidden="true" size={16} className="text-accent" />
                </ReportLink>
              </li>
            </ul>
          </nav>
        </details>
      </div>
    </>
  )
}

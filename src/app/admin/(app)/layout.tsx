import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { USER_ROLE_META } from '@/db/enums'
import { SITE } from '@/lib/site'
import { can } from '@/server/admin/permissions'
import { requireUser } from '@/server/admin/session'
import { logout } from '../_actions/auth'

export const metadata: Metadata = { title: { default: 'Editors', template: `%s — ${SITE.name} editors` }, robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireUser()
  const nav = [
    { href: '/admin', label: 'Dashboard', show: true },
    { href: '/admin/incidents', label: 'Records', show: true },
    { href: '/admin/review', label: 'Review queue', show: can.review(me.role) },
    { href: '/admin/leads', label: 'Leads', show: can.triage(me.role) },
    { href: '/admin/corrections', label: 'Corrections', show: can.handleCorrections(me.role) },
    { href: '/admin/cases', label: 'Cases', show: can.manageCases(me.role) },
    { href: '/admin/audit', label: 'Audit log', show: can.viewAudit(me.role) },
    { href: '/admin/users', label: 'Users', show: can.manageUsers(me.role) },
  ].filter((n) => n.show)
  return (
    <>
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="font-serif text-xl font-bold">
            <Link href="/admin" className="text-text no-underline">
              {SITE.name} · Editors
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {me.displayName} <span className="text-muted">({USER_ROLE_META[me.role].label})</span>
            </span>
            <Link href="/admin/account/password">Password</Link>
            <Link href="/">Public site</Link>
            <form action={logout}>
              <button type="submit" className="btn btn-secondary min-h-9 py-1">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Editor sections" className="mx-auto max-w-content px-4 sm:px-6">
          <ul className="flex flex-wrap gap-x-1 text-base">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="inline-flex min-h-11 items-center px-2 font-medium">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-content px-4 py-8 outline-none sm:px-6">
        {children}
      </main>
    </>
  )
}

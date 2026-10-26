import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE } from '@/lib/site'

export const metadata: Metadata = { title: 'Editors', robots: { index: false, follow: false } }

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-content px-4 py-3 font-serif text-xl font-bold sm:px-6">{SITE.name} · Editors</div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-md px-4 py-12 outline-none sm:px-6">
        {children}
      </main>
    </>
  )
}

import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { lastUpdatedSafe } from '@/server/public/site-status'

// Keeps the footer's "last updated" time fresh on otherwise static pages.
export const revalidate = 3600

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const lastUpdated = await lastUpdatedSafe()
  return (
    <>
      <SiteHeader />
      <div id="main" tabIndex={-1} className="outline-none">
        {children}
      </div>
      <SiteFooter lastUpdated={lastUpdated} />
    </>
  )
}

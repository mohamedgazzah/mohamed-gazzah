import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/source-serif-4/wght.css'
import '@fontsource/noto-naskh-arabic/arabic-400.css'
import '@fontsource/noto-naskh-arabic/arabic-600.css'
import './globals.css'
import { THEME_SCRIPT } from '@/components/ThemeToggle'
import { TooltipDismisser } from '@/components/TooltipDismisser'
import { indexingEnabled } from '@/lib/indexing'
import { SITE } from '@/lib/site'
import { inter, sourceSerif } from './fonts'

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.fullName, template: `%s — ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.fullName, type: 'website' },
  robots: indexingEnabled() ? { index: true, follow: true } : { index: false, follow: false },
  // No favicon until the project has its final name and mark (avoids a 404 request).
  icons: { icon: 'data:,' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const analytics = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {analytics ? <script defer src={analytics} data-domain={process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID} data-website-id={process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID} /> : null}
      </head>
      <body>
        <a
          href="#main"
          className="sr-only-focusable fixed start-4 top-4 z-50 rounded bg-surface px-4 py-2 font-semibold text-accent shadow"
        >
          Skip to content
        </a>
        {children}
        <TooltipDismisser />
      </body>
    </html>
  )
}

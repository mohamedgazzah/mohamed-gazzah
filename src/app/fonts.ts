import localFont from 'next/font/local'

/**
 * Self-hosted fonts (no request to Google). The Latin files are preloaded by
 * next/font with metric-matched fallbacks; other scripts (Latin Extended,
 * Cyrillic, Greek, Vietnamese) come from the @fontsource stylesheets in the
 * root layout and download only when a page uses them.
 */
export const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
  adjustFontFallback: 'Arial',
})

export const sourceSerif = localFont({
  src: '../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2',
  weight: '200 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-source-serif',
  adjustFontFallback: 'Times New Roman',
})

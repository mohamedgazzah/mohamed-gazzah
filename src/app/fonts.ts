import localFont from 'next/font/local'

/**
 * Self-hosted fonts (no request to Google). The Latin files load through
 * next/font with metric-matched fallbacks; other scripts (Latin Extended,
 * Vietnamese) come from the @fontsource stylesheet in the root layout and
 * download only when a page uses them.
 *
 * Instrument Sans for everything: headlines, reading text, interface and
 * tables (it has tabular figures). Variable weight 400–700, 30 KB.
 */
export const instrument = localFont({
  src: '../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-instrument',
  adjustFontFallback: 'Arial',
})

// Italics (emphasis, cited titles) use var(--typeface-italic). Not preloaded:
// few pages use italics, and those fetch it only when they do.
export const instrumentItalic = localFont({
  src: '../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-italic.woff2',
  weight: '400 700',
  style: 'italic',
  display: 'swap',
  preload: false,
  variable: '--font-instrument-italic',
  adjustFontFallback: 'Arial',
})

import localFont from 'next/font/local'

/**
 * Self-hosted fonts (no request to Google). The Latin files load through
 * next/font with metric-matched fallbacks; other scripts (Latin Extended,
 * Cyrillic, Greek, Vietnamese) come from the @fontsource stylesheets in the
 * root layout and download only when a page uses them.
 *
 * Newsreader: headlines and reading text. Its optical-size axis gives the
 * finer display cut at headline sizes, which is why this is the larger file
 * (kept in src/fonts, trimmed to the weights the site uses).
 * Libre Franklin: interface, labels and tables. IBM Plex Mono: record ids,
 * dates and other reference data.
 */
// Weights limited to 400–600 (src/fonts/README.md).
export const newsreader = localFont({
  src: '../fonts/newsreader-latin-wght400-600-normal.woff2',
  weight: '400 600',
  style: 'normal',
  display: 'swap',
  variable: '--font-newsreader',
  adjustFontFallback: 'Times New Roman',
})

// Serif italics in running text (emphasis, cited titles) use var(--typeface-serif-italic).
// Not preloaded, and record pages avoid italics, so most pages never fetch it.
export const newsreaderItalic = localFont({
  src: '../fonts/newsreader-latin-wght400-600-italic.woff2',
  weight: '400 600',
  style: 'italic',
  display: 'swap',
  preload: false,
  variable: '--font-newsreader-italic',
  adjustFontFallback: 'Times New Roman',
})

// Italics inside display headlines (the home page's): a 14 KB static cut at
// headline size, basic Latin only, preloaded so the headline paints once.
// Other characters fall through to the full italic.
export const newsreaderDisplayItalic = localFont({
  src: '../fonts/newsreader-display-italic-basic-latin.woff2',
  weight: '500',
  style: 'italic',
  display: 'swap',
  variable: '--font-newsreader-display-italic',
  adjustFontFallback: 'Times New Roman',
})

export const franklin = localFont({
  src: '../../node_modules/@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-franklin',
  adjustFontFallback: 'Arial',
})

export const plexMono = localFont({
  src: [
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  // Small reference text with a monospace fallback of the same advance width: not worth a preload.
  preload: false,
  variable: '--font-plex-mono',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
})

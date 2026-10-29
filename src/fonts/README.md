# Fonts

The site is set in one family, **Instrument Sans** (SIL Open Font License 1.1),
loaded from `@fontsource-variable/instrument-sans` through `next/font/local`
(`src/app/fonts.ts`):

- `instrument-sans-latin-wght-normal.woff2` (30 KB, weight 400–700) is
  preloaded with a metric-matched Arial fallback, so text does not jump when
  it arrives.
- The italic (32 KB) is not preloaded; pages fetch it only when they show
  italics.
- Latin Extended and Vietnamese come from the package's stylesheet, imported
  in the root layout, and download only when a page uses those characters.
- Arabic text uses Noto Naskh Arabic (`@fontsource/noto-naskh-arabic`).

Code samples use the reader's system monospace font; nothing is downloaded
for them.

## Characters the Latin file lacks

The package's stylesheet declares the Latin file for a `unicode-range` wider
than its glyphs (it includes ↑ and ↓ and the whole General Punctuation block).
When a page shows one of the missing characters, the browser downloads the
package's copy of the Latin file only to find the glyph missing there too. So
the interface draws its arrows and icons as SVG (`lucide-react`,
`src/components/Arrow.tsx`) instead of typing them.

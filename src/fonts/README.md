# Fonts kept in the repository

`newsreader-latin-wght400-600-{normal,italic}.woff2` are the Latin files of
Newsreader from `@fontsource-variable/newsreader` 5.3.0 (the optical-size
build), with the weight axis limited to 400–600, the only weights the site
uses. That makes them about 30% smaller (90 KB and 101 KB instead of 132 KB and
147 KB). The optical-size axis (6–72) is kept whole.

Made with [fontTools](https://github.com/fonttools/fonttools) 4.67:

```bash
SRC=node_modules/@fontsource-variable/newsreader/files
for style in normal italic; do
  fonttools varLib.instancer "$SRC/newsreader-latin-opsz-$style.woff2" wght=400:600 -o /tmp/newsreader-$style.ttf
  pyftsubset /tmp/newsreader-$style.ttf \
    --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
    --layout-features='kern,liga,tnum,pnum,rvrn,mark,mkmk' --flavor=woff2 \
    --output-file="src/fonts/newsreader-latin-wght400-600-$style.woff2"
done
```

Newsreader is licensed under the SIL Open Font License 1.1 (`OFL-Newsreader.txt`),
with no Reserved Font Name, so the modified files keep the name. Other scripts
(Latin Extended, Vietnamese) still come from the npm package.

`newsreader-display-italic-basic-latin.woff2` (14 KB) is a static cut of the
italic at weight 500 and optical size 60, with basic Latin, quotes and dashes
only. It is preloaded for italics inside display headlines, so the home page
headline paints once instead of reflowing when the full italic arrives:

```bash
fonttools varLib.instancer "$SRC/newsreader-latin-opsz-italic.woff2" wght=500 opsz=60 -o /tmp/display-italic.ttf
pyftsubset /tmp/display-italic.ttf --unicodes="U+0020-007E,U+00A0,U+2013-2014,U+2018-2019,U+201C-201D,U+2026" \
  --layout-features='kern,liga' --flavor=woff2 --output-file=src/fonts/newsreader-display-italic-basic-latin.woff2
```

## Characters the Latin files lack

The npm stylesheets declare each Latin file for a `unicode-range` wider than its
glyphs: it includes ↑ and ↓ (U+2191, U+2193) and the whole General Punctuation
block (U+2000–206F), of which these typefaces draw only the common marks (dashes,
quotes, ellipsis, bullet, primes). When a page shows a character from that gap,
such as ↓, a hyphen variant (U+2010–2012), a typographic space or †, the browser
downloads the package's copy of the Latin file (16–132 KB) only to find the glyph
missing there too. So the interface draws its arrows (`src/components/Arrow.tsx`)
instead of typing them. Record text can still contain such characters; the cost
is one extra download on that page.

/**
 * Acceptance: both themes pass contrast checks; no hard-coded colors outside
 * the token file.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const TOKENS = readFileSync('src/styles/tokens.css', 'utf8')

function block(selector: string): Record<string, string> {
  const start = TOKENS.indexOf(selector)
  const body = TOKENS.slice(TOKENS.indexOf('{', start) + 1, TOKENS.indexOf('}', start))
  return Object.fromEntries(Array.from(body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)).map((m) => [m[1]!, m[2]!.toLowerCase()]))
}

const light = block(':root {')
const dark = block(":root[data-theme='dark']")
const darkMedia = block(":root:not([data-theme='light'])")

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const channel = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(channel) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
/** CSS color-mix(in srgb, a p%, b): linear interpolation of gamma-encoded channels. */
const mix = (a: string, b: string, p: number) =>
  '#' + rgb(a).map((v, i) => Math.round(v * p + rgb(b)[i]! * (1 - p)).toString(16).padStart(2, '0')).join('')

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, t) => {
  const text = ['text', 'text-muted', 'accent', 'status-confirmed', 'status-reported', 'status-severe']
  for (const fg of text) {
    for (const bg of ['bg', 'surface']) {
      it(`${fg} on ${bg} meets AA for body text (4.5:1)`, () => {
        expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
  it('text stays readable on zebra rows, hover rows and the accent tint', () => {
    const zebra = mix(t.text!, t.surface!, 0.03)
    const hover = mix(t.accent!, t.surface!, 0.07)
    const tint = mix(t.accent!, t.surface!, 0.08)
    for (const bg of [zebra, hover, tint]) {
      expect(contrast(t.text!, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t['text-muted']!, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.accent!, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('search highlights keep body text and link text readable', () => {
    const mark = mix(t['status-reported']!, t.surface!, 0.16)
    expect(contrast(t.text!, mark)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.accent!, mark)).toBeGreaterThanOrEqual(4.5)
  })
  it('button text on the accent meets AA', () => {
    expect(contrast(t.surface!, t.accent!)).toBeGreaterThanOrEqual(4.5)
  })
  it('text on the ink band (footer, tooltips) meets AA', () => {
    for (const fg of ['band-text', 'band-muted', 'band-accent']) {
      expect(contrast(t[fg]!, t['band-bg']!)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(t['band-bg']!, t['band-text']!)).toBeGreaterThanOrEqual(4.5)
  })
  it('the selected segment (ink on paper, reversed) meets AA', () => {
    expect(contrast(t.bg!, t.text!)).toBeGreaterThanOrEqual(4.5)
  })
  it('form control borders meet the 3:1 non-text contrast', () => {
    expect(contrast(t['text-muted']!, t.surface!)).toBeGreaterThanOrEqual(3)
    expect(contrast(t['text-muted']!, t.bg!)).toBeGreaterThanOrEqual(3)
  })
})

describe('token file', () => {
  it('uses the exact colors from the specification', () => {
    expect(light).toMatchObject({
      bg: '#fafaf7', surface: '#ffffff', text: '#1a1d21', 'text-muted': '#5b6169', rule: '#e3e1da', accent: '#1f5c4e',
      'status-confirmed': '#2f6b3a', 'status-reported': '#8a6d1f', 'status-severe': '#7a2e2e',
    })
    expect(dark).toMatchObject({
      bg: '#121417', surface: '#1b1e22', text: '#e8e6e1', 'text-muted': '#a3a9b0', rule: '#2c3036', accent: '#6fb8a4',
      'status-confirmed': '#7cc48a', 'status-reported': '#d9b95c', 'status-severe': '#d48a8a',
    })
  })
  it('the system dark theme and the manual dark theme are identical', () => {
    expect(darkMedia).toEqual(dark)
  })
  it('prints in the light theme whatever the screen theme', () => {
    expect(block('@media print')).toEqual(light)
  })
})

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

describe('no hard-coded colors', () => {
  it('only src/styles/tokens.css contains color literals', () => {
    const offenders: string[] = []
    const literal = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\b(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink)\b(?=\s*[;"'`)])/i
    for (const f of files('src')) {
      if (!/\.(tsx?|css)$/.test(f) || f.endsWith(path.join('styles', 'tokens.css'))) continue
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      for (const [i, line] of src.split('\n').entries()) {
        // Hex escapes in regular expressions, URL fragments and ids are not colors.
        const cleaned = line.replace(/['"`]#[a-z][\w-]*['"`]/gi, '').replace(/href=\{?`?#/g, '').replace(/#\$\{/g, '')
        if (literal.test(cleaned)) offenders.push(`${f}:${i + 1}: ${line.trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

/**
 * Source picker auto-fill: fetch a URL and read its title, outlet, author and
 * publication date from page metadata. Guards against server-side request
 * forgery: only http(s) on standard ports, and every connection (including
 * redirects) is refused if the host resolves to a private address.
 */
import 'server-only'
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

export type SourceMetadata = { outlet: string | null; title: string | null; author: string | null; publishedDate: string | null; finalUrl: string }

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 6000

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::' || v6 === '::1') return true
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6)
}

function safeLookup(hostname: string, options: object, cb: (err: Error | null, address: string | LookupAddress[], family?: number) => void) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, '')
    const list = addresses as LookupAddress[]
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) return cb(new Error('Address not allowed'), '')
    const wantsAll = (options as { all?: boolean }).all
    if (wantsAll) cb(null, list)
    else cb(null, list[0]!.address, list[0]!.family)
  })
}

function checkUrl(raw: string): URL {
  const u = new URL(raw)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http and https links are supported.')
  if (u.username || u.password) throw new Error('Links with credentials are not allowed.')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Only standard ports are allowed.')
  if (isIP(u.hostname.replace(/^\[|\]$/g, '')) && isPrivateAddress(u.hostname.replace(/^\[|\]$/g, ''))) throw new Error('Address not allowed')
  return u
}

function get(u: URL): Promise<{ status: number; location: string | null; body: string; type: string }> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.get(
      u,
      {
        lookup: safeLookup as never,
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'TheRecordBot/1.0 (source metadata; +https://example.org/about)', Accept: 'text/html,application/xhtml+xml' },
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (c: Buffer) => {
          size += c.length
          if (size > MAX_BYTES) {
            res.destroy()
            return
          }
          chunks.push(c)
        })
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null, body: Buffer.concat(chunks).toString('utf8'), type: String(res.headers['content-type'] ?? '') }),
        )
        res.on('close', () =>
          resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null, body: Buffer.concat(chunks).toString('utf8'), type: String(res.headers['content-type'] ?? '') }),
        )
      },
    )
    req.on('timeout', () => req.destroy(new Error('Timed out')))
    req.on('error', reject)
  })
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–' }
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

function meta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*>`, 'i')
    const tag = re.exec(html)?.[0]
    const content = tag ? /content=["']([^"']*)["']/i.exec(tag)?.[1] : undefined
    if (content) return decode(content)
  }
  return null
}

function isoDate(value: string | null): string | null {
  if (!value) return null
  const m = /(\d{4}-\d{2}-\d{2})/.exec(value)
  return m ? m[1]! : null
}

export function parseMetadata(html: string, url: URL): Omit<SourceMetadata, 'finalUrl'> {
  const head = html.slice(0, 300_000)
  const jsonLd = Array.from(head.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[1] ?? '').join('\n')
  const ldDate = /"datePublished"\s*:\s*"([^"]+)"/.exec(jsonLd)?.[1] ?? null
  const ldPublisher = /"publisher"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/.exec(jsonLd)?.[1] ?? null
  const ldAuthor = /"author"\s*:\s*(?:\[\s*)?\{[^}]*"name"\s*:\s*"([^"]+)"/.exec(jsonLd)?.[1] ?? null
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  return {
    title: meta(head, ['og:title', 'twitter:title', 'headline']) ?? (titleTag ? decode(titleTag) : null),
    outlet: meta(head, ['og:site_name', 'application-name']) ?? (ldPublisher ? decode(ldPublisher) : null) ?? url.hostname.replace(/^www\./, ''),
    author: meta(head, ['author', 'article:author', 'parsely-author', 'sailthru.author']) ?? (ldAuthor ? decode(ldAuthor) : null),
    publishedDate: isoDate(meta(head, ['article:published_time', 'datePublished', 'pubdate', 'publish-date', 'date', 'dc.date']) ?? ldDate),
  }
}

export async function fetchSourceMetadata(raw: string): Promise<SourceMetadata> {
  let u = checkUrl(raw)
  for (let hop = 0; hop < 4; hop++) {
    const res = await get(u)
    if (res.status >= 300 && res.status < 400 && res.location) {
      u = checkUrl(new URL(res.location, u).toString())
      continue
    }
    if (res.status >= 400) throw new Error(`The page answered ${res.status}.`)
    if (!/html/i.test(res.type)) return { title: null, outlet: u.hostname.replace(/^www\./, ''), author: null, publishedDate: null, finalUrl: u.toString() }
    return { ...parseMetadata(res.body, u), finalUrl: u.toString() }
  }
  throw new Error('Too many redirects.')
}

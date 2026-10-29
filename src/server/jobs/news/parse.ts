/**
 * Parsing for the news scan: feed formats (RSS 2.0, Atom, GDELT's article
 * list), article pages, and the normal forms used to recognize an article
 * seen before. No dependencies and no network, so it is all unit-tested.
 */

export type RawItem = { url: string; headline: string; outlet: string | null; publishedAt: string | null; snippet: string | null }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Text of an HTML fragment: tags removed, entities decoded, whitespace squashed. */
export function stripTags(html: string): string {
  return squash(decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')))
}

function unwrap(value: string): string {
  const cdata = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return cdata ? cdata[1]! : value
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? unwrap(m[1]!) : null
}

function toIso(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date.trim())
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Items of an RSS 2.0 or Atom feed. */
export function parseFeed(xml: string): RawItem[] {
  const items: RawItem[] = []
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = m[1]!
    const url = stripTags(tag(block, 'link') ?? '')
    const headline = stripTags(tag(block, 'title') ?? '')
    if (!url || !headline) continue
    const source = block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i)
    const description = tag(block, 'description')
    items.push({
      url,
      headline,
      outlet: source ? stripTags(unwrap(source[1]!)) || null : null,
      publishedAt: toIso(tag(block, 'pubDate') ?? tag(block, 'dc:date')),
      snippet: description ? stripTags(description) || null : null,
    })
  }
  for (const m of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)) {
    const block = m[1]!
    const link = block.match(/<link\b[^>]*?href="([^"]+)"[^>]*>/i)
    const headline = stripTags(tag(block, 'title') ?? '')
    if (!link || !headline) continue
    const summary = tag(block, 'summary') ?? tag(block, 'content')
    items.push({
      url: decodeEntities(link[1]!),
      headline,
      outlet: null,
      publishedAt: toIso(tag(block, 'published') ?? tag(block, 'updated')),
      snippet: summary ? stripTags(summary) || null : null,
    })
  }
  return items
}

/** Articles from GDELT's DOC 2.0 API (mode=artlist, format=json). */
export function parseGdelt(body: unknown): RawItem[] {
  const articles = (body as { articles?: unknown })?.articles
  if (!Array.isArray(articles)) return []
  return articles.flatMap((a) => {
    const { url, title, domain, seendate } = a as Record<string, unknown>
    if (typeof url !== 'string' || typeof title !== 'string' || !title.trim()) return []
    // seendate is UTC, like 20261026T143000Z.
    const m = typeof seendate === 'string' ? seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/) : null
    return [
      {
        url,
        headline: squash(decodeEntities(title)),
        outlet: typeof domain === 'string' ? domain : null,
        publishedAt: m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null,
        snippet: null,
      },
    ]
  })
}

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ocid$|cmpid$|ref$|ref_src$|smid$|taid$|cid$|at_)/i

/** One address per article: https, no tracking parameters, no fragment, no trailing slash. Null if not http(s). */
export function normalizeUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  u.protocol = 'https:'
  u.hostname = u.hostname.toLowerCase().replace(/^(www|amp|m)\./, '')
  u.hash = ''
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key)
  u.searchParams.sort()
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1)
  return u.toString()
}

/**
 * A headline reduced for comparison, so one story from two feeds is read
 * once: lower case, no outlet suffix (" - Outlet" in Google News titles),
 * letters and digits only.
 */
export function headlineKey(headline: string, outlet?: string | null): string {
  let h = headline
  if (outlet && h.toLowerCase().endsWith(` - ${outlet.toLowerCase()}`)) h = h.slice(0, -(outlet.length + 3))
  return h
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * The readable text of an article page: paragraphs from <article> (or <main>,
 * or the whole body), without scripts, navigation and boilerplate, up to
 * `max` characters. Falls back to the page's description.
 */
export function articleText(html: string, max = 8_000): string {
  const clean = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|template)\b[\s\S]*?<\/\1>/gi, ' ')
  const region = clean.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? clean.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? clean
  const paragraphs = [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]!)).filter((p) => p.length > 40)
  let text = paragraphs.join('\n\n')
  if (!text) {
    const meta =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i)
    text = meta ? squash(decodeEntities(meta[1]!)) : ''
  }
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** Google News links redirect through Google with scripts, so their pages cannot be read directly. */
export function isGoogleNewsLink(url: string): boolean {
  try {
    return new URL(url).hostname === 'news.google.com'
  } catch {
    return false
  }
}

/**
 * Whether an address from a feed may be fetched: http(s) on a public host name.
 * Feeds are third-party content, so an item must not point the server at
 * itself or its network (localhost, IP literals, internal names).
 */
export function isPublicWebAddress(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  if (u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  if (!host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host) || /^0x/i.test(host)) return false
  return !/(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(host)
}


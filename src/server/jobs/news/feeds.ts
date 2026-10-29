/**
 * Where the morning scan looks, and fetching it. Free sources with no keys:
 * Google News search feeds, GDELT's index of world news (direct article
 * links), and organization feeds. Editors can add RSS or Atom feeds with
 * NEWS_SCAN_EXTRA_FEEDS (comma-separated URLs).
 */
import 'server-only'
import type { LeadSource } from '@/db/enums'
import { SITE } from '@/lib/site'
import { articleText, headlineKey, isGoogleNewsLink, isPublicWebAddress, normalizeUrl, parseFeed, parseGdelt, type RawItem } from './parse'

export type FeedItem = RawItem & { feed: string; leadSource: LeadSource; matchedTerms: string[] }

type Source =
  | { id: string; kind: 'google'; query: string }
  | { id: string; kind: 'gdelt'; query: string }
  | { id: string; kind: 'rss'; url: string; leadSource: LeadSource }

/** Searches that describe the kinds of incident the record includes. Each runs over the last day. */
export const SEARCHES = [
  '"anti-Muslim"',
  'Islamophobic OR Islamophobia',
  'mosque vandalized OR "mosque vandalism" OR "mosque fire" OR "mosque threat"',
  '"hate crime" Muslim',
  '"hate crime" mosque',
  'hijab attacked OR "hijab pulled" OR "hijab ripped"',
  'Quran burned OR "Quran desecrated"',
  'CAIR "hate crime" OR "CAIR condemns"',
]

const GDELT_QUERY =
  '("anti-Muslim" OR Islamophobic OR Islamophobia OR mosque OR hijab OR Quran) (attack OR assault OR threat OR threatened OR vandalism OR vandalized OR arson OR "hate crime" OR harassed OR slur) sourcecountry:US sourcelang:english'

export function sources(env: NodeJS.ProcessEnv = process.env): Source[] {
  const extra = (env.NEWS_SCAN_EXTRA_FEEDS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  return [
    ...SEARCHES.map((query, i) => ({ id: `google-${i + 1}`, kind: 'google' as const, query })),
    { id: 'gdelt', kind: 'gdelt', query: GDELT_QUERY },
    // CAIR's national press releases: many report incidents and calls for hate-crime charges.
    { id: 'cair', kind: 'rss', url: 'https://www.cair.com/feed/', leadSource: 'org_feed' },
    ...extra.map((url, i) => ({ id: `extra-${i + 1}`, kind: 'rss' as const, url, leadSource: 'org_feed' as const })),
  ]
}

export const USER_AGENT = `TheRecordNewsScan/1.0 (+${SITE.url}/about)`

async function get(fetchImpl: typeof fetch, url: string, timeoutMs = 12_000): Promise<string> {
  const res = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT, accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  return text.length > 3_000_000 ? text.slice(0, 3_000_000) : text
}

function sourceUrl(s: Source): string {
  if (s.kind === 'google') return `https://news.google.com/rss/search?q=${encodeURIComponent(`${s.query} when:1d`)}&hl=en-US&gl=US&ceid=US:en`
  if (s.kind === 'gdelt')
    return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(s.query)}&mode=artlist&format=json&timespan=36h&maxrecords=100&sort=datedesc`
  return s.url
}

/**
 * Every item from every source, each address normalized, the same article or
 * headline from several sources kept once (preferring a direct link over a
 * Google News redirect). One failing source does not stop the others.
 */
export async function fetchFeeds(fetchImpl: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env) {
  const errors: { feed: string; error: string }[] = []
  const lists = await Promise.all(
    sources(env).map(async (s) => {
      try {
        const body = await get(fetchImpl, sourceUrl(s))
        const raw = s.kind === 'gdelt' ? parseGdelt(JSON.parse(body)) : parseFeed(body)
        return raw.map(
          (r): FeedItem => ({
            ...r,
            feed: s.id,
            leadSource: s.kind === 'rss' ? s.leadSource : 'news_monitor',
            matchedTerms: s.kind === 'rss' ? [] : [s.query],
          }),
        )
      } catch (err) {
        errors.push({ feed: s.id, error: (err as Error).message })
        return []
      }
    }),
  )
  return { items: dedupe(lists.flat()), errors, tried: lists.length }
}

export function dedupe(items: FeedItem[]): FeedItem[] {
  const byUrl = new Map<string, FeedItem>()
  for (const item of items) {
    const url = normalizeUrl(item.url)
    if (!url) continue
    const prev = byUrl.get(url)
    if (prev) prev.matchedTerms = [...new Set([...prev.matchedTerms, ...item.matchedTerms])]
    else byUrl.set(url, { ...item, url })
  }
  const byHeadline = new Map<string, FeedItem>()
  for (const item of byUrl.values()) {
    const key = headlineKey(item.headline, item.outlet)
    const prev = byHeadline.get(key)
    if (!prev) byHeadline.set(key, item)
    else {
      const merged = [...new Set([...prev.matchedTerms, ...item.matchedTerms])]
      // The same story through Google News and directly: keep the direct link.
      const keep = isGoogleNewsLink(prev.url) && !isGoogleNewsLink(item.url) ? item : prev
      byHeadline.set(key, { ...keep, matchedTerms: merged, outlet: keep.outlet ?? prev.outlet ?? item.outlet })
    }
  }
  return [...byHeadline.values()]
}

/** An article page, following up to three redirects, each to a public address only. */
async function getArticle(fetchImpl: typeof fetch, url: string): Promise<string> {
  let current = url
  for (let hop = 0; hop <= 3; hop++) {
    if (!isPublicWebAddress(current)) throw new Error('Not a public web address')
    const res = await fetchImpl(current, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(10_000), redirect: 'manual' })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString()
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    return text.length > 3_000_000 ? text.slice(0, 3_000_000) : text
  }
  throw new Error('Too many redirects')
}

/** The article's text for the model, or the feed's snippet when the page cannot be read. */
export async function readArticle(fetchImpl: typeof fetch, item: { url: string; snippet: string | null }): Promise<string> {
  if (!isGoogleNewsLink(item.url)) {
    try {
      const text = articleText(await getArticle(fetchImpl, item.url))
      if (text.length > 200) return text
    } catch {
      // Fall through to the snippet: paywalls and blocks are common.
    }
  }
  return item.snippet ?? ''
}

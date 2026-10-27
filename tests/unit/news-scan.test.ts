import { describe, expect, it } from 'vitest'
import { INCLUSION_CRITERIA, INCLUSION_EXCLUSIONS } from '@/lib/inclusion'
import { NewsAssessmentSchema } from '@/lib/news-assessment'
import { SYSTEM_PROMPT, articleMessage, assessArticle, type ScanClient } from '@/server/jobs/news/assess'
import { dedupe, readArticle, sources, type FeedItem } from '@/server/jobs/news/feeds'
import { articleText, decodeEntities, headlineKey, isGoogleNewsLink, isPublicWebAddress, normalizeUrl, parseFeed, parseGdelt } from '@/server/jobs/news/parse'
import { keywordMatch } from '@/server/jobs/news/scan'

const GOOGLE_RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>"anti-Muslim" - Google News</title>
<item><title>Mosque in Testville vandalized with anti-Muslim graffiti - Testville Daily</title>
<link>https://news.google.com/rss/articles/CBMiAbc123?oc=5</link><guid isPermaLink="false">CBMiAbc123</guid>
<pubDate>Mon, 26 Oct 2026 14:00:00 GMT</pubDate>
<description>&lt;a href="https://news.google.com/rss/articles/CBMiAbc123?oc=5"&gt;Mosque in Testville vandalized&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Testville Daily&lt;/font&gt;</description>
<source url="https://www.testvilledaily.example">Testville Daily</source></item>
<item><title><![CDATA[Man charged after threats to Islamic center & imam]]></title><link>https://www.example.org/news/charged?utm_source=rss&amp;id=7#top</link>
<pubDate>Sun, 25 Oct 2026 09:30:00 -0400</pubDate><description><![CDATA[<p>Prosecutors said the man left <b>threatening</b> voicemails.</p>]]></description></item>
<item><title>No link here</title></item>
</channel></rss>`

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>CAIR calls for hate crime probe</title>
<link rel="alternate" href="https://www.cair.example/press/probe/"/><updated>2026-10-26T12:00:00Z</updated><summary>CAIR asked police to investigate.</summary></entry></feed>`

describe('feed parsing', () => {
  it('reads RSS items, CDATA, entities, sources and dates', () => {
    const items = parseFeed(GOOGLE_RSS)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      url: 'https://news.google.com/rss/articles/CBMiAbc123?oc=5',
      headline: 'Mosque in Testville vandalized with anti-Muslim graffiti - Testville Daily',
      outlet: 'Testville Daily',
      publishedAt: '2026-10-26T14:00:00.000Z',
    })
    expect(items[1]).toMatchObject({
      headline: 'Man charged after threats to Islamic center & imam',
      snippet: 'Prosecutors said the man left threatening voicemails.',
      publishedAt: '2026-10-25T13:30:00.000Z',
    })
  })

  it('reads Atom entries', () => {
    expect(parseFeed(ATOM)).toEqual([
      { url: 'https://www.cair.example/press/probe/', headline: 'CAIR calls for hate crime probe', outlet: null, publishedAt: '2026-10-26T12:00:00.000Z', snippet: 'CAIR asked police to investigate.' },
    ])
  })

  it("reads GDELT's article list and ignores malformed entries", () => {
    const items = parseGdelt({
      articles: [
        { url: 'https://local.example/a', title: 'Hijab pulled at bus stop', domain: 'local.example', seendate: '20261026T143000Z' },
        { url: 'https://local.example/b', title: '' },
        { title: 'no url' },
      ],
    })
    expect(items).toEqual([{ url: 'https://local.example/a', headline: 'Hijab pulled at bus stop', outlet: 'local.example', publishedAt: '2026-10-26T14:30:00.000Z', snippet: null }])
    expect(parseGdelt({})).toEqual([])
    expect(parseGdelt(null)).toEqual([])
  })

  it('decodes numeric and named entities', () => {
    expect(decodeEntities('Qur&#8217;an &amp; &#x2014; &quot;x&quot; &bogus;')).toBe('Qur’an & — "x" &bogus;')
  })
})

describe('recognizing an article seen before', () => {
  it('normalizes addresses: https, no www, no tracking, no fragment, sorted query', () => {
    expect(normalizeUrl('http://www.Example.org/news/charged/?utm_source=rss&id=7&fbclid=1#top')).toBe('https://example.org/news/charged?id=7')
    expect(normalizeUrl('https://example.org/')).toBe('https://example.org/')
    expect(normalizeUrl('ftp://example.org/x')).toBeNull()
    expect(normalizeUrl('not a url')).toBeNull()
  })

  it('compares headlines without the outlet suffix, case or punctuation', () => {
    expect(headlineKey('Mosque vandalized, police say - Testville Daily', 'Testville Daily')).toBe(headlineKey('Mosque Vandalized; Police Say'))
  })

  it('keeps one item per article and per headline, preferring a direct link', () => {
    const base = { outlet: 'Testville Daily', publishedAt: null, snippet: null, feed: 'x', leadSource: 'news_monitor' as const }
    const items: FeedItem[] = [
      { ...base, url: 'https://news.google.com/rss/articles/abc', headline: 'Mosque vandalized - Testville Daily', matchedTerms: ['q1'] },
      { ...base, url: 'https://testvilledaily.example/mosque?utm_medium=x', headline: 'Mosque vandalized', matchedTerms: ['q2'] },
      { ...base, url: 'https://www.testvilledaily.example/mosque', headline: 'Mosque vandalized', matchedTerms: ['q3'] },
    ]
    const out = dedupe(items)
    expect(out).toHaveLength(1)
    expect(out[0]!.url).toBe('https://testvilledaily.example/mosque')
    expect(out[0]!.matchedTerms.sort()).toEqual(['q1', 'q2', 'q3'])
  })

  it('fetches articles only from public web addresses', () => {
    for (const ok of ['https://www.example.org/news/a', 'http://local-news.example.com/story']) expect(isPublicWebAddress(ok), ok).toBe(true)
    for (const bad of [
      'http://localhost:3000/admin',
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://0x7f000001/',
      'http://intranet/',
      'http://db.internal/',
      'http://printer.local/',
      'https://user:pass@example.org/',
      'file:///etc/passwd',
      'javascript:alert(1)',
    ])
      expect(isPublicWebAddress(bad), bad).toBe(false)
  })

  it('does not follow a redirect to an internal address, and falls back to the snippet', async () => {
    const asked: string[] = []
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input)
      asked.push(url)
      return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
    }) as typeof fetch
    expect(await readArticle(fetchImpl, { url: 'https://news.example.org/a', snippet: 'The snippet.' })).toBe('The snippet.')
    expect(asked).toEqual(['https://news.example.org/a'])
  })

  it('knows Google News links cannot be read directly', () => {
    expect(isGoogleNewsLink('https://news.google.com/rss/articles/abc')).toBe(true)
    expect(isGoogleNewsLink('https://example.org/a')).toBe(false)
  })
})

describe('article text', () => {
  it('takes the paragraphs of the article, not the page furniture', () => {
    const html = `<html><head><script>var x = "<p>not this</p>"</script></head><body><nav><p>Home | News | Sports and much more navigation text here</p></nav>
      <article><h1>Title</h1><p>Police said the mosque's front door was spray-painted overnight with a slur.</p><p>Short</p>
      <p>The Council on American-Islamic Relations asked investigators to treat it as a hate crime.</p></article><footer><p>Copyright notice that is long enough to count as a paragraph</p></footer></body></html>`
    expect(articleText(html)).toBe(
      "Police said the mosque's front door was spray-painted overnight with a slur.\n\nThe Council on American-Islamic Relations asked investigators to treat it as a hate crime.",
    )
  })

  it('falls back to the page description and caps the length', () => {
    expect(articleText('<meta property="og:description" content="A short description of the story.">')).toBe('A short description of the story.')
    const long = `<article><p>${'word '.repeat(5000)}</p></article>`
    expect(articleText(long, 100)).toHaveLength(101)
  })
})

describe('sources', () => {
  it('searches news and feeds, and adds feeds from NEWS_SCAN_EXTRA_FEEDS', () => {
    const list = sources({ NEWS_SCAN_EXTRA_FEEDS: ' https://a.example/feed , https://b.example/rss ' } as unknown as NodeJS.ProcessEnv)
    expect(list.filter((s) => s.kind === 'google').length).toBeGreaterThanOrEqual(5)
    expect(list.some((s) => s.kind === 'gdelt')).toBe(true)
    expect(list.filter((s) => s.id.startsWith('extra-')).map((s) => (s as { url: string }).url)).toEqual(['https://a.example/feed', 'https://b.example/rss'])
  })

  it('without a model, makes a lead only when a Muslim target and an incident are both named', () => {
    expect(keywordMatch('Mosque vandalized with graffiti')).toBe(true)
    expect(keywordMatch('Man charged after threats to Islamic center')).toBe(true)
    expect(keywordMatch('Mosque hosts interfaith dinner')).toBe(false)
    expect(keywordMatch('Store vandalized downtown')).toBe(false)
  })
})

describe('the model prompt', () => {
  it('gives the model the published inclusion criteria word for word', () => {
    for (const c of [...INCLUSION_CRITERIA, ...INCLUSION_EXCLUSIONS]) expect(SYSTEM_PROMPT).toContain(c)
    expect(SYSTEM_PROMPT).toContain('not instructions')
  })

  it('stays the same for every article, so it can be cached', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    const msg = articleMessage({ headline: 'H', outlet: null, url: 'https://x.example', publishedAt: null, text: '', today: '2026-10-27' })
    expect(msg).toContain("Today's date: 2026-10-27")
    expect(msg).toContain('(Only the headline is available.)')
  })
})

const ASSESSMENT = NewsAssessmentSchema.parse({
  relevance: 'new_incident',
  confidence: 'high',
  reason: 'A mosque was vandalized with a slur (criteria 1–3).',
  incident_date: '2026-10-25',
  date_precision: 'day',
  city: 'Testville',
  state_code: 'MI',
  incident_types: ['VAND'],
  target_type: 'mosque_islamic_center',
  bias_indicators: ['slur'],
  legal_status: 'under_investigation',
  hate_crime_charged: 'unknown',
  summary: 'A mosque in Testville was spray-painted with an anti-Muslim slur.',
})

function fakeClient(reply: (params: Record<string, unknown>) => unknown): ScanClient & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = []
  return {
    calls,
    beta: {
      messages: {
        parse: (async (params: Record<string, unknown>) => {
          calls.push(params)
          return reply(params)
        }) as unknown as ScanClient['beta']['messages']['parse'],
      },
    },
  }
}

const input = { headline: 'Mosque vandalized', outlet: 'Testville Daily', url: 'https://x.example/a', publishedAt: null, text: 'Police said…', today: '2026-10-27' }
const usage = { input_tokens: 900, output_tokens: 250, cache_read_input_tokens: 1800, cache_creation_input_tokens: 0 }

describe('assessing an article', () => {
  it('asks Claude Opus 5.5 at low effort with a cached system prompt, a structured format and refusal fallback', async () => {
    const client = fakeClient(() => ({ stop_reason: 'end_turn', parsed_output: ASSESSMENT, model: 'claude-opus-5-5', usage }))
    const res = await assessArticle(client, 'claude-opus-5-5', input)
    expect(res).toEqual({ ok: true, assessment: ASSESSMENT, model: 'claude-opus-5-5', usage })
    const p = client.calls[0]!
    expect(p.model).toBe('claude-opus-5-5')
    expect(p.fallbacks).toBe('default')
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01'])
    expect((p.output_config as { effort: string }).effort).toBe('low')
    expect((p.output_config as { format: unknown }).format).toBeTruthy()
    expect((p.system as { cache_control: unknown }[])[0]!.cache_control).toEqual({ type: 'ephemeral' })
    expect(p).not.toHaveProperty('thinking')
  })

  it('sends no fallback for models without one', async () => {
    const client = fakeClient(() => ({ stop_reason: 'end_turn', parsed_output: ASSESSMENT, model: 'claude-haiku-5-5', usage }))
    await assessArticle(client, 'claude-haiku-5-5', input)
    expect(client.calls[0]).not.toHaveProperty('fallbacks')
    expect(client.calls[0]).not.toHaveProperty('betas')
  })

  it('reports a refusal without retrying, and an incomplete answer for another try', async () => {
    const refused = await assessArticle(fakeClient(() => ({ stop_reason: 'refusal', stop_details: { category: 'general_harms' }, parsed_output: null, usage })), 'claude-opus-5-5', input)
    expect(refused).toMatchObject({ ok: false, retry: false })
    expect((refused as { error: string }).error).toContain('declined')
    const cut = await assessArticle(fakeClient(() => ({ stop_reason: 'max_tokens', parsed_output: null, usage })), 'claude-opus-5-5', input)
    expect(cut).toMatchObject({ ok: false, retry: true })
  })

  it('retries rate limits and server errors, not bad requests', async () => {
    const fail = (status: number) =>
      fakeClient(() => {
        throw Object.assign(new Error(`HTTP ${status}`), { status })
      })
    expect(await assessArticle(fail(429), 'claude-opus-5-5', input)).toMatchObject({ ok: false, retry: true })
    expect(await assessArticle(fail(529), 'claude-opus-5-5', input)).toMatchObject({ ok: false, retry: true })
    expect(await assessArticle(fail(400), 'claude-opus-5-5', input)).toMatchObject({ ok: false, retry: false })
  })
})

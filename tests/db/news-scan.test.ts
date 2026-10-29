/**
 * The morning news scan against stand-in feeds, article pages and model: it
 * reads each article once, sends relevant or unclear ones to the leads inbox,
 * keeps the rest with the reason, and never creates or publishes a record.
 */
import { randomUUID } from 'node:crypto'
import { eq, inArray, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { adminDb } from '@/db/admin'
import { auditLog, incidents, leads, newsCandidates, publishedIncidents } from '@/db/schema'
import type { NewsAssessment } from '@/lib/news-assessment'
import * as wf from '@/server/admin/incidents'
import type { ScanClient } from '@/server/jobs/news/assess'
import { runNewsScan } from '@/server/jobs/news/scan'
import { completeDraft, team } from './helpers'

let run = ''
let failing = new Set<string>()
let gdeltStatus = 200

const rss = (items: { title: string; link: string; source?: string }[]) =>
  `<rss version="2.0"><channel>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link><pubDate>Mon, 26 Oct 2026 14:00:00 GMT</pubDate>${i.source ? `<source url="https://x.example">${i.source}</source>` : ''}</item>`)
    .join('')}</channel></rss>`

/** Stand-ins for Google News, GDELT, CAIR and article pages. */
const fakeFetch = (async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input)
  const host = new URL(url).hostname
  if (host === 'news.google.com' && url.includes('/rss/search'))
    return new Response(
      rss([
        { title: `Mosque in Testville vandalized ${run} - Testville Daily`, link: `https://news.google.com/rss/articles/${run}-vandal`, source: 'Testville Daily' },
        { title: `Mosque hosts interfaith dinner ${run}`, link: `https://news.google.com/rss/articles/${run}-dinner`, source: 'Testville Daily' },
      ]),
    )
  if (host === 'api.gdeltproject.org') {
    if (gdeltStatus !== 200) return new Response('down', { status: gdeltStatus })
    return Response.json({
      articles: [
        // The same story as the first Google item, with a direct link: kept instead of it.
        { url: `https://testvilledaily.example/${run}/vandal?utm_source=gdelt`, title: `Mosque in Testville vandalized ${run}`, domain: 'testvilledaily.example', seendate: '20261026T140000Z' },
        { url: `https://other.example/${run}/unclear`, title: `Unclear report near a mosque ${run}`, domain: 'other.example', seendate: '20261026T150000Z' },
      ],
    })
  }
  if (host === 'www.cair.com') return new Response(rss([{ title: `CAIR condemns threats to Islamic center ${run}`, link: `https://www.cair.com/press/${run}-threats/` }]))
  if (url.includes(run))
    return new Response(`<html><body><article><p>Police in Testville said the building was spray-painted overnight with an anti-Muslim slur.</p></article></body></html>`)
  return new Response('not found', { status: 404 })
}) as typeof fetch

const reading = (over: Partial<NewsAssessment> = {}): NewsAssessment => ({
  relevance: 'new_incident',
  confidence: 'high',
  reason: 'A mosque was vandalized with a slur.',
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
  ...over,
})

function model(): ScanClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    beta: {
      messages: {
        parse: (async (params: { messages: { content: string }[] }) => {
          const text = params.messages[0]!.content
          const headline = /Headline: (.*)/.exec(text)![1]!
          calls.push(headline)
          if ([...failing].some((f) => headline.includes(f))) throw Object.assign(new Error('Overloaded'), { status: 529 })
          const out = headline.includes('interfaith')
            ? reading({ relevance: 'not_relevant', reason: 'A community event, not an incident.', incident_types: [], bias_indicators: [] })
            : headline.includes('Unclear')
              ? reading({ relevance: 'not_relevant', confidence: 'low', reason: 'Too little detail to tell.' })
              : headline.includes('CAIR')
                ? reading({ relevance: 'new_incident', incident_types: ['THRT'] })
                : reading()
          return { stop_reason: 'end_turn', parsed_output: out, model: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 } }
        }) as unknown as ScanClient['beta']['messages']['parse'],
      },
    },
  }
}

async function rows() {
  return adminDb().select().from(newsCandidates).where(sql`${newsCandidates.url} LIKE ${`%${run}%`}`)
}

beforeEach(async () => {
  run = `run${randomUUID().slice(0, 8)}`
  failing = new Set()
  gdeltStatus = 200
  // Each test reads only its own articles.
  await adminDb().update(newsCandidates).set({ status: 'skipped' }).where(inArray(newsCandidates.status, ['pending', 'working']))
})

describe('morning news scan', () => {
  it('reads each article once and sends relevant or unclear ones to the inbox', async () => {
    const client = model()
    const res = await runNewsScan({ fetchImpl: fakeFetch, client, now: () => new Date('2026-10-27T10:10:00Z') })
    expect(res).toMatchObject({ ai: true, model: 'claude-opus-5-5', added: 4, read: 4, leads: 3, skipped: 1, failed: 0, remaining: 0, stoppedAt: 'done' })
    expect(client.calls).toHaveLength(4)

    const found = await rows()
    const byStatus = Object.fromEntries(found.map((r) => [r.headline.replace(` ${run}`, '').replace(' - Testville Daily', ''), r.status]))
    expect(byStatus).toEqual({
      'Mosque in Testville vandalized': 'lead',
      'Unclear report near a mosque': 'lead',
      'CAIR condemns threats to Islamic center': 'lead',
      'Mosque hosts interfaith dinner': 'skipped',
    })
    // The direct link was kept over the Google News redirect, without tracking parameters.
    expect(found.map((r) => r.url)).toContain(`https://testvilledaily.example/${run}/vandal`)
    const skipped = found.find((r) => r.status === 'skipped')!
    expect(skipped.assessment?.reason).toBe('A community event, not an incident.')
    expect(skipped.leadId).toBeNull()

    const made = await adminDb().select().from(leads).where(inArray(leads.id, found.flatMap((r) => (r.leadId ? [r.leadId] : []))))
    expect(made).toHaveLength(3)
    expect(made.every((l) => l.status === 'new')).toBe(true)
    expect(made.find((l) => l.headline.startsWith('CAIR'))?.source).toBe('org_feed')
    expect(made.find((l) => l.headline.startsWith('Mosque in'))?.source).toBe('news_monitor')
    expect(made.find((l) => l.headline.startsWith('Mosque in'))?.publishedDate).toBe('2026-10-26')

    const logged = await adminDb().select().from(auditLog).where(inArray(auditLog.entityId, made.map((l) => l.id)))
    expect(logged.map((a) => a.action)).toEqual(['lead.create', 'lead.create', 'lead.create'])
    expect(logged.every((a) => a.actorId === null && (a.details as { via: string }).via === 'news_scan')).toBe(true)

    // A second pass the same morning finds nothing new and asks the model nothing.
    const again = await runNewsScan({ fetchImpl: fakeFetch, client, now: () => new Date('2026-10-27T10:45:00Z') })
    expect(again).toMatchObject({ added: 0, read: 0, leads: 0 })
    expect(client.calls).toHaveLength(4)
  })

  it('never creates or publishes a record', async () => {
    const before = await adminDb().select({ n: sql<number>`count(*)::int` }).from(incidents)
    const published = await adminDb().select({ n: sql<number>`count(*)::int` }).from(publishedIncidents)
    await runNewsScan({ fetchImpl: fakeFetch, client: model() })
    expect(await adminDb().select({ n: sql<number>`count(*)::int` }).from(incidents)).toEqual(before)
    expect(await adminDb().select({ n: sql<number>`count(*)::int` }).from(publishedIncidents)).toEqual(published)
  })

  it('skips articles already in the inbox, and flags records in the same place and week', async () => {
    const t = await team()
    const { id } = await wf.saveIncident(t.author, completeDraft({ dateStart: '2026-10-23', stateFips: '26', city: 'Testville' }), 'x')
    await adminDb().insert(leads).values({ source: 'manual', headline: 'Entered by hand', url: `https://www.cair.com/press/${run}-threats` })
    await runNewsScan({ fetchImpl: fakeFetch, client: model() })
    const found = await rows()
    expect(found.some((r) => r.url.includes('-threats'))).toBe(false)
    const vandal = found.find((r) => r.url.includes('/vandal'))!
    expect(vandal.assessment?.possible_duplicates).toContain(id)
  })

  it('stops at the daily lead limit and leaves the rest for the next pass', async () => {
    // A clock a year ahead, so leads made by the other tests are outside its 24 hours.
    const res = await runNewsScan({ fetchImpl: fakeFetch, client: model(), maxLeadsPerDay: 1, concurrency: 1, now: () => new Date(Date.now() + 365 * 86_400_000) })
    expect(res.leads).toBe(1)
    expect(res.stoppedAt).toBe('daily_limit')
    expect(res.remaining).toBeGreaterThan(0)
  })

  it('retries an article when the model is unavailable, and keeps going when a feed is down', async () => {
    failing = new Set(['Unclear'])
    gdeltStatus = 503
    const res = await runNewsScan({ fetchImpl: fakeFetch, client: model() })
    expect(res.feedErrors).toEqual([{ feed: 'gdelt', error: 'HTTP 503' }])
    expect(res.allFeedsFailed).toBe(false)
    // Without GDELT the Google items are kept; the unclear article came only from GDELT.
    expect(res.added).toBe(3)

    gdeltStatus = 200
    const res2 = await runNewsScan({ fetchImpl: fakeFetch, client: model() })
    // The vandalism story seen yesterday through Google News is not read again from GDELT.
    expect(res2.added).toBe(1)
    expect(res2.retrying).toBe(1)
    expect(res2.read).toBe(1)
    const unclear = (await rows()).find((r) => r.url.includes('unclear'))!
    expect(unclear).toMatchObject({ status: 'pending', attempts: 1, note: 'Overloaded' })

    failing = new Set()
    await runNewsScan({ fetchImpl: fakeFetch, client: model(), collect: false })
    expect((await rows()).find((r) => r.url.includes('unclear'))).toMatchObject({ status: 'lead', attempts: 2 })
  })

  it('says so when no source can be reached', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    const res = await runNewsScan({ fetchImpl: offline, client: model() })
    expect(res).toMatchObject({ allFeedsFailed: true, added: 0 })
    expect(res.feedErrors.every((e) => e.error === 'fetch failed')).toBe(true)
  })

  it('without an API key, uses the keyword rule', async () => {
    const res = await runNewsScan({ fetchImpl: fakeFetch, client: null })
    expect(res).toMatchObject({ ai: false, model: null })
    const found = await rows()
    const status = (part: string) => found.find((r) => r.url.includes(part))!.status
    expect(status('/vandal')).toBe('lead')
    expect(status('-threats')).toBe('lead')
    expect(status('-dinner')).toBe('skipped')
    expect(found.find((r) => r.url.includes('-dinner'))!.note).toContain('keyword rule')
    const lead = await adminDb().select().from(leads).where(eq(leads.id, found.find((r) => r.url.includes('/vandal'))!.leadId!))
    expect(lead[0]!.status).toBe('new')
  })
})

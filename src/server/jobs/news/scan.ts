/**
 * The morning news scan. Each pass:
 *  1. collects new articles from the feeds (src/server/jobs/news/feeds.ts),
 *     skipping any already seen, already a lead, or already a record's source;
 *  2. reads waiting articles until its time is up: Claude judges each against
 *     the inclusion criteria and extracts what it states;
 *  3. turns relevant or unclear ones into leads in the editors' inbox, and
 *     keeps the rest, with the reason, for editors to check.
 * Nothing here publishes: a lead is a suggestion, records are drafted and
 * reviewed by editors, and publishing takes two people (enforced in the database).
 * Without an Anthropic API key the scan still runs, with a keyword rule instead.
 */
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { and, asc, count, eq, gte, inArray, isNotNull, lt, notInArray, or, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { incidents, leads, newsCandidates, sources } from '@/db/schema'
import type { NewsCandidateStatus } from '@/db/enums'
import { addDays, todayIso } from '@/lib/format'
import type { NewsAssessment, StoredAssessment } from '@/lib/news-assessment'
import { stateByCode } from '@/lib/states'
import { audit } from '@/server/admin/audit'
import { DEFAULT_SCAN_MODEL, assessArticle, type ScanClient } from './assess'
import { fetchFeeds, readArticle } from './feeds'
import { headlineKey, normalizeUrl } from './parse'

/** Tries per article before it is marked failed. */
export const MAX_ATTEMPTS = 3
/** A claim older than this was abandoned (the pass timed out); the article is taken again. */
const STALE_CLAIM_MINUTES = 10
/** Time a model call may take, so a pass stops starting new ones before its deadline. */
const CALL_MS = 50_000

export type ScanOptions = {
  /** Fetch the feeds first (default). Later passes of the same morning only read. */
  collect?: boolean
  /** Epoch milliseconds after which no new article is started. */
  deadline?: number
  concurrency?: number
  fetchImpl?: typeof fetch
  /** The Anthropic client; null runs the keyword rule. Default: one from ANTHROPIC_API_KEY, if set. */
  client?: ScanClient | null
  model?: string
  maxLeadsPerDay?: number
  now?: () => Date
}

export type ScanResult = {
  ai: boolean
  model: string | null
  collected: number
  added: number
  read: number
  leads: number
  skipped: number
  failed: number
  retrying: number
  remaining: number
  feedErrors: { feed: string; error: string }[]
  /** Every source failed: nothing new could be found (network or source outage). */
  allFeedsFailed: boolean
  stoppedAt: 'done' | 'deadline' | 'daily_limit'
}

export function scanClientFromEnv(env: NodeJS.ProcessEnv = process.env): ScanClient | null {
  if (env.NEWS_SCAN_AI === 'off') return null
  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) return null
  return new Anthropic()
}

// Without a model: a lead only when the headline or snippet names both a
// Muslim target and an incident. Coarse on purpose; editors triage the rest.
const MUSLIM_TERMS = /\b(muslims?|islam\w*|mosques?|masjids?|hijabs?|qurans?|korans?|cair)\b/i
const INCIDENT_TERMS = /\b(attack\w*|assault\w*|threat\w*|vandal\w*|arson\w*|fires?|hate crimes?|harass\w*|slurs?|graffiti|desecrat\w*|arrest\w*|charged|indicted|convicted|sentenced)\b/i
export function keywordMatch(text: string): boolean {
  return MUSLIM_TERMS.test(text) && INCIDENT_TERMS.test(text)
}

type Candidate = typeof newsCandidates.$inferSelect

/** Addresses already seen as a lead or as a source of a record in the last six months. */
async function knownUrls(): Promise<Set<string>> {
  const since = new Date(Date.now() - 183 * 86_400_000)
  const db = adminDb()
  const [fromLeads, fromSources] = await Promise.all([
    db.select({ url: leads.url }).from(leads).where(and(isNotNull(leads.url), gte(leads.createdAt, since))),
    db.select({ url: sources.url }).from(sources).where(gte(sources.createdAt, since)),
  ])
  return new Set([...fromLeads, ...fromSources].map((r) => (r.url ? normalizeUrl(r.url) : null)).filter((u): u is string => !!u))
}

/** Records in the same state (and city, when known) within a week of the date: possible duplicates. */
async function possibleDuplicates(a: NewsAssessment, fallbackDate: string): Promise<string[]> {
  const state = a.state_code ? stateByCode(a.state_code) : undefined
  if (!state) return []
  const day = a.incident_date && /^\d{4}-\d{2}-\d{2}$/.test(a.incident_date) ? a.incident_date : fallbackDate
  const rows = await adminDb()
    .select({ id: incidents.id })
    .from(incidents)
    .where(
      and(
        eq(incidents.stateFips, state.fips),
        a.city ? sql`(${incidents.city} IS NULL OR lower(${incidents.city}) = lower(${a.city}))` : undefined,
        gte(incidents.dateStart, addDays(day, -7)),
        lt(incidents.dateStart, addDays(day, 8)),
      ),
    )
    .orderBy(asc(incidents.id))
    .limit(5)
  return rows.map((r) => r.id)
}

/** Headlines found in the last week, so a story seen again under another address is not read twice. */
async function recentHeadlines(): Promise<Set<string>> {
  const since = new Date(Date.now() - 7 * 86_400_000)
  const rows = await adminDb().select({ headline: newsCandidates.headline, outlet: newsCandidates.outlet }).from(newsCandidates).where(gte(newsCandidates.createdAt, since))
  return new Set(rows.map((r) => headlineKey(r.headline, r.outlet)))
}

/**
 * Take up to n waiting articles; parallel passes never take the same one.
 * `exclude` holds the ones this pass already tried, so a failure waits for the next pass.
 */
async function claim(n: number, exclude: string[]): Promise<Candidate[]> {
  const db = adminDb()
  const staleBefore = sql`now() - make_interval(mins => ${STALE_CLAIM_MINUTES})`
  const open = or(eq(newsCandidates.status, 'pending'), and(eq(newsCandidates.status, 'working'), lt(newsCandidates.claimedAt, staleBefore)))
  // Abandoned too often: give up on it.
  await db
    .update(newsCandidates)
    .set({ status: 'failed', note: 'Gave up after repeated tries.' })
    .where(and(open, gte(newsCandidates.attempts, MAX_ATTEMPTS)))
  const ids = db
    .select({ id: newsCandidates.id })
    .from(newsCandidates)
    .where(and(open, lt(newsCandidates.attempts, MAX_ATTEMPTS), exclude.length ? notInArray(newsCandidates.id, exclude) : undefined))
    .orderBy(asc(newsCandidates.createdAt), asc(newsCandidates.id))
    .limit(n)
    .for('update', { skipLocked: true })
  return db
    .update(newsCandidates)
    .set({ status: 'working', claimedAt: sql`now()`, attempts: sql`${newsCandidates.attempts} + 1` })
    .where(inArray(newsCandidates.id, ids))
    .returning()
}

async function leadsCreatedSince(since: Date): Promise<number> {
  const [row] = await adminDb()
    .select({ n: count() })
    .from(newsCandidates)
    .where(and(eq(newsCandidates.status, 'lead'), gte(newsCandidates.assessedAt, since)))
  return row?.n ?? 0
}

async function finish(c: Candidate, status: NewsCandidateStatus, patch: Partial<Candidate>) {
  await adminDb()
    .update(newsCandidates)
    .set({ ...patch, status, claimedAt: null, assessedAt: status === 'pending' ? null : new Date() })
    .where(eq(newsCandidates.id, c.id))
}

/** A lead in the inbox and the article marked as sent, together. */
async function makeLead(c: Candidate, patch: Partial<Candidate>) {
  await adminDb().transaction(async (tx) => {
    const [lead] = await tx
      .insert(leads)
      .values({
        source: c.leadSource,
        headline: c.headline,
        url: c.url,
        outlet: c.outlet,
        publishedDate: c.publishedAt ? todayIso(c.publishedAt) : null,
        matchedTerms: c.matchedTerms,
      })
      .returning({ id: leads.id })
    await tx
      .update(newsCandidates)
      .set({ ...patch, status: 'lead', leadId: lead!.id, claimedAt: null, assessedAt: new Date() })
      .where(eq(newsCandidates.id, c.id))
    await audit(tx, null, 'lead.create', 'lead', lead!.id, {
      via: 'news_scan',
      candidate: c.id,
      relevance: patch.assessment?.relevance ?? null,
      confidence: patch.assessment?.confidence ?? null,
    })
  })
}

export async function runNewsScan(opts: ScanOptions = {}): Promise<ScanResult> {
  const now = opts.now ?? (() => new Date())
  const deadline = opts.deadline ?? now().getTime() + 270_000
  const fetchImpl = opts.fetchImpl ?? fetch
  const client = opts.client === undefined ? scanClientFromEnv() : opts.client
  const model = opts.model ?? process.env.NEWS_SCAN_MODEL ?? DEFAULT_SCAN_MODEL
  const maxLeads = opts.maxLeadsPerDay ?? Number(process.env.NEWS_SCAN_MAX_LEADS_PER_DAY ?? 40)
  const concurrency = opts.concurrency ?? 6
  const result: ScanResult = {
    ai: !!client,
    model: client ? model : null,
    collected: 0,
    added: 0,
    read: 0,
    leads: 0,
    skipped: 0,
    failed: 0,
    retrying: 0,
    remaining: 0,
    feedErrors: [],
    allFeedsFailed: false,
    stoppedAt: 'done',
  }

  if (opts.collect !== false) {
    const { items, errors, tried } = await fetchFeeds(fetchImpl)
    result.collected = items.length
    result.feedErrors = errors
    result.allFeedsFailed = tried > 0 && errors.length === tried
    const [known, seen] = await Promise.all([knownUrls(), recentHeadlines()])
    const fresh = items.filter((i) => !known.has(i.url) && !seen.has(headlineKey(i.headline, i.outlet)))
    if (fresh.length) {
      const inserted = await adminDb()
        .insert(newsCandidates)
        .values(
          fresh.map((i) => ({
            url: i.url,
            headline: i.headline.slice(0, 500),
            outlet: i.outlet?.slice(0, 200) ?? null,
            publishedAt: i.publishedAt ? new Date(i.publishedAt) : null,
            feed: i.feed,
            leadSource: i.leadSource,
            matchedTerms: i.matchedTerms,
            snippet: i.snippet?.slice(0, 2000) ?? null,
          })),
        )
        .onConflictDoNothing({ target: newsCandidates.url })
        .returning({ id: newsCandidates.id })
      result.added = inserted.length
    }
  }

  // The daily limit counts leads made in the last 24 hours.
  const today = todayIso(now())
  let budget = Math.max(0, maxLeads - (await leadsCreatedSince(new Date(now().getTime() - 86_400_000))))

  const process1 = async (c: Candidate) => {
    result.read += 1
    const text = await readArticle(fetchImpl, c)
    if (!client) {
      if (keywordMatch(`${c.headline} ${c.snippet ?? ''} ${text.slice(0, 2000)}`) && budget > 0) {
        budget -= 1
        result.leads += 1
        await makeLead(c, { note: 'Keyword match (no model configured).' })
      } else {
        result.skipped += 1
        await finish(c, 'skipped', { note: 'No model configured, and the headline did not match the keyword rule.' })
      }
      return
    }
    // Read in an earlier pass but held back by the daily limit: use that reading.
    if (c.assessment && c.model) {
      const patch = { assessment: c.assessment, model: c.model, usage: c.usage, note: null }
      if (budget > 0) {
        budget -= 1
        result.leads += 1
        await makeLead(c, patch)
      } else {
        result.retrying += 1
        await finish(c, 'pending', patch)
      }
      return
    }
    const res = await assessArticle(client, model, {
      headline: c.headline,
      outlet: c.outlet,
      url: c.url,
      publishedAt: c.publishedAt?.toISOString() ?? null,
      text,
      today,
    })
    if (!res.ok) {
      if (res.retry && c.attempts < MAX_ATTEMPTS) {
        result.retrying += 1
        await finish(c, 'pending', { note: res.error, usage: res.usage ?? null })
      } else if (!res.retry && budget > 0) {
        // Declined or unreadable for good: an editor decides.
        budget -= 1
        result.leads += 1
        await makeLead(c, { note: res.error, usage: res.usage ?? null })
      } else {
        result.failed += 1
        await finish(c, 'failed', { note: res.error, usage: res.usage ?? null })
      }
      return
    }
    const a = res.assessment
    const stored: StoredAssessment = { ...a, possible_duplicates: await possibleDuplicates(a, c.publishedAt ? todayIso(c.publishedAt) : today) }
    const patch = { assessment: stored, model: res.model, usage: res.usage, note: null }
    // Relevant, or unclear: an editor looks. Clearly irrelevant: kept here, not in the inbox.
    if ((a.relevance !== 'not_relevant' || a.confidence === 'low') && budget > 0) {
      budget -= 1
      result.leads += 1
      await makeLead(c, patch)
    } else if (a.relevance !== 'not_relevant' || a.confidence === 'low') {
      result.retrying += 1
      await finish(c, 'pending', { ...patch })
    } else {
      result.skipped += 1
      await finish(c, 'skipped', patch)
    }
  }

  const tried: string[] = []
  for (;;) {
    if (budget <= 0) {
      result.stoppedAt = 'daily_limit'
      break
    }
    if (now().getTime() + CALL_MS > deadline) {
      result.stoppedAt = 'deadline'
      break
    }
    const batch = await claim(Math.min(concurrency, budget), tried)
    if (!batch.length) break
    tried.push(...batch.map((c) => c.id))
    await Promise.all(
      batch.map((c) =>
        process1(c).catch(async (err) => {
          result.retrying += 1
          await finish(c, 'pending', { note: `Pass error: ${(err as Error).message.slice(0, 300)}` })
        }),
      ),
    )
  }

  const [left] = await adminDb()
    .select({ n: count() })
    .from(newsCandidates)
    .where(and(inArray(newsCandidates.status, ['pending', 'working']), lt(newsCandidates.attempts, MAX_ATTEMPTS)))
  result.remaining = left?.n ?? 0
  return result
}

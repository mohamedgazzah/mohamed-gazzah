import Link from 'next/link'
import { NEWS_CANDIDATE_STATUSES, NEWS_CANDIDATE_STATUS_META, type NewsCandidateStatus } from '@/db/enums'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { RELEVANCE_LABELS } from '@/lib/news-assessment'
import { listScanCandidates, scanSummary } from '@/server/admin/news'
import { requireUser } from '@/server/admin/session'
import { DEFAULT_SCAN_MODEL } from '@/server/jobs/news/assess'

export const metadata = { title: 'Morning news scan' }

// Claude Opus 5.5 list prices per million tokens: input, output, cache read, cache write (5 minutes).
const OPUS_5_5 = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }

export default async function ScanLogPage(props: PageProps<'/admin/leads/scan'>) {
  await requireUser('editor')
  const sp = await props.searchParams
  const status =
    typeof sp.status === 'string' && (NEWS_CANDIDATE_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as NewsCandidateStatus) : 'all'
  const [rows, summary] = await Promise.all([listScanCandidates({ status, days: 7 }), scanSummary(7)])
  const model = process.env.NEWS_SCAN_MODEL ?? DEFAULT_SCAN_MODEL
  const ai = process.env.NEWS_SCAN_AI !== 'off' && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
  const t = summary.tokens
  const cost = (t.input * OPUS_5_5.input + t.output * OPUS_5_5.output + t.cacheRead * OPUS_5_5.cacheRead + t.cacheWrite * OPUS_5_5.cacheWrite) / 1_000_000

  return (
    <>
      <p className="text-sm">
        <Link href="/admin/leads">Leads inbox</Link>
      </p>
      <h1 className="mt-1 text-2xl">Morning news scan</h1>
      <p className="mt-2 hint max-w-3xl">
        Each morning the scan reads new articles from news searches and organization feeds, judges each against the published inclusion criteria,
        and sends relevant or unclear ones to the leads inbox. It never edits or publishes records. Skipped articles are listed here so its
        judgment can be checked; if one should be a lead, add it by hand from the inbox.
      </p>
      <p className="mt-3 text-base">
        {ai ? (
          <>
            Reading with <span className="tabular">{model}</span>.
          </>
        ) : process.env.NEWS_SCAN_AI === 'off' ? (
          'The model is turned off (NEWS_SCAN_AI=off), so the scan uses a keyword rule.'
        ) : (
          'No Anthropic API key is set, so the scan uses a keyword rule instead of a model (docs/DEPLOY.md, step 8.5).'
        )}{' '}
        Last article found: {summary.lastFound ? formatTimestamp(summary.lastFound) : 'none yet'}.
      </p>

      <section aria-labelledby="week-h" className="card mt-5 p-4">
        <h2 id="week-h" className="text-lg">
          Last 7 days
        </h2>
        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-base">
          {NEWS_CANDIDATE_STATUSES.map((s) => (
            <li key={s}>
              {NEWS_CANDIDATE_STATUS_META[s].label}: <span className="tabular font-semibold">{formatNumber(summary.byStatus[s] ?? 0)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted tabular">
          Tokens: {formatNumber(t.input)} input, {formatNumber(t.cacheRead)} cached input read, {formatNumber(t.cacheWrite)} written to cache,{' '}
          {formatNumber(t.output)} output
          {model === 'claude-opus-5-5' && t.input + t.output > 0 ? ` · about $${cost.toFixed(2)} at Claude Opus 5.5 list prices` : ''}.
        </p>
      </section>

      <nav aria-label="Filter by outcome" className="mt-5 flex flex-wrap gap-2">
        {(['all', ...NEWS_CANDIDATE_STATUSES] as const).map((s) => (
          <Link key={s} href={s === 'all' ? '/admin/leads/scan' : `/admin/leads/scan?status=${s}`} aria-current={status === s ? 'page' : undefined} className={status === s ? 'btn' : 'btn btn-secondary'}>
            {s === 'all' ? 'All' : NEWS_CANDIDATE_STATUS_META[s].label}
          </Link>
        ))}
      </nav>

      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="card p-4">
            <p className="text-sm text-muted tabular">
              {NEWS_CANDIDATE_STATUS_META[r.status].label} · found {formatTimestamp(r.createdAt)} · {r.outlet ?? 'unknown outlet'} · {r.feed}
              {r.attempts > 1 ? ` · ${r.attempts} tries` : ''}
            </p>
            <p className="mt-1 font-semibold">
              <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">
                {r.headline}
              </a>
            </p>
            {r.assessment ? (
              <p className="mt-1 text-base">
                {RELEVANCE_LABELS[r.assessment.relevance]} ({r.assessment.confidence} confidence): {r.assessment.reason}
              </p>
            ) : r.note ? (
              <p className="mt-1 text-base text-muted">{r.note}</p>
            ) : null}
            {r.leadId ? (
              <p className="mt-1 text-sm">
                <Link href={`/admin/leads/${r.leadId}`}>Open the lead</Link>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="card mt-5 p-4">No articles with this outcome in the last 7 days.</p> : null}
    </>
  )
}

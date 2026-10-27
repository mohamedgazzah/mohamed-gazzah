/**
 * The body of an incident record. Used by the public page and by the admin
 * editor's live preview, so editors see exactly what will be published.
 * Pure presentational: no data fetching, safe in server and client trees.
 */
import { Archive, ArrowRight, CalendarDays, ExternalLink, MapPin, MessageSquareText, Quote, RefreshCw, Tag } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  ALLEGATION_STATUSES,
  BIAS_INDICATOR_META,
  CONVICTION_STATUSES,
  INCIDENT_TYPE_META,
  LEGAL_EVENT_META,
  LOCATION_PRECISION_META,
  PERPETRATOR_TYPE_META,
  SOURCE_TYPE_META,
  STATEMENT_TYPE_META,
  STATEMENT_TYPES,
  TARGET_ATTRIBUTE_META,
  TARGET_TYPE_META,
  VERIFICATION_META,
  YES_NO_UNKNOWN_META,
  type BiasIndicator,
  type DatePrecision,
  type IncidentType,
  type LegalStatus,
  type LocationPrecision,
  type PerpetratorType,
  type Severity,
  type SourceType,
  type TargetAttribute,
  type TargetType,
  type VerificationLevel,
  type YesNoUnknown,
} from '@/db/enums'
import type { PublicCase, PublicChange, PublicLegalEvent, PublicSource, PublicStatement } from '@/db/schema'
import { formatDate, formatDateRange, formatPlace, formatTimestamp, plural } from '@/lib/format'
import { stateName } from '@/lib/states'
import { DemoBadge, LegalStatusBadges, SeverityMarker, VerificationBadge, WarningBadge } from './Badges'
import { SourceRef } from './SourceRef'
import { Summary } from './Summary'
import { Timeline } from './Timeline'

export type IncidentViewData = {
  id: string
  title: string
  summary: string
  dateStart: string
  dateEnd: string | null
  datePrecision: DatePrecision
  city: string | null
  stateCode: string
  locationPrecision: LocationPrecision
  incidentTypes: IncidentType[]
  targetType: TargetType
  targetAttributes: TargetAttribute[]
  severity: Severity
  deaths: number | null
  injuries: number | null
  propertyDamage: YesNoUnknown
  perpetratorType: PerpetratorType
  perpetratorCount: number | null
  perpetratorNames: string[]
  biasIndicators: BiasIndicator[]
  verificationLevel: VerificationLevel
  legalStatus: LegalStatus | null
  hateCrimeCharged: YesNoUnknown
  agenciesInvolved: string[]
  sourceTypes: SourceType[]
  sources: PublicSource[]
  legalEvents: PublicLegalEvent[]
  statements: PublicStatement[]
  cases: PublicCase[]
  changeLog: PublicChange[]
  isDemo: boolean
  updatedAt: string | null
}

/** What is known comes first: "1 person injured; deaths not stated". */
function casualties(deaths: number | null, injuries: number | null): string {
  if (deaths === null && injuries === null) return 'Not stated in sources'
  const d = deaths === null ? 'deaths not stated' : deaths === 0 ? 'no deaths reported' : plural(deaths, 'death')
  const inj = injuries === null ? 'injuries not stated' : injuries === 0 ? 'no injuries reported' : plural(injuries, 'person injured', 'people injured')
  const parts = deaths === null && injuries !== null ? [inj, d] : [d, inj]
  const text = parts.join('; ')
  return text[0]!.toUpperCase() + text.slice(1)
}

/** Statuses before any charge: a hate-crime charge cannot be "unknown" when no charge is known. */
const PRE_CHARGE: readonly LegalStatus[] = ['reported', 'under_investigation', 'suspect_identified', 'no_arrest', 'not_prosecuted']

/** "Unknown" reads as a finding; the sources simply do not say. */
const yesNo = (v: YesNoUnknown) => (v === 'unknown' ? 'Not stated in sources' : YES_NO_UNKNOWN_META[v].label)

/** "Stated motive, hate-crime charge": a list of labels as one phrase. */
const phrase = (labels: string[]) => labels.map((l, i) => (i ? l[0]!.toLowerCase() + l.slice(1) : l)).join(', ')

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-rule px-5 py-3.5 last:border-b-0 sm:grid-cols-[11.5rem_1fr]">
      <dt className="text-xs font-semibold text-muted">{term}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  )
}

/** A source title whose last word stays on one line with the external-link icon. */
function TitleWithIcon({ title }: { title: string }) {
  const cut = title.trimEnd().lastIndexOf(' ')
  return (
    <>
      {cut > 0 ? `${title.slice(0, cut)} ` : ''}
      <span className="whitespace-nowrap">
        {cut > 0 ? title.slice(cut + 1) : title}
        <ExternalLink aria-hidden="true" size={14} className="ms-1.5 inline align-[-1px] text-muted" />
      </span>
    </>
  )
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="section-head mb-4 text-2xl leading-tight">
      {children}
    </h2>
  )
}

/**
 * What is verified and where the case stands, side by side and in words, so
 * a reader scanning the page never takes a charge for a conviction.
 */
function RecordStatus({ data, idPrefix, nextDate }: { data: IncidentViewData; idPrefix: string; nextDate: string | null }) {
  const publicLevel = data.verificationLevel === 'V0' ? null : data.verificationLevel
  const alleged = data.legalStatus ? ALLEGATION_STATUSES.includes(data.legalStatus) : false
  const preCharge = data.legalStatus ? PRE_CHARGE.includes(data.legalStatus) : false
  const latest = [...data.legalEvents].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  // The rule is printed under each badge, so the badges here carry no tooltip to repeat it.
  return (
    <section aria-label="Record status" className="glass relative mt-6 grid gap-5 rounded-[var(--radius-md)] p-4 sm:grid-cols-2 sm:gap-6 md:p-5">
      <div className="flex flex-col">
        <p className="kicker">Verification</p>
        <div className="mt-2">
          {publicLevel ? (
            <VerificationBadge level={publicLevel} sourceTypes={data.sourceTypes} idPrefix={idPrefix} tooltip={false} />
          ) : (
            <WarningBadge>V0 — unverified, cannot be published</WarningBadge>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">{VERIFICATION_META[data.verificationLevel].rule}</p>
        <p className="mt-auto pt-2 text-sm">
          <a href={`/methodology#verification-${data.verificationLevel.toLowerCase()}`} className="arrow-link">
            How we verify <ArrowRight aria-hidden="true" size={14} />
          </a>
        </p>
      </div>
      <div className="flex flex-col sm:border-s sm:border-rule sm:ps-6">
        <p className="kicker">Legal status</p>
        <div className="mt-2">
          {data.legalStatus ? (
            <LegalStatusBadges status={data.legalStatus} hateCrimeCharged={data.hateCrimeCharged} idPrefix={idPrefix} alleged={false} tooltip={false} />
          ) : (
            <WarningBadge>Legal status not set</WarningBadge>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          {alleged ? (
            <>
              <strong className="font-semibold text-text">Not convicted.</strong> Anyone accused is presumed innocent.{' '}
            </>
          ) : null}
          {preCharge ? 'No charges are known. ' : null}
          {latest ? `Latest: ${LEGAL_EVENT_META[latest.event_type].label.toLowerCase()}, ${formatDate(latest.date)}.` : null}
          {nextDate ? (
            <>
              {' '}
              <span className="whitespace-nowrap">Next court date: {formatDate(nextDate)}.</span>
            </>
          ) : null}
        </p>
        {data.legalStatus ? (
          <p className="mt-auto pt-2 text-sm">
            <a href={`/methodology#legal-${data.legalStatus}`} className="arrow-link">
              What this status means <ArrowRight aria-hidden="true" size={14} />
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}

export function IncidentView({
  data,
  preview = false,
  contents,
}: {
  data: IncidentViewData
  preview?: boolean
  /** "On this page" for phones, shown under the status panel. */
  contents?: ReactNode
}) {
  const idPrefix = `rec-${data.id || 'draft'}`
  const convicted = data.legalStatus ? CONVICTION_STATUSES.includes(data.legalStatus) : false
  const statementsByType = STATEMENT_TYPES.map((t) => ({ type: t, items: data.statements.filter((s) => s.statement_type === t) })).filter(
    (g) => g.items.length,
  )
  const nextDate = data.cases.map((c) => c.next_date).filter((d): d is string => !!d).sort()[0] ?? null

  return (
    <article aria-labelledby={`${idPrefix}-title`}>
      <header className="mb-10">
        <p className="relative flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" size={16} />
            {formatDateRange(data.dateStart, data.dateEnd, data.datePrecision)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden="true" size={16} />
            {formatPlace(data.city, data.stateCode) || stateName(data.stateCode)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Tag aria-hidden="true" size={16} />
            {data.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(', ')}
          </span>
          {data.severity >= 4 ? <SeverityMarker severity={data.severity} idPrefix={idPrefix} /> : null}
          {preview && data.isDemo ? <DemoBadge /> : null}
          {/* Wide screens show it in the sidebar. */}
          {!preview && data.updatedAt ? (
            <span className="tabular inline-flex items-center gap-1.5 md:hidden">
              <RefreshCw aria-hidden="true" size={14} />
              Updated {formatTimestamp(data.updatedAt)}
            </span>
          ) : null}
        </p>
        <h1 id={`${idPrefix}-title`} className="mt-4 text-[clamp(30px,2.2vw+18px,46px)] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">
          {data.title || 'Untitled draft'}
        </h1>
        <RecordStatus data={data} idPrefix={idPrefix} nextDate={nextDate} />
      </header>
      {contents}

      <section aria-labelledby={`${idPrefix}-summary`} className="mb-12">
        <h2 id={`${idPrefix}-summary`} className="sr-only">
          Summary
        </h2>
        <p className="text-lg leading-[1.6] md:text-xl">
          {data.summary ? <Summary text={data.summary} idPrefix={`${idPrefix}-source`} sources={data.sources} /> : preview ? <em>No summary yet.</em> : null}
        </p>
      </section>

      <section aria-labelledby={`${idPrefix}-facts`} className="mb-12">
        <SectionTitle id={`${idPrefix}-facts`}>Key facts</SectionTitle>
        <dl className="card overflow-hidden">
          <Fact term="Date">
            {formatDateRange(data.dateStart, data.dateEnd, data.datePrecision)}
            {data.datePrecision !== 'day' ? <span className="text-muted"> (only the {data.datePrecision} is known)</span> : null}
          </Fact>
          <Fact term="Location">
            {formatPlace(data.city, data.stateCode) || stateName(data.stateCode)}
            <span className="block text-sm text-muted">Mapped at {LOCATION_PRECISION_META[data.locationPrecision].label.toLowerCase()} level</span>
          </Fact>
          <Fact term="Target">
            {TARGET_TYPE_META[data.targetType].label}
            {data.targetAttributes.length ? (
              <span className="text-muted"> — {data.targetAttributes.map((a) => TARGET_ATTRIBUTE_META[a].label).join(', ')}</span>
            ) : null}
          </Fact>
          <Fact term="Perpetrator">
            {PERPETRATOR_TYPE_META[data.perpetratorType].label}
            {data.perpetratorCount ? `, ${plural(data.perpetratorCount, 'person', 'people')}` : ''}
            {data.perpetratorNames.length ? (
              <span className="block">
                {convicted ? 'Convicted: ' : 'Charged, not convicted: '}
                {data.perpetratorNames.join(', ')}
              </span>
            ) : null}
          </Fact>
          <Fact term="Injuries and deaths">{casualties(data.deaths, data.injuries)}</Fact>
          <Fact term="Property damage">{yesNo(data.propertyDamage)}</Fact>
          <Fact term="Hate-crime charge">
            {data.hateCrimeCharged === 'unknown' && data.legalStatus && PRE_CHARGE.includes(data.legalStatus) ? 'No charges known' : yesNo(data.hateCrimeCharged)}
          </Fact>
          <Fact term="Agencies involved">{data.agenciesInvolved.length ? data.agenciesInvolved.join('; ') : 'None named in sources'}</Fact>
          <Fact term="Bias indicators stated by sources">
            {data.biasIndicators.length ? phrase(data.biasIndicators.map((b) => BIAS_INDICATOR_META[b].label)) : 'None recorded'}
          </Fact>
          {preview ? (
            <Fact term="Record">
              <span className="tabular font-semibold">{data.id || 'New draft'}</span>
              {data.updatedAt ? <span className="text-muted"> · last updated {formatTimestamp(data.updatedAt)}</span> : null}
            </Fact>
          ) : null}
        </dl>
      </section>

      {data.legalEvents.length ? (
        <section aria-labelledby={`${idPrefix}-legal`} className="mb-12">
          <SectionTitle id={`${idPrefix}-legal`}>Legal timeline</SectionTitle>
          <Timeline events={data.legalEvents} sourceIdPrefix={`${idPrefix}-source`} showCase={data.cases.length > 1} nextDate={nextDate} />
          {data.cases.map((c) => (
            <div key={c.id} className="card mt-6 px-5 py-4">
              <h3 className="kicker">Court case</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-base">
                <dt className="text-muted">Case</dt>
                <dd className="font-semibold">{c.name}</dd>
                {c.court ? (
                  <>
                    <dt className="text-muted">Court</dt>
                    <dd>{c.court}</dd>
                  </>
                ) : null}
                {c.docket_number ? (
                  <>
                    <dt className="text-muted">Docket</dt>
                    <dd className="tabular whitespace-nowrap">{c.docket_number}</dd>
                  </>
                ) : null}
                {c.next_date ? (
                  <>
                    <dt className="text-muted">Next court date</dt>
                    <dd className="font-semibold">{formatDate(c.next_date)}</dd>
                  </>
                ) : null}
              </dl>
              {c.courtlistener_url ? (
                <p className="mt-3 text-sm">
                  <a href={c.courtlistener_url} rel="noopener noreferrer nofollow" className="arrow-link">
                    Docket on CourtListener <ExternalLink aria-hidden="true" size={14} />
                  </a>
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {statementsByType.length ? (
        <section aria-labelledby={`${idPrefix}-statements`} className="mb-12">
          <SectionTitle id={`${idPrefix}-statements`}>Statements</SectionTitle>
          <div className="space-y-8">
            {statementsByType.map((g) => (
              <div key={g.type}>
                <h3 className="mb-1 text-sm font-semibold text-muted">{STATEMENT_TYPE_META[g.type].label}</h3>
                {g.items.map((s, i) => (
                  <figure key={i} className="statement border-t border-rule pt-4 pb-1">
                    <span className="icon-chip mt-0.5 h-8 w-8 rounded-[10px]" aria-hidden="true">
                      {s.quote ? <Quote /> : <MessageSquareText />}
                    </span>
                    {s.quote ? <blockquote className="statement-text">“{s.quote}”</blockquote> : <p className="statement-text">{s.paraphrase}</p>}
                    <figcaption className="statement-caption mt-2 text-sm text-muted">
                      {s.quote ? null : <span className="me-1.5 font-semibold">Paraphrase ·</span>}
                      <span className="font-semibold text-text">{s.speaker}</span>
                      {[s.speaker_role, s.organization].filter(Boolean).length ? `, ${[s.speaker_role, s.organization].filter(Boolean).join(', ')}` : ''}
                      {s.date ? ` · ${formatDate(s.date)}` : ''}
                      {s.source_n ? (
                        <>
                          {' '}
                          <SourceRef n={s.source_n} href={`#${idPrefix}-source-${s.source_n}`} />
                        </>
                      ) : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby={`${idPrefix}-sources`} className="mb-12">
        <SectionTitle id={`${idPrefix}-sources`}>Sources</SectionTitle>
        {data.sources.length ? (
          <ol className="space-y-3">
            {data.sources.map((s) => (
              <li key={s.n} id={`${idPrefix}-source-${s.n}`} className="source-card card lift relative flex gap-4 px-4 py-4 md:px-5">
                <span className="src-num tabular">{s.n}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap gap-x-2 text-sm">
                    <span className="font-semibold">{s.outlet}</span>
                    {s.published_date ? <span className="whitespace-nowrap text-muted">{formatDate(s.published_date)}</span> : null}
                  </p>
                  <a
                    href={s.url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="source-link mt-1 block text-base leading-snug font-medium break-words text-text no-underline hover:underline"
                  >
                    <TitleWithIcon title={s.title} />
                    <span className="sr-only"> ({s.outlet}, opens in a new tab)</span>
                  </a>
                  <p className="mono mt-1.5 text-muted">
                    {SOURCE_TYPE_META[s.source_type].label}
                    {s.author ? ` · ${s.author}` : ''}
                    {s.claim_attribution ? ` · ${s.claim_attribution}` : ''}
                    {` · accessed ${formatDate(s.accessed_date)}`}
                    {s.archived_url ? null : ' · archived copy pending'}
                  </p>
                </div>
                {s.archived_url ? (
                  <a
                    href={s.archived_url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="archive-link"
                    aria-label={`Archived copy of “${s.title}” (opens in a new tab)`}
                  >
                    <Archive aria-hidden="true" size={16} />
                    <span aria-hidden="true">Archived</span>
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="field-error">No sources. A record cannot be published without at least one source.</p>
        )}
      </section>

      <section aria-labelledby={`${idPrefix}-changes`} className="mb-12">
        <SectionTitle id={`${idPrefix}-changes`}>Change log</SectionTitle>
        {data.changeLog.length ? (
          <ol className="space-y-2 text-base">
            {data.changeLog.map((c, i) => (
              <li key={i}>
                <time dateTime={c.date} className="tabular text-muted">
                  {formatTimestamp(c.date)}
                </time>
                {' — '}
                {c.note}
                {c.changed_fields.length ? <span className="text-sm text-muted"> (changed: {c.changed_fields.join(', ').replaceAll('_', ' ')})</span> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">{preview ? 'The first entry will read “Published.”' : 'No changes recorded.'}</p>
        )}
      </section>
    </article>
  )
}

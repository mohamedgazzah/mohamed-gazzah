/**
 * The body of an incident record. Used by the public page and by the admin
 * editor's live preview, so editors see exactly what will be published.
 * Pure presentational: no data fetching, safe in server and client trees.
 */
import type { ReactNode } from 'react'
import {
  BIAS_INDICATOR_META,
  CONVICTION_STATUSES,
  INCIDENT_TYPE_META,
  LOCATION_PRECISION_META,
  PERPETRATOR_TYPE_META,
  SOURCE_TYPE_META,
  STATEMENT_TYPE_META,
  STATEMENT_TYPES,
  TARGET_ATTRIBUTE_META,
  TARGET_TYPE_META,
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
import { SourceChip } from './SourceChip'
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

function casualties(deaths: number | null, injuries: number | null): string {
  const parts: string[] = []
  parts.push(deaths === null ? 'Deaths: unknown' : deaths === 0 ? 'No deaths reported' : plural(deaths, 'death'))
  parts.push(injuries === null ? 'injuries: unknown' : injuries === 0 ? 'no injuries reported' : plural(injuries, 'person injured', 'people injured'))
  return parts.join('; ')
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-rule py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="caps pt-0.5 text-[11.5px] text-muted">{term}</dt>
      <dd className="text-[15.5px]">{children}</dd>
    </div>
  )
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="section-head mb-5 scroll-mt-6 text-[28px] leading-tight">
      {children}
    </h2>
  )
}

export function IncidentView({ data, preview = false }: { data: IncidentViewData; preview?: boolean }) {
  const idPrefix = `rec-${data.id || 'draft'}`
  const died = (data.deaths ?? 0) > 0 || data.severity === 5
  const convicted = data.legalStatus ? CONVICTION_STATUSES.includes(data.legalStatus) : false
  const publicLevel = data.verificationLevel === 'V0' ? null : data.verificationLevel
  const statementsByType = STATEMENT_TYPES.map((t) => ({ type: t, items: data.statements.filter((s) => s.statement_type === t) })).filter(
    (g) => g.items.length,
  )

  return (
    <article aria-labelledby={`${idPrefix}-title`}>
      <header className="mb-8">
        {died ? <hr className="mb-5 border-t border-ink" aria-hidden="true" /> : null}
        <p className="mono text-muted">
          <span>{formatDateRange(data.dateStart, data.dateEnd, data.datePrecision)}</span>
          <span aria-hidden="true"> · </span>
          <span>{formatPlace(data.city, data.stateCode) || stateName(data.stateCode)}</span>
          <span aria-hidden="true"> · </span>
          <span>{data.incidentTypes.map((t) => INCIDENT_TYPE_META[t].label).join(', ')}</span>
        </p>
        <h1 id={`${idPrefix}-title`} className="display mt-4 text-[clamp(34px,4.6vw,54px)] leading-[1.02]">
          {data.title || 'Untitled draft'}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {publicLevel ? (
            <VerificationBadge level={publicLevel} sourceTypes={data.sourceTypes} idPrefix={idPrefix} />
          ) : (
            <WarningBadge>V0 — unverified, cannot be published</WarningBadge>
          )}
          {data.legalStatus ? (
            <LegalStatusBadges status={data.legalStatus} hateCrimeCharged={data.hateCrimeCharged} idPrefix={idPrefix} />
          ) : (
            <WarningBadge>Legal status not set</WarningBadge>
          )}
          <SeverityMarker severity={data.severity} idPrefix={idPrefix} />
          {data.isDemo ? <DemoBadge /> : null}
        </div>
      </header>

      <section aria-labelledby={`${idPrefix}-summary`} className="mb-12">
        <h2 id={`${idPrefix}-summary`} className="sr-only">
          Summary
        </h2>
        <p className="font-serif text-[21px] leading-[1.55]">
          {data.summary ? <Summary text={data.summary} idPrefix={`${idPrefix}-source`} /> : preview ? <em>No summary yet.</em> : null}
        </p>
      </section>

      <section aria-labelledby={`${idPrefix}-facts`} className="mb-12">
        <SectionTitle id={`${idPrefix}-facts`}>Key facts</SectionTitle>
        <dl className="border-t border-rule">
          <Fact term="Date">
            {formatDateRange(data.dateStart, data.dateEnd, data.datePrecision)}
            {data.datePrecision !== 'day' ? <span className="text-muted"> (only the {data.datePrecision} is known)</span> : null}
          </Fact>
          <Fact term="Location">
            {formatPlace(data.city, data.stateCode) || stateName(data.stateCode)}
            <span className="block text-sm text-muted">Shown at: {LOCATION_PRECISION_META[data.locationPrecision].label.toLowerCase()}</span>
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
                {convicted ? 'Convicted: ' : 'Charged (alleged): '}
                {data.perpetratorNames.join(', ')}
              </span>
            ) : null}
          </Fact>
          <Fact term="Injuries and deaths">{casualties(data.deaths, data.injuries)}</Fact>
          <Fact term="Property damage">{YES_NO_UNKNOWN_META[data.propertyDamage].label}</Fact>
          <Fact term="Hate-crime charge">{YES_NO_UNKNOWN_META[data.hateCrimeCharged].label}</Fact>
          <Fact term="Agencies involved">{data.agenciesInvolved.length ? data.agenciesInvolved.join('; ') : 'None named in sources'}</Fact>
          <Fact term="Bias indicators stated by sources">
            {data.biasIndicators.length ? data.biasIndicators.map((b) => BIAS_INDICATOR_META[b].label).join(', ') : 'None recorded'}
          </Fact>
          <Fact term="Record">
            <span className="mono text-[14px] text-text">{data.id || 'New draft'}</span>
            {data.updatedAt ? <span className="text-muted"> · last updated {formatTimestamp(data.updatedAt)}</span> : null}
          </Fact>
        </dl>
      </section>

      {data.legalEvents.length ? (
        <section aria-labelledby={`${idPrefix}-legal`} className="mb-12">
          <SectionTitle id={`${idPrefix}-legal`}>Legal timeline</SectionTitle>
          <Timeline events={data.legalEvents} sourceIdPrefix={`${idPrefix}-source`} />
          {data.cases.length ? (
            <ul className="mt-6 space-y-1 border-t border-rule pt-4 text-[15px]">
              {data.cases.map((c) => (
                <li key={c.id}>
                  <span className="font-semibold">{c.name}</span>
                  {c.court ? `, ${c.court}` : ''}
                  {c.docket_number ? <span className="mono"> · Docket {c.docket_number}</span> : null}
                  {c.next_date ? <span className="text-muted"> · Next date {formatDate(c.next_date)}</span> : null}
                  {c.courtlistener_url ? (
                    <>
                      {' · '}
                      <a href={c.courtlistener_url} rel="noopener noreferrer nofollow">
                        Docket on CourtListener
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {statementsByType.length ? (
        <section aria-labelledby={`${idPrefix}-statements`} className="mb-12">
          <SectionTitle id={`${idPrefix}-statements`}>Statements</SectionTitle>
          {statementsByType.map((g) => (
            <div key={g.type} className="mb-8 last:mb-0">
              <h3 className="kicker mb-3 text-text">{STATEMENT_TYPE_META[g.type].label}</h3>
              <ul className="space-y-6">
                {g.items.map((s, i) => (
                  <li key={i} className="border-s border-ink ps-5">
                    {s.quote ? (
                      <blockquote className="font-serif text-[23px] leading-[1.4]">“{s.quote}”</blockquote>
                    ) : (
                      <p className="font-serif text-[19px] leading-[1.55]">{s.paraphrase}</p>
                    )}
                    <p className="mono mt-2 text-muted">
                      {s.quote ? '— ' : 'Paraphrased: '}
                      {[s.speaker, s.speaker_role, s.organization].filter(Boolean).join(', ')}
                      {s.date ? `, ${formatDate(s.date)}` : ''}
                      {s.source_n ? (
                        <>
                          {' '}
                          <a href={`#${idPrefix}-source-${s.source_n}`}>[{s.source_n}]</a>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-labelledby={`${idPrefix}-sources`} className="mb-12">
        <SectionTitle id={`${idPrefix}-sources`}>Sources</SectionTitle>
        {data.sources.length ? (
          <ol className="border-t border-rule">
            {data.sources.map((s) => (
              <li key={s.n} id={`${idPrefix}-source-${s.n}`} className="flex scroll-mt-24 gap-4 border-b border-rule py-4 target:bg-accent-tint">
                <span className="mono w-6 shrink-0 pt-1 text-end text-[14px] text-text">{s.n}</span>
                <div className="min-w-0">
                  <SourceChip source={s} idPrefix={idPrefix} />
                  <p className="mt-1 font-serif text-[18px] leading-snug break-words">{s.title}</p>
                  <p className="mono mt-1 text-muted">
                    {SOURCE_TYPE_META[s.source_type].label}
                    {s.author ? ` · ${s.author}` : ''}
                    {s.claim_attribution ? ` · ${s.claim_attribution}` : ''}
                    {` · accessed ${formatDate(s.accessed_date)}`}
                    {s.archived_url ? null : ' · archived copy pending'}
                  </p>
                </div>
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
          <ol className="space-y-2 text-[15.5px]">
            {data.changeLog.map((c, i) => (
              <li key={i}>
                <time dateTime={c.date} className="mono text-muted">
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

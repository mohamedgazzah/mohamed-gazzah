'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useId, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import {
  BIAS_INDICATORS,
  BIAS_INDICATOR_META,
  DATE_PRECISIONS,
  DATE_PRECISION_META,
  INCIDENT_TYPES,
  INCIDENT_TYPE_META,
  LEGAL_EVENT_META,
  LEGAL_EVENT_TYPES,
  LEGAL_STATUSES,
  LEGAL_STATUS_META,
  LOCATION_PRECISIONS,
  LOCATION_PRECISION_META,
  PERPETRATOR_TYPES,
  PERPETRATOR_TYPE_META,
  SEVERITIES,
  SEVERITY_META,
  SOURCE_TYPES,
  SOURCE_TYPE_META,
  STATEMENT_TYPES,
  STATEMENT_TYPE_META,
  TARGET_ATTRIBUTES,
  TARGET_ATTRIBUTE_META,
  TARGET_TYPES,
  TARGET_TYPE_META,
  VERIFICATION_LEVELS,
  VERIFICATION_META,
  YES_NO_UNKNOWN,
  YES_NO_UNKNOWN_META,
} from '@/db/enums'
import { IncidentView } from '@/components/IncidentView'
import { draftToView, type CaseOption } from '@/lib/draft-view'
import { todayIso } from '@/lib/format'
import { US_STATES, stateByFips } from '@/lib/states'
import { lintSummary } from '@/lib/summary'
import { incidentDraftInput, issuesByPath, wordCount, type IncidentDraftInput } from '@/lib/validation'
import type { DuplicateCandidate } from '@/server/admin/incidents'
import { duplicateCandidates, lookupSource, saveRecord } from '@/app/admin/_actions/records'

type Draft = IncidentDraftInput

const uuid = () => crypto.randomUUID()
const list = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)

function toggle<T>(arr: readonly T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <fieldset id={id} className="card space-y-4 p-4 sm:p-5">
      <legend className="px-1 font-serif text-lg font-semibold">{title}</legend>
      {children}
    </fieldset>
  )
}

function Err({ errors, path }: { errors: Record<string, string>; path: string }) {
  const m = errors[path]
  return m ? (
    <p id={`err-${path}`} className="field-error mt-1">
      {m}
    </p>
  ) : null
}

function Field({
  label,
  path,
  errors,
  hint,
  children,
}: {
  label: string
  path: string
  errors: Record<string, string>
  hint?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = `ed-${path.replace(/\./g, '-')}`
  const describedBy = [hint ? `${id}-hint` : null, errors[path] ? `err-${path}` : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children({ id, 'aria-invalid': errors[path] ? true : undefined, 'aria-describedby': describedBy })}
      {hint ? (
        <p id={`${id}-hint`} className="hint mt-1">
          {hint}
        </p>
      ) : null}
      <Err errors={errors} path={path} />
    </div>
  )
}

function CheckGroup<T extends string>({
  legend,
  values,
  selected,
  label,
  onChange,
  error,
  columns = 2,
}: {
  legend: string
  values: readonly T[]
  selected: readonly T[]
  label: (v: T) => string
  onChange: (next: T[]) => void
  error?: string
  columns?: 1 | 2 | 3
}) {
  const gid = useId()
  return (
    <fieldset aria-describedby={error ? `${gid}-err` : undefined}>
      <legend className="label">{legend}</legend>
      <div className={`grid gap-x-4 ${columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {values.map((v) => (
          <label key={v} className="flex min-h-9 items-start gap-2 py-0.5 text-base">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={selected.includes(v)} onChange={() => onChange(toggle(selected, v))} />
            <span>{label(v)}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${gid}-err`} className="field-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

export function RecordEditor({ initial, cases, isNew }: { initial: Draft; cases: CaseOption[]; isNew: boolean }) {
  const router = useRouter()
  const [d, setD] = useState<Draft>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [reason, setReason] = useState(isNew ? 'Initial draft' : '')
  const [saving, startSaving] = useTransition()
  const [tab, setTab] = useState<'preview' | 'duplicates' | 'checks'>('preview')
  const [dupes, setDupes] = useState<DuplicateCandidate[] | null>(null)
  const [compare, setCompare] = useState<DuplicateCandidate | null>(null)
  const [lookup, setLookup] = useState<Record<string, string>>({})
  const statusRef = useRef<HTMLDivElement>(null)

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value })), [])
  const view = useMemo(() => draftToView(d, cases), [d, cases])
  const summaryIssues = useMemo(() => lintSummary(d.summary, d.sources.length), [d.summary, d.sources.length])
  const sourceLabel = (sid: string) => {
    const i = d.sources.findIndex((s) => s.id === sid)
    return i < 0 ? 'Choose a source' : `[${i + 1}] ${d.sources[i]!.outlet || d.sources[i]!.url || 'Untitled source'}`
  }

  const updateItem = <K extends 'sources' | 'legalEvents' | 'statements'>(key: K, index: number, patch: Partial<Draft[K][number]>) =>
    setD((prev) => ({ ...prev, [key]: prev[key].map((item, i) => (i === index ? { ...item, ...patch } : item)) }))
  const removeItem = (key: 'sources' | 'legalEvents' | 'statements', index: number) =>
    setD((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }))
  const moveSource = (index: number, dir: -1 | 1) =>
    setD((prev) => {
      const next = [...prev.sources]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j]!, next[index]!]
      return { ...prev, sources: next }
    })

  async function runDuplicateCheck() {
    setTab('duplicates')
    setDupes(null)
    setDupes(
      await duplicateCandidates({
        id: d.id,
        dateStart: d.dateStart,
        stateFips: d.stateFips,
        city: d.city,
        lat: d.lat,
        lng: d.lng,
        text: `${d.title} ${d.summary}`,
      }),
    )
  }

  async function fillFromLink(index: number) {
    const s = d.sources[index]
    if (!s?.url) return
    setLookup((l) => ({ ...l, [s.id]: 'Reading the page…' }))
    const res = await lookupSource(s.url)
    if (!res.ok) {
      setLookup((l) => ({ ...l, [s.id]: res.error }))
      return
    }
    updateItem('sources', index, {
      url: res.data.finalUrl,
      outlet: s.outlet || res.data.outlet || '',
      title: s.title || res.data.title || '',
      author: s.author || res.data.author,
      publishedDate: s.publishedDate || res.data.publishedDate,
    })
    setLookup((l) => ({ ...l, [s.id]: 'Filled from the page. Check each field.' }))
  }

  function save() {
    const parsed = incidentDraftInput.safeParse(d)
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error))
      setStatus({ kind: 'error', text: 'Some fields need attention. Nothing was saved.' })
      requestAnimationFrame(() => statusRef.current?.focus())
      return
    }
    if (!isNew && !reason.trim()) {
      setErrors({ reason: 'Say briefly why you are making this change. It goes into the change log.' })
      setStatus({ kind: 'error', text: 'Add a reason for the change log. Nothing was saved.' })
      requestAnimationFrame(() => statusRef.current?.focus())
      return
    }
    startSaving(async () => {
      const res = await saveRecord(parsed.data, reason)
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setStatus({ kind: 'error', text: res.error })
        requestAnimationFrame(() => statusRef.current?.focus())
        return
      }
      setErrors({})
      setStatus({ kind: 'ok', text: `Saved as revision ${res.revision}.` })
      if (isNew) router.push(`/admin/incidents/${res.id}?saved=1`)
      else {
        setReason('')
        router.refresh()
      }
      requestAnimationFrame(() => statusRef.current?.focus())
    })
  }

  const errorList = Object.entries(errors)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Section id="sec-basics" title="What happened">
          <Field label={`Title (${d.title.length}/110)`} path="title" errors={errors} hint="A factual headline, e.g. “Man charged with hate crime after threats at Des Plaines park”.">
            {(p) => <input {...p} className="control" value={d.title} maxLength={110} onChange={(e) => set('title', e.target.value)} />}
          </Field>
          <Field label="Summary" path="summary" errors={errors} hint="2–4 neutral sentences. End each sentence with the number of its source in brackets, like [1]. Use “alleged” for anyone not convicted.">
            {(p) => <textarea {...p} className="control" rows={6} value={d.summary} onChange={(e) => set('summary', e.target.value)} />}
          </Field>
          {d.summary && summaryIssues.length ? (
            <ul className="list-disc space-y-1 ps-5 text-sm text-reported">
              {summaryIssues.map((i, k) => (
                <li key={k}>{i.detail}</li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" path="dateStart" errors={errors}>
              {(p) => <input {...p} type="date" className="control" value={d.dateStart} onChange={(e) => set('dateStart', e.target.value)} />}
            </Field>
            <Field label="End date (multi-day only)" path="dateEnd" errors={errors}>
              {(p) => <input {...p} type="date" className="control" value={d.dateEnd ?? ''} onChange={(e) => set('dateEnd', e.target.value || null)} />}
            </Field>
            <Field label="Date precision" path="datePrecision" errors={errors}>
              {(p) => (
                <select {...p} className="control" value={d.datePrecision} onChange={(e) => set('datePrecision', e.target.value as Draft['datePrecision'])}>
                  {DATE_PRECISIONS.map((x) => (
                    <option key={x} value={x}>
                      {DATE_PRECISION_META[x].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Section>

        <Section id="sec-location" title="Where">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="State or territory" path="stateFips" errors={errors}>
              {(p) => (
                <select {...p} className="control" value={d.stateFips} onChange={(e) => set('stateFips', e.target.value)}>
                  <option value="">Choose</option>
                  {US_STATES.map((s) => (
                    <option key={s.fips} value={s.fips}>
                      {s.name} ({s.fips})
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="City" path="city" errors={errors}>
              {(p) => <input {...p} className="control" value={d.city ?? ''} onChange={(e) => set('city', e.target.value || null)} />}
            </Field>
            <Field label="County FIPS (5 digits, optional)" path="countyFips" errors={errors}>
              {(p) => <input {...p} className="control tabular" inputMode="numeric" value={d.countyFips ?? ''} onChange={(e) => set('countyFips', e.target.value || null)} />}
            </Field>
            <Field label="Location precision" path="locationPrecision" errors={errors} hint="No more precise than needed. Never an exact private home.">
              {(p) => (
                <select {...p} className="control" value={d.locationPrecision} onChange={(e) => set('locationPrecision', e.target.value as Draft['locationPrecision'])}>
                  {LOCATION_PRECISIONS.map((x) => (
                    <option key={x} value={x}>
                      {LOCATION_PRECISION_META[x].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Latitude" path="lat" errors={errors} hint="City centroid unless the place is public.">
              {(p) => <input {...p} className="control tabular" inputMode="decimal" value={d.lat ?? ''} onChange={(e) => set('lat', numOrNull(e.target.value))} />}
            </Field>
            <Field label="Longitude" path="lng" errors={errors}>
              {(p) => <input {...p} className="control tabular" inputMode="decimal" value={d.lng ?? ''} onChange={(e) => set('lng', numOrNull(e.target.value))} />}
            </Field>
          </div>
        </Section>

        <Section id="sec-classification" title="Classification">
          <CheckGroup legend="Incident types (one or more)" values={INCIDENT_TYPES} selected={d.incidentTypes} label={(t) => `${t} — ${INCIDENT_TYPE_META[t].label}`} onChange={(v) => set('incidentTypes', v)} error={errors.incidentTypes} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target" path="targetType" errors={errors}>
              {(p) => (
                <select {...p} className="control" value={d.targetType} onChange={(e) => set('targetType', e.target.value as Draft['targetType'])}>
                  {TARGET_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {TARGET_TYPE_META[x].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Property damage" path="propertyDamage" errors={errors}>
              {(p) => (
                <select {...p} className="control" value={d.propertyDamage} onChange={(e) => set('propertyDamage', e.target.value as Draft['propertyDamage'])}>
                  {YES_NO_UNKNOWN.map((x) => (
                    <option key={x} value={x}>
                      {YES_NO_UNKNOWN_META[x].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <CheckGroup legend="Target attributes (only when a source states them)" values={TARGET_ATTRIBUTES} selected={d.targetAttributes} label={(t) => TARGET_ATTRIBUTE_META[t].label} onChange={(v) => set('targetAttributes', v)} />
          <fieldset>
            <legend className="label">Severity</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {SEVERITIES.map((s) => (
                <label key={s} className="flex min-h-9 items-center gap-2 text-base">
                  <input type="radio" name="severity" className="h-4 w-4 accent-accent" checked={d.severity === s} onChange={() => set('severity', s)} />
                  {s} — {SEVERITY_META[s].label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deaths (blank if unknown)" path="deaths" errors={errors}>
              {(p) => <input {...p} className="control tabular" inputMode="numeric" value={d.deaths ?? ''} onChange={(e) => set('deaths', numOrNull(e.target.value))} />}
            </Field>
            <Field label="Injuries (blank if unknown)" path="injuries" errors={errors}>
              {(p) => <input {...p} className="control tabular" inputMode="numeric" value={d.injuries ?? ''} onChange={(e) => set('injuries', numOrNull(e.target.value))} />}
            </Field>
          </div>
          <CheckGroup legend="Bias indicators stated by a source (at least one to publish)" values={BIAS_INDICATORS} selected={d.biasIndicators} label={(b) => BIAS_INDICATOR_META[b].label} onChange={(v) => set('biasIndicators', v)} />
        </Section>

        <Section id="sec-perpetrator" title="Perpetrator">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Perpetrator type" path="perpetratorType" errors={errors}>
              {(p) => (
                <select {...p} className="control" value={d.perpetratorType} onChange={(e) => set('perpetratorType', e.target.value as Draft['perpetratorType'])}>
                  {PERPETRATOR_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {PERPETRATOR_TYPE_META[x].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Number of perpetrators (blank if unknown)" path="perpetratorCount" errors={errors}>
              {(p) => <input {...p} className="control tabular" inputMode="numeric" value={d.perpetratorCount ?? ''} onChange={(e) => set('perpetratorCount', numOrNull(e.target.value))} />}
            </Field>
          </div>
          <Field label="Names (comma-separated)" path="perpetratorNames" errors={errors} hint="Only people charged and named by authorities or in court records.">
            {(p) => <input {...p} className="control" defaultValue={d.perpetratorNames.join(', ')} onBlur={(e) => set('perpetratorNames', list(e.target.value))} />}
          </Field>
          <Field label="Agencies involved (comma-separated)" path="agenciesInvolved" errors={errors}>
            {(p) => <input {...p} className="control" defaultValue={d.agenciesInvolved.join(', ')} onBlur={(e) => set('agenciesInvolved', list(e.target.value))} />}
          </Field>
        </Section>

        <Section id="sec-status" title="Verification and legal status">
          <fieldset>
            <legend className="label">Verification level</legend>
            {VERIFICATION_LEVELS.map((v) => (
              <label key={v} className="flex min-h-9 items-start gap-2 py-0.5 text-base">
                <input type="radio" name="verificationLevel" className="mt-1 h-4 w-4 accent-accent" checked={d.verificationLevel === v} onChange={() => set('verificationLevel', v)} />
                <span>
                  <strong>
                    {v} — {VERIFICATION_META[v].label}.
                  </strong>{' '}
                  <span className="text-muted">{VERIFICATION_META[v].rule}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal status" path="legalStatus" errors={errors} hint="Must be backed by a dated, sourced legal event below.">
              {(p) => (
                <select {...p} className="control" value={d.legalStatus ?? ''} onChange={(e) => set('legalStatus', (e.target.value || null) as Draft['legalStatus'])}>
                  <option value="">Not set</option>
                  {LEGAL_STATUSES.map((x) => (
                    <option key={x} value={x}>
                      {LEGAL_STATUS_META[x].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Hate-crime charge filed" path="hateCrimeCharged" errors={errors}>
              {(p) => (
                <select {...p} className="control" value={d.hateCrimeCharged} onChange={(e) => set('hateCrimeCharged', e.target.value as Draft['hateCrimeCharged'])}>
                  {YES_NO_UNKNOWN.map((x) => (
                    <option key={x} value={x}>
                      {YES_NO_UNKNOWN_META[x].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Section>

        <Section id="sec-sources" title={`Sources (${d.sources.length})`}>
          <p className="hint">Every public, linkable source. Numbers here are the [n] markers in the summary. Archived copies are captured automatically when you save.</p>
          {d.sources.map((s, i) => (
            <div key={s.id} className="space-y-3 rounded-lg border border-rule p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Source [{i + 1}]</p>
                <div className="flex gap-1">
                  <button type="button" className="btn btn-quiet min-h-9" onClick={() => moveSource(i, -1)} disabled={i === 0} aria-label={`Move source ${i + 1} up`}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-quiet min-h-9" onClick={() => moveSource(i, 1)} disabled={i === d.sources.length - 1} aria-label={`Move source ${i + 1} down`}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet min-h-9"
                    onClick={() => {
                      const used = d.legalEvents.some((e) => e.sourceId === s.id) || d.statements.some((x) => x.sourceId === s.id)
                      if (used) setStatus({ kind: 'error', text: `Source [${i + 1}] is cited by a legal event or statement. Change those first.` })
                      else removeItem('sources', i)
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <Field label="Link" path={`sources.${i}.url`} errors={errors}>
                {(p) => (
                  <div className="flex gap-2">
                    <input {...p} type="url" className="control" value={s.url} onChange={(e) => updateItem('sources', i, { url: e.target.value })} />
                    <button type="button" className="btn btn-secondary shrink-0" onClick={() => fillFromLink(i)}>
                      Fill from link
                    </button>
                  </div>
                )}
              </Field>
              {lookup[s.id] ? (
                <p className="hint" role="status">
                  {lookup[s.id]}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Outlet or organization" path={`sources.${i}.outlet`} errors={errors}>
                  {(p) => <input {...p} className="control" value={s.outlet} onChange={(e) => updateItem('sources', i, { outlet: e.target.value })} />}
                </Field>
                <Field label="Source type" path={`sources.${i}.sourceType`} errors={errors}>
                  {(p) => (
                    <select {...p} className="control" value={s.sourceType} onChange={(e) => updateItem('sources', i, { sourceType: e.target.value as typeof s.sourceType })}>
                      {SOURCE_TYPES.map((x) => (
                        <option key={x} value={x}>
                          {SOURCE_TYPE_META[x].label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <Field label="Title" path={`sources.${i}.title`} errors={errors}>
                {(p) => <input {...p} className="control" value={s.title} onChange={(e) => updateItem('sources', i, { title: e.target.value })} />}
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Author" path={`sources.${i}.author`} errors={errors}>
                  {(p) => <input {...p} className="control" value={s.author ?? ''} onChange={(e) => updateItem('sources', i, { author: e.target.value || null })} />}
                </Field>
                <Field label="Published" path={`sources.${i}.publishedDate`} errors={errors}>
                  {(p) => <input {...p} type="date" className="control" value={s.publishedDate ?? ''} onChange={(e) => updateItem('sources', i, { publishedDate: e.target.value || null })} />}
                </Field>
                <Field label="Accessed" path={`sources.${i}.accessedDate`} errors={errors}>
                  {(p) => <input {...p} type="date" className="control" value={s.accessedDate} onChange={(e) => updateItem('sources', i, { accessedDate: e.target.value })} />}
                </Field>
              </div>
              <Field label="Claim attribution (optional)" path={`sources.${i}.claimAttribution`} errors={errors} hint="Who makes the claim, e.g. “CAIR-Chicago, citing court records”.">
                {(p) => <input {...p} className="control" value={s.claimAttribution ?? ''} onChange={(e) => updateItem('sources', i, { claimAttribution: e.target.value || null })} />}
              </Field>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              set('sources', [
                ...d.sources,
                { id: uuid(), url: '', outlet: '', title: '', author: null, publishedDate: null, accessedDate: todayIso(), sourceType: 'news', claimAttribution: null },
              ])
            }
          >
            Add a source
          </button>
        </Section>

        <Section id="sec-legal" title={`Legal events (${d.legalEvents.length})`}>
          <p className="hint">Every status change is a dated event with a source: reported, arrest, charges, arraignment, plea, trial, verdict, sentence, dismissal, civil suit.</p>
          {d.legalEvents.map((e, i) => (
            <div key={e.id} className="space-y-3 rounded-lg border border-rule p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Date" path={`legalEvents.${i}.date`} errors={errors}>
                  {(p) => <input {...p} type="date" className="control" value={e.date} onChange={(ev) => updateItem('legalEvents', i, { date: ev.target.value })} />}
                </Field>
                <Field label="Event" path={`legalEvents.${i}.eventType`} errors={errors}>
                  {(p) => (
                    <select {...p} className="control" value={e.eventType} onChange={(ev) => updateItem('legalEvents', i, { eventType: ev.target.value as typeof e.eventType })}>
                      {LEGAL_EVENT_TYPES.map((x) => (
                        <option key={x} value={x}>
                          {LEGAL_EVENT_META[x].label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Source" path={`legalEvents.${i}.sourceId`} errors={errors}>
                  {(p) => (
                    <select {...p} className="control" value={e.sourceId} onChange={(ev) => updateItem('legalEvents', i, { sourceId: ev.target.value })}>
                      <option value="">Choose a source</option>
                      {d.sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {sourceLabel(s.id)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <Field label="Description" path={`legalEvents.${i}.description`} errors={errors}>
                {(p) => <input {...p} className="control" value={e.description} onChange={(ev) => updateItem('legalEvents', i, { description: ev.target.value })} />}
              </Field>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Field label="Court case (optional)" path={`legalEvents.${i}.caseId`} errors={errors}>
                  {(p) => (
                    <select {...p} className="control" value={e.caseId ?? ''} onChange={(ev) => updateItem('legalEvents', i, { caseId: ev.target.value || null })}>
                      <option value="">None</option>
                      {cases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} — {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <button type="button" className="btn btn-quiet" onClick={() => removeItem('legalEvents', i)}>
                  Remove event
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => set('legalEvents', [...d.legalEvents, { id: uuid(), date: d.dateStart, eventType: 'reported', description: '', sourceId: d.sources[0]?.id ?? '', caseId: null }])}
          >
            Add a legal event
          </button>
        </Section>

        <Section id="sec-statements" title={`Statements (${d.statements.length})`}>
          <p className="hint">Attributed responses. Quotes are 25 words or fewer; otherwise paraphrase.</p>
          {d.statements.map((s, i) => (
            <div key={s.id} className="space-y-3 rounded-lg border border-rule p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Speaker" path={`statements.${i}.speaker`} errors={errors}>
                  {(p) => <input {...p} className="control" value={s.speaker} onChange={(ev) => updateItem('statements', i, { speaker: ev.target.value })} />}
                </Field>
                <Field label="Role" path={`statements.${i}.speakerRole`} errors={errors}>
                  {(p) => <input {...p} className="control" value={s.speakerRole ?? ''} onChange={(ev) => updateItem('statements', i, { speakerRole: ev.target.value || null })} />}
                </Field>
                <Field label="Organization" path={`statements.${i}.organization`} errors={errors}>
                  {(p) => <input {...p} className="control" value={s.organization ?? ''} onChange={(ev) => updateItem('statements', i, { organization: ev.target.value || null })} />}
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Type" path={`statements.${i}.statementType`} errors={errors}>
                  {(p) => (
                    <select {...p} className="control" value={s.statementType} onChange={(ev) => updateItem('statements', i, { statementType: ev.target.value as typeof s.statementType })}>
                      {STATEMENT_TYPES.map((x) => (
                        <option key={x} value={x}>
                          {STATEMENT_TYPE_META[x].label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Date" path={`statements.${i}.date`} errors={errors}>
                  {(p) => <input {...p} type="date" className="control" value={s.date ?? ''} onChange={(ev) => updateItem('statements', i, { date: ev.target.value || null })} />}
                </Field>
                <Field label="Source" path={`statements.${i}.sourceId`} errors={errors}>
                  {(p) => (
                    <select {...p} className="control" value={s.sourceId} onChange={(ev) => updateItem('statements', i, { sourceId: ev.target.value })}>
                      <option value="">Choose a source</option>
                      {d.sources.map((src) => (
                        <option key={src.id} value={src.id}>
                          {sourceLabel(src.id)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <Field label={`Quote (${wordCount(s.quote ?? '')}/25 words)`} path={`statements.${i}.quote`} errors={errors}>
                {(p) => <textarea {...p} rows={2} className="control" value={s.quote ?? ''} onChange={(ev) => updateItem('statements', i, { quote: ev.target.value || null })} />}
              </Field>
              <Field label="Paraphrase" path={`statements.${i}.paraphrase`} errors={errors}>
                {(p) => <textarea {...p} rows={2} className="control" value={s.paraphrase ?? ''} onChange={(ev) => updateItem('statements', i, { paraphrase: ev.target.value || null })} />}
              </Field>
              <button type="button" className="btn btn-quiet" onClick={() => removeItem('statements', i)}>
                Remove statement
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              set('statements', [
                ...d.statements,
                { id: uuid(), speaker: '', speakerRole: null, organization: null, statementType: 'official', date: null, quote: null, paraphrase: null, sourceId: d.sources[0]?.id ?? '' },
              ])
            }
          >
            Add a statement
          </button>
        </Section>

        <Section id="sec-links" title="Cases, related records and tags">
          {cases.length ? (
            <CheckGroup legend="Court cases" values={cases.map((c) => c.id)} selected={d.caseIds} label={(cid) => `${cid} — ${cases.find((c) => c.id === cid)?.name ?? ''}`} onChange={(v) => set('caseIds', v)} columns={1} />
          ) : (
            <p className="hint">
              No cases yet. <Link href="/admin/cases">Create a case</Link> to link court records.
            </p>
          )}
          <Field label="Related record ids (same perpetrator or series, comma-separated)" path="relatedIncidentIds" errors={errors}>
            {(p) => <input {...p} className="control tabular" defaultValue={d.relatedIncidentIds.join(', ')} onBlur={(e) => set('relatedIncidentIds', list(e.target.value).map((x) => x.toUpperCase()))} />}
          </Field>
          <Field label="Tags (comma-separated)" path="tags" errors={errors} hint="Lowercase, e.g. campus, election-related. Use “backfill” for records before 2020.">
            {(p) => <input {...p} className="control" defaultValue={d.tags.join(', ')} onBlur={(e) => set('tags', list(e.target.value).map((x) => x.toLowerCase()))} />}
          </Field>
        </Section>

        <Section id="sec-private" title="Private editor notes">
          <Field label="Notes (never published)" path="editorNotes" errors={errors} hint="Never shown on public pages, in downloads or in the API.">
            {(p) => <textarea {...p} rows={4} className="control" value={d.editorNotes} onChange={(e) => set('editorNotes', e.target.value)} />}
          </Field>
        </Section>

        <div className="card sticky bottom-0 z-10 space-y-3 p-4">
          <div ref={statusRef} tabIndex={-1} className="outline-none" role={status?.kind === 'error' ? 'alert' : 'status'}>
            {status ? <p className={status.kind === 'error' ? 'field-error' : 'font-semibold text-confirmed'}>{status.text}</p> : null}
            {status?.kind === 'error' && errorList.length ? (
              <ul className="mt-1 list-disc ps-5 text-sm">
                {errorList.slice(0, 8).map(([path, msg]) => (
                  <li key={path}>
                    <a href={`#ed-${path.replace(/\./g, '-')}`}>{msg}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {!isNew ? (
            <div>
              <label htmlFor="ed-reason" className="label">
                Reason for this change (goes into the change log)
              </label>
              <input id="ed-reason" className="control" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={errors.reason ? true : undefined} />
              <Err errors={errors} path="reason" />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create draft' : 'Save changes'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={runDuplicateCheck}>
              Check for duplicates
            </button>
          </div>
        </div>
      </div>

      <aside aria-label="Preview and checks" className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
        <div role="tablist" aria-label="Side panel" className="mb-3 flex gap-1">
          {(
            [
              ['preview', 'Live preview'],
              ['duplicates', 'Possible duplicates'],
              ['checks', 'Checks'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} id={`tab-${key}`} className={tab === key ? 'btn' : 'btn btn-secondary'} onClick={() => (key === 'duplicates' ? runDuplicateCheck() : setTab(key))}>
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="card p-4 sm:p-5">
          {tab === 'preview' ? (
            <>
              <p className="mb-4 rounded border border-dashed border-control p-2 text-sm text-muted">Preview of the public page. Not published.</p>
              <IncidentView data={view} preview />
            </>
          ) : tab === 'duplicates' ? (
            <div className="space-y-4">
              <p className="hint">Records within 3 days of this date, in the same city or with similar text.</p>
              {dupes === null ? (
                <p role="status">Checking…</p>
              ) : dupes.length === 0 ? (
                <p role="status">No likely duplicates found.</p>
              ) : (
                <ul className="space-y-3">
                  {dupes.map((c) => (
                    <li key={c.id} className="rounded-lg border border-rule p-3">
                      <p className="text-sm text-muted tabular">
                        {c.id} · {c.dateStart} · {c.city ?? ''} {stateByFips(c.stateFips)?.code ?? ''} · {c.workflowStatus}
                        {c.sameCity ? ' · same city' : ''}
                        {c.km !== null ? ` · ${c.km} km away` : ''} · text match {Math.round(c.textScore * 100)}%
                      </p>
                      <p className="font-semibold">{c.title}</p>
                      <div className="mt-1 flex gap-3 text-sm">
                        <button type="button" className="btn btn-quiet min-h-9" onClick={() => setCompare(c)}>
                          Compare side by side
                        </button>
                        <Link href={`/admin/incidents/${c.id}`} target="_blank">
                          Open
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {compare ? (
                <div className="grid gap-4 border-t border-rule pt-4 sm:grid-cols-2" aria-label="Side-by-side comparison">
                  <div>
                    <p className="label">This draft</p>
                    <p className="font-semibold">{d.title}</p>
                    <p className="text-sm text-muted">
                      {d.dateStart} · {d.city}
                    </p>
                    <p className="mt-1 text-base">{d.summary}</p>
                  </div>
                  <div>
                    <p className="label">{compare.id}</p>
                    <p className="font-semibold">{compare.title}</p>
                    <p className="text-sm text-muted">
                      {compare.dateStart} · {compare.city}
                    </p>
                    <p className="mt-1 text-base">{compare.summary}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="list-disc space-y-1 ps-5 text-base">
              {summaryIssues.map((i, k) => (
                <li key={k}>{i.detail}</li>
              ))}
              {d.sources.length === 0 ? <li>Attach at least one source.</li> : null}
              {d.verificationLevel === 'V0' ? <li>Set a verification level of V1, V2 or V3 before review.</li> : null}
              {!d.legalStatus ? <li>Set a legal status.</li> : null}
              {d.legalStatus && d.legalStatus !== 'unknown' && d.legalEvents.length === 0 ? <li>Add a legal event that supports the legal status.</li> : null}
              {d.biasIndicators.length === 0 ? <li>Record at least one bias indicator stated by a source.</li> : null}
              {summaryIssues.length === 0 && d.sources.length && d.verificationLevel !== 'V0' && d.legalStatus && d.biasIndicators.length ? <li>No problems found. The database checks again on approval.</li> : null}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}

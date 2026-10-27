'use client'

import { ChevronDown, CircleAlert, CircleCheck, Copy, LoaderCircle, Paperclip, SendHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { CopyButton } from '@/components/CopyButton'
import { REPORTER_RELATIONS, REPORTER_RELATION_META, SLA } from '@/db/enums'
import {
  CITY_MESSAGE,
  EMAIL_MESSAGE,
  MAX_LENGTH,
  RECORD_ID_MESSAGE,
  WHAT_HAPPENED_MESSAGE,
  WHAT_HAPPENED_MIN,
  isEmail,
  linksProblem,
  tooLong,
} from '@/lib/report-rules'
import { SITE } from '@/lib/site'
import { isRecordId } from '@/lib/slug'
import { US_STATES } from '@/lib/states'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { submitReport, type ReportState } from './actions'

declare global {
  interface Window {
    turnstile?: { reset: (el?: string | HTMLElement) => void }
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="field-error mt-1.5">
      <CircleAlert aria-hidden="true" />
      {message}
    </p>
  )
}

/** A numbered step heading inside the form. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="space-y-5">
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-xl">
        <span aria-hidden="true" className="tabular inline-grid h-8 min-w-8 place-items-center rounded-full bg-accent-tint text-xs font-semibold text-accent">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

const MB = 1024 * 1024
const size = (bytes: number) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
// Limits read "3 MB" and "3.5 MB", not "3.0 MB".
const limit = (bytes: number) => `${Number((bytes / MB).toFixed(1))} MB`
const LIMIT_EACH = limit(UPLOAD_LIMITS.maxFileBytes)
const LIMIT_TOTAL = limit(UPLOAD_LIMITS.maxTotalBytes)

/** What is wrong with one chosen file, in words, or null. */
function fileProblem(f: { size: number; type: string }, index: number): string | null {
  if (index >= UPLOAD_LIMITS.maxFiles) return `Over the ${UPLOAD_LIMITS.maxFiles}-file limit: remove this one or another.`
  if (f.type && !ACCEPT.includes(f.type)) return 'Not a supported type: use JPEG, PNG, WebP, GIF or PDF.'
  if (f.size > UPLOAD_LIMITS.maxFileBytes) return `Each file must be under ${LIMIT_EACH}: remove it, or attach a screenshot instead.`
  return null
}

// The order fields appear in, so the error summary reads top to bottom.
const FIELD_ORDER = ['recordId', 'whatHappened', 'incidentDate', 'city', 'stateFips', 'links', 'files', 'contactEmail'] as const

/** "7K2M9QXA" shown as 7K2M 9QXA, so it is easy to note down; it copies without the gap. */
function Reference({ value }: { value: string }) {
  return (
    <strong className="tabular tracking-[0.04em]">
      {value.slice(0, 4)}
      <span className="ms-[0.35em]">{value.slice(4)}</span>
    </strong>
  )
}

export function ReportForm({ mode, recordId, siteKey, today }: { mode: 'report' | 'correction'; recordId: string; siteKey: string | null; today: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, { status: 'idle' })
  const [checked, setChecked] = useState<Record<string, string> | null>(null)
  // Fields fixed since the last send: their errors clear as soon as the rule passes.
  const [fixed, setFixed] = useState<string[]>([])
  const [files, setFiles] = useState<{ name: string; size: number; type: string }[]>([])
  const [whatLength, setWhatLength] = useState(0)
  const [removal, setRemoval] = useState(state.values?.privacyRequest === 'on')
  const summaryRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const v = state.values ?? {}
  const isCorrection = mode === 'correction'
  // Errors found in the browser win until the next send; the server's otherwise.
  const all: Record<string, string> = checked ?? state.errors ?? {}
  const e: Record<string, string> = Object.fromEntries(Object.entries(all).filter(([k]) => !fixed.includes(k)))
  const failed = !!checked || state.status === 'error'

  const labels: Record<string, string> = {
    recordId: 'Record id',
    whatHappened: isCorrection ? 'What should be corrected' : 'What happened',
    incidentDate: 'Date',
    city: 'City or town',
    stateFips: 'State',
    links: 'Links',
    files: 'Photos or documents',
    contactEmail: 'Email',
  }
  const contactAddress = isCorrection ? SITE.emails.corrections : SITE.emails.editors

  useEffect(() => {
    if (state.status === 'error') {
      summaryRef.current?.focus()
      window.turnstile?.reset()
    }
    if (state.status === 'ok') {
      doneRef.current?.focus()
      document.title = `${isCorrection ? 'Request received' : 'Report received'} — ${SITE.name}`
    }
  }, [state, isCorrection])

  useEffect(() => {
    if (checked) summaryRef.current?.focus()
  }, [checked])

  if (state.status === 'ok') {
    return (
      <div className="card p-6 md:p-8" role="status" data-done="">
        <span className="icon-chip icon-chip-lg" aria-hidden="true">
          <CircleCheck />
        </span>
        <h2 ref={doneRef} tabIndex={-1} className="mt-5 text-2xl leading-tight outline-none">
          Thank you. We received your {isCorrection ? 'correction request' : 'report'}.
        </h2>
        <p className="mt-3 text-lg">
          Reference: <Reference value={state.reference ?? ''} />. Note it down: if you remember something later, write to{' '}
          <a href={`mailto:${contactAddress}?subject=${encodeURIComponent(`Reference ${state.reference ?? ''}`)}`}>{contactAddress}</a> and quote it.
        </p>
        <p className="mt-3">
          <CopyButton text={state.reference ?? ''} label="Copy reference" className="btn btn-secondary btn-sm" icon={<Copy aria-hidden="true" />} />
        </p>
        <h3 className="mt-6 text-sm font-semibold text-muted">What happens now</h3>
        <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-base">
          {isCorrection ? (
            <>
              <li>If you left an email, an editor replies within {SLA.correctionResponseHours} hours.</li>
              <li>Material errors are fixed within {SLA.correctionFixDays} days, with a note in the record’s change log.</li>
              <li>Requests to remove identifying details are handled within {SLA.privacyRemovalHours} hours.</li>
            </>
          ) : (
            <>
              <li>An editor reads it. Nothing is published automatically.</li>
              <li>They look for public sources: news reports, police statements, court records.</li>
              <li>A record is published only after a second editor reviews it, never with your name, contact details or exact address.</li>
            </>
          )}
        </ol>
        <p className="mt-5 text-sm text-muted">
          If someone is in danger, call 911. Sending this does not report it to the police: to report a crime, contact your local police or the FBI
          at <a href="https://tips.fbi.gov">tips.fbi.gov</a>.
        </p>
        <p className="mt-6 flex flex-wrap gap-3">
          <Link href="/incidents" className="btn btn-secondary">
            Explore the record
          </Link>
          <Link href="/" className="btn btn-quiet">
            Go to the home page
          </Link>
        </p>
      </div>
    )
  }

  const describedBy = (name: string, hint?: string) => [hint, e[name] ? `${name}-error` : null].filter(Boolean).join(' ') || undefined
  const invalid = (name: string) => (e[name] ? true : undefined)

  /** The rules the server applies, checked in the browser so nothing typed or attached is lost. */
  function problems(fd: FormData, chosen: File[]): Record<string, string> {
    const found: Record<string, string> = {}
    const what = String(fd.get('whatHappened') ?? '').trim()
    const removing = isCorrection && fd.get('privacyRequest') === 'on'
    if (what.length > MAX_LENGTH.whatHappened) found.whatHappened = tooLong(what.length, MAX_LENGTH.whatHappened)
    else if (what.length < WHAT_HAPPENED_MIN && !removing) found.whatHappened = WHAT_HAPPENED_MESSAGE[mode]
    if (!isCorrection && !String(fd.get('city') ?? '').trim()) found.city = CITY_MESSAGE
    if (isCorrection && !isRecordId(String(fd.get('recordId') ?? '').trim().toUpperCase())) found.recordId = RECORD_ID_MESSAGE
    const links = linksProblem(String(fd.get('links') ?? ''))
    if (links) found.links = links
    const email = String(fd.get('contactEmail') ?? '').trim()
    if (email && !isEmail(email)) found.contactEmail = EMAIL_MESSAGE
    const big = chosen.find((f) => f.size > UPLOAD_LIMITS.maxFileBytes)
    const total = chosen.reduce((n, f) => n + f.size, 0)
    if (chosen.length > UPLOAD_LIMITS.maxFiles) found.files = `Attach at most ${UPLOAD_LIMITS.maxFiles} files: remove ${chosen.length - UPLOAD_LIMITS.maxFiles}.`
    else if (big) found.files = `“${big.name}” is ${size(big.size)}. Each file must be under ${LIMIT_EACH}: remove it, or attach a screenshot instead.`
    else if (total > UPLOAD_LIMITS.maxTotalBytes)
      found.files = `The files come to ${size(total)}; the limit is ${LIMIT_TOTAL} in total. Remove one, or attach smaller copies.`
    return found
  }

  const chosenFiles = (fd: FormData) => fd.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0)

  // Sent by hand rather than by the form's own action, so React does not reset the form: if the server
  // finds a problem, every field, the chosen state and the attachments are still there.
  function send(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const found = problems(fd, chosenFiles(fd))
    setFixed([])
    if (Object.keys(found).length) {
      setChecked(found)
      return
    }
    setChecked(null)
    startTransition(() => action(fd))
  }

  // Once a highlighted field passes its rule, its error goes away while the person types.
  function recheck(ev: FormEvent<HTMLFormElement>) {
    const name = (ev.target as HTMLInputElement).name
    const key = name === 'privacyRequest' ? 'whatHappened' : name
    if (!all[key] || fixed.includes(key)) return
    const fd = new FormData(ev.currentTarget)
    if (!problems(fd, chosenFiles(fd))[key]) setFixed((f) => [...f, key])
  }

  // GOV.UK's pattern: bring the field's label and hint into view, then focus the field.
  function jump(ev: MouseEvent<HTMLAnchorElement>, key: string) {
    const field = document.getElementById(`f-${key}`)
    if (!field) return
    ev.preventDefault()
    ;(document.querySelector(`label[for="f-${key}"]`) ?? field).scrollIntoView({ block: 'start' })
    field.focus({ preventScroll: true })
  }

  function removeFile(index: number) {
    const input = fileInput.current
    if (!input?.files) return
    const dt = new DataTransfer()
    Array.from(input.files).forEach((f, i) => {
      if (i !== index) dt.items.add(f)
    })
    input.files = dt.files
    setFiles(Array.from(dt.files).map((f) => ({ name: f.name, size: f.size, type: f.type })))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const total = files.reduce((n, f) => n + f.size, 0)
  const showCount = whatLength > MAX_LENGTH.whatHappened * 0.8

  return (
    <form action={action} onSubmit={send} onInput={recheck} noValidate className="space-y-12" aria-describedby="report-notice">
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer /> : null}
      <input type="hidden" name="mode" value={mode} />

      {failed && (Object.keys(e).length || !checked) ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="card border-severe p-5 outline-none">
          <p className="flex items-center gap-2 font-semibold text-severe">
            <CircleAlert aria-hidden="true" size={18} />
            {checked ? 'Please check the highlighted fields.' : state.message}
          </p>
          {Object.keys(e).length ? (
            <ul className="mt-2 list-disc space-y-1 ps-7">
              {FIELD_ORDER.filter((k) => e[k]).map((k) => (
                <li key={k}>
                  <a href={`#f-${k}`} onClick={(ev) => jump(ev, k)}>
                    {labels[k]}: {e[k]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {v.hadFiles && !files.length && !checked ? <p className="mt-2">Your photos or documents were not kept. Please attach them again.</p> : null}
        </div>
      ) : null}

      <Step n={1} title={isCorrection ? 'The correction' : 'What happened'}>
        {isCorrection ? (
          <>
            <div>
              <label htmlFor="f-recordId" className="label">
                Record id <span className="font-normal text-muted">(required)</span>
              </label>
              <p id="recordId-hint" className="hint mb-2">
                Shown at the top of every record and in its address, for example US-2026-0412.
              </p>
              <FieldError id="recordId-error" message={e.recordId} />
              <input
                id="f-recordId"
                name="recordId"
                defaultValue={v.recordId ?? recordId}
                required
                maxLength={MAX_LENGTH.recordId}
                className="control tabular sm:max-w-xs"
                aria-invalid={invalid('recordId')}
                aria-describedby={describedBy('recordId', 'recordId-hint')}
              />
            </div>
            <label className="choice">
              <input type="checkbox" name="privacyRequest" defaultChecked={v.privacyRequest === 'on'} onChange={(ev) => setRemoval(ev.currentTarget.checked)} />
              <span>I am a person described in this record and I want identifying details removed. No questions asked.</span>
            </label>
          </>
        ) : null}

        <div>
          <label htmlFor="f-whatHappened" className="label">
            {isCorrection ? 'What should be corrected, and why?' : 'What happened?'}{' '}
            {isCorrection ? (
              // The tag swaps from CSS when removal is ticked, so it is right without JavaScript too.
              <span className="font-normal text-muted">
                <span className="when-required">(required)</span>
                <span className="when-optional">(optional when asking for removal)</span>
              </span>
            ) : (
              <span className="font-normal text-muted">(required)</span>
            )}
          </label>
          <p id="whatHappened-hint" className="hint mb-2">
            {isCorrection
              ? 'Point to the sentence or field, and add a source if you have one. Asking only for removal? You can leave this blank.'
              : 'In your own words: what was said or done, and where. A sentence or two is enough. Leave out other people’s names unless they are public officials.'}
          </p>
          <FieldError id="whatHappened-error" message={e.whatHappened} />
          <textarea
            id="f-whatHappened"
            name="whatHappened"
            required={!(isCorrection && removal)}
            rows={6}
            defaultValue={v.whatHappened}
            onChange={(ev) => setWhatLength(ev.currentTarget.value.trim().length)}
            className="control"
            aria-invalid={invalid('whatHappened')}
            aria-describedby={describedBy('whatHappened', showCount ? 'whatHappened-hint whatHappened-count' : 'whatHappened-hint')}
          />
          {showCount ? (
            <p id="whatHappened-count" className={`hint tabular mt-1.5 ${whatLength > MAX_LENGTH.whatHappened ? 'font-semibold text-severe' : ''}`}>
              {whatLength.toLocaleString('en-US')} of {MAX_LENGTH.whatHappened.toLocaleString('en-US')} characters
            </p>
          ) : null}
        </div>
      </Step>

      {!isCorrection ? (
        <Step n={2} title="When and where">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label htmlFor="f-incidentDate" className="label">
                Date <span className="font-normal text-muted">(optional)</span>
              </label>
              <p id="incidentDate-hint" className="hint mb-2">
                Your best guess is fine.
              </p>
              <FieldError id="incidentDate-error" message={e.incidentDate} />
              <input
                id="f-incidentDate"
                name="incidentDate"
                type="date"
                max={today}
                defaultValue={v.incidentDate}
                className="control"
                aria-invalid={invalid('incidentDate')}
                aria-describedby={describedBy('incidentDate', 'incidentDate-hint')}
              />
            </div>
            <div className="lg:self-end">
              <label htmlFor="f-city" className="label">
                City or town <span className="font-normal text-muted">(required)</span>
              </label>
              <FieldError id="city-error" message={e.city} />
              <input
                id="f-city"
                name="city"
                required
                maxLength={MAX_LENGTH.city}
                defaultValue={v.city}
                autoComplete="address-level2"
                className="control"
                aria-invalid={invalid('city')}
                aria-describedby={describedBy('city')}
              />
            </div>
            <div className="lg:self-end">
              <label htmlFor="f-stateFips" className="label">
                State <span className="font-normal text-muted">(optional)</span>
              </label>
              <FieldError id="stateFips-error" message={e.stateFips} />
              <div className="relative">
                <select
                  id="f-stateFips"
                  name="stateFips"
                  // Keyed by the value sent back, so a page that comes back from the server shows the state chosen.
                  key={v.stateFips ?? ''}
                  defaultValue={v.stateFips ?? ''}
                  className="control"
                  aria-invalid={invalid('stateFips')}
                  aria-describedby={describedBy('stateFips')}
                >
                  <option value="">Choose a state</option>
                  {US_STATES.map((s) => (
                    <option key={s.fips} value={s.fips}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="f-address" className="label">
              Exact address or place <span className="font-normal text-muted">(optional, never published)</span>
            </label>
            <p id="address-hint" className="hint mb-2">
              Helps editors check police reports. It is encrypted and only editors can see it.
            </p>
            <input
              id="f-address"
              name="address"
              maxLength={MAX_LENGTH.address}
              defaultValue={v.address}
              className="control"
              autoComplete="off"
              aria-describedby="address-hint"
            />
          </div>
        </Step>
      ) : null}

      <Step n={isCorrection ? 2 : 3} title="Evidence (optional)">
        <div>
          <label htmlFor="f-links" className="label">
            Links to news stories, police reports or posts <span className="font-normal text-muted">(one per line)</span>
          </label>
          <FieldError id="links-error" message={e.links} />
          <textarea
            id="f-links"
            name="links"
            rows={3}
            defaultValue={v.links}
            className="control"
            aria-invalid={invalid('links')}
            aria-describedby={describedBy('links')}
          />
        </div>

        <div>
          <label htmlFor="f-files" className="label">
            Photos or documents
          </label>
          <p id="files-hint" className="hint mb-2">
            Up to {UPLOAD_LIMITS.maxFiles} files, {LIMIT_TOTAL} in total (each under {LIMIT_EACH}): JPEG, PNG, WebP, GIF or PDF. A screenshot is
            often smaller than the original photo.
            <br />
            We remove location data from photos. Files are encrypted and never published.
          </p>
          <FieldError id="files-error" message={e.files} />
          <input
            ref={fileInput}
            id="f-files"
            name="files"
            type="file"
            multiple
            accept={ACCEPT.join(',')}
            className="control"
            aria-invalid={invalid('files')}
            aria-describedby={describedBy('files', 'files-hint')}
            onChange={(ev) => setFiles(Array.from(ev.currentTarget.files ?? []).map((f) => ({ name: f.name, size: f.size, type: f.type })))}
          />
          {files.length ? (
            <div className="mt-2 rounded-[var(--radius-sm)] border border-rule bg-surface px-3 py-2 text-sm">
              <ul className="space-y-1.5">
                {files.map((f, i) => {
                  const problem = fileProblem(f, i)
                  return (
                    <li key={`${f.name}-${i}`}>
                      <span className="flex items-center gap-2">
                        <Paperclip aria-hidden="true" size={14} className="shrink-0 text-muted" />
                        <span className="min-w-0 truncate">{f.name}</span>
                        <span className={`tabular ms-auto shrink-0 ${problem ? 'font-semibold text-severe' : 'text-muted'}`}>{size(f.size)}</span>
                        <button type="button" className="file-remove" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}>
                          <X aria-hidden="true" size={14} />
                        </button>
                      </span>
                      {problem ? <span className="mt-0.5 block ps-[22px] text-severe">{problem}</span> : null}
                    </li>
                  )
                })}
              </ul>
              <p className={`tabular mt-1.5 border-t border-rule pt-1.5 ${total > UPLOAD_LIMITS.maxTotalBytes ? 'font-semibold text-severe' : 'text-muted'}`}>
                {size(total)} of {LIMIT_TOTAL}
                {total > UPLOAD_LIMITS.maxTotalBytes ? ': too large together. Remove one, or attach smaller copies.' : ''}
              </p>
            </div>
          ) : null}
        </div>
      </Step>

      <Step n={isCorrection ? 3 : 4} title="About you (optional)">
        {!isCorrection ? (
          <fieldset>
            <legend className="label">How do you know about it?</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {REPORTER_RELATIONS.map((r) => (
                <label key={r} className="choice">
                  <input type="radio" name="relation" value={r} defaultChecked={v.relation === r} />
                  {REPORTER_RELATION_META[r].label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="card space-y-4 p-5">
          <legend className="float-left mb-1 w-full p-0 text-base font-semibold">Contact details</legend>
          <p className="hint clear-both">
            Only if you want an editor to {isCorrection ? `reply (within ${SLA.correctionResponseHours} hours)` : 'follow up'}. Never published,
            encrypted, and deleted {SLA.submitterDataRetentionMonths} months after the matter is resolved.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="f-contactEmail" className="label">
                Email
              </label>
              <FieldError id="contactEmail-error" message={e.contactEmail} />
              <input
                id="f-contactEmail"
                name="contactEmail"
                type="email"
                maxLength={MAX_LENGTH.contactEmail}
                defaultValue={v.contactEmail}
                autoComplete="email"
                className="control sm:max-w-md"
                aria-invalid={invalid('contactEmail')}
                aria-describedby={describedBy('contactEmail')}
              />
            </div>
            <div>
              <label htmlFor="f-contactName" className="label">
                Name
              </label>
              <input
                id="f-contactName"
                name="contactName"
                maxLength={MAX_LENGTH.contactName}
                defaultValue={v.contactName}
                autoComplete="name"
                className="control"
              />
            </div>
            <div>
              <label htmlFor="f-contactPhone" className="label">
                Phone
              </label>
              <input
                id="f-contactPhone"
                name="contactPhone"
                type="tel"
                maxLength={MAX_LENGTH.contactPhone}
                defaultValue={v.contactPhone}
                autoComplete="tel"
                className="control"
              />
            </div>
          </div>
          <label className="choice">
            <input type="checkbox" name="keepConsent" defaultChecked={v.keepConsent === 'on'} />
            <span>You may keep my contact details after the {SLA.submitterDataRetentionMonths} months, so editors can reach me about later developments.</span>
          </label>
        </fieldset>
      </Step>

      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="f-website">Website</label>
        <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {siteKey ? <div className="cf-turnstile" data-sitekey={siteKey} data-appearance="interaction-only" data-size="flexible" /> : null}

      <div className="border-t border-rule pt-8">
        {siteKey ? (
          <noscript>
            <p className="note mb-5">
              This form needs JavaScript for its spam check. Without it, email what happened to{' '}
              <a href={`mailto:${contactAddress}`}>{contactAddress}</a>.
            </p>
          </noscript>
        ) : null}
        <button type="submit" className="btn btn-lg w-full sm:w-auto" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <SendHorizontal aria-hidden="true" className="nudge" />}
          {pending ? 'Sending…' : isCorrection ? 'Send correction request' : 'Send report'}
        </button>
        <span aria-live="polite" className="sr-only">
          {pending ? 'Sending…' : ''}
        </span>
        <p className="hint mt-3">You’ll get a reference number on the next screen.</p>
      </div>
    </form>
  )
}

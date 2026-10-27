'use client'

import { ChevronDown, CircleAlert, CircleCheck, LoaderCircle, Paperclip, SendHorizontal } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { REPORTER_RELATIONS, REPORTER_RELATION_META } from '@/db/enums'
import { CITY_MESSAGE, RECORD_ID_MESSAGE, WHAT_HAPPENED_MESSAGE, WHAT_HAPPENED_MIN } from '@/lib/report-rules'
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
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-[19px]">
        <span aria-hidden="true" className="tabular inline-grid h-8 min-w-8 place-items-center rounded-full bg-accent-tint text-[13px] font-semibold text-accent">
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

// The order fields appear in, so the error summary reads top to bottom.
const FIELD_ORDER = ['recordId', 'whatHappened', 'incidentDate', 'city', 'stateFips', 'links', 'files', 'contactEmail'] as const

export function ReportForm({ mode, recordId, siteKey, today }: { mode: 'report' | 'correction'; recordId: string; siteKey: string | null; today: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, { status: 'idle' })
  const [checked, setChecked] = useState<Record<string, string> | null>(null)
  const [files, setFiles] = useState<{ name: string; size: number }[]>([])
  const [lostFiles, setLostFiles] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const sentFiles = useRef(false)
  const v = state.values ?? {}
  const isCorrection = mode === 'correction'
  // Errors found in the browser win until the next send; the server's otherwise.
  const e: Record<string, string> = checked ?? state.errors ?? {}
  const failed = !!checked || state.status === 'error'

  const labels: Record<string, string> = {
    recordId: 'Record id',
    whatHappened: isCorrection ? 'What should be corrected' : 'What happened?',
    incidentDate: 'Date',
    city: 'City or town',
    stateFips: 'State',
    links: 'Links',
    files: 'Photos or documents',
    contactEmail: 'Email',
  }

  useEffect(() => {
    if (state.status === 'error') {
      summaryRef.current?.focus()
      window.turnstile?.reset()
      // A file input cannot be refilled after the form resets: say so instead of dropping files silently.
      if (sentFiles.current) setLostFiles(true)
      setFiles([])
    }
    if (state.status === 'ok') doneRef.current?.focus()
  }, [state])

  useEffect(() => {
    if (checked) summaryRef.current?.focus()
  }, [checked])

  if (state.status === 'ok') {
    return (
      <div className="card p-6 md:p-8" role="status" data-done="">
        <span className="icon-chip icon-chip-lg" aria-hidden="true">
          <CircleCheck />
        </span>
        <h2 ref={doneRef} tabIndex={-1} className="mt-5 text-[26px] leading-tight outline-none">
          Thank you. We received your {isCorrection ? 'correction request' : 'report'}.
        </h2>
        <p className="mt-3 text-[17px]">
          Reference: <strong className="tabular">{state.reference}</strong>. Note it down: if you remember something later, write to the editors
          and quote it.
        </p>
        <h3 className="mt-6 text-[15px] text-muted">What happens now</h3>
        <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-[16px]">
          {isCorrection ? (
            <>
              <li>An editor replies within 72 hours.</li>
              <li>Material errors are fixed within 7 days, with a note in the record’s change log.</li>
              <li>Requests to remove identifying details are handled within 48 hours.</li>
            </>
          ) : (
            <>
              <li>An editor reads it. Nothing is published automatically.</li>
              <li>They look for public sources: news reports, police statements, court records.</li>
              <li>A record is published only after a second editor reviews it, never with your name, contact details or exact address.</li>
            </>
          )}
        </ol>
        <p className="mt-5 text-[15px] text-muted">If someone is in danger, call 911.</p>
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

  // The same required-field rules the server applies, checked before sending so attachments stay attached.
  function check(ev: FormEvent<HTMLFormElement>) {
    const fd = new FormData(ev.currentTarget)
    const found: Record<string, string> = {}
    const what = String(fd.get('whatHappened') ?? '').trim()
    const removal = isCorrection && fd.get('privacyRequest') === 'on'
    if (what.length < WHAT_HAPPENED_MIN && !removal) found.whatHappened = WHAT_HAPPENED_MESSAGE[mode]
    if (!isCorrection && !String(fd.get('city') ?? '').trim()) found.city = CITY_MESSAGE
    if (isCorrection && !isRecordId(String(fd.get('recordId') ?? '').trim().toUpperCase())) found.recordId = RECORD_ID_MESSAGE
    const chosen = fd.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0)
    const big = chosen.find((f) => f.size > UPLOAD_LIMITS.maxFileBytes)
    if (chosen.length > UPLOAD_LIMITS.maxFiles) found.files = `Attach at most ${UPLOAD_LIMITS.maxFiles} files.`
    else if (big) found.files = `“${big.name}” is larger than 3 MB.`
    else if (chosen.reduce((n, f) => n + f.size, 0) > UPLOAD_LIMITS.maxTotalBytes) found.files = 'Files are too large together. The limit is 3.5 MB in total.'
    if (Object.keys(found).length) {
      ev.preventDefault()
      setChecked(found)
      return
    }
    setChecked(null)
    setLostFiles(false)
    sentFiles.current = chosen.length > 0
  }

  const total = files.reduce((n, f) => n + f.size, 0)

  return (
    <form action={action} onSubmit={check} noValidate className="space-y-12" aria-describedby="report-notice">
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer /> : null}
      <input type="hidden" name="mode" value={mode} />

      {failed ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="card border-severe p-5 outline-none">
          <p className="flex items-center gap-2 font-semibold text-severe">
            <CircleAlert aria-hidden="true" size={18} />
            {checked ? 'Please check the highlighted fields.' : state.message}
          </p>
          {Object.keys(e).length ? (
            <ul className="mt-2 list-disc space-y-1 ps-7">
              {FIELD_ORDER.filter((k) => e[k]).map((k) => (
                <li key={k}>
                  <a href={`#f-${k}`}>
                    {labels[k]}: {e[k]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {lostFiles && !checked ? <p className="mt-2">Your photos or documents were not kept. Please attach them again.</p> : null}
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
                className="control max-w-xs tabular"
                aria-invalid={invalid('recordId')}
                aria-describedby={describedBy('recordId', 'recordId-hint')}
              />
            </div>
            <label className="choice">
              <input type="checkbox" name="privacyRequest" defaultChecked={v.privacyRequest === 'on'} />
              <span>
                I am a person described in this record and I want identifying details removed. We do this within 48 hours, no questions asked.
              </span>
            </label>
          </>
        ) : null}

        <div>
          <label htmlFor="f-whatHappened" className="label">
            {isCorrection ? 'What should be corrected, and why?' : 'What happened?'} <span className="font-normal text-muted">(required)</span>
          </label>
          <p id="whatHappened-hint" className="hint mb-2">
            {isCorrection
              ? 'Point to the sentence or field, and add a source if you have one. Asking for removal? “Please remove my details” is enough.'
              : 'In your own words: what was said or done, and where. A sentence or two is enough. Leave out other people’s names unless they are public officials.'}
          </p>
          <FieldError id="whatHappened-error" message={e.whatHappened} />
          <textarea
            id="f-whatHappened"
            name="whatHappened"
            required
            rows={6}
            defaultValue={v.whatHappened}
            className="control"
            aria-invalid={invalid('whatHappened')}
            aria-describedby={describedBy('whatHappened', 'whatHappened-hint')}
          />
        </div>
      </Step>

      {!isCorrection ? (
        <Step n={2} title="When and where">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="f-incidentDate" className="label">
                Date <span className="font-normal text-muted">(optional)</span>
              </label>
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
              <p id="incidentDate-hint" className="hint mt-1.5">
                Your best guess is fine.
              </p>
            </div>
            <div>
              <label htmlFor="f-city" className="label">
                City or town <span className="font-normal text-muted">(required)</span>
              </label>
              <FieldError id="city-error" message={e.city} />
              <input
                id="f-city"
                name="city"
                required
                defaultValue={v.city}
                autoComplete="address-level2"
                className="control"
                aria-invalid={invalid('city')}
                aria-describedby={describedBy('city')}
              />
            </div>
            <div>
              <label htmlFor="f-stateFips" className="label">
                State <span className="font-normal text-muted">(optional)</span>
              </label>
              <FieldError id="stateFips-error" message={e.stateFips} />
              <div className="relative">
                <select
                  id="f-stateFips"
                  name="stateFips"
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
            <input id="f-address" name="address" defaultValue={v.address} className="control" autoComplete="off" aria-describedby="address-hint" />
          </div>
        </Step>
      ) : null}

      <Step n={isCorrection ? 2 : 3} title="Evidence (optional)">
        <div>
          <label htmlFor="f-links" className="label">
            Links to news stories, police reports or posts <span className="font-normal text-muted">(optional, one per line)</span>
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
            Photos or documents <span className="font-normal text-muted">(optional)</span>
          </label>
          <p id="files-hint" className="hint mb-2">
            Up to 5 files, 3.5 MB in total (each under 3 MB): JPEG, PNG, WebP, GIF or PDF.
            <br />
            We remove location data from photos. Files are encrypted and never published.
          </p>
          <FieldError id="files-error" message={e.files ?? (lostFiles ? 'Please attach your files again.' : undefined)} />
          <input
            id="f-files"
            name="files"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="control"
            aria-invalid={invalid('files')}
            aria-describedby={describedBy('files', 'files-hint')}
            onChange={(ev) => {
              setFiles(Array.from(ev.currentTarget.files ?? []).map((f) => ({ name: f.name, size: f.size })))
              setLostFiles(false)
            }}
          />
          {files.length ? (
            <div className="mt-2 rounded-[var(--radius-sm)] border border-rule bg-surface px-3 py-2 text-[14.5px]">
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Paperclip aria-hidden="true" size={14} className="shrink-0 text-muted" />
                    <span className="min-w-0 truncate">{f.name}</span>
                    <span className={`tabular ms-auto shrink-0 ${f.size > UPLOAD_LIMITS.maxFileBytes ? 'font-semibold text-severe' : 'text-muted'}`}>{size(f.size)}</span>
                  </li>
                ))}
              </ul>
              <p className={`tabular mt-1.5 border-t border-rule pt-1.5 ${total > UPLOAD_LIMITS.maxTotalBytes ? 'font-semibold text-severe' : 'text-muted'}`}>
                {size(total)} of 3.5 MB
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
          <legend className="float-left mb-1 w-full p-0 text-[16px] font-semibold">Contact details (optional)</legend>
          <p className="hint clear-both">Only if you want an editor to follow up. Never published, encrypted, and deleted 12 months after the matter is resolved.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="f-contactName" className="label">
                Name
              </label>
              <input id="f-contactName" name="contactName" defaultValue={v.contactName} autoComplete="name" className="control" />
            </div>
            <div>
              <label htmlFor="f-contactEmail" className="label">
                Email
              </label>
              <FieldError id="contactEmail-error" message={e.contactEmail} />
              <input
                id="f-contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={v.contactEmail}
                autoComplete="email"
                className="control"
                aria-invalid={invalid('contactEmail')}
                aria-describedby={describedBy('contactEmail')}
              />
            </div>
            <div>
              <label htmlFor="f-contactPhone" className="label">
                Phone
              </label>
              <input id="f-contactPhone" name="contactPhone" type="tel" defaultValue={v.contactPhone} autoComplete="tel" className="control" />
            </div>
          </div>
          <label className="choice">
            <input type="checkbox" name="keepConsent" defaultChecked={v.keepConsent === 'on'} />
            <span>You may keep my contact details after the 12 months, so editors can reach me about later developments.</span>
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
        <button type="submit" className="btn btn-lg w-full sm:w-auto" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <SendHorizontal aria-hidden="true" className="nudge" />}
          {pending ? 'Sending…' : isCorrection ? 'Send correction request' : 'Send report'}
        </button>
        <p className="hint mt-3">You’ll get a reference number on the next screen.</p>
      </div>
    </form>
  )
}

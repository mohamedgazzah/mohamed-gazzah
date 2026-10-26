'use client'

import Script from 'next/script'
import { useActionState, useEffect, useRef } from 'react'
import { REPORTER_RELATIONS, REPORTER_RELATION_META } from '@/db/enums'
import { US_STATES } from '@/lib/states'
import { submitReport, type ReportState } from './actions'

declare global {
  interface Window {
    turnstile?: { reset: (el?: string | HTMLElement) => void }
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="field-error mt-1">
      {message}
    </p>
  )
}

const FIELD_LABELS: Record<string, string> = {
  whatHappened: 'Description',
  incidentDate: 'Date',
  city: 'City',
  stateFips: 'State',
  links: 'Links',
  contactEmail: 'Email',
  recordId: 'Record id',
  files: 'Files',
}

export function ReportForm({ mode, recordId, siteKey }: { mode: 'report' | 'correction'; recordId: string; siteKey: string | null }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, { status: 'idle' })
  const summaryRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const v = state.values ?? {}
  const e = state.errors ?? {}
  const isCorrection = mode === 'correction'

  useEffect(() => {
    if (state.status === 'error') {
      summaryRef.current?.focus()
      window.turnstile?.reset()
    }
    if (state.status === 'ok') doneRef.current?.focus()
  }, [state])

  if (state.status === 'ok') {
    return (
      <div className="card p-6" role="status">
        <h2 ref={doneRef} tabIndex={-1} className="text-2xl outline-none">
          Thank you. We received your {isCorrection ? 'correction request' : 'report'}.
        </h2>
        <p className="mt-3 reading">
          Reference: <strong className="tabular">{state.reference}</strong>. An editor will review it. Nothing you sent is published
          automatically, and your personal details stay private.
          {isCorrection ? ' We respond to correction requests within 72 hours, and to requests to remove identifying details within 48 hours.' : ''}
        </p>
        <p className="mt-3 reading">If someone is in danger, call 911.</p>
      </div>
    )
  }

  const describedBy = (name: string, hint?: string) => [hint, e[name] ? `${name}-error` : null].filter(Boolean).join(' ') || undefined

  return (
    <form action={action} noValidate className="space-y-6" aria-describedby="report-notice">
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer /> : null}
      <input type="hidden" name="mode" value={mode} />

      {state.status === 'error' ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="card border-severe p-4 outline-none">
          <p className="font-semibold text-severe">{state.message}</p>
          {Object.keys(e).length ? (
            <ul className="mt-2 list-disc ps-5">
              {Object.entries(e).map(([k, msg]) => (
                <li key={k}>
                  <a href={`#f-${k}`}>{FIELD_LABELS[k] ?? k}: {msg}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {isCorrection ? (
        <div>
          <label htmlFor="f-recordId" className="label">
            Record id <span className="font-normal text-muted">(required)</span>
          </label>
          <input
            id="f-recordId"
            name="recordId"
            defaultValue={v.recordId ?? recordId}
            required
            className="control max-w-xs tabular"
            placeholder="US-2026-0412"
            aria-invalid={!!e.recordId}
            aria-describedby={describedBy('recordId', 'recordId-hint')}
          />
          <p id="recordId-hint" className="hint mt-1">
            Shown at the top of every record and in its address.
          </p>
          <FieldError id="recordId-error" message={e.recordId} />
        </div>
      ) : null}

      <div>
        <label htmlFor="f-whatHappened" className="label">
          {isCorrection ? 'What should be corrected, and why?' : 'What happened?'} <span className="font-normal text-muted">(required)</span>
        </label>
        <textarea
          id="f-whatHappened"
          name="whatHappened"
          required
          rows={7}
          defaultValue={v.whatHappened}
          className="control"
          aria-invalid={!!e.whatHappened}
          aria-describedby={describedBy('whatHappened', 'whatHappened-hint')}
        />
        <p id="whatHappened-hint" className="hint mt-1">
          {isCorrection
            ? 'Point to the sentence or field, and add a source if you have one.'
            : 'Describe what you saw or experienced. Please do not include other people’s names unless they are public officials.'}
        </p>
        <FieldError id="whatHappened-error" message={e.whatHappened} />
      </div>

      {isCorrection ? (
        <div>
          <label className="flex min-h-11 items-start gap-2 text-base">
            <input type="checkbox" name="privacyRequest" defaultChecked={v.privacyRequest === 'on'} className="mt-1 h-4 w-4 accent-accent" />
            <span>
              I am a person described in this record and I want identifying details removed. We do this within 48 hours, no questions asked.
            </span>
          </label>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="f-incidentDate" className="label">
                Date
              </label>
              <input
                id="f-incidentDate"
                name="incidentDate"
                type="date"
                defaultValue={v.incidentDate}
                className="control"
                aria-invalid={!!e.incidentDate}
                aria-describedby={describedBy('incidentDate')}
              />
              <FieldError id="incidentDate-error" message={e.incidentDate} />
            </div>
            <div>
              <label htmlFor="f-city" className="label">
                City or town <span className="font-normal text-muted">(required)</span>
              </label>
              <input
                id="f-city"
                name="city"
                required
                defaultValue={v.city}
                autoComplete="address-level2"
                className="control"
                aria-invalid={!!e.city}
                aria-describedby={describedBy('city')}
              />
              <FieldError id="city-error" message={e.city} />
            </div>
            <div>
              <label htmlFor="f-stateFips" className="label">
                State
              </label>
              <select id="f-stateFips" name="stateFips" defaultValue={v.stateFips ?? ''} className="control" aria-describedby={describedBy('stateFips')}>
                <option value="">Choose a state</option>
                {US_STATES.map((s) => (
                  <option key={s.fips} value={s.fips}>
                    {s.name}
                  </option>
                ))}
              </select>
              <FieldError id="stateFips-error" message={e.stateFips} />
            </div>
          </div>
          <div>
            <label htmlFor="f-address" className="label">
              Exact address or place <span className="font-normal text-muted">(optional, never published)</span>
            </label>
            <input id="f-address" name="address" defaultValue={v.address} className="control" autoComplete="off" aria-describedby="address-hint" />
            <p id="address-hint" className="hint mt-1">
              Helps editors check police reports. It is encrypted and only editors can see it.
            </p>
          </div>
        </>
      )}

      <div>
        <label htmlFor="f-links" className="label">
          Links to news stories, police reports or posts <span className="font-normal text-muted">(optional, one per line)</span>
        </label>
        <textarea
          id="f-links"
          name="links"
          rows={3}
          defaultValue={v.links}
          className="control"
          aria-invalid={!!e.links}
          aria-describedby={describedBy('links')}
        />
        <FieldError id="links-error" message={e.links} />
      </div>

      <div>
        <label htmlFor="f-files" className="label">
          Photos or documents <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="f-files"
          name="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="control"
          aria-invalid={!!e.files}
          aria-describedby={describedBy('files', 'files-hint')}
        />
        <p id="files-hint" className="hint mt-1">
          Up to 5 files, 3.5 MB in total: JPEG, PNG, WebP, GIF or PDF. Location data is removed from photos. Files are encrypted and never
          published.
        </p>
        <FieldError id="files-error" message={e.files} />
      </div>

      {!isCorrection ? (
        <fieldset>
          <legend className="label">How do you know about it?</legend>
          <div className="space-y-1">
            {REPORTER_RELATIONS.map((r) => (
              <label key={r} className="flex min-h-11 items-center gap-2 text-base">
                <input type="radio" name="relation" value={r} defaultChecked={v.relation === r} className="h-4 w-4 accent-accent" />
                {REPORTER_RELATION_META[r].label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="card space-y-4 p-4">
        <legend className="px-1 font-semibold">Contact details (optional)</legend>
        <p className="hint">Only if you want an editor to follow up. Never published, encrypted, and deleted 12 months after the matter is resolved.</p>
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
            <input
              id="f-contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={v.contactEmail}
              autoComplete="email"
              className="control"
              aria-invalid={!!e.contactEmail}
              aria-describedby={describedBy('contactEmail')}
            />
            <FieldError id="contactEmail-error" message={e.contactEmail} />
          </div>
          <div>
            <label htmlFor="f-contactPhone" className="label">
              Phone
            </label>
            <input id="f-contactPhone" name="contactPhone" type="tel" defaultValue={v.contactPhone} autoComplete="tel" className="control" />
          </div>
        </div>
        <label className="flex min-h-11 items-start gap-2 text-base">
          <input type="checkbox" name="keepConsent" defaultChecked={v.keepConsent === 'on'} className="mt-1 h-4 w-4 accent-accent" />
          <span>You may keep my contact details after the 12 months, so editors can reach me about later developments.</span>
        </label>
      </fieldset>

      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="f-website">Website</label>
        <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {siteKey ? <div className="cf-turnstile" data-sitekey={siteKey} data-appearance="interaction-only" data-size="flexible" /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Sending…' : isCorrection ? 'Send correction request' : 'Send report'}
        </button>
        <p className="hint">Submissions are reviewed by editors. Nothing is published automatically.</p>
      </div>
    </form>
  )
}

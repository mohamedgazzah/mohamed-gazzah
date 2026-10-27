'use client'

import { ChevronDown, CircleAlert, CircleCheck, Copy, LoaderCircle, Mail, Paperclip, Plus, SendHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { CopyButton } from '@/components/CopyButton'
import { REPORTER_RELATIONS, REPORTER_RELATION_META, SLA } from '@/db/enums'
import {
  CITY_MESSAGE,
  EMAIL_MESSAGE,
  MAX_LENGTH,
  RECORD_ID_MESSAGE,
  WHAT_HAPPENED_MIN,
  isEmail,
  linksProblem,
  tooLong,
  whatHappenedMessage,
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

/** The role addresses in a message become mailto links. */
function linkEmails(text: string): ReactNode[] {
  return text.split(/([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/).map((part, i) =>
    i % 2 ? (
      <a key={i} href={`mailto:${part}`}>
        {part}
      </a>
    ) : (
      part
    ),
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="field-error mt-1.5">
      <CircleAlert aria-hidden="true" />
      {/* One flex item, so a link in the message does not split the sentence into columns. */}
      <span>{linkEmails(message)}</span>
    </p>
  )
}

/** A numbered step heading inside the form. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="space-y-5">
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-xl">
        <span aria-hidden="true" className="step-disk tabular inline-grid h-8 min-w-8 place-items-center rounded-full text-xs font-semibold">
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

/** By its type, or by its name when the browser does not know the type (the server checks the bytes either way). */
const supported = (f: { name: string; type: string }) =>
  f.type ? ACCEPT.includes(f.type) : !/\.\w+$/.test(f.name) || /\.(jpe?g|png|webp|gif|pdf)$/i.test(f.name)

/** What is wrong with one chosen file, in words, or null. */
function fileProblem(f: { name: string; size: number; type: string }, index: number): string | null {
  if (index >= UPLOAD_LIMITS.maxFiles) return `Over the ${UPLOAD_LIMITS.maxFiles}-file limit: remove this one or another.`
  if (!supported(f)) return 'Not a supported type: use JPEG, PNG, WebP, GIF or PDF.'
  if (f.size > UPLOAD_LIMITS.maxFileBytes) return `Each file must be under ${LIMIT_EACH}: remove it, or attach a screenshot instead.`
  return null
}

const totalSize = (list: { size: number }[]) => list.reduce((n, f) => n + f.size, 0)
/** "3 files, 2.7 MB of 3.5 MB.", said after a file is added or removed. */
const tally = (list: { size: number }[]) =>
  list.length ? `${list.length} ${list.length === 1 ? 'file' : 'files'}, ${size(totalSize(list))} of ${LIMIT_TOTAL}.` : 'No files attached.'
// A file chosen twice is listed once.
const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
function toFileList(list: File[]): FileList {
  const dt = new DataTransfer()
  list.forEach((f) => dt.items.add(f))
  return dt.files
}

// The order fields appear in, so the error summary reads top to bottom.
const FIELD_ORDER = ['recordId', 'whatHappened', 'incidentDate', 'city', 'stateFips', 'links', 'files', 'contactEmail'] as const

type Draft = { values: Record<string, string>; files: File[] }
// What a draft holds: the fields the server sends back after an error, and the two ticks.
const DRAFT_FIELDS = ['recordId', 'whatHappened', 'incidentDate', 'city', 'stateFips', 'address', 'links', 'relation', 'contactEmail', 'contactName', 'contactPhone', 'keepConsent', 'privacyRequest']
/**
 * Unsent reports, held in this tab's memory only, never in storage or cookies: following a link and
 * coming back loses nothing. Sending clears the draft; closing or reloading the tab forgets it.
 * Written only from event handlers, so the server's copy of this module never holds anything.
 */
const drafts = new Map<string, Draft>()

/** "7K2M9QXA" shown as 7K2M 9QXA, so it is easy to note down; it copies without the gap. */
function Reference({ value }: { value: string }) {
  return (
    <strong className="tabular text-2xl leading-tight tracking-[0.04em]">
      {value.slice(0, 4)}
      <span className="ms-[0.35em]">{value.slice(4)}</span>
    </strong>
  )
}

export function ReportForm({ mode, recordId, siteKey, today }: { mode: 'report' | 'correction'; recordId: string; siteKey: string | null; today: string }) {
  const isCorrection = mode === 'correction'
  // A correction's draft belongs to the record it was started from.
  const draftKey = isCorrection ? `correction:${recordId}` : 'report'
  const [restored] = useState(() => drafts.get(draftKey) ?? null)
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, { status: 'idle' })
  const v = state.values ?? restored?.values ?? {}
  const [checked, setChecked] = useState<Record<string, string> | null>(null)
  // Fields fixed since the last send: their errors clear as soon as the rule passes.
  const [fixed, setFixed] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [fileNews, setFileNews] = useState('')
  const [whatLength, setWhatLength] = useState(() => (v.whatHappened ?? '').trim().length)
  const [removal, setRemoval] = useState(v.privacyRequest === 'on')
  const [dirty, setDirty] = useState(!!restored)
  const summaryRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileList = useRef<HTMLUListElement>(null)
  const focusAfterRemove = useRef<number | null>(null)
  // Errors found in the browser win until the next send; the server's otherwise.
  const all: Record<string, string> = checked ?? state.errors ?? {}
  const e: Record<string, string> = Object.fromEntries(Object.entries(all).filter(([k]) => !fixed.includes(k)))
  const errorKeys = Object.keys(e)
  // A problem that is not about a field (the spam check, the rate limit) stays until the next send.
  const showSummary = errorKeys.length > 0 || (!checked && state.status === 'error' && !state.errors)

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
  const mailto = `mailto:${contactAddress}?subject=${encodeURIComponent(isCorrection ? `Correction request${recordId ? ` ${recordId}` : ''}` : 'Incident report')}`

  useEffect(() => {
    if (state.status === 'error') {
      summaryRef.current?.focus()
      window.turnstile?.reset()
    }
    if (state.status === 'ok') {
      drafts.delete(draftKey)
      doneRef.current?.focus()
      document.title = `${isCorrection ? 'Request received' : 'Report received'} — ${SITE.name}`
    }
  }, [state, isCorrection, draftKey])

  useEffect(() => {
    if (checked) summaryRef.current?.focus()
  }, [checked])

  // A file input can be refilled only from script: a remembered draft's attachments come back here.
  useEffect(() => {
    const input = fileInput.current
    if (!input || !restored?.files.length) return
    input.files = toFileList(restored.files)
    setFiles(restored.files)
  }, [restored])

  // After Remove, focus goes to the Remove button now in the same place, or to the field once the list is empty.
  useEffect(() => {
    const at = focusAfterRemove.current
    if (at === null) return
    focusAfterRemove.current = null
    const buttons = fileList.current?.querySelectorAll<HTMLButtonElement>('.file-remove')
    ;(buttons?.length ? buttons[Math.min(at, buttons.length - 1)] : fileInput.current)?.focus()
  }, [files])

  // Reloading, closing the tab or leaving the site would lose what was typed, so the browser asks first.
  // Links within the site keep the draft. Chrome also fires this for a mailto link, which keeps the page open: let it through.
  useEffect(() => {
    if (!dirty || state.status === 'ok') return
    let mailing = false
    const click = (ev: globalThis.MouseEvent) => {
      if (!(ev.target instanceof Element) || !ev.target.closest('a[href^="mailto:"]')) return
      mailing = true
      setTimeout(() => (mailing = false))
    }
    const ask = (ev: BeforeUnloadEvent) => {
      if (mailing) return
      ev.preventDefault()
      ev.returnValue = true // older browsers
    }
    document.addEventListener('click', click, true)
    window.addEventListener('beforeunload', ask)
    return () => {
      document.removeEventListener('click', click, true)
      window.removeEventListener('beforeunload', ask)
    }
  }, [dirty, state.status])

  if (state.status === 'ok') {
    const reference = state.reference ?? ''
    return (
      <div className="card p-6 md:p-8" role="status" data-done="">
        <span className="icon-chip icon-chip-lg" aria-hidden="true">
          <CircleCheck />
        </span>
        {/* The page title already says it was received. */}
        <h2 ref={doneRef} tabIndex={-1} className="mt-5 text-2xl leading-tight outline-none">
          {isCorrection ? 'Thank you for your request.' : 'Thank you for telling us.'}
        </h2>
        <div className="report-ref mt-5">
          <p className="kicker">Your reference</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Reference value={reference} />
            <CopyButton text={reference} label="Copy reference" className="btn btn-secondary btn-sm" icon={<Copy aria-hidden="true" />} />
          </div>
        </div>
        <p className="mt-4">
          Note it down: if you remember something later, write to{' '}
          <a href={`mailto:${contactAddress}?subject=${encodeURIComponent(`Reference ${reference}`)}`}>{contactAddress}</a> and quote it.
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
          at{' '}
          <a href="https://tips.fbi.gov" target="_blank" rel="noopener noreferrer">
            tips.fbi.gov<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
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
    if (what.length > MAX_LENGTH.whatHappened) found.whatHappened = tooLong(what.length, MAX_LENGTH.whatHappened, contactAddress)
    else if (what.length < WHAT_HAPPENED_MIN && !removing) found.whatHappened = whatHappenedMessage(mode, what.length)
    if (!isCorrection && !String(fd.get('city') ?? '').trim()) found.city = CITY_MESSAGE
    if (isCorrection && !isRecordId(String(fd.get('recordId') ?? '').trim().toUpperCase())) found.recordId = RECORD_ID_MESSAGE
    const links = linksProblem(String(fd.get('links') ?? ''))
    if (links) found.links = links
    const email = String(fd.get('contactEmail') ?? '').trim()
    if (email && !isEmail(email)) found.contactEmail = EMAIL_MESSAGE
    // The same checks as the rows of the file list, so the field and its rows never disagree.
    const unsupported = chosen.find((f) => !supported(f))
    const big = chosen.find((f) => f.size > UPLOAD_LIMITS.maxFileBytes)
    const total = totalSize(chosen)
    if (chosen.length > UPLOAD_LIMITS.maxFiles) found.files = `Attach at most ${UPLOAD_LIMITS.maxFiles} files: remove ${chosen.length - UPLOAD_LIMITS.maxFiles}.`
    else if (unsupported) found.files = `“${unsupported.name}” is not a supported type. Use JPEG, PNG, WebP, GIF or PDF.`
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

  /** Keeps the draft in memory as the person types, and drops it once the form is empty again. */
  function remember(form: HTMLFormElement) {
    const fd = new FormData(form)
    const values: Record<string, string> = {}
    for (const k of DRAFT_FIELDS) {
      const value = fd.get(k)
      if (typeof value === 'string') values[k] = value
    }
    const attached = chosenFiles(fd)
    const filled = attached.length > 0 || Object.entries(values).some(([k, value]) => value.trim() !== '' && !(k === 'recordId' && value === recordId))
    if (filled) drafts.set(draftKey, { values, files: attached })
    else drafts.delete(draftKey)
    setDirty(filled)
  }

  // After any change: a highlighted field's error goes away once it passes its rule, and the draft is kept.
  function changed(form: HTMLFormElement, name: string) {
    const key = name === 'privacyRequest' ? 'whatHappened' : name
    if (all[key] && !fixed.includes(key)) {
      const fd = new FormData(form)
      if (!problems(fd, chosenFiles(fd))[key]) setFixed((f) => [...f, key])
    }
    remember(form)
  }

  function onInput(ev: FormEvent<HTMLFormElement>) {
    const target = ev.target as HTMLInputElement
    // The file field is handled once the new choice has joined the list (addFiles).
    if (target.type !== 'file') changed(ev.currentTarget, target.name)
  }

  // GOV.UK's pattern: bring the field's label and hint into view, then focus the field.
  function jump(ev: MouseEvent<HTMLAnchorElement>, key: string) {
    const field = document.getElementById(`f-${key}`)
    if (!field) return
    ev.preventDefault()
    ;(document.querySelector(`label[for="f-${key}"]`) ?? field).scrollIntoView({ block: 'start' })
    field.focus({ preventScroll: true })
  }

  // Choosing again adds to the list instead of replacing it: on phones, photos are often added one at a time.
  function addFiles(ev: ChangeEvent<HTMLInputElement>) {
    const input = ev.currentTarget
    const picked = Array.from(input.files ?? [])
    const added = picked.filter((f, i) => !files.some((c) => sameFile(c, f)) && picked.findIndex((g) => sameFile(g, f)) === i)
    const next = [...files, ...added]
    input.files = toFileList(next)
    setFiles(next)
    if (picked.length) setFileNews(`${added.length ? `Added ${added.length === 1 ? added[0]!.name : `${added.length} files`}` : 'Already in the list'}. ${tally(next)}`)
    if (input.form) changed(input.form, 'files')
  }

  function removeFile(index: number) {
    const input = fileInput.current
    const gone = files[index]
    if (!input || !gone) return
    const next = files.filter((_, i) => i !== index)
    input.files = toFileList(next)
    focusAfterRemove.current = index
    setFiles(next)
    setFileNews(`Removed ${gone.name}. ${tally(next)}`)
    if (input.form) changed(input.form, 'files')
  }

  const total = totalSize(files)
  const showCount = whatLength > MAX_LENGTH.whatHappened * 0.8
  const fieldsTitle = !!checked || errorKeys.length > 0

  return (
    <form action={action} onSubmit={send} onInput={onInput} noValidate className="report-form space-y-12" aria-describedby="report-notice">
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer /> : null}
      <input type="hidden" name="mode" value={mode} />

      {showSummary ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="card border-severe p-5">
          <p className="flex items-start gap-2 font-semibold text-severe">
            <CircleAlert aria-hidden="true" size={18} className="mt-[0.2em] shrink-0" />
            {fieldsTitle ? 'Please check the highlighted fields.' : state.title}
          </p>
          {!fieldsTitle && state.detail ? <p className="mt-1.5 ps-[26px]">{linkEmails(state.detail)}</p> : null}
          {errorKeys.length ? (
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
          {v.hadFiles && !files.length && !checked ? <p className="mt-2 ps-[26px]">Your photos or documents were not kept. Please attach them again.</p> : null}
        </div>
      ) : null}

      {siteKey ? (
        // Without JavaScript the spam check cannot run: said first, and Send gives way to email (globals.css).
        <noscript className="block">
          <div className="note report-nojs">
            <p>
              <span className="note-label">This form needs JavaScript</span>
              It runs the spam check before anything is sent. You can email {isCorrection ? 'the correction' : 'what happened'} to{' '}
              <a href={mailto}>{contactAddress}</a> instead.
            </p>
          </div>
        </noscript>
      ) : null}

      <Step n={1} title={isCorrection ? 'The correction' : 'In your own words'}>
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
              : 'What was said or done, and where. A sentence or two is enough. Leave out other people’s names unless they are public officials.'}
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
          {/* The date's hint sits under its field, so the three labels and fields line up. */}
          <div className="grid gap-4 lg:grid-cols-3">
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
                maxLength={MAX_LENGTH.city}
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
            often smaller than the original photo. We remove location data from photos.
          </p>
          <FieldError id="files-error" message={e.files} />
          {files.length ? (
            <div className={`mt-2 rounded-[var(--radius-sm)] border bg-surface px-3 py-2 text-sm ${e.files ? 'border-severe' : 'border-rule'}`}>
              <ul ref={fileList} className="space-y-1.5">
                {files.map((f, i) => {
                  const problem = fileProblem(f, i)
                  return (
                    <li key={`${f.name}-${f.size}-${f.lastModified}`}>
                      <span className="flex items-center gap-2">
                        <Paperclip aria-hidden="true" size={14} className="shrink-0 text-muted" />
                        <span className="min-w-0 truncate">{f.name}</span>
                        {/* Red only when the size is the problem. */}
                        <span className={`tabular ms-auto shrink-0 ${f.size > UPLOAD_LIMITS.maxFileBytes ? 'font-semibold text-severe' : 'text-muted'}`}>
                          {size(f.size)}
                        </span>
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
          <input
            ref={fileInput}
            id="f-files"
            name="files"
            type="file"
            multiple
            accept={ACCEPT.join(',')}
            // Once files are listed, the native field gives way to "Add more files" below the list; it stays in the tab order.
            className={files.length ? 'file-input sr-only' : 'control'}
            aria-invalid={invalid('files')}
            aria-describedby={describedBy('files', 'files-hint')}
            onChange={addFiles}
          />
          {files.length ? (
            <label htmlFor="f-files" className="file-add btn btn-secondary btn-sm mt-3">
              <Plus aria-hidden="true" />
              Add more files
            </label>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {fileNews}
          </p>
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
          {/* The notice above says how they are protected; the rail says when an editor replies. */}
          <p className="hint clear-both">{isCorrection ? 'Only if you want a reply.' : 'Only if you want an editor to follow up.'}</p>
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
                className="control"
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
            <span>
              You may keep my contact details after the usual {SLA.submitterDataRetentionMonths} months, so editors can reach me about later developments.
            </span>
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
            <a href={mailto} className="btn btn-lg w-full sm:w-auto">
              <Mail aria-hidden="true" />
              Email the editors
            </a>
          </noscript>
        ) : null}
        <div className="report-send">
          <button type="submit" className="btn btn-lg w-full sm:w-auto" disabled={pending}>
            {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <SendHorizontal aria-hidden="true" className="nudge" />}
            {pending ? 'Sending…' : isCorrection ? 'Send correction request' : 'Send report'}
          </button>
          <span aria-live="polite" className="sr-only">
            {pending ? 'Sending…' : ''}
          </span>
          <p className="hint mt-3">You’ll get a reference number on the next screen.</p>
        </div>
      </div>
    </form>
  )
}

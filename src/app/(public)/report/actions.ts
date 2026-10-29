'use server'

import { z } from 'zod'
import { SITE } from '@/lib/site'
import { issuesByPath } from '@/lib/validation'
import { clientIp } from '@/server/shared/request'
import { rateLimit } from '@/server/shared/ratelimit'
import { verifyTurnstile } from '@/server/shared/turnstile'
import { SubmissionError, createSubmission, prepareFiles, reportFields } from '@/server/public/submissions'

export type ReportState = {
  status: 'idle' | 'error' | 'ok'
  /** The error summary's first line: short. */
  title?: string
  /** What to do next, in plain words. The form turns email addresses in it into links. */
  detail?: string
  errors?: Record<string, string>
  reference?: string
  mode?: 'report' | 'correction'
  /** Text the person typed, returned on error so the form keeps it. */
  values?: Record<string, string>
}

const KEEP = ['whatHappened', 'incidentDate', 'city', 'stateFips', 'address', 'links', 'relation', 'contactName', 'contactEmail', 'contactPhone', 'recordId'] as const

const CHECK_FIELDS = 'Please check the highlighted fields.'

const text = (fd: FormData, key: string) => {
  const v = fd.get(key)
  return typeof v === 'string' ? v : undefined
}

export async function submitReport(_prev: ReportState, fd: FormData): Promise<ReportState> {
  const result = await handle(fd)
  if (result.status === 'error') {
    result.values = Object.fromEntries(KEEP.map((k) => [k, text(fd, k) ?? '']))
    if (fd.get('keepConsent') === 'on') result.values.keepConsent = 'on'
    if (fd.get('privacyRequest') === 'on') result.values.privacyRequest = 'on'
    // A page sent back without JavaScript cannot refill a file input; the form says so.
    if (fd.getAll('files').some((f) => typeof f !== 'string' && f.size > 0)) result.values.hadFiles = '1'
  }
  return result
}

async function handle(fd: FormData): Promise<ReportState> {
  const mode = text(fd, 'mode') === 'correction' ? 'correction' : 'report'
  const email = mode === 'correction' ? SITE.emails.corrections : SITE.emails.editors

  // Honeypot: real people never fill this hidden field. Bots get a quiet success.
  if (text(fd, 'website')) return { status: 'ok', reference: 'RECEIVED', mode }

  const ip = await clientIp()
  if (!(await verifyTurnstile(text(fd, 'cf-turnstile-response') ?? null, ip))) {
    // No token field at all: the check never ran (JavaScript is off, or its script was blocked), so sending again cannot help.
    if (!fd.has('cf-turnstile-response')) {
      return {
        status: 'error',
        mode,
        title: 'The spam check couldn’t run, so nothing was sent.',
        detail: `It needs JavaScript, and some ad or content blockers stop it. Turn JavaScript on or pause the blocker for this page, then send again. Or email us at ${email}.`,
      }
    }
    return {
      status: 'error',
      mode,
      title: 'We couldn’t finish the spam check, so nothing was sent.',
      detail: `Everything you entered is still here: please send it again. If it keeps failing, an ad or content blocker may be stopping the check. Pause it for this page, or email us at ${email}.`,
    }
  }

  const parsed = reportFields.safeParse({
    mode,
    whatHappened: text(fd, 'whatHappened') ?? '',
    incidentDate: text(fd, 'incidentDate'),
    city: text(fd, 'city'),
    stateFips: text(fd, 'stateFips'),
    address: text(fd, 'address'),
    links: text(fd, 'links'),
    relation: text(fd, 'relation') || undefined,
    contactName: text(fd, 'contactName'),
    contactEmail: text(fd, 'contactEmail'),
    contactPhone: text(fd, 'contactPhone'),
    keepConsent: fd.get('keepConsent') === 'on',
    recordId: text(fd, 'recordId'),
    privacyRequest: fd.get('privacyRequest') === 'on',
  })
  if (!parsed.success) {
    return { status: 'error', mode, title: CHECK_FIELDS, errors: issuesByPath(parsed.error as z.ZodError) }
  }
  // Counted only for submissions that would be stored, so a corrected mistake never uses up the allowance.
  const limit = await rateLimit('report', ip, Number(process.env.REPORT_RATE_LIMIT ?? 5), 3600)
  if (!limit.ok) {
    return {
      status: 'error',
      mode,
      title: 'Sending is paused for now, so nothing was sent.',
      detail: `Several ${mode === 'correction' ? 'requests' : 'reports'} were sent from this connection in the last hour. Everything you entered is still here: try again later, or email us at ${email}.`,
    }
  }

  try {
    const files = await Promise.all(
      fd
        .getAll('files')
        .filter((f): f is File => typeof f !== 'string' && f.size > 0)
        .map(async (f) => ({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })),
    )
    const prepared = await prepareFiles(files)
    const { reference } = await createSubmission(parsed.data, prepared)
    return { status: 'ok', reference, mode }
  } catch (err) {
    // A file problem is said once, in the list of fields, not again as the summary's title.
    if (err instanceof SubmissionError) return { status: 'error', mode, title: CHECK_FIELDS, errors: { files: err.message } }
    console.error('[report] submission failed', (err as Error).message)
    return {
      status: 'error',
      mode,
      title: `Your ${mode === 'correction' ? 'request' : 'report'} could not be saved.`,
      detail: `Nothing was stored, but everything you entered is still here. Please try again later, or email us at ${email}.`,
    }
  }
}

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
  message?: string
  errors?: Record<string, string>
  reference?: string
  mode?: 'report' | 'correction'
  /** Text the person typed, returned on error so the form keeps it. */
  values?: Record<string, string>
}

const KEEP = ['whatHappened', 'incidentDate', 'city', 'stateFips', 'address', 'links', 'relation', 'contactName', 'contactEmail', 'contactPhone', 'recordId'] as const

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
  }
  return result
}

async function handle(fd: FormData): Promise<ReportState> {
  const mode = text(fd, 'mode') === 'correction' ? 'correction' : 'report'

  // Honeypot: real people never fill this hidden field. Bots get a quiet success.
  if (text(fd, 'website')) return { status: 'ok', reference: 'RECEIVED', mode }

  const ip = await clientIp()
  if (!(await verifyTurnstile(text(fd, 'cf-turnstile-response') ?? null, ip))) {
    return {
      status: 'error',
      mode,
      message: `We couldn’t finish our automatic spam check, so nothing has been sent yet. Your words are still here: please don’t reload. Press the button again. If it keeps failing, a content blocker may be stopping the check (allow challenges.cloudflare.com), or email ${SITE.emails.editors}.`,
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
    return { status: 'error', mode, message: 'Please check the highlighted fields.', errors: issuesByPath(parsed.error as z.ZodError) }
  }
  // Counted only for submissions that would be stored, so a corrected mistake never uses up the allowance.
  const limit = await rateLimit('report', ip, Number(process.env.REPORT_RATE_LIMIT ?? 5), 3600)
  if (!limit.ok) {
    return {
      status: 'error',
      mode,
      message: `You’ve sent several reports from this connection in the last hour, so new ones are paused. Your text is still here. Try again later, or email it to ${SITE.emails.editors}.`,
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
    if (err instanceof SubmissionError) return { status: 'error', mode, message: err.message, errors: { files: err.message } }
    console.error('[report] submission failed', (err as Error).message)
    return { status: 'error', mode, message: 'Your submission could not be saved. Nothing was stored. Please try again later.' }
  }
}

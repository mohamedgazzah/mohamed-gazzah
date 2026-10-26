/**
 * Public submissions (/report). Nothing here is ever published: a submission
 * becomes a lead in the admin inbox (and, for corrections, a ticket with SLA
 * timers). Contact details, exact addresses and files are encrypted and
 * stored apart from incident data.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { adminDb } from '@/db/admin'
import { correctionTickets, leads, submissionFiles, submissionPrivate, submissions } from '@/db/schema'
import { REPORTER_RELATIONS, SLA } from '@/db/enums'
import { encryptBytes, encryptText, sha256Hex } from '@/lib/crypto'
import { stateByFips } from '@/lib/states'
import { isRecordId } from '@/lib/slug'
import { putObject } from '../shared/storage'
import { UPLOAD_LIMITS, sniffType, stripImageMetadata } from '../shared/uploads'

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))

export const reportFields = z
  .object({
    mode: z.enum(['report', 'correction']),
    whatHappened: z.string().trim().min(20, 'Please describe what happened in at least a sentence or two.').max(5000),
    incidentDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use the date picker or YYYY-MM-DD.'),
    city: optional(100),
    stateFips: optional(2).refine((v) => v === null || !!stateByFips(v), 'Choose a state from the list.'),
    address: optional(300),
    links: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? '')
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .refine((l) => l.length <= 10, 'Add at most 10 links.')
      .refine((l) => l.every((u) => /^https?:\/\/[^\s]+$/i.test(u) && u.length <= 2000), 'Links must start with http:// or https://'),
    relation: z.enum(REPORTER_RELATIONS).optional().transform((v) => v ?? null),
    contactName: optional(200),
    contactEmail: optional(254).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Check the email address.'),
    contactPhone: optional(40),
    keepConsent: z.boolean(),
    recordId: optional(40),
    privacyRequest: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.mode === 'report' && !d.city) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Enter the city or town.' })
    if (d.mode === 'correction' && !(d.recordId && isRecordId(d.recordId.toUpperCase()))) {
      ctx.addIssue({ code: 'custom', path: ['recordId'], message: 'Enter the record id, for example US-2026-0412.' })
    }
  })

export type ReportFields = z.infer<typeof reportFields>
export type IncomingFile = { name: string; bytes: Buffer }

export class SubmissionError extends Error {}

type PreparedFile = { bytes: Buffer; type: string; stripped: boolean; name: string }

export async function prepareFiles(files: IncomingFile[]): Promise<PreparedFile[]> {
  const real = files.filter((f) => f.bytes.length > 0)
  if (real.length > UPLOAD_LIMITS.maxFiles) throw new SubmissionError(`Attach at most ${UPLOAD_LIMITS.maxFiles} files.`)
  const total = real.reduce((n, f) => n + f.bytes.length, 0)
  if (total > UPLOAD_LIMITS.maxTotalBytes) throw new SubmissionError('Files are too large together. The limit is 3.5 MB in total.')
  const out: PreparedFile[] = []
  for (const f of real) {
    if (f.bytes.length > UPLOAD_LIMITS.maxFileBytes) throw new SubmissionError(`“${f.name}” is larger than 3 MB.`)
    const type = sniffType(f.bytes)
    if (!type) throw new SubmissionError(`“${f.name}” is not a supported file. Use JPEG, PNG, WebP, GIF or PDF.`)
    if (type === 'application/pdf') {
      out.push({ bytes: f.bytes, type, stripped: false, name: f.name })
    } else {
      try {
        out.push({ bytes: await stripImageMetadata(f.bytes, type), type, stripped: true, name: f.name })
      } catch {
        throw new SubmissionError(`“${f.name}” could not be read as an image.`)
      }
    }
  }
  return out
}

export async function createSubmission(d: ReportFields, files: PreparedFile[]): Promise<{ reference: string }> {
  const id = randomUUID()
  const hasContact = !!(d.contactName || d.contactEmail || d.contactPhone)
  const recordId = d.recordId?.toUpperCase() ?? null

  // Encrypt and store files first; the rows reference them.
  const stored: { key: string; type: string; size: number; sha: string; nameEnc: string; stripped: boolean }[] = []
  for (const f of files) {
    const key = `submissions/${id}/${randomUUID()}`
    await putObject(key, encryptBytes(f.bytes, 'SUBMISSIONS_ENCRYPTION_KEY', key))
    stored.push({
      key,
      type: f.type,
      size: f.bytes.length,
      sha: sha256Hex(f.bytes),
      nameEnc: encryptText(f.name.slice(0, 200), 'SUBMISSIONS_ENCRYPTION_KEY', key),
      stripped: f.stripped,
    })
  }

  await adminDb().transaction(async (tx) => {
    await tx.insert(submissions).values({
      id,
      kind: d.mode,
      whatHappened: d.whatHappened,
      incidentDate: d.incidentDate,
      city: d.city,
      stateFips: d.stateFips,
      links: d.links,
      reporterRelation: d.relation,
      correctionRecordId: d.mode === 'correction' ? recordId : null,
      isPrivacyRequest: d.mode === 'correction' && d.privacyRequest,
      keepConsent: d.keepConsent,
      hasContact,
      fileCount: stored.length,
    })
    if (hasContact || d.address) {
      await tx.insert(submissionPrivate).values({
        submissionId: id,
        contactEnc: hasContact
          ? encryptText(JSON.stringify({ name: d.contactName, email: d.contactEmail, phone: d.contactPhone }), 'SUBMISSIONS_ENCRYPTION_KEY', `contact:${id}`)
          : null,
        addressEnc: d.address ? encryptText(d.address, 'SUBMISSIONS_ENCRYPTION_KEY', `address:${id}`) : null,
      })
    }
    for (const f of stored) {
      await tx.insert(submissionFiles).values({
        submissionId: id,
        storageKey: f.key,
        mimeType: f.type,
        sizeBytes: f.size,
        sha256: f.sha,
        originalNameEnc: f.nameEnc,
        metadataStripped: f.stripped,
      })
    }
    if (d.mode === 'correction') {
      const now = Date.now()
      const responseHours = d.privacyRequest ? SLA.privacyRemovalHours : SLA.correctionResponseHours
      await tx.insert(correctionTickets).values({
        recordId: recordId!,
        submissionId: id,
        isPrivacyRequest: d.privacyRequest,
        responseDueAt: new Date(now + responseHours * 3_600_000),
        fixDueAt: new Date(now + (d.privacyRequest ? SLA.privacyRemovalHours / 24 : SLA.correctionFixDays) * 86_400_000),
      })
    } else {
      await tx.insert(leads).values({
        source: 'submission',
        headline: d.whatHappened.replace(/\s+/g, ' ').slice(0, 140),
        url: d.links[0] ?? null,
        publishedDate: d.incidentDate,
        submissionId: id,
      })
    }
  })
  return { reference: id.slice(0, 8).toUpperCase() }
}

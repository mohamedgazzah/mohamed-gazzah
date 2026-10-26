/**
 * Acceptance: uploaded images have EXIF removed; submitter details are
 * encrypted and stay in the admin area. Also covers the retention rule.
 */
import { eq, sql } from 'drizzle-orm'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { adminDb } from '@/db/admin'
import { correctionTickets, leads, submissionFiles, submissionPrivate, submissions } from '@/db/schema'
import { decryptBytes } from '@/lib/crypto'
import { runRetention } from '@/server/jobs/retention'
import { createSubmission, prepareFiles, reportFields } from '@/server/public/submissions'
import { getObject } from '@/server/shared/storage'
import { hasImageMetadata } from '@/server/shared/uploads'
import { jpegWithGps } from '../fixtures/make-images'
import { asPublic } from './helpers'

const base = {
  mode: 'report',
  whatHappened: 'Someone shouted slurs at worshippers leaving evening prayers.',
  incidentDate: '2026-09-01',
  city: 'Dearborn',
  stateFips: '26',
  address: '123 Private Street',
  links: 'https://example.org/news/1',
  relation: 'witness',
  contactName: 'Pat Submitter',
  contactEmail: 'pat.submitter@example.com',
  contactPhone: '555-0100',
  keepConsent: false,
  recordId: undefined,
  privacyRequest: false,
} as const

describe('report submissions', () => {
  it('strips EXIF from photos, encrypts files and contact details, and creates a lead', async () => {
    const original = await jpegWithGps()
    expect(await hasImageMetadata(original)).toBe(true)
    const fields = reportFields.parse(base)
    const files = await prepareFiles([{ name: 'IMG_0001.jpg', bytes: original }])
    const { reference } = await createSubmission(fields, files)
    expect(reference).toMatch(/^[0-9A-F]{8}$/)

    const [sub] = await adminDb().select().from(submissions).where(sql`upper(left(${submissions.id}::text, 8)) = ${reference}`)
    expect(sub?.hasContact).toBe(true)
    const [priv] = await adminDb().select().from(submissionPrivate).where(eq(submissionPrivate.submissionId, sub!.id))
    expect(priv?.contactEnc).toBeTruthy()
    expect(priv?.contactEnc).not.toContain('pat.submitter')
    expect(priv?.addressEnc).not.toContain('Private Street')
    // Nothing identifying sits in the submission row itself.
    expect(JSON.stringify(sub)).not.toContain('pat.submitter')
    expect(JSON.stringify(sub)).not.toContain('Private Street')

    const [file] = await adminDb().select().from(submissionFiles).where(eq(submissionFiles.submissionId, sub!.id))
    expect(file?.metadataStripped).toBe(true)
    const stored = await getObject(file!.storageKey)
    expect(stored.includes(Buffer.from('TestPhone'))).toBe(false) // encrypted at rest
    const plain = decryptBytes(stored, 'SUBMISSIONS_ENCRYPTION_KEY', file!.storageKey)
    expect((await sharp(plain).metadata()).format).toBe('jpeg')
    expect(await hasImageMetadata(plain)).toBe(false)
    expect(plain.includes(Buffer.from('TestPhone'))).toBe(false)

    const [lead] = await adminDb().select().from(leads).where(eq(leads.submissionId, sub!.id))
    expect(lead?.status).toBe('new')
    expect(lead?.source).toBe('submission')
  })

  it('rejects files that are not images or PDFs, whatever their name', async () => {
    await expect(prepareFiles([{ name: 'photo.jpg', bytes: Buffer.from('MZ\x90\x00 not an image') }])).rejects.toThrow(/not a supported file/)
  })

  it('opens a correction ticket with SLA deadlines (48 hours for privacy removals)', async () => {
    const fields = reportFields.parse({ ...base, mode: 'correction', recordId: 'us-2026-0001', privacyRequest: true, contactName: '', contactEmail: '', contactPhone: '' })
    const before = Date.now()
    await createSubmission(fields, [])
    const [ticket] = await adminDb().select().from(correctionTickets).orderBy(sql`${correctionTickets.createdAt} desc`).limit(1)
    expect(ticket?.recordId).toBe('US-2026-0001')
    expect(ticket?.isPrivacyRequest).toBe(true)
    const hours = (ticket!.responseDueAt.getTime() - before) / 3_600_000
    expect(hours).toBeGreaterThan(47.9)
    expect(hours).toBeLessThan(48.1)
  })

  it('submitter data is unreachable from the public role', async () => {
    for (const table of ['submissions', 'submission_private', 'submission_files', 'leads', 'correction_tickets']) {
      const msg = await asPublic((c) => c.query(`select * from record.${table}`).then(() => 'readable', (e: Error) => e.message))
      expect(msg, table).toMatch(/permission denied/)
    }
  })

  it('deletes contact details and files 12 months after resolution, unless the submitter agreed to keep them', async () => {
    const files = await prepareFiles([{ name: 'a.jpg', bytes: await jpegWithGps() }])
    await createSubmission(reportFields.parse(base), files)
    await createSubmission(reportFields.parse({ ...base, keepConsent: true }), [])
    const recent = await adminDb().select().from(submissions).orderBy(sql`${submissions.createdAt} desc`).limit(2)
    const longAgo = new Date(Date.now() - 400 * 86_400_000)
    for (const s of recent) await adminDb().update(submissions).set({ resolvedAt: longAgo }).where(eq(submissions.id, s.id))

    const result = await runRetention()
    expect(result.purged).toBeGreaterThanOrEqual(1)
    const [kept, purged] = [recent.find((s) => s.keepConsent)!, recent.find((s) => !s.keepConsent)!]
    expect(await adminDb().select().from(submissionPrivate).where(eq(submissionPrivate.submissionId, purged.id))).toHaveLength(0)
    expect(await adminDb().select().from(submissionFiles).where(eq(submissionFiles.submissionId, purged.id))).toHaveLength(0)
    expect(await adminDb().select().from(submissionPrivate).where(eq(submissionPrivate.submissionId, kept.id))).toHaveLength(1)
    const [after] = await adminDb().select().from(submissions).where(eq(submissions.id, purged.id))
    expect(after?.purgedAt).not.toBeNull()
  })
})

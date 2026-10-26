import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { adminDb } from '@/db/admin'
import { users } from '@/db/schema'
import type { UserRole } from '@/db/enums'
import { emptyDraft } from '@/server/admin/incidents'
import type { SessionUser } from '@/server/admin/session'
import type { IncidentDraftInput } from '@/lib/validation'
import { testUrls } from './test-env'

export const CANARY_NOTE = `EDITOR-NOTE-CANARY-${randomUUID().slice(0, 8)}`

export async function makeUser(role: UserRole, name: string = role): Promise<SessionUser> {
  const [u] = await adminDb()
    .insert(users)
    .values({
      email: `${name}-${randomUUID().slice(0, 8)}@test.invalid`,
      displayName: `Test ${name}`,
      role,
      passwordHash: 'scrypt$1$1$1$x$x',
      mustChangePassword: false,
      totpEnabledAt: new Date(),
    })
    .returning()
  return u!
}

export async function team() {
  return {
    author: await makeUser('editor', 'author'),
    reviewer: await makeUser('editor', 'reviewer'),
    third: await makeUser('editor', 'third'),
    senior: await makeUser('senior_editor', 'senior'),
    contributor: await makeUser('contributor', 'contributor'),
  }
}

/** A draft that satisfies every publish precondition. */
export function completeDraft(over: Partial<IncidentDraftInput> = {}): IncidentDraftInput {
  const s1 = randomUUID()
  const base = emptyDraft()
  return {
    ...base,
    title: `Test record ${randomUUID().slice(0, 6)}`,
    summary: 'A test sentence describing a fictional event.[1] A second test sentence with its source.[1]',
    dateStart: '2026-05-01',
    stateFips: '26',
    city: 'Testville',
    lat: 42.3,
    lng: -83.2,
    incidentTypes: ['VAND'],
    targetType: 'mosque_islamic_center',
    severity: 2,
    biasIndicators: ['target_selection'],
    verificationLevel: 'V2',
    legalStatus: 'reported',
    editorNotes: `Private notes ${CANARY_NOTE}`,
    sources: [
      {
        id: s1,
        url: `https://example.org/test/${randomUUID()}`,
        outlet: 'Test Outlet',
        title: 'Test article',
        author: null,
        publishedDate: '2026-05-02',
        accessedDate: '2026-05-03',
        sourceType: 'news',
        claimAttribution: null,
      },
    ],
    legalEvents: [{ id: randomUUID(), date: '2026-05-01', eventType: 'reported', description: 'Reported.', sourceId: s1, caseId: null }],
    ...over,
  }
}

export const CHECKLIST_ALL = {
  chkSourcesCited: true,
  chkAllegationsLabelled: true,
  chkVictimPrivacy: true,
  chkLocationPrecision: true,
  chkTaxonomyCorrect: true,
}

export async function withClient<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

export const asOwner = <T>(fn: (c: pg.Client) => Promise<T>) => withClient(testUrls.migration, fn)
export const asApp = <T>(fn: (c: pg.Client) => Promise<T>) => withClient(testUrls.app, fn)
export const asPublic = <T>(fn: (c: pg.Client) => Promise<T>) => withClient(testUrls.public, fn)

/** The database error code a promise rejects with (first word of the message). */
export async function rejectionCode(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (err) {
    let e: unknown = err
    for (let i = 0; i < 4 && e; i++) {
      const m = (e as { message?: string }).message ?? ''
      const code = /^([a-z_]+)(:|$)/.exec(m)?.[1]
      if (code) return code
      e = (e as { cause?: unknown }).cause
    }
    return (err as Error).message
  }
  throw new Error('Expected the operation to fail, but it succeeded')
}

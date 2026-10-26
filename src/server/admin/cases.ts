import 'server-only'
import { asc, eq, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { cases } from '@/db/schema'
import { caseInput, type CaseInput } from '@/lib/validation'
import { audit } from './audit'
import { WorkflowError } from './incidents'
import { can } from './permissions'
import type { SessionUser } from './session'

export async function listCases() {
  return adminDb().select().from(cases).orderBy(asc(cases.nextDate), asc(cases.id))
}

export async function caseOptions() {
  return adminDb().select({ id: cases.id, name: cases.name }).from(cases).orderBy(asc(cases.id))
}

export async function getCase(id: string) {
  const [c] = await adminDb().select().from(cases).where(eq(cases.id, id))
  return c ?? null
}

/** Case details reach the public page when a linked record is next published. */
export async function saveCase(user: SessionUser, input: CaseInput): Promise<string> {
  if (!can.manageCases(user.role)) throw new WorkflowError('Only editors can manage cases.')
  const d = caseInput.parse(input)
  const values = {
    name: d.name,
    court: d.court,
    jurisdiction: d.jurisdiction,
    docketNumber: d.docketNumber,
    caseType: d.caseType,
    parties: d.parties,
    stage: d.stage,
    nextDate: d.nextDate,
    courtlistenerUrl: d.courtlistenerUrl,
    updatedAt: new Date(),
  }
  const db = adminDb()
  if (d.id) {
    await db.update(cases).set(values).where(eq(cases.id, d.id))
    await audit(null, user.id, 'case.update', 'case', d.id)
    return d.id
  }
  const res = await db.execute<{ id: string }>(sql`select record.next_id('CASE', ${new Date().getUTCFullYear()}) as id`)
  const id = res.rows[0]!.id
  await db.insert(cases).values({ id, createdBy: user.id, ...values })
  await audit(null, user.id, 'case.create', 'case', id)
  return id
}

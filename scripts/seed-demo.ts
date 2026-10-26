/**
 * Development seed: demo users and 5 clearly fake DEMO records.
 *
 *   npm run db:seed
 *
 * Every record goes through the real workflow (author drafts, a second editor
 * reviews, a senior editor publishes), so the seed also exercises the
 * database rules. It refuses to run in production, and demo records are
 * hidden by the public view unless the database sets record.allow_demo=on.
 *
 * Canary strings below let tests prove editor notes and V0 drafts never leak.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { DEMO_USERS, EDITOR_NOTE_CANARY, V0_CANARY } from './lib/demo-data'
import { isProductionEnv, loadEnv } from './lib/env'

loadEnv()
if (isProductionEnv()) {
  console.error('Refusing to seed demo data in production.')
  process.exit(1)
}

const { adminDb } = await import('@/db/admin')
const { users, cases, incidents } = await import('@/db/schema')
const { hashPassword } = await import('@/lib/passwords')
const { encryptText } = await import('@/lib/crypto')
const wf = await import('@/server/admin/incidents')
const { emptyDraft } = wf
type Draft = ReturnType<typeof emptyDraft>
type SessionUser = Parameters<typeof wf.saveIncident>[0]

async function upsertUser(u: (typeof DEMO_USERS)[number]): Promise<SessionUser> {
  const db = adminDb()
  const [existing] = await db.select().from(users).where(eq(users.email, u.email))
  if (existing) return existing
  const id = randomUUID()
  const [row] = await db
    .insert(users)
    .values({
      id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      passwordHash: await hashPassword(u.password),
      mustChangePassword: false,
      totpSecretEnc: encryptText(u.totp, 'APP_ENCRYPTION_KEY', `totp:${id}`),
      totpEnabledAt: new Date(),
      isDemo: true,
    })
    .returning()
  return row!
}

const src = (outlet: string, title: string, type: Draft['sources'][number]['sourceType'], date: string, slug: string) => ({
  id: randomUUID(),
  url: `https://example.org/demo/${slug}`,
  outlet,
  title,
  author: null,
  publishedDate: date,
  accessedDate: '2026-10-20',
  sourceType: type,
  claimAttribution: null,
})

function draft(over: Partial<Draft>): Draft {
  return { ...emptyDraft(), ...over }
}

async function main() {
  const db = adminDb()
  const author = await upsertUser(DEMO_USERS[0])
  const reviewer = await upsertUser(DEMO_USERS[1])
  const senior = await upsertUser(DEMO_USERS[2])
  await upsertUser(DEMO_USERS[3])
  await upsertUser(DEMO_USERS[4])

  const already = await db.select({ id: incidents.id }).from(incidents).where(eq(incidents.isDemo, true))
  if (already.length) {
    console.log(`Demo records already present (${already.length}). Run \`npm run db:setup -- --reset\` to start over.`)
    return
  }

  await db
    .insert(cases)
    .values({
      id: 'DEMO-CASE-2026-0001',
      name: 'DEMO: State v. Demo Defendant A',
      court: 'Fictional Superior Court, Riverside County',
      jurisdiction: 'California',
      docketNumber: 'DEMO-26-CR-0001',
      caseType: 'criminal',
      parties: ['State of California (fictional)', 'Demo Defendant A'],
      stage: 'Pretrial',
      nextDate: '2026-12-03',
      isDemo: true,
    })
    .onConflictDoNothing()

  const records: Draft[] = []

  {
    const s1 = src('Demo City Ledger', 'DEMO: Graffiti found on Islamic center wall', 'news', '2026-09-15', 'springfield-graffiti')
    const s2 = src('Demo Police Department', 'DEMO: Statement on vandalism report', 'police', '2026-09-16', 'springfield-police')
    records.push(
      draft({
        title: 'DEMO: Graffiti reported on a fictional Islamic center in Springfield',
        summary:
          'This is a fictional demonstration record: staff at a made-up Islamic center reported graffiti on an outside wall.[1] Police said they had opened an investigation and were reviewing camera footage.[2] No arrest has been reported.[2]',
        dateStart: '2026-09-14',
        stateFips: '17',
        city: 'Springfield',
        lat: 39.7817,
        lng: -89.6501,
        incidentTypes: ['VAND'],
        targetType: 'mosque_islamic_center',
        severity: 2,
        propertyDamage: 'yes',
        biasIndicators: ['symbol', 'target_selection'],
        verificationLevel: 'V3',
        legalStatus: 'under_investigation',
        agenciesInvolved: ['Demo Police Department'],
        editorNotes: `Demo note: called PIO, no update. ${EDITOR_NOTE_CANARY}`,
        sources: [s1, s2],
        legalEvents: [
          { id: randomUUID(), date: '2026-09-14', eventType: 'reported', description: 'Reported to police by center staff.', sourceId: s1.id, caseId: null },
          { id: randomUUID(), date: '2026-09-16', eventType: 'under_investigation', description: 'Police opened an investigation.', sourceId: s2.id, caseId: null },
        ],
      }),
    )
  }
  {
    const s1 = src('Demo Inland Daily', 'DEMO: Man arrested over threats to mosque', 'news', '2026-08-04', 'riverside-arrest')
    const s2 = src('Demo County District Attorney', 'DEMO: Charges filed in threats case', 'prosecutor', '2026-08-06', 'riverside-charges')
    const s3 = src('Demo Superior Court', 'DEMO: Docket DEMO-26-CR-0001', 'court_record', '2026-08-20', 'riverside-docket')
    records.push(
      draft({
        title: 'DEMO: Man charged with hate crime after threatening calls to a fictional mosque in Riverside',
        summary:
          'This fictional record describes threatening phone calls made to a made-up mosque over two days.[1] Prosecutors charged a man with making criminal threats and filed a hate-crime enhancement.[2] He has pleaded not guilty and is presumed innocent.[3]',
        dateStart: '2026-08-01',
        dateEnd: '2026-08-02',
        stateFips: '06',
        city: 'Riverside',
        lat: 33.9533,
        lng: -117.3962,
        incidentTypes: ['THRT'],
        targetType: 'mosque_islamic_center',
        severity: 3,
        perpetratorType: 'individual',
        perpetratorCount: 1,
        perpetratorNames: ['Demo Defendant A'],
        biasIndicators: ['stated_motive', 'hate_crime_charge'],
        verificationLevel: 'V3',
        legalStatus: 'charged',
        hateCrimeCharged: 'yes',
        agenciesInvolved: ['Demo Police Department', 'Demo County District Attorney'],
        caseIds: ['DEMO-CASE-2026-0001'],
        tags: ['phone-threats'],
        editorNotes: `Demo note: watch docket. ${EDITOR_NOTE_CANARY}`,
        sources: [s1, s2, s3],
        legalEvents: [
          { id: randomUUID(), date: '2026-08-02', eventType: 'reported', description: 'The mosque reported the calls to police.', sourceId: s1.id, caseId: null },
          { id: randomUUID(), date: '2026-08-04', eventType: 'arrested', description: 'A suspect was arrested.', sourceId: s1.id, caseId: null },
          { id: randomUUID(), date: '2026-08-06', eventType: 'charged', description: 'Criminal threats charge filed.', sourceId: s2.id, caseId: 'DEMO-CASE-2026-0001' },
          { id: randomUUID(), date: '2026-08-06', eventType: 'hate_crime_charge_filed', description: 'Hate-crime enhancement filed.', sourceId: s2.id, caseId: 'DEMO-CASE-2026-0001' },
          { id: randomUUID(), date: '2026-08-20', eventType: 'arraignment', description: 'Pleaded not guilty.', sourceId: s3.id, caseId: 'DEMO-CASE-2026-0001' },
        ],
        statements: [
          {
            id: randomUUID(),
            speaker: 'Demo Spokesperson',
            speakerRole: 'Spokesperson',
            organization: 'Demo County District Attorney',
            statementType: 'official',
            date: '2026-08-06',
            quote: 'Threats against a house of worship will be prosecuted fully.',
            paraphrase: null,
            sourceId: s2.id,
          },
          {
            id: randomUUID(),
            speaker: 'Demo Defense Counsel',
            speakerRole: 'Defense attorney',
            organization: null,
            statementType: 'defense',
            date: '2026-08-20',
            quote: null,
            paraphrase: 'Said the client denies the allegations and will contest the charges.',
            sourceId: s3.id,
          },
        ],
      }),
    )
  }
  {
    const s1 = src('Demo Middle Tennessee News', 'DEMO: Woman says hijab was pulled at bus stop', 'news', '2026-06-22', 'franklin-assault')
    const s2 = src('Demo Police Department', 'DEMO: Assault investigation update', 'police', '2026-06-24', 'franklin-police')
    records.push(
      draft({
        title: 'DEMO: Woman reports hijab pulled at a fictional bus stop in Franklin',
        summary:
          'In this fictional record, a woman told a local outlet that a stranger pulled her hijab and shoved her at a bus stop.[1] She was treated for minor injuries, the outlet reported.[1] Police said the assault is under investigation.[2]',
        dateStart: '2026-06-21',
        stateFips: '47',
        city: 'Franklin',
        lat: 35.9251,
        lng: -86.8689,
        incidentTypes: ['ASLT'],
        targetType: 'individual',
        targetAttributes: ['woman_wearing_hijab'],
        severity: 4,
        injuries: 1,
        biasIndicators: ['target_selection', 'slur'],
        verificationLevel: 'V2',
        legalStatus: 'under_investigation',
        agenciesInvolved: ['Demo Police Department'],
        sources: [s1, s2],
        legalEvents: [
          { id: randomUUID(), date: '2026-06-21', eventType: 'reported', description: 'Reported to police.', sourceId: s1.id, caseId: null },
          { id: randomUUID(), date: '2026-06-24', eventType: 'under_investigation', description: 'Police confirmed an investigation.', sourceId: s2.id, caseId: null },
        ],
      }),
    )
  }
  {
    const s1 = src('Demo Civil Rights Coalition', 'DEMO: Student reports slurs written on car', 'advocacy_org', '2026-03-10', 'greenville-car')
    records.push(
      draft({
        title: 'DEMO: Slurs reported written on a fictional student’s car in Greenville',
        summary:
          'A made-up advocacy group said a student found anti-Muslim slurs written on her car in a campus lot.[1] The group said the student reported it to campus police.[1] This record is fictional and has a single source.[1]',
        dateStart: '2026-03-09',
        stateFips: '45',
        city: 'Greenville',
        lat: 34.8526,
        lng: -82.394,
        incidentTypes: ['VAND', 'SCHL'],
        targetType: 'vehicle',
        targetAttributes: ['student'],
        severity: 2,
        propertyDamage: 'yes',
        biasIndicators: ['slur'],
        verificationLevel: 'V1',
        legalStatus: 'reported',
        tags: ['campus'],
        sources: [s1],
        legalEvents: [{ id: randomUUID(), date: '2026-03-09', eventType: 'reported', description: 'Reported to campus police, per the group.', sourceId: s1.id, caseId: null }],
      }),
    )
  }
  {
    const s1 = src('Demo Town Council', 'DEMO: Council meeting video and minutes', 'government', '2025-11-19', 'fairview-minutes')
    const s2 = src('Demo North Texas Herald', 'DEMO: Residents object to council member remarks', 'news', '2025-11-20', 'fairview-herald')
    records.push(
      draft({
        title: 'DEMO: Fictional council member directs slurs at residents during a public meeting in Fairview',
        summary:
          'Minutes of a fictional town council meeting record a council member using anti-Muslim slurs toward residents who spoke.[1] Several residents objected at the meeting, the local outlet reported.[2] The council later voted to censure the member.[1]',
        dateStart: '2025-11-18',
        stateFips: '48',
        city: 'Fairview',
        lat: 33.1579,
        lng: -96.6319,
        locationPrecision: 'exact_public_place',
        incidentTypes: ['OFCL'],
        targetType: 'multiple_individuals',
        severity: 1,
        perpetratorType: 'public_official',
        perpetratorCount: 1,
        biasIndicators: ['slur', 'official_finding'],
        verificationLevel: 'V3',
        legalStatus: 'unknown',
        sources: [s1, s2],
        statements: [
          {
            id: randomUUID(),
            speaker: 'Demo Resident',
            speakerRole: 'Resident',
            organization: null,
            statementType: 'community',
            date: '2025-11-18',
            quote: 'We came to talk about zoning and were insulted for our faith.',
            paraphrase: null,
            sourceId: s2.id,
          },
        ],
      }),
    )
  }

  for (const d of records) {
    const { id } = await wf.saveIncident(author, d, 'Demo seed: initial draft', { idPrefix: 'DEMO' })
    await wf.submitForReview(author, id)
    await wf.reviewIncident(
      reviewer,
      id,
      'approved',
      { chkSourcesCited: true, chkAllegationsLabelled: true, chkVictimPrivacy: true, chkLocationPrecision: true, chkTaxonomyCorrect: true },
      'Demo seed review.',
    )
    await wf.publishIncident(senior, id, 'Published.')
    console.log(`Published ${id}`)
  }

  // A V0 submission-style draft that must never appear publicly.
  const v0 = await wf.saveIncident(
    author,
    draft({
      title: `DEMO: ${V0_CANARY} unverified submission awaiting triage`,
      summary: 'Unverified. Not for publication.',
      dateStart: '2026-10-01',
      stateFips: '26',
      city: 'Dearborn',
      incidentTypes: ['HARS'],
      targetType: 'individual',
      severity: 1,
      verificationLevel: 'V0',
      editorNotes: `Private: submitter asked not to be contacted. ${EDITOR_NOTE_CANARY}`,
    }),
    'Demo seed: V0 draft',
    { idPrefix: 'DEMO' },
  )
  console.log(`Created unpublished V0 draft ${v0.id}`)
  console.log('\nDemo accounts (development only):')
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(13)} ${u.email}  password: ${u.password}  TOTP secret: ${u.totp}`)
}

await main()
process.exit(0)

/**
 * Form validation shared by the record editor (client) and server actions.
 * The database enforces the same rules again; this layer gives editors
 * field-level messages before they save.
 */
import { z } from 'zod'
import {
  BIAS_INDICATORS,
  DATE_PRECISIONS,
  INCIDENT_TYPES,
  LEGAL_EVENT_TYPES,
  LEGAL_STATUSES,
  LOCATION_PRECISIONS,
  PERPETRATOR_TYPES,
  SOURCE_TYPES,
  STATEMENT_TYPES,
  TARGET_ATTRIBUTES,
  TARGET_TYPES,
  VERIFICATION_LEVELS,
  YES_NO_UNKNOWN,
  CHARGED_OR_LATER,
  CASE_TYPES,
} from '@/db/enums'
import { stateByFips } from './states'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null))
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Enter a full link starting with https://')

export function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0
}

export const sourceInput = z.object({
  id: z.uuid(),
  url: httpUrl,
  outlet: z.string().trim().min(1, 'Name the outlet or organization.').max(200),
  title: z.string().trim().min(1, 'Give the article or document title.').max(500),
  author: optionalText(200),
  publishedDate: isoDate.nullable(),
  accessedDate: isoDate,
  sourceType: z.enum(SOURCE_TYPES),
  claimAttribution: optionalText(300),
})

export const legalEventInput = z.object({
  id: z.uuid(),
  date: isoDate,
  eventType: z.enum(LEGAL_EVENT_TYPES),
  description: z.string().trim().max(1000),
  sourceId: z.uuid('Choose the source that reports this event.'),
  caseId: z.string().nullable(),
})

export const statementInput = z
  .object({
    id: z.uuid(),
    speaker: z.string().trim().min(1, 'Name who said it.').max(200),
    speakerRole: optionalText(200),
    organization: optionalText(200),
    statementType: z.enum(STATEMENT_TYPES),
    date: isoDate.nullable(),
    quote: optionalText(400).refine((q) => !q || wordCount(q) <= 25, 'Quotes must be 25 words or fewer.'),
    paraphrase: optionalText(1000),
    sourceId: z.uuid('Choose the source of this statement.'),
  })
  .refine((s) => s.quote || s.paraphrase, { message: 'Add a short quote or a paraphrase.', path: ['quote'] })

const recordId = z.string().regex(/^(US|DEMO)-\d{4}-\d{4,}$/, 'Use a record id like US-2026-0412.')

export const incidentDraftInput = z
  .object({
    id: recordId.nullable(),
    title: z.string().trim().min(1, 'Write a factual headline.').max(110, 'Keep the title to 110 characters.'),
    summary: z.string().trim().max(3000),
    dateStart: isoDate,
    dateEnd: isoDate.nullable(),
    datePrecision: z.enum(DATE_PRECISIONS),
    stateFips: z.string().refine((v) => !!stateByFips(v), 'Choose a state or territory.'),
    countyFips: z
      .string()
      .trim()
      .regex(/^\d{5}$/, 'County FIPS codes have 5 digits.')
      .nullable()
      .or(z.literal('').transform(() => null)),
    city: optionalText(100),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    locationPrecision: z.enum(LOCATION_PRECISIONS),
    incidentTypes: z.array(z.enum(INCIDENT_TYPES)).min(1, 'Choose at least one incident type.'),
    targetType: z.enum(TARGET_TYPES),
    targetAttributes: z.array(z.enum(TARGET_ATTRIBUTES)),
    severity: z.number().int().min(1).max(5),
    deaths: z.number().int().min(0).nullable(),
    injuries: z.number().int().min(0).nullable(),
    propertyDamage: z.enum(YES_NO_UNKNOWN),
    perpetratorType: z.enum(PERPETRATOR_TYPES),
    perpetratorCount: z.number().int().min(0).nullable(),
    perpetratorNames: z.array(z.string().trim().min(1).max(120)).max(20),
    biasIndicators: z.array(z.enum(BIAS_INDICATORS)),
    verificationLevel: z.enum(VERIFICATION_LEVELS),
    legalStatus: z.enum(LEGAL_STATUSES).nullable(),
    hateCrimeCharged: z.enum(YES_NO_UNKNOWN),
    agenciesInvolved: z.array(z.string().trim().min(1).max(200)).max(20),
    relatedIncidentIds: z.array(recordId).max(50),
    tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]*$/, 'Tags use lowercase letters, digits and hyphens.')).max(20),
    caseIds: z.array(z.string().trim().min(1)).max(20),
    editorNotes: z.string().max(20000),
    sources: z.array(sourceInput).max(50),
    legalEvents: z.array(legalEventInput).max(100),
    statements: z.array(statementInput).max(50),
  })
  .superRefine((d, ctx) => {
    if (d.dateEnd && d.dateEnd < d.dateStart) {
      ctx.addIssue({ code: 'custom', path: ['dateEnd'], message: 'The end date is before the start date.' })
    }
    if ((d.lat === null) !== (d.lng === null)) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Enter both latitude and longitude, or neither.' })
    }
    if (d.locationPrecision !== 'state' && !d.city) {
      ctx.addIssue({ code: 'custom', path: ['city'], message: 'Enter the city, or set location precision to state.' })
    }
    if (d.targetType === 'home' && d.locationPrecision === 'exact_public_place') {
      ctx.addIssue({ code: 'custom', path: ['locationPrecision'], message: 'Never place a private home at an exact location.' })
    }
    if (d.perpetratorNames.length && !(d.legalStatus && CHARGED_OR_LATER.includes(d.legalStatus))) {
      ctx.addIssue({
        code: 'custom',
        path: ['perpetratorNames'],
        message: 'Name a person only after they are charged and named by authorities or in court records.',
      })
    }
    if (d.severity === 5 && d.deaths === 0) {
      ctx.addIssue({ code: 'custom', path: ['deaths'], message: 'Severity 5 means at least one death.' })
    }
    const sourceIds = new Set(d.sources.map((s) => s.id))
    d.legalEvents.forEach((e, i) => {
      if (!sourceIds.has(e.sourceId)) ctx.addIssue({ code: 'custom', path: ['legalEvents', i, 'sourceId'], message: 'Choose one of this record’s sources.' })
    })
    d.statements.forEach((s, i) => {
      if (!sourceIds.has(s.sourceId)) ctx.addIssue({ code: 'custom', path: ['statements', i, 'sourceId'], message: 'Choose one of this record’s sources.' })
    })
  })

export type IncidentDraftInput = z.infer<typeof incidentDraftInput>
export type SourceInput = z.infer<typeof sourceInput>
export type LegalEventInput = z.infer<typeof legalEventInput>
export type StatementInput = z.infer<typeof statementInput>

export const caseInput = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(1).max(300),
  court: optionalText(300),
  jurisdiction: optionalText(200),
  docketNumber: optionalText(120),
  caseType: z.enum(CASE_TYPES),
  parties: z.array(z.string().trim().min(1).max(300)).max(30),
  stage: optionalText(120),
  nextDate: isoDate.nullable(),
  courtlistenerUrl: httpUrl.nullable(),
})
export type CaseInput = z.infer<typeof caseInput>

/** Flatten Zod issues to { "sources.0.url": "message" } for form display. */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    out[key] ??= issue.message
  }
  return out
}

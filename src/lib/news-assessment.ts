/**
 * What the morning news scan asks the model to return for each article, as a
 * Zod schema (sent as a structured-output format, so the reply always parses)
 * and the shape stored with the article for editors to check.
 */
import { z } from 'zod'
import { BIAS_INDICATORS, DATE_PRECISIONS, INCIDENT_TYPES, LEGAL_STATUSES, TARGET_TYPES, YES_NO_UNKNOWN } from '@/db/enums'
import { US_STATES } from './states'

export const RELEVANCES = ['new_incident', 'case_update', 'not_relevant'] as const
export type Relevance = (typeof RELEVANCES)[number]
export const RELEVANCE_LABELS: Record<Relevance, string> = {
  new_incident: 'Possible new incident',
  case_update: 'Update on a known case',
  not_relevant: 'Not relevant',
}

export const CONFIDENCES = ['high', 'medium', 'low'] as const
export type Confidence = (typeof CONFIDENCES)[number]

const stateCodes = US_STATES.map((s) => s.code) as [string, ...string[]]

export const NewsAssessmentSchema = z.object({
  relevance: z
    .enum(RELEVANCES)
    .describe('new_incident: reports an incident that meets the criteria. case_update: a new development (arrest, charge, plea, verdict, sentence) in one. not_relevant: anything else.'),
  confidence: z.enum(CONFIDENCES).describe('How sure you are of the relevance, from what the article states.'),
  reason: z.string().describe('One or two plain sentences for the editors: which criterion is met or missed, citing the article.'),
  incident_date: z.string().nullable().describe('When the incident happened (not when the article was published), as YYYY-MM-DD; null if the article does not say.'),
  date_precision: z.enum(DATE_PRECISIONS).nullable().describe('day, month (use the 1st) or year (use January 1); null with no date.'),
  city: z.string().nullable().describe('City or town where it happened, as written; null if not stated.'),
  state_code: z.enum(stateCodes).nullable().describe('Two-letter USPS code of the state or territory; null if not stated or outside the US.'),
  incident_types: z.array(z.enum(INCIDENT_TYPES)).describe('Every incident type the article describes, by code; empty if not relevant.'),
  target_type: z.enum(TARGET_TYPES).nullable(),
  bias_indicators: z.array(z.enum(BIAS_INDICATORS)).describe('Anti-Muslim elements the article itself reports.'),
  legal_status: z.enum(LEGAL_STATUSES).nullable().describe('The furthest legal step the article reports; null if none.'),
  hate_crime_charged: z.enum(YES_NO_UNKNOWN),
  summary: z
    .string()
    .describe('A neutral one- or two-sentence summary. Say "alleged" for anyone not convicted. Do not name victims, witnesses or uncharged people.'),
})

export type NewsAssessment = z.infer<typeof NewsAssessmentSchema>

/** What is stored with an article once read. */
export type StoredAssessment = NewsAssessment & {
  /** Records in the same place within a week of the reported date: possible duplicates. */
  possible_duplicates: string[]
}

export type NewsUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

/**
 * The data model (Section 3), defined once.
 *
 *   - `npm run db:generate` diffs this file into SQL migrations (drizzle/).
 *   - TypeScript types are inferred from these tables ($inferSelect).
 *   - The public data dictionary is generated from `publicIncidents` and
 *     `PUBLIC_FIELD_DOCS` below (src/lib/dictionary.ts). The docs object is
 *     typed against the view's columns, so a column without documentation is
 *     a compile error.
 *
 * Two Postgres schemas:
 *   record         internal working data. Never readable by the public role.
 *   record_public  read-only views for the public site, API and downloads.
 *
 * Rules that must hold no matter which code path writes (two-person review,
 * publish preconditions, immutable audit log, change logging) live in SQL:
 * drizzle/0002_rules.sql.
 */
import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  customType,
  date,
  doublePrecision,
  geometry,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import * as E from './enums'
import type { NewsUsage, StoredAssessment } from '@/lib/news-assessment'

export const recordSchema = pgSchema('record')
export const recordPublicSchema = pgSchema('record_public')

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const incidentTypeEnum = recordSchema.enum('incident_type', E.INCIDENT_TYPES)
export const targetTypeEnum = recordSchema.enum('target_type', E.TARGET_TYPES)
export const targetAttributeEnum = recordSchema.enum('target_attribute', E.TARGET_ATTRIBUTES)
export const perpetratorTypeEnum = recordSchema.enum('perpetrator_type', E.PERPETRATOR_TYPES)
export const biasIndicatorEnum = recordSchema.enum('bias_indicator', E.BIAS_INDICATORS)
export const verificationLevelEnum = recordSchema.enum('verification_level', E.VERIFICATION_LEVELS)
export const legalStatusEnum = recordSchema.enum('legal_status', E.LEGAL_STATUSES)
export const legalEventTypeEnum = recordSchema.enum('legal_event_type', E.LEGAL_EVENT_TYPES)
export const yesNoUnknownEnum = recordSchema.enum('yes_no_unknown', E.YES_NO_UNKNOWN)
export const datePrecisionEnum = recordSchema.enum('temporal_precision', E.DATE_PRECISIONS)
export const locationPrecisionEnum = recordSchema.enum('location_precision', E.LOCATION_PRECISIONS)
export const sourceTypeEnum = recordSchema.enum('source_type', E.SOURCE_TYPES)
export const caseTypeEnum = recordSchema.enum('case_type', E.CASE_TYPES)
export const statementTypeEnum = recordSchema.enum('statement_type', E.STATEMENT_TYPES)
export const workflowStatusEnum = recordSchema.enum('workflow_status', E.WORKFLOW_STATUSES)
export const userRoleEnum = recordSchema.enum('user_role', E.USER_ROLES)
export const reviewDecisionEnum = recordSchema.enum('review_decision', E.REVIEW_DECISIONS)
export const publicationActionEnum = recordSchema.enum('publication_action', E.PUBLICATION_ACTIONS)
export const leadSourceEnum = recordSchema.enum('lead_source', E.LEAD_SOURCES)
export const leadStatusEnum = recordSchema.enum('lead_status', E.LEAD_STATUSES)
export const submissionKindEnum = recordSchema.enum('submission_kind', E.SUBMISSION_KINDS)
export const reporterRelationEnum = recordSchema.enum('reporter_relation', E.REPORTER_RELATIONS)
export const correctionStatusEnum = recordSchema.enum('correction_status', E.CORRECTION_STATUSES)
export const archiveStatusEnum = recordSchema.enum('archive_status', E.ARCHIVE_STATUSES)

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const emptyArray = sql`'{}'`

// ---------------------------------------------------------------------------
// JSON shapes stored in published snapshots (snake_case: they are part of the
// public dataset).
// ---------------------------------------------------------------------------
export type PublicSource = {
  n: number
  outlet: string
  title: string
  author: string | null
  url: string
  archived_url: string | null
  published_date: string | null
  accessed_date: string
  source_type: E.SourceType
  claim_attribution: string | null
}
export type PublicLegalEvent = {
  date: string
  event_type: E.LegalEventType
  description: string
  case_id: string | null
  source_n: number | null
}
export type PublicStatement = {
  speaker: string
  speaker_role: string | null
  organization: string | null
  statement_type: E.StatementType
  date: string | null
  quote: string | null
  paraphrase: string | null
  source_n: number | null
}
export type PublicCase = {
  id: string
  name: string
  court: string | null
  jurisdiction: string | null
  docket_number: string | null
  case_type: E.CaseType
  parties: string[]
  stage: string | null
  next_date: string | null
  courtlistener_url: string | null
}
export type PublicChange = {
  date: string
  action: E.PublicationAction
  note: string
  changed_fields: string[]
  revision: number
}

/**
 * Incident fields shared by the working copy, the published snapshot and the
 * public view. A function so each table gets fresh column builders.
 */
const incidentFields = () => ({
  slug: text('slug').notNull(),
  title: varchar('title', { length: 110 }).notNull(),
  summary: text('summary').notNull().default(''),
  dateStart: date('date_start', { mode: 'string' }).notNull(),
  dateEnd: date('date_end', { mode: 'string' }),
  datePrecision: datePrecisionEnum('date_precision').notNull().default('day'),
  stateFips: char('state_fips', { length: 2 }).notNull(),
  countyFips: char('county_fips', { length: 5 }),
  city: text('city'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  mapLat: doublePrecision('map_lat'),
  mapLng: doublePrecision('map_lng'),
  locationPrecision: locationPrecisionEnum('location_precision').notNull().default('city'),
  incidentTypes: incidentTypeEnum('incident_types').array().notNull(),
  targetType: targetTypeEnum('target_type').notNull(),
  targetAttributes: targetAttributeEnum('target_attributes').array().notNull().default(emptyArray),
  severity: smallint('severity').notNull(),
  deaths: integer('deaths'),
  injuries: integer('injuries'),
  propertyDamage: yesNoUnknownEnum('property_damage').notNull().default('unknown'),
  perpetratorType: perpetratorTypeEnum('perpetrator_type').notNull().default('unknown'),
  perpetratorCount: integer('perpetrator_count'),
  perpetratorNames: text('perpetrator_names').array().notNull().default(emptyArray),
  biasIndicators: biasIndicatorEnum('bias_indicators').array().notNull().default(emptyArray),
  hateCrimeCharged: yesNoUnknownEnum('hate_crime_charged').notNull().default('unknown'),
  agenciesInvolved: text('agencies_involved').array().notNull().default(emptyArray),
  relatedIncidentIds: text('related_incident_ids').array().notNull().default(emptyArray),
  tags: text('tags').array().notNull().default(emptyArray),
})

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
export const usStates = recordSchema.table('us_states', {
  fips: char('fips', { length: 2 }).primaryKey(),
  code: char('code', { length: 2 }).notNull().unique(),
  name: text('name').notNull(),
  territory: boolean('territory').notNull().default(false),
})

/** Per-year counters for human-readable ids (US-2026-0412). */
export const idCounters = recordSchema.table('id_counters', {
  scope: text('scope').primaryKey(),
  next: integer('next').notNull(),
})

// ---------------------------------------------------------------------------
// People and sessions (admin only)
// ---------------------------------------------------------------------------
export const users = recordSchema.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    role: userRoleEnum('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    totpSecretEnc: text('totp_secret_enc'),
    totpPendingSecretEnc: text('totp_pending_secret_enc'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    totpLastStep: bigint('totp_last_step', { mode: 'number' }),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`)],
)

export const sessions = recordSchema.table(
  'sessions',
  {
    /** SHA-256 of the cookie token. The token itself is never stored. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    mfaVerifiedAt: timestamp('mfa_verified_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------
export const submissions = recordSchema.table(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: submissionKindEnum('kind').notNull(),
    whatHappened: text('what_happened').notNull(),
    incidentDate: date('incident_date', { mode: 'string' }),
    city: text('city'),
    stateFips: char('state_fips', { length: 2 }).references(() => usStates.fips),
    links: text('links').array().notNull().default(emptyArray),
    reporterRelation: reporterRelationEnum('reporter_relation'),
    correctionRecordId: text('correction_record_id'),
    isPrivacyRequest: boolean('is_privacy_request').notNull().default(false),
    keepConsent: boolean('keep_consent').notNull().default(false),
    hasContact: boolean('has_contact').notNull().default(false),
    fileCount: integer('file_count').notNull().default(0),
    createdAt: createdAt(),
    /** When the lead or ticket was closed; starts the retention clock. */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** When contact details and files were deleted under the retention rule. */
    purgedAt: timestamp('purged_at', { withTimezone: true }),
  },
  (t) => [
    check('submissions_city_required', sql`${t.kind} = 'correction' OR ${t.city} IS NOT NULL`),
    check(
      'submissions_correction_record',
      sql`${t.kind} = 'report' OR ${t.correctionRecordId} IS NOT NULL`,
    ),
  ],
)

/** Encrypted submitter contact details and exact address. Kept apart from incident data. */
export const submissionPrivate = recordSchema.table('submission_private', {
  submissionId: uuid('submission_id')
    .primaryKey()
    .references(() => submissions.id, { onDelete: 'cascade' }),
  contactEnc: text('contact_enc'),
  addressEnc: text('address_enc'),
  createdAt: createdAt(),
})

export const submissionFiles = recordSchema.table('submission_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id')
    .notNull()
    .references(() => submissions.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  originalNameEnc: text('original_name_enc'),
  metadataStripped: boolean('metadata_stripped').notNull(),
  createdAt: createdAt(),
})

export const leads = recordSchema.table(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: leadSourceEnum('source').notNull(),
    status: leadStatusEnum('status').notNull().default('new'),
    headline: text('headline').notNull(),
    url: text('url'),
    outlet: text('outlet'),
    publishedDate: date('published_date', { mode: 'string' }),
    matchedTerms: text('matched_terms').array().notNull().default(emptyArray),
    submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'set null' }),
    incidentId: text('incident_id'),
    triageReason: text('triage_reason'),
    triagedBy: uuid('triaged_by').references(() => users.id),
    triagedAt: timestamp('triaged_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('leads_status_idx').on(t.status, t.createdAt),
    check(
      'leads_out_of_scope_reason',
      sql`${t.status} <> 'out_of_scope' OR coalesce(trim(${t.triageReason}), '') <> ''`,
    ),
  ],
)

export const newsCandidateStatusEnum = recordSchema.enum('news_candidate_status', E.NEWS_CANDIDATE_STATUSES)

/**
 * Articles the morning news scan found (src/server/jobs/news). Private, like
 * leads. One row per article address, so each is read once; skipped articles
 * stay, with the model's reason, for editors to check its judgment.
 */
export const newsCandidates = recordSchema.table(
  'news_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull(),
    headline: text('headline').notNull(),
    outlet: text('outlet'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    feed: text('feed').notNull(),
    leadSource: leadSourceEnum('lead_source').notNull(),
    matchedTerms: text('matched_terms').array().notNull().default(emptyArray),
    snippet: text('snippet'),
    status: newsCandidateStatusEnum('status').notNull().default('pending'),
    assessment: jsonb('assessment').$type<StoredAssessment>(),
    model: text('model'),
    usage: jsonb('usage').$type<NewsUsage>(),
    attempts: integer('attempts').notNull().default(0),
    /** Why it was skipped without a model, or why reading it failed. */
    note: text('note'),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    assessedAt: timestamp('assessed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('news_candidates_url_key').on(t.url), index('news_candidates_status_idx').on(t.status, t.createdAt)],
)

// ---------------------------------------------------------------------------
// Incidents: the working copy editors draft and review
// ---------------------------------------------------------------------------
export const incidents = recordSchema.table(
  'incidents',
  {
    id: text('id').primaryKey(),
    ...incidentFields(),
    verificationLevel: verificationLevelEnum('verification_level').notNull().default('V0'),
    /** Must be set explicitly before publishing. */
    legalStatus: legalStatusEnum('legal_status'),
    /** Private. Never copied to published snapshots, views, exports or the API. */
    editorNotes: text('editor_notes').notNull().default(''),
    workflowStatus: workflowStatusEnum('workflow_status').notNull().default('draft'),
    exclusionReason: text('exclusion_reason'),
    revision: integer('revision').notNull().default(1),
    revisionTxid: bigint('revision_txid', { mode: 'number' }),
    isDemo: boolean('is_demo').notNull().default(false),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    firstPublishedAt: timestamp('first_published_at', { withTimezone: true }),
    nextReviewDue: date('next_review_due', { mode: 'string' }),
    geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).generatedAlwaysAs(
      sql`CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326) END`,
    ),
  },
  (t) => [
    check('incidents_id_format', sql`${t.id} ~ '^(US|DEMO)-[0-9]{4}-[0-9]{4,}$'`),
    check('incidents_demo_flag', sql`${t.isDemo} = (${t.id} LIKE 'DEMO-%')`),
    check('incidents_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 110`),
    check('incidents_dates', sql`${t.dateEnd} IS NULL OR ${t.dateEnd} >= ${t.dateStart}`),
    check('incidents_severity', sql`${t.severity} BETWEEN 1 AND 5`),
    check('incidents_types_nonempty', sql`cardinality(${t.incidentTypes}) >= 1`),
    check('incidents_counts', sql`coalesce(${t.deaths}, 0) >= 0 AND coalesce(${t.injuries}, 0) >= 0 AND coalesce(${t.perpetratorCount}, 0) >= 0`),
    check('incidents_lat', sql`${t.lat} IS NULL OR ${t.lat} BETWEEN -90 AND 90`),
    check('incidents_lng', sql`${t.lng} IS NULL OR ${t.lng} BETWEEN -180 AND 180`),
    check('incidents_county_fips', sql`${t.countyFips} IS NULL OR ${t.countyFips} ~ '^[0-9]{5}$'`),
    check('incidents_excluded_reason', sql`${t.workflowStatus} <> 'excluded' OR coalesce(trim(${t.exclusionReason}), '') <> ''`),
    index('incidents_status_idx').on(t.workflowStatus),
    index('incidents_date_idx').on(t.dateStart),
    index('incidents_geom_idx').using('gist', t.geom),
    index('incidents_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
  ],
)

export const cases = recordSchema.table(
  'cases',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    court: text('court'),
    jurisdiction: text('jurisdiction'),
    docketNumber: text('docket_number'),
    caseType: caseTypeEnum('case_type').notNull(),
    parties: text('parties').array().notNull().default(emptyArray),
    stage: text('stage'),
    nextDate: date('next_date', { mode: 'string' }),
    courtlistenerUrl: text('courtlistener_url'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('cases_id_format', sql`${t.id} ~ '^(CASE|DEMO-CASE)-[0-9]{4}-[0-9]{4,}$'`)],
)

export const incidentCases = recordSchema.table(
  'incident_cases',
  {
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.incidentId, t.caseId] })],
)

export const sources = recordSchema.table(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    url: text('url').notNull(),
    archivedUrl: text('archived_url'),
    archiveStatus: archiveStatusEnum('archive_status').notNull().default('pending'),
    archiveAttempts: integer('archive_attempts').notNull().default(0),
    archiveJobId: text('archive_job_id'),
    archiveLastError: text('archive_last_error'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    outlet: text('outlet').notNull(),
    title: text('title').notNull(),
    author: text('author'),
    publishedDate: date('published_date', { mode: 'string' }),
    accessedDate: date('accessed_date', { mode: 'string' }).notNull().default(sql`CURRENT_DATE`),
    sourceType: sourceTypeEnum('source_type').notNull(),
    claimAttribution: text('claim_attribution'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('sources_incident_idx').on(t.incidentId, t.position),
    index('sources_archive_idx').on(t.archiveStatus, t.createdAt),
    check('sources_url_scheme', sql`${t.url} ~* '^https?://'`),
  ],
)

export const legalEvents = recordSchema.table(
  'legal_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    caseId: text('case_id').references(() => cases.id, { onDelete: 'set null' }),
    date: date('date', { mode: 'string' }).notNull(),
    eventType: legalEventTypeEnum('event_type').notNull(),
    description: text('description').notNull().default(''),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [index('legal_events_incident_idx').on(t.incidentId, t.date)],
)

export const statements = recordSchema.table(
  'statements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    speaker: text('speaker').notNull(),
    speakerRole: text('speaker_role'),
    organization: text('organization'),
    statementType: statementTypeEnum('statement_type').notNull(),
    date: date('date', { mode: 'string' }),
    quote: text('quote'),
    paraphrase: text('paraphrase'),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('statements_incident_idx').on(t.incidentId),
    check('statements_has_text', sql`${t.quote} IS NOT NULL OR ${t.paraphrase} IS NOT NULL`),
    check(
      'statements_quote_25_words',
      sql`${t.quote} IS NULL OR cardinality(regexp_split_to_array(btrim(${t.quote}), '\\s+')) <= 25`,
    ),
  ],
)

// ---------------------------------------------------------------------------
// Review, change tracking, publication
// ---------------------------------------------------------------------------
export const reviews = recordSchema.table(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id),
    /** Set by trigger to the incident's revision at review time. */
    revision: integer('revision').notNull(),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id),
    decision: reviewDecisionEnum('decision').notNull(),
    comments: text('comments').notNull().default(''),
    chkSourcesCited: boolean('chk_sources_cited').notNull().default(false),
    chkAllegationsLabelled: boolean('chk_allegations_labelled').notNull().default(false),
    chkVictimPrivacy: boolean('chk_victim_privacy').notNull().default(false),
    chkLocationPrecision: boolean('chk_location_precision').notNull().default(false),
    chkTaxonomyCorrect: boolean('chk_taxonomy_correct').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('reviews_incident_idx').on(t.incidentId, t.revision),
    check(
      'reviews_checklist_complete',
      sql`${t.decision} <> 'approved' OR (${t.chkSourcesCited} AND ${t.chkAllegationsLabelled} AND ${t.chkVictimPrivacy} AND ${t.chkLocationPrecision} AND ${t.chkTaxonomyCorrect})`,
    ),
    check('reviews_return_comments', sql`${t.decision} <> 'returned' OR btrim(${t.comments}) <> ''`),
  ],
)

/** Who edited which revision. Written by trigger; used to stop editors reviewing their own changes. */
export const incidentEdits = recordSchema.table(
  'incident_edits',
  {
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    firstAt: timestamp('first_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.incidentId, t.revision, t.actorId] })],
)

/** Field-level change log. Written only by triggers; internal (who, field, old, new, reason). */
export const changeLog = recordSchema.table(
  'change_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id),
    revision: integer('revision').notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    field: text('field').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    reason: text('reason').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index('change_log_incident_idx').on(t.incidentId, t.id)],
)

/** Every publish, update and takedown. Its rows form the public change log. */
export const publications = recordSchema.table(
  'publications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id),
    revision: integer('revision').notNull(),
    action: publicationActionEnum('action').notNull(),
    publicNote: text('public_note').notNull(),
    changedFields: text('changed_fields').array().notNull().default(emptyArray),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    reviewId: uuid('review_id').references(() => reviews.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('publications_incident_idx').on(t.incidentId, t.id),
    check('publications_note', sql`btrim(${t.publicNote}) <> ''`),
  ],
)

/**
 * The published snapshot: what the public sees. Written only by
 * record.publish_incident(); a trigger re-checks every publish precondition on
 * each insert or update.
 */
export const publishedIncidents = recordSchema.table(
  'published_incidents',
  {
    id: text('id')
      .primaryKey()
      .references(() => incidents.id),
    revision: integer('revision').notNull(),
    ...incidentFields(),
    stateCode: char('state_code', { length: 2 }).notNull(),
    verificationLevel: verificationLevelEnum('verification_level').notNull(),
    legalStatus: legalStatusEnum('legal_status').notNull(),
    caseIds: text('case_ids').array().notNull().default(emptyArray),
    sourceTypes: sourceTypeEnum('source_types').array().notNull(),
    sourceCount: integer('source_count').notNull(),
    sources: jsonb('sources').$type<PublicSource[]>().notNull(),
    legalEvents: jsonb('legal_events').$type<PublicLegalEvent[]>().notNull(),
    statements: jsonb('statements').$type<PublicStatement[]>().notNull(),
    cases: jsonb('cases').$type<PublicCase[]>().notNull(),
    methodologyVersion: text('methodology_version').notNull(),
    isDemo: boolean('is_demo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    approvedReviewId: uuid('approved_review_id')
      .notNull()
      .references(() => reviews.id),
    publishedBy: uuid('published_by')
      .notNull()
      .references(() => users.id),
    searchText: text('search_text').notNull(),
    searchDocument: tsvector('search_document').generatedAlwaysAs(
      sql`to_tsvector('english'::regconfig, search_text)`,
    ),
    geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).generatedAlwaysAs(
      sql`CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326) END`,
    ),
  },
  (t) => [
    check('published_not_v0', sql`${t.verificationLevel} <> 'V0'`),
    check('published_has_sources', sql`${t.sourceCount} >= 1`),
    index('published_date_idx').on(t.dateStart, t.id),
    index('published_state_idx').on(t.stateCode),
    index('published_search_idx').using('gin', t.searchDocument),
    index('published_search_trgm_idx').using('gin', sql`${t.searchText} gin_trgm_ops`),
    index('published_types_idx').using('gin', t.incidentTypes),
    index('published_geom_idx').using('gist', t.geom),
  ],
)

// ---------------------------------------------------------------------------
// Corrections, audit, operations
// ---------------------------------------------------------------------------
export const correctionTickets = recordSchema.table(
  'correction_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: text('record_id').notNull(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id),
    status: correctionStatusEnum('status').notNull().default('open'),
    isPrivacyRequest: boolean('is_privacy_request').notNull().default(false),
    responseDueAt: timestamp('response_due_at', { withTimezone: true }).notNull(),
    fixDueAt: timestamp('fix_due_at', { withTimezone: true }).notNull(),
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    assignedTo: uuid('assigned_to').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('corrections_status_idx').on(t.status, t.responseDueAt)],
)

/** Every action by every user. Append-only: UPDATE, DELETE and TRUNCATE raise. */
export const auditLog = recordSchema.table(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: jsonb('details').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index('audit_log_at_idx').on(t.at), index('audit_log_entity_idx').on(t.entityType, t.entityId)],
)

/** Fixed-window counters. Keys are HMACs of IP addresses, never raw IPs. */
export const rateLimits = recordSchema.table(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
)

/** Nightly dataset releases (record-v2026.10.26.csv / .json). */
export const datasetReleases = recordSchema.table('dataset_releases', {
  id: serial('id').primaryKey(),
  version: text('version').notNull().unique(),
  createdAt: createdAt(),
  methodologyVersion: text('methodology_version').notNull(),
  recordCount: integer('record_count').notNull(),
  csv: text('csv').notNull(),
  json: text('json').notNull(),
  csvSha256: char('csv_sha256', { length: 64 }).notNull(),
  jsonSha256: char('json_sha256', { length: 64 }).notNull(),
  previousVersion: text('previous_version'),
  changelog: jsonb('changelog')
    .$type<{ added: string[]; removed: string[]; updated: string[] }>()
    .notNull(),
})

// ---------------------------------------------------------------------------
// Public views (record_public). Defined in SQL (drizzle/0002_rules.sql) and
// declared here so queries are typed and the dictionary is generated from
// them. tests/db/public-access.test.ts checks these declarations match the
// database exactly.
// ---------------------------------------------------------------------------
export const publicIncidents = recordPublicSchema
  .view('incidents', {
    id: text('id').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    dateStart: date('date_start', { mode: 'string' }).notNull(),
    dateEnd: date('date_end', { mode: 'string' }),
    datePrecision: text('date_precision').$type<E.DatePrecision>().notNull(),
    stateFips: char('state_fips', { length: 2 }).notNull(),
    stateCode: char('state_code', { length: 2 }).notNull(),
    countyFips: char('county_fips', { length: 5 }),
    city: text('city'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    mapLat: doublePrecision('map_lat'),
    mapLng: doublePrecision('map_lng'),
    locationPrecision: text('location_precision').$type<E.LocationPrecision>().notNull(),
    incidentTypes: text('incident_types').array().$type<E.IncidentType[]>().notNull(),
    targetType: text('target_type').$type<E.TargetType>().notNull(),
    targetAttributes: text('target_attributes').array().$type<E.TargetAttribute[]>().notNull(),
    severity: smallint('severity').$type<E.Severity>().notNull(),
    deaths: integer('deaths'),
    injuries: integer('injuries'),
    propertyDamage: text('property_damage').$type<E.YesNoUnknown>().notNull(),
    perpetratorType: text('perpetrator_type').$type<E.PerpetratorType>().notNull(),
    perpetratorCount: integer('perpetrator_count'),
    perpetratorNames: text('perpetrator_names').array().notNull(),
    biasIndicators: text('bias_indicators').array().$type<E.BiasIndicator[]>().notNull(),
    verificationLevel: text('verification_level').$type<E.PublicVerificationLevel>().notNull(),
    legalStatus: text('legal_status').$type<E.LegalStatus>().notNull(),
    hateCrimeCharged: text('hate_crime_charged').$type<E.YesNoUnknown>().notNull(),
    agenciesInvolved: text('agencies_involved').array().notNull(),
    caseIds: text('case_ids').array().notNull(),
    relatedIncidentIds: text('related_incident_ids').array().notNull(),
    tags: text('tags').array().notNull(),
    sourceTypes: text('source_types').array().$type<E.SourceType[]>().notNull(),
    sourceCount: integer('source_count').notNull(),
    sources: jsonb('sources').$type<PublicSource[]>().notNull(),
    legalEvents: jsonb('legal_events').$type<PublicLegalEvent[]>().notNull(),
    statements: jsonb('statements').$type<PublicStatement[]>().notNull(),
    cases: jsonb('cases').$type<PublicCase[]>().notNull(),
    changeLog: jsonb('change_log').$type<PublicChange[]>().notNull(),
    methodologyVersion: text('methodology_version').notNull(),
    isDemo: boolean('is_demo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
    searchText: text('search_text').notNull(),
    searchDocument: tsvector('search_document').notNull(),
  })
  .existing()

/** Release metadata. File contents are in record_public.dataset_files. */
export const publicDatasetReleases = recordPublicSchema
  .view('dataset_releases', {
    version: text('version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    methodologyVersion: text('methodology_version').notNull(),
    recordCount: integer('record_count').notNull(),
    csvSha256: char('csv_sha256', { length: 64 }).notNull(),
    jsonSha256: char('json_sha256', { length: 64 }).notNull(),
    csvBytes: integer('csv_bytes').notNull(),
    jsonBytes: integer('json_bytes').notNull(),
    previousVersion: text('previous_version'),
    changelog: jsonb('changelog').$type<{ added: string[]; removed: string[]; updated: string[] }>().notNull(),
  })
  .existing()

export const publicDatasetFiles = recordPublicSchema
  .view('dataset_files', {
    version: text('version').notNull(),
    csv: text('csv').notNull(),
    json: text('json').notNull(),
    csvSha256: char('csv_sha256', { length: 64 }).notNull(),
    jsonSha256: char('json_sha256', { length: 64 }).notNull(),
  })
  .existing()

export type PublicIncident = typeof publicIncidents.$inferSelect
export type Incident = typeof incidents.$inferSelect
export type User = typeof users.$inferSelect
export type Source = typeof sources.$inferSelect
export type LegalEvent = typeof legalEvents.$inferSelect
export type Statement = typeof statements.$inferSelect
export type Case = typeof cases.$inferSelect

// ---------------------------------------------------------------------------
// Public data dictionary. Typed against the public view, so adding a column
// to the view without documenting it fails the type check.
// ---------------------------------------------------------------------------
export type FieldDoc = {
  /** Human type shown in the dictionary. */
  type: string
  description: string
  /** Allowed values, when the column is an enum. */
  allowed?: readonly (string | number)[]
  /** JSON arrays: the keys of each entry, and the allowed values of the coded ones. */
  keys?: readonly string[]
  keyValues?: Readonly<Record<string, readonly string[]>>
  /** Included in CSV/JSON downloads and the API. Search columns are not. */
  exported: boolean
  nullable?: boolean
}

const allowed = <T extends readonly (string | number)[]>(values: T) => values
/** The keys of a JSON entry, checked against its type. */
const keysOf = <T>(keys: readonly (keyof T & string)[]) => keys

export const PUBLIC_FIELD_DOCS: Record<keyof PublicIncident, FieldDoc> = {
  id: { type: 'string', description: 'Stable, human-readable record id, e.g. `US-2026-0412`. Never reused.', exported: true },
  slug: { type: 'string', description: 'URL slug derived from the title. May change if the title changes; the id does not.', exported: true },
  title: { type: 'string (≤ 110 chars)', description: 'Factual headline.', exported: true },
  summary: {
    type: 'text',
    description: '2–4 neutral sentences. Markers like [1] refer to the numbered entries in `sources`.',
    exported: true,
  },
  dateStart: { type: 'date (YYYY-MM-DD)', description: 'Date the incident happened, or began.', exported: true },
  dateEnd: { type: 'date (YYYY-MM-DD)', description: 'Last day, for multi-day events only.', exported: true, nullable: true },
  datePrecision: {
    type: 'enum',
    description: 'How precisely the date is known. For month precision the day is shown as 01; for year, 01-01.',
    allowed: allowed(E.DATE_PRECISIONS),
    exported: true,
  },
  stateFips: { type: 'string (2-digit FIPS)', description: 'State or territory FIPS code.', exported: true },
  stateCode: { type: 'string (USPS)', description: 'Two-letter postal code for the state or territory.', exported: true },
  countyFips: { type: 'string (5-digit FIPS)', description: 'County FIPS code, when known.', exported: true, nullable: true },
  city: { type: 'string', description: 'City or town. Empty when only the state is known.', exported: true, nullable: true },
  lat: {
    type: 'number',
    description: 'Latitude at the stated location precision. City-level records use the city centroid.',
    exported: true,
    nullable: true,
  },
  lng: { type: 'number', description: 'Longitude at the stated location precision.', exported: true, nullable: true },
  mapLat: {
    type: 'number',
    description: 'Latitude used on the map. For city, neighborhood and state precision this includes a small random offset, stored once, so markers do not stack. Positions are approximate.',
    exported: true,
    nullable: true,
  },
  mapLng: { type: 'number', description: 'Longitude used on the map (see `map_lat`).', exported: true, nullable: true },
  locationPrecision: {
    type: 'enum',
    description: 'How precisely the location is shown. Private homes are never shown more precisely than the neighborhood.',
    allowed: allowed(E.LOCATION_PRECISIONS),
    exported: true,
  },
  incidentTypes: { type: 'enum[]', description: 'One or more taxonomy codes. See /methodology#taxonomy.', allowed: allowed(E.INCIDENT_TYPES), exported: true },
  targetType: { type: 'enum', description: 'What was targeted.', allowed: allowed(E.TARGET_TYPES), exported: true },
  targetAttributes: {
    type: 'enum[]',
    description: 'Attributes of the target, only when a source states them.',
    allowed: allowed(E.TARGET_ATTRIBUTES),
    exported: true,
  },
  severity: {
    type: 'integer 1–5',
    description: '1 verbal or written, 2 property, 3 physical threat or attempt, 4 injury, 5 death.',
    allowed: allowed(E.SEVERITIES),
    exported: true,
  },
  deaths: { type: 'integer', description: 'Deaths. Empty when unknown; never zero by default.', exported: true, nullable: true },
  injuries: { type: 'integer', description: 'Injuries. Empty when unknown; never zero by default.', exported: true, nullable: true },
  propertyDamage: {
    type: 'enum',
    description: 'Whether a source reports property damage.',
    allowed: allowed(E.YES_NO_UNKNOWN),
    exported: true,
  },
  perpetratorType: { type: 'enum', description: 'Who is alleged or found to be responsible.', allowed: allowed(E.PERPETRATOR_TYPES), exported: true },
  perpetratorCount: { type: 'integer', description: 'Number of perpetrators, when a source states it.', exported: true, nullable: true },
  perpetratorNames: {
    type: 'string[]',
    description: 'Names of people charged and named by authorities or in public court records. Empty otherwise. Anyone not convicted is alleged.',
    exported: true,
  },
  biasIndicators: {
    type: 'enum[]',
    description: 'Anti-Muslim elements stated by a source. The project never infers motive.',
    allowed: allowed(E.BIAS_INDICATORS),
    exported: true,
  },
  verificationLevel: {
    type: 'enum',
    description: 'V3 confirmed by authorities, V2 independently reported, V1 single-source report. Counts default to V2 and V3.',
    allowed: allowed(E.PUBLIC_VERIFICATION_LEVELS),
    exported: true,
  },
  legalStatus: { type: 'enum', description: 'Current stage in the legal status lifecycle.', allowed: allowed(E.LEGAL_STATUSES), exported: true },
  hateCrimeCharged: {
    type: 'enum',
    description: 'Whether a hate-crime or bias-enhancement charge was filed.',
    allowed: allowed(E.YES_NO_UNKNOWN),
    exported: true,
  },
  agenciesInvolved: { type: 'string[]', description: 'Police, prosecutors and other agencies named in sources.', exported: true },
  caseIds: { type: 'string[]', description: 'IDs of court cases tied to this incident.', exported: true },
  relatedIncidentIds: { type: 'string[]', description: 'Other records with the same perpetrator or in the same series.', exported: true },
  tags: { type: 'string[]', description: 'Free editorial tags, e.g. campus, election-related.', exported: true },
  sourceTypes: { type: 'enum[]', description: 'Distinct types of the sources cited.', allowed: allowed(E.SOURCE_TYPES), exported: true },
  sourceCount: { type: 'integer', description: 'Number of sources cited. Always at least 1.', exported: true },
  sources: {
    type: 'json array',
    description: 'The sources cited. The [1] markers in `summary` refer to `n`.',
    keys: keysOf<PublicSource>(['n', 'outlet', 'title', 'author', 'url', 'archived_url', 'published_date', 'accessed_date', 'source_type', 'claim_attribution']),
    keyValues: { source_type: E.SOURCE_TYPES },
    exported: true,
  },
  legalEvents: {
    type: 'json array',
    description: 'Dated legal events. `source_n` is the `n` of the source that reports the event; `case_id` matches an entry in `cases`.',
    keys: keysOf<PublicLegalEvent>(['date', 'event_type', 'description', 'case_id', 'source_n']),
    keyValues: { event_type: E.LEGAL_EVENT_TYPES },
    exported: true,
  },
  statements: {
    type: 'json array',
    description: 'Attributed responses. A `quote` is at most 25 words; `source_n` is the source that reports it.',
    keys: keysOf<PublicStatement>(['speaker', 'speaker_role', 'organization', 'statement_type', 'date', 'quote', 'paraphrase', 'source_n']),
    keyValues: { statement_type: E.STATEMENT_TYPES },
    exported: true,
  },
  cases: {
    type: 'json array',
    description: 'Court cases tied to the incident, listed by id in `case_ids`. `stage` is free text.',
    keys: keysOf<PublicCase>(['id', 'name', 'court', 'jurisdiction', 'docket_number', 'case_type', 'parties', 'stage', 'next_date', 'courtlistener_url']),
    keyValues: { case_type: E.CASE_TYPES },
    exported: true,
  },
  changeLog: {
    type: 'json array',
    description: 'The public change log, one entry per published change.',
    keys: keysOf<PublicChange>(['date', 'action', 'note', 'changed_fields', 'revision']),
    keyValues: { action: E.PUBLICATION_ACTIONS },
    exported: true,
  },
  methodologyVersion: { type: 'string', description: 'Inclusion-criteria version the record was published under.', exported: true },
  isDemo: { type: 'boolean', description: 'True only for fictional development records. Always false in production data.', exported: true },
  createdAt: { type: 'datetime (UTC)', description: 'When the record was first drafted.', exported: true },
  publishedAt: { type: 'datetime (UTC)', description: 'When the record was first published.', exported: true },
  updatedAt: { type: 'datetime (UTC)', description: 'When the published record last changed.', exported: true },
  searchText: { type: 'text', description: 'Internal: text indexed for search.', exported: false },
  searchDocument: { type: 'tsvector', description: 'Internal: full-text search index.', exported: false },
}

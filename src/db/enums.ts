/**
 * Every enumerated value in the data model, with its public label and
 * definition. This file is the single source for:
 *   - Postgres enum types (src/db/schema.ts → drizzle migrations)
 *   - form validation (src/lib/validation.ts)
 *   - labels, badges and tooltips in the UI
 *   - the public data dictionary and the Methodology page
 *
 * Change a value here and the migration, types, UI and dictionary follow.
 * Changing inclusion-relevant values (taxonomy, verification levels) is a
 * methodology change: bump METHODOLOGY_VERSION and log it on /methodology.
 */

export const METHODOLOGY_VERSION = '1.0'
export const METHODOLOGY_EFFECTIVE_DATE = '2026-10-26'
/** Inclusion criterion 1: incidents on or after this date. */
export const INCLUSION_START_DATE = '2020-01-01'

type Meta = { label: string; description: string }

// ---------------------------------------------------------------------------
// Incident type taxonomy (Section 3)
// ---------------------------------------------------------------------------
export const INCIDENT_TYPES = [
  'HOM',
  'ASLT',
  'THRT',
  'HARS',
  'VAND',
  'ARSN',
  'DESC',
  'MASS',
  'PLOT',
  'OFCL',
  'SCHL',
  'EMPL',
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]
export const INCIDENT_TYPE_META: Record<IncidentType, Meta> = {
  HOM: { label: 'Homicide', description: 'Killing with an anti-Muslim element.' },
  ASLT: {
    label: 'Physical assault',
    description: 'Hitting, pulling a hijab, attack with a weapon.',
  },
  THRT: {
    label: 'Threat',
    description: 'In-person, phone, mail, or online threat aimed at a specific target.',
  },
  HARS: { label: 'Harassment', description: 'Repeated or targeted verbal abuse, stalking.' },
  VAND: {
    label: 'Vandalism',
    description: 'Graffiti, damage to a mosque, home, car, or business.',
  },
  ARSN: { label: 'Arson or explosive', description: 'Fire, attempted fire, explosive device.' },
  DESC: {
    label: 'Desecration',
    description: "Burning or damaging a Qur'an or religious objects at a Muslim site.",
  },
  MASS: {
    label: 'Mass-casualty attack',
    description: 'Three or more people shot or injured in one attack.',
  },
  PLOT: {
    label: 'Disrupted plot',
    description: 'Arrest before an attack, with an anti-Muslim target.',
  },
  OFCL: {
    label: 'Official misconduct',
    description: 'Bias act by a public official in an official role.',
  },
  SCHL: {
    label: 'School or campus bullying',
    description: 'Reported to the school or police, with a named institution.',
  },
  EMPL: {
    label: 'Workplace incident',
    description: 'Concrete event, not an ongoing employment dispute.',
  },
}

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------
export const TARGET_TYPES = [
  'individual',
  'multiple_individuals',
  'mosque_islamic_center',
  'school',
  'business',
  'home',
  'vehicle',
  'other',
] as const
export type TargetType = (typeof TARGET_TYPES)[number]
export const TARGET_TYPE_META: Record<TargetType, Meta> = {
  individual: { label: 'Person', description: 'One person was targeted.' },
  multiple_individuals: {
    label: 'Several people',
    description: 'Two or more people were targeted together.',
  },
  mosque_islamic_center: {
    label: 'Mosque or Islamic center',
    description: 'A mosque, Islamic center, or Muslim community institution.',
  },
  school: { label: 'School', description: 'A school, college, or university.' },
  business: { label: 'Business', description: 'A business or its staff as a business.' },
  home: { label: 'Home', description: 'A residence.' },
  vehicle: { label: 'Vehicle', description: 'A car or other vehicle.' },
  other: { label: 'Other', description: 'A target not covered by the other categories.' },
}

export const TARGET_ATTRIBUTES = [
  'woman_wearing_hijab',
  'child',
  'student',
  'religious_leader',
  'arab',
  'south_asian',
  'black_muslim',
  'perceived_muslim',
] as const
export type TargetAttribute = (typeof TARGET_ATTRIBUTES)[number]
export const TARGET_ATTRIBUTE_META: Record<TargetAttribute, Meta> = {
  woman_wearing_hijab: {
    label: 'Woman wearing hijab',
    description: 'A source states the person targeted was a woman wearing a hijab.',
  },
  child: { label: 'Child', description: 'A source states a person under 18 was targeted.' },
  student: { label: 'Student', description: 'A source states a student was targeted.' },
  religious_leader: {
    label: 'Religious leader',
    description: 'A source states an imam or other religious leader was targeted.',
  },
  arab: { label: 'Arab', description: 'A source states the person targeted is Arab.' },
  south_asian: {
    label: 'South Asian',
    description: 'A source states the person targeted is South Asian.',
  },
  black_muslim: {
    label: 'Black Muslim',
    description: 'A source states the person targeted is a Black Muslim.',
  },
  perceived_muslim: {
    label: 'Perceived as Muslim',
    description: 'A source states the person was targeted because they were perceived to be Muslim.',
  },
}

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------
export const SEVERITIES = [1, 2, 3, 4, 5] as const
export type Severity = (typeof SEVERITIES)[number]
export const SEVERITY_META: Record<Severity, Meta> = {
  1: { label: 'Verbal or written', description: 'Slurs, written or verbal abuse, no physical act.' },
  2: { label: 'Property', description: 'Damage to or defacement of property.' },
  3: {
    label: 'Physical threat or attempt',
    description: 'A physical threat, or an attempted attack without injury.',
  },
  4: { label: 'Injury', description: 'At least one person was injured.' },
  5: { label: 'Death', description: 'At least one person died.' },
}

// ---------------------------------------------------------------------------
// Perpetrator
// ---------------------------------------------------------------------------
export const PERPETRATOR_TYPES = [
  'individual',
  'group',
  'organized_extremist_group',
  'public_official',
  'law_enforcement',
  'unknown',
] as const
export type PerpetratorType = (typeof PERPETRATOR_TYPES)[number]
export const PERPETRATOR_TYPE_META: Record<PerpetratorType, Meta> = {
  individual: { label: 'Private individual', description: 'One private individual.' },
  group: { label: 'Group', description: 'Two or more private individuals acting together.' },
  organized_extremist_group: {
    label: 'Organized extremist group',
    description: 'A source identifies an organized extremist group as responsible.',
  },
  public_official: {
    label: 'Public official',
    description: 'A public official acting in an official role.',
  },
  law_enforcement: {
    label: 'Law enforcement',
    description: 'A law-enforcement officer or agency.',
  },
  unknown: { label: 'Unknown', description: 'No source identifies who was responsible.' },
}

// ---------------------------------------------------------------------------
// Bias indicators
// ---------------------------------------------------------------------------
export const BIAS_INDICATORS = [
  'slur',
  'stated_motive',
  'symbol',
  'target_selection',
  'official_finding',
  'hate_crime_charge',
] as const
export type BiasIndicator = (typeof BIAS_INDICATORS)[number]
export const BIAS_INDICATOR_META: Record<BiasIndicator, Meta> = {
  slur: { label: 'Slur', description: 'A source reports an anti-Muslim slur was used.' },
  stated_motive: {
    label: 'Stated motive',
    description: 'A source reports the perpetrator stated an anti-Muslim motive.',
  },
  symbol: {
    label: 'Symbol',
    description: 'A source reports hate symbols or anti-Muslim imagery were used.',
  },
  target_selection: {
    label: 'Target selection',
    description: 'The target was a Muslim institution or person identifiable as Muslim.',
  },
  official_finding: {
    label: 'Official finding',
    description: 'An official body stated the incident was bias-motivated.',
  },
  hate_crime_charge: {
    label: 'Hate-crime charge',
    description: 'Prosecutors filed a hate-crime or bias-enhancement charge.',
  },
}

// ---------------------------------------------------------------------------
// Verification levels
// ---------------------------------------------------------------------------
export const VERIFICATION_LEVELS = ['V0', 'V1', 'V2', 'V3'] as const
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number]
/** Levels that may ever appear publicly. V0 is admin only. */
export const PUBLIC_VERIFICATION_LEVELS = ['V1', 'V2', 'V3'] as const
export type PublicVerificationLevel = (typeof PUBLIC_VERIFICATION_LEVELS)[number]
/** Public counts default to these. V1 is included only through a labelled toggle. */
export const DEFAULT_VERIFICATION_LEVELS = ['V2', 'V3'] as const
export const VERIFICATION_META: Record<VerificationLevel, Meta & { rule: string }> = {
  V3: {
    label: 'Confirmed by authorities',
    description: 'Police, prosecutor, or court record confirms the incident occurred.',
    rule: 'Police, prosecutor, or court record confirms the incident occurred.',
  },
  V2: {
    label: 'Independently reported',
    description: 'At least one professional news outlet reported it from its own reporting.',
    rule: 'At least one professional news outlet reported it from its own reporting.',
  },
  V1: {
    label: 'Single-source report',
    description:
      'Only one source, for example an advocacy-group release or social media from the victim.',
    rule: 'Only one source, e.g. an advocacy-group release or social media from the victim.',
  },
  V0: {
    label: 'Unverified submission',
    description: 'Seen only by editors; never published.',
    rule: 'Seen only by editors; never published.',
  },
}

// ---------------------------------------------------------------------------
// Legal status lifecycle
// ---------------------------------------------------------------------------
export const LEGAL_STATUSES = [
  'reported',
  'under_investigation',
  'suspect_identified',
  'arrested',
  'charged',
  'in_court',
  'convicted',
  'acquitted',
  'dismissed',
  'plea_deal',
  'deferred',
  'sentenced',
  'no_arrest',
  'suspect_deceased',
  'not_prosecuted',
  'unknown',
] as const
export type LegalStatus = (typeof LEGAL_STATUSES)[number]
export const LEGAL_STATUS_META: Record<LegalStatus, Meta> = {
  reported: { label: 'Reported', description: 'The incident was reported. No further step is known.' },
  under_investigation: {
    label: 'Under investigation',
    description: 'An agency has said it is investigating.',
  },
  suspect_identified: {
    label: 'Suspect identified',
    description: 'Authorities have identified a suspect. No arrest is known.',
  },
  arrested: { label: 'Arrest made', description: 'A suspect was arrested. Charges are not yet known.' },
  charged: { label: 'Charged', description: 'Charges were filed. The accused is presumed innocent.' },
  in_court: {
    label: 'In court',
    description: 'The case is before a court. The accused is presumed innocent.',
  },
  convicted: { label: 'Convicted', description: 'A court found the defendant guilty.' },
  acquitted: { label: 'Acquitted', description: 'A court found the defendant not guilty.' },
  dismissed: { label: 'Charges dismissed', description: 'The charges were dismissed or dropped.' },
  plea_deal: {
    label: 'Plea agreement',
    description: 'The defendant entered a plea under an agreement with prosecutors.',
  },
  deferred: {
    label: 'Deferred',
    description: 'Prosecution or judgment was deferred, for example through diversion.',
  },
  sentenced: { label: 'Sentenced', description: 'The court imposed a sentence.' },
  no_arrest: { label: 'No arrest', description: 'Authorities have said no arrest was made.' },
  suspect_deceased: { label: 'Suspect deceased', description: 'The suspect died before trial.' },
  not_prosecuted: {
    label: 'Not prosecuted',
    description: 'Prosecutors declined to bring charges.',
  },
  unknown: { label: 'Status unknown', description: 'No public source states the legal status.' },
}
/** Outcomes after which the 30-day review reminder stops. */
export const FINAL_LEGAL_STATUSES: readonly LegalStatus[] = [
  'sentenced',
  'acquitted',
  'dismissed',
  'suspect_deceased',
  'not_prosecuted',
]
/** Statuses at which a suspect has been charged. Names may be published only from here on. */
export const CHARGED_OR_LATER: readonly LegalStatus[] = [
  'charged',
  'in_court',
  'convicted',
  'acquitted',
  'dismissed',
  'plea_deal',
  'deferred',
  'sentenced',
]
/** Statuses before a conviction where a person is accused: language must say "alleged". */
export const ALLEGATION_STATUSES: readonly LegalStatus[] = [
  'suspect_identified',
  'arrested',
  'charged',
  'in_court',
]
export const CONVICTION_STATUSES: readonly LegalStatus[] = ['convicted', 'plea_deal', 'sentenced']

export const LEGAL_EVENT_TYPES = [
  'reported',
  'under_investigation',
  'suspect_identified',
  'arrested',
  'charged',
  'hate_crime_charge_filed',
  'arraignment',
  'in_court',
  'plea_entered',
  'plea_deal',
  'trial',
  'verdict',
  'convicted',
  'acquitted',
  'dismissed',
  'deferred',
  'sentenced',
  'no_arrest',
  'suspect_deceased',
  'not_prosecuted',
  'civil_suit',
  'other',
] as const
export type LegalEventType = (typeof LEGAL_EVENT_TYPES)[number]
export const LEGAL_EVENT_META: Record<LegalEventType, Meta> = {
  reported: { label: 'Reported', description: 'The incident was reported to police or the public.' },
  under_investigation: { label: 'Investigation opened', description: 'An agency opened an investigation.' },
  suspect_identified: { label: 'Suspect identified', description: 'Authorities identified a suspect.' },
  arrested: { label: 'Arrest', description: 'A suspect was arrested.' },
  charged: { label: 'Charges filed', description: 'Charges were filed.' },
  hate_crime_charge_filed: {
    label: 'Hate-crime charge filed',
    description: 'A hate-crime or bias-enhancement charge was filed.',
  },
  arraignment: { label: 'Arraignment', description: 'The defendant was arraigned.' },
  in_court: { label: 'Court hearing', description: 'A court hearing took place.' },
  plea_entered: { label: 'Plea entered', description: 'The defendant entered a plea.' },
  plea_deal: { label: 'Plea agreement', description: 'A plea agreement was entered.' },
  trial: { label: 'Trial', description: 'A trial began or took place.' },
  verdict: { label: 'Verdict', description: 'A verdict was returned.' },
  convicted: { label: 'Conviction', description: 'The defendant was convicted.' },
  acquitted: { label: 'Acquittal', description: 'The defendant was acquitted.' },
  dismissed: { label: 'Dismissal', description: 'Charges were dismissed or dropped.' },
  deferred: { label: 'Deferral', description: 'Prosecution or judgment was deferred.' },
  sentenced: { label: 'Sentence', description: 'A sentence was imposed.' },
  no_arrest: { label: 'No arrest', description: 'Authorities said no arrest was made.' },
  suspect_deceased: { label: 'Suspect died', description: 'The suspect died.' },
  not_prosecuted: { label: 'Charges declined', description: 'Prosecutors declined to bring charges.' },
  civil_suit: { label: 'Civil suit', description: 'A civil suit was filed or decided.' },
  other: { label: 'Other legal event', description: 'Another dated legal event.' },
}
/**
 * Which legal events establish each legal status. A record's legal status must
 * be backed by at least one dated, sourced event of these types ("Every status
 * change is a dated Legal Event with a source"). Mirrored in SQL by
 * record.legal_event_establishes() — tests/db/rules.test.ts keeps them in sync.
 */
export const LEGAL_STATUS_EVIDENCE: Record<LegalStatus, readonly LegalEventType[]> = {
  reported: ['reported'],
  under_investigation: ['under_investigation'],
  suspect_identified: ['suspect_identified'],
  arrested: ['arrested'],
  charged: ['charged', 'hate_crime_charge_filed'],
  in_court: ['arraignment', 'in_court', 'plea_entered', 'trial'],
  convicted: ['convicted', 'verdict'],
  acquitted: ['acquitted', 'verdict'],
  dismissed: ['dismissed'],
  plea_deal: ['plea_deal'],
  deferred: ['deferred'],
  sentenced: ['sentenced'],
  no_arrest: ['no_arrest'],
  suspect_deceased: ['suspect_deceased'],
  not_prosecuted: ['not_prosecuted'],
  unknown: [],
}

// ---------------------------------------------------------------------------
// Small shared enums
// ---------------------------------------------------------------------------
export const YES_NO_UNKNOWN = ['yes', 'no', 'unknown'] as const
export type YesNoUnknown = (typeof YES_NO_UNKNOWN)[number]
export const YES_NO_UNKNOWN_META: Record<YesNoUnknown, Meta> = {
  yes: { label: 'Yes', description: 'A source states this.' },
  no: { label: 'No', description: 'A source states this did not happen.' },
  unknown: { label: 'Unknown', description: 'No source states either way.' },
}

export const DATE_PRECISIONS = ['day', 'month', 'year'] as const
export type DatePrecision = (typeof DATE_PRECISIONS)[number]
export const DATE_PRECISION_META: Record<DatePrecision, Meta> = {
  day: { label: 'Exact day', description: 'The day is known.' },
  month: { label: 'Month only', description: 'Only the month is known; the day is shown as the 1st.' },
  year: { label: 'Year only', description: 'Only the year is known; the date is shown as January 1.' },
}

export const LOCATION_PRECISIONS = ['exact_public_place', 'neighborhood', 'city', 'state'] as const
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number]
export const LOCATION_PRECISION_META: Record<LocationPrecision, Meta> = {
  exact_public_place: {
    label: 'Exact public place',
    description: 'A public place such as a mosque, park, or school. Never a private home.',
  },
  neighborhood: { label: 'Neighborhood', description: 'Shown at the neighborhood level.' },
  city: { label: 'City', description: 'Shown at the city centroid, with a small fixed offset on the map.' },
  state: { label: 'State', description: 'Only the state is shown.' },
}

export const SOURCE_TYPES = [
  'news',
  'police',
  'prosecutor',
  'court_record',
  'government',
  'advocacy_org',
  'academic',
  'social_media',
  'victim_statement',
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]
export const SOURCE_TYPE_META: Record<SourceType, Meta> = {
  news: { label: 'News outlet', description: 'A professional news organization.' },
  police: { label: 'Police', description: 'A police department or sheriff statement or report.' },
  prosecutor: { label: 'Prosecutor', description: 'A prosecutor or US Attorney statement or filing.' },
  court_record: { label: 'Court record', description: 'A court filing, docket, or ruling.' },
  government: { label: 'Government', description: 'Another government body or official.' },
  advocacy_org: { label: 'Advocacy group', description: 'A civil-rights or advocacy organization.' },
  academic: { label: 'Academic', description: 'A university or research publication.' },
  social_media: { label: 'Social media', description: 'A public social-media post.' },
  victim_statement: { label: 'Victim statement', description: 'A public statement by the person targeted.' },
}
/** "Use the most authoritative source available": court > prosecutor > police > news > advocacy > social. */
export const SOURCE_AUTHORITY_ORDER: readonly SourceType[] = [
  'court_record',
  'prosecutor',
  'police',
  'government',
  'news',
  'academic',
  'advocacy_org',
  'victim_statement',
  'social_media',
]

export const CASE_TYPES = ['criminal', 'civil_rights', 'administrative'] as const
export type CaseType = (typeof CASE_TYPES)[number]
export const CASE_TYPE_META: Record<CaseType, Meta> = {
  criminal: { label: 'Criminal', description: 'A criminal prosecution.' },
  civil_rights: { label: 'Civil rights', description: 'A civil-rights lawsuit.' },
  administrative: { label: 'Administrative', description: 'An administrative proceeding.' },
}

export const STATEMENT_TYPES = ['official', 'defense', 'community'] as const
export type StatementType = (typeof STATEMENT_TYPES)[number]
export const STATEMENT_TYPE_META: Record<StatementType, Meta> = {
  official: { label: 'Official response', description: 'Police, prosecutors, or public officials.' },
  defense: { label: "Accused's counsel", description: 'The accused or their lawyer.' },
  community: { label: 'Community response', description: 'Community members or organizations.' },
}

// ---------------------------------------------------------------------------
// Internal workflow (never public)
// ---------------------------------------------------------------------------
export const WORKFLOW_STATUSES = [
  'draft',
  'in_review',
  'returned',
  'approved',
  'published',
  'unpublished',
  'excluded',
] as const
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]
export const WORKFLOW_STATUS_META: Record<WorkflowStatus, Meta> = {
  draft: { label: 'Draft', description: 'Being written. Changes since the last review are not public.' },
  in_review: { label: 'In review', description: 'Waiting for a second editor.' },
  returned: { label: 'Returned', description: 'The reviewer returned it with comments.' },
  approved: { label: 'Approved', description: 'Approved by a second editor. Ready to publish.' },
  published: { label: 'Published', description: 'This revision is live.' },
  unpublished: { label: 'Unpublished', description: 'Taken down from the public site.' },
  excluded: { label: 'Excluded', description: 'Out of scope under the inclusion criteria. Kept with a reason.' },
}

export const USER_ROLES = ['contributor', 'editor', 'senior_editor', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]
export const USER_ROLE_META: Record<UserRole, Meta> = {
  contributor: { label: 'Contributor', description: 'Drafts only.' },
  editor: { label: 'Editor', description: 'Draft and review.' },
  senior_editor: { label: 'Senior editor', description: 'Publish, unpublish, merge records.' },
  admin: { label: 'Admin', description: 'Users and settings, plus everything a senior editor can do.' },
}

export const REVIEW_DECISIONS = ['approved', 'returned'] as const
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

/** The fixed review checklist (Section 4). A record cannot be approved until every box is ticked. */
export const REVIEW_CHECKLIST = [
  { key: 'chkSourcesCited', column: 'chk_sources_cited', label: 'Every sentence is backed by a cited source.' },
  { key: 'chkAllegationsLabelled', column: 'chk_allegations_labelled', label: 'Allegations are labelled as allegations.' },
  {
    key: 'chkVictimPrivacy',
    column: 'chk_victim_privacy',
    label: 'No private victim is identified without public self-identification or a court record.',
  },
  { key: 'chkLocationPrecision', column: 'chk_location_precision', label: 'Location is no more precise than needed.' },
  { key: 'chkTaxonomyCorrect', column: 'chk_taxonomy_correct', label: 'Taxonomy codes are correct.' },
] as const
export type ReviewChecklistKey = (typeof REVIEW_CHECKLIST)[number]['key']

export const PUBLICATION_ACTIONS = ['published', 'updated', 'unpublished'] as const
export type PublicationAction = (typeof PUBLICATION_ACTIONS)[number]

export const LEAD_SOURCES = ['submission', 'news_monitor', 'org_feed', 'docket_alert', 'manual'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]
export const LEAD_SOURCE_META: Record<LeadSource, Meta> = {
  submission: { label: 'Public submission', description: 'Sent through /report.' },
  news_monitor: { label: 'News monitor', description: 'Matched a saved news query.' },
  org_feed: { label: 'Organization feed', description: 'From an organization or agency press page.' },
  docket_alert: { label: 'Docket alert', description: 'From a court docket alert.' },
  manual: { label: 'Manual', description: 'Entered by an editor.' },
}

export const LEAD_STATUSES = ['new', 'new_incident', 'update', 'duplicate', 'out_of_scope'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export const LEAD_STATUS_META: Record<LeadStatus, Meta> = {
  new: { label: 'Untriaged', description: 'Not yet triaged.' },
  new_incident: { label: 'New incident', description: 'A draft record was created from this lead.' },
  update: { label: 'Update', description: 'Adds information to an existing record.' },
  duplicate: { label: 'Duplicate', description: 'Already covered by another lead or record.' },
  out_of_scope: { label: 'Out of scope', description: 'Does not meet the inclusion criteria.' },
}

/** Articles found by the morning news scan (src/server/jobs/news). */
export const NEWS_CANDIDATE_STATUSES = ['pending', 'working', 'lead', 'skipped', 'failed'] as const
export type NewsCandidateStatus = (typeof NEWS_CANDIDATE_STATUSES)[number]
export const NEWS_CANDIDATE_STATUS_META: Record<NewsCandidateStatus, Meta> = {
  pending: { label: 'Waiting', description: 'Found, not read yet.' },
  working: { label: 'Being read', description: 'A scan pass is reading it now.' },
  lead: { label: 'Lead created', description: 'Sent to the leads inbox for an editor.' },
  skipped: { label: 'Skipped', description: 'Judged outside the inclusion criteria; kept here so editors can check.' },
  failed: { label: 'Failed', description: 'Could not be read after several tries.' },
}

export const SUBMISSION_KINDS = ['report', 'correction'] as const
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]

export const REPORTER_RELATIONS = ['victim', 'witness', 'other', 'prefer_not_to_say'] as const
export type ReporterRelation = (typeof REPORTER_RELATIONS)[number]
export const REPORTER_RELATION_META: Record<ReporterRelation, Meta> = {
  victim: { label: 'It happened to me', description: 'The reporter is the person targeted.' },
  witness: { label: 'I saw it happen', description: 'The reporter witnessed it.' },
  other: { label: 'I heard or read about it', description: 'The reporter learned of it another way.' },
  prefer_not_to_say: { label: 'Prefer not to say', description: 'Not stated.' },
}

export const CORRECTION_STATUSES = ['open', 'responded', 'resolved', 'declined'] as const
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number]
export const CORRECTION_STATUS_META: Record<CorrectionStatus, Meta> = {
  open: { label: 'Open', description: 'No response yet.' },
  responded: { label: 'Responded', description: 'The requester has had a response; a fix may be pending.' },
  resolved: { label: 'Resolved', description: 'Fixed, or answered with no change needed.' },
  declined: { label: 'Declined', description: 'No factual or legal basis for a change.' },
}

export const ARCHIVE_STATUSES = ['pending', 'archived', 'failed'] as const
export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number]

// ---------------------------------------------------------------------------
// Service levels (Section 4)
// ---------------------------------------------------------------------------
export const SLA = {
  correctionResponseHours: 72,
  correctionFixDays: 7,
  privacyRemovalHours: 48,
  acquittalUpdateDays: 7,
  openCaseReviewDays: 30,
  submitterDataRetentionMonths: 12,
} as const

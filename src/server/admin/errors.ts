/**
 * Database rule violations arrive as exceptions whose message starts with a
 * stable code (see drizzle/0002_rules.sql). This maps them to plain language.
 */
const MESSAGES: Record<string, string> = {
  actor_required: 'This change is not attributed to a signed-in user.',
  reviewer_is_author: 'You wrote this record. A second editor who is not the author must review it.',
  reviewer_edited_revision: 'You edited this revision, so you cannot approve it. Return it with comments instead, or ask another editor.',
  review_requires_editor_role: 'Only editors and senior editors can review records.',
  review_requires_in_review_status: 'This record is not waiting for review.',
  review_actor_mismatch: 'Reviews must be recorded by the signed-in reviewer.',
  approval_blocked: 'This record cannot be approved yet:',
  publish_requires_second_editor_approval: 'A second editor must approve the current revision before it can be published.',
  publish_requires_senior_editor: 'Only senior editors can publish.',
  publish_requires_public_note: 'Add a one-line public note describing what changed.',
  publish_requires_verification_level: 'Set a verification level (V1–V3). V0 records are never public.',
  publish_requires_legal_status: 'Set a legal status.',
  publish_requires_source: 'Attach at least one public, linkable source.',
  publish_requires_methodology_version: 'Missing methodology version.',
  publish_blocked: 'This record cannot be published yet:',
  publish_revision_mismatch: 'The record changed after approval. It needs a new review.',
  publish_via_publish_incident_only: 'Records are published only through the publish step.',
  review_decisions_via_reviews_only: 'Approval and return happen only through a review.',
  unpublish_via_unpublish_incident_only: 'Records are unpublished only through the unpublish step.',
  unpublish_requires_senior_editor: 'Only senior editors can unpublish.',
  unpublish_requires_reason: 'Give a reason for unpublishing.',
  unpublish_before_excluding: 'Unpublish the record before marking it excluded.',
  not_published: 'This record is not published.',
  names_require_charge: 'Names may appear only after a person has been charged and named by authorities or in court records.',
  source_must_belong_to_the_same_record: 'Legal events and statements must cite one of this record’s sources.',
  new_records_start_as_drafts: 'New records start as drafts.',
  record_id_is_permanent: 'Record ids never change.',
  record_author_is_permanent: 'The author of a record cannot be changed.',
  revision_is_managed_by_the_database: 'Revision numbers are managed by the database.',
  revision_cannot_decrease: 'Revision numbers only move forward.',
  append_only: 'This history cannot be changed or deleted.',
  incident_not_found: 'Record not found.',
  cannot_submit_from_draft: 'This record cannot be submitted from its current status.',
}

export const BLOCKER_MESSAGES: Record<string, string> = {
  no_source: 'Attach at least one source.',
  verification_level_v0: 'Set a verification level of V1, V2 or V3.',
  legal_status_missing: 'Set a legal status.',
  legal_status_without_event: 'Add a dated, sourced legal event that supports the legal status.',
  summary_missing: 'Write the summary.',
  bias_indicator_missing: 'Record at least one bias indicator stated by a source (inclusion criterion 2).',
  names_require_charge: 'Remove names: they may appear only once a person is charged.',
  before_inclusion_window: 'The incident is before January 1, 2020. Tag it "backfill" to include it as a labelled backfill.',
  excluded: 'The record is marked excluded.',
  incident_not_found: 'Record not found.',
}

function rawMessage(err: unknown): string {
  let e: unknown = err
  for (let i = 0; i < 4 && e; i++) {
    const msg = (e as { message?: string }).message
    if (msg && /^[a-z_]+(:|$)/.test(msg)) return msg
    e = (e as { cause?: unknown }).cause
  }
  return (err as { message?: string })?.message ?? String(err)
}

export function dbErrorCode(err: unknown): string | null {
  const m = /^([a-z_]+)(?::|$)/.exec(rawMessage(err))
  return m ? m[1]! : null
}

export function friendlyDbError(err: unknown): string {
  const raw = rawMessage(err)
  const code = dbErrorCode(err)
  if (code === 'approval_blocked' || code === 'publish_blocked') {
    const list = raw.split(':')[1]?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
    return [MESSAGES[code], ...list.map((b) => BLOCKER_MESSAGES[b] ?? b)].join(' ')
  }
  if (code?.startsWith('cannot_submit_from_')) return MESSAGES.cannot_submit_from_draft!
  if (code && MESSAGES[code]) return MESSAGES[code]
  // Constraint violations from CHECK constraints
  const constraint = (err as { cause?: { constraint?: string } })?.cause?.constraint
  if (constraint) return `The record violates the rule “${constraint}”.`
  console.error('[admin] unexpected database error', err)
  return 'Something went wrong saving this change. Nothing was saved.'
}

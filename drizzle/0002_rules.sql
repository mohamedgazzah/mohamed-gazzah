-- ============================================================================
-- Rules that hold no matter which code path writes to the database.
--
--   1. Reference data (states and territories, FIPS)
--   2. Attribution: every content change names an actor (app.actor_id)
--   3. Revisions: any content change bumps the revision and voids approval
--   4. Change log: every field change is logged by trigger
--   5. Two-person review: reviewers cannot be the author or an editor of the
--      revision they approve; approval requires the full checklist
--   6. Publishing: only record.publish_incident() writes the public snapshot,
--      and a trigger re-checks every precondition on each write
--   7. Append-only tables: audit_log, reviews, publications, change_log,
--      incident_edits
--   8. Privileges and row-level security for the two runtime roles
--   9. Public views (record_public): the only objects the public role can read
--
-- Error messages start with a stable code (e.g. reviewer_is_author) that the
-- app maps to readable text in src/server/admin/errors.ts.
-- ============================================================================

-- 1. Reference data ----------------------------------------------------------
INSERT INTO record.us_states (fips, code, name, territory) VALUES
  ('01','AL','Alabama',false),('02','AK','Alaska',false),('04','AZ','Arizona',false),
  ('05','AR','Arkansas',false),('06','CA','California',false),('08','CO','Colorado',false),
  ('09','CT','Connecticut',false),('10','DE','Delaware',false),('11','DC','District of Columbia',false),
  ('12','FL','Florida',false),('13','GA','Georgia',false),('15','HI','Hawaii',false),
  ('16','ID','Idaho',false),('17','IL','Illinois',false),('18','IN','Indiana',false),
  ('19','IA','Iowa',false),('20','KS','Kansas',false),('21','KY','Kentucky',false),
  ('22','LA','Louisiana',false),('23','ME','Maine',false),('24','MD','Maryland',false),
  ('25','MA','Massachusetts',false),('26','MI','Michigan',false),('27','MN','Minnesota',false),
  ('28','MS','Mississippi',false),('29','MO','Missouri',false),('30','MT','Montana',false),
  ('31','NE','Nebraska',false),('32','NV','Nevada',false),('33','NH','New Hampshire',false),
  ('34','NJ','New Jersey',false),('35','NM','New Mexico',false),('36','NY','New York',false),
  ('37','NC','North Carolina',false),('38','ND','North Dakota',false),('39','OH','Ohio',false),
  ('40','OK','Oklahoma',false),('41','OR','Oregon',false),('42','PA','Pennsylvania',false),
  ('44','RI','Rhode Island',false),('45','SC','South Carolina',false),('46','SD','South Dakota',false),
  ('47','TN','Tennessee',false),('48','TX','Texas',false),('49','UT','Utah',false),
  ('50','VT','Vermont',false),('51','VA','Virginia',false),('53','WA','Washington',false),
  ('54','WV','West Virginia',false),('55','WI','Wisconsin',false),('56','WY','Wyoming',false),
  ('60','AS','American Samoa',true),('66','GU','Guam',true),('69','MP','Northern Mariana Islands',true),
  ('72','PR','Puerto Rico',true),('74','UM','U.S. Minor Outlying Islands',true),('78','VI','U.S. Virgin Islands',true)
ON CONFLICT (fips) DO NOTHING;
--> statement-breakpoint
ALTER TABLE record.incidents ADD CONSTRAINT incidents_state_fk FOREIGN KEY (state_fips) REFERENCES record.us_states (fips);
--> statement-breakpoint
ALTER TABLE record.published_incidents ADD CONSTRAINT published_state_fk FOREIGN KEY (state_fips) REFERENCES record.us_states (fips);
--> statement-breakpoint

-- 2. Attribution -------------------------------------------------------------
CREATE OR REPLACE FUNCTION record.current_actor() RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  v text := current_setting('app.actor_id', true);
BEGIN
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION 'actor_required: set app.actor_id before changing records';
  END IF;
  RETURN v::uuid;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.change_reason() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.change_reason', true), '')
$$;
--> statement-breakpoint

-- Which legal events establish a legal status. Mirrors LEGAL_STATUS_EVIDENCE
-- in src/db/enums.ts (tests/db/rules.test.ts keeps them in sync).
CREATE OR REPLACE FUNCTION record.legal_event_establishes(e record.legal_event_type, s record.legal_status) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s
    WHEN 'reported' THEN e IN ('reported')
    WHEN 'under_investigation' THEN e IN ('under_investigation')
    WHEN 'suspect_identified' THEN e IN ('suspect_identified')
    WHEN 'arrested' THEN e IN ('arrested')
    WHEN 'charged' THEN e IN ('charged', 'hate_crime_charge_filed')
    WHEN 'in_court' THEN e IN ('arraignment', 'in_court', 'plea_entered', 'trial')
    WHEN 'convicted' THEN e IN ('convicted', 'verdict')
    WHEN 'acquitted' THEN e IN ('acquitted', 'verdict')
    WHEN 'dismissed' THEN e IN ('dismissed')
    WHEN 'plea_deal' THEN e IN ('plea_deal')
    WHEN 'deferred' THEN e IN ('deferred')
    WHEN 'sentenced' THEN e IN ('sentenced')
    WHEN 'no_arrest' THEN e IN ('no_arrest')
    WHEN 'suspect_deceased' THEN e IN ('suspect_deceased')
    WHEN 'not_prosecuted' THEN e IN ('not_prosecuted')
    ELSE false
  END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.is_charged_or_later(s record.legal_status) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT s IS NOT NULL AND s IN ('charged','in_court','convicted','acquitted','dismissed','plea_deal','deferred','sentenced')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.is_final_status(s record.legal_status) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT s IS NOT NULL AND s IN ('sentenced','acquitted','dismissed','suspect_deceased','not_prosecuted')
$$;
--> statement-breakpoint

-- Human-readable ids: US-2026-0412, CASE-2026-0001, DEMO-2026-0001.
CREATE OR REPLACE FUNCTION record.next_id(p_prefix text, p_year integer) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
  INSERT INTO record.id_counters AS c (scope, next) VALUES (p_prefix || '-' || p_year, 2)
  ON CONFLICT (scope) DO UPDATE SET next = c.next + 1
  RETURNING p_prefix || '-' || p_year || '-' || lpad((next - 1)::text, 4, '0')
$$;
--> statement-breakpoint

-- 3. Revisions ---------------------------------------------------------------
-- The editorial content of a record: everything except workflow bookkeeping,
-- private notes and derived columns. A change here creates a new revision.
CREATE OR REPLACE FUNCTION record.incident_content(r record.incidents) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT to_jsonb(r) - ARRAY[
    'revision', 'revision_txid', 'workflow_status', 'exclusion_reason', 'updated_at',
    'submitted_at', 'published_at', 'first_published_at', 'next_review_due',
    'editor_notes', 'map_lat', 'map_lng', 'geom', 'lead_id', 'created_at', 'created_by'
  ]
$$;
--> statement-breakpoint
-- Called when a source, legal event, statement or case link changes.
CREATE OR REPLACE FUNCTION record.bump_revision(p_incident text, p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  r integer;
BEGIN
  UPDATE record.incidents SET
    revision = CASE WHEN revision_txid IS DISTINCT FROM txid_current() THEN revision + 1 ELSE revision END,
    revision_txid = txid_current(),
    workflow_status = CASE
      WHEN workflow_status IN ('in_review', 'approved', 'returned', 'published', 'unpublished') THEN 'draft'::record.workflow_status
      ELSE workflow_status END,
    updated_at = now()
  WHERE id = p_incident
  RETURNING revision INTO r;
  IF r IS NOT NULL THEN
    INSERT INTO record.incident_edits (incident_id, revision, actor_id)
    VALUES (p_incident, r, p_actor) ON CONFLICT DO NOTHING;
  END IF;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.incidents_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
BEGIN
  -- The author is whoever is acting, never a value the caller supplies.
  NEW.created_by := record.current_actor();
  NEW.revision := 1;
  NEW.revision_txid := txid_current();
  NEW.created_at := now();
  NEW.updated_at := now();
  IF NEW.workflow_status NOT IN ('draft', 'excluded') THEN
    RAISE EXCEPTION 'new_records_start_as_drafts';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.incidents_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO record.incident_edits (incident_id, revision, actor_id)
  VALUES (NEW.id, NEW.revision, NEW.created_by) ON CONFLICT DO NOTHING;
  INSERT INTO record.change_log (incident_id, revision, actor_id, field, old_value, new_value, reason)
  VALUES (NEW.id, NEW.revision, NEW.created_by, 'record', NULL,
          to_jsonb(NEW) - ARRAY['geom', 'revision_txid'], record.change_reason());
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.incidents_before_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  actor uuid;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'record_id_is_permanent';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'record_author_is_permanent';
  END IF;

  IF NEW.revision < OLD.revision THEN
    RAISE EXCEPTION 'revision_cannot_decrease';
  END IF;

  IF record.incident_content(NEW) IS DISTINCT FROM record.incident_content(OLD) THEN
    actor := record.current_actor();
    IF OLD.revision_txid IS DISTINCT FROM txid_current() THEN
      NEW.revision := OLD.revision + 1;
      NEW.revision_txid := txid_current();
    ELSE
      NEW.revision := OLD.revision;
    END IF;
    -- Any content change voids a pending or granted approval.
    IF NEW.workflow_status IN ('in_review', 'approved', 'returned', 'published', 'unpublished') THEN
      NEW.workflow_status := 'draft';
    END IF;
    NEW.updated_at := now();
    INSERT INTO record.incident_edits (incident_id, revision, actor_id)
    VALUES (NEW.id, NEW.revision, actor) ON CONFLICT DO NOTHING;
  ELSE
    -- Revision numbers only move forward, through the content path above or
    -- record.bump_revision().
    IF NEW.revision IS DISTINCT FROM OLD.revision AND NEW.revision_txid IS DISTINCT FROM txid_current() THEN
      RAISE EXCEPTION 'revision_is_managed_by_the_database';
    END IF;
    IF NEW.editor_notes IS DISTINCT FROM OLD.editor_notes THEN
      PERFORM record.current_actor();
      NEW.updated_at := now();
    END IF;
  END IF;

  -- Workflow transitions.
  IF NEW.workflow_status IS DISTINCT FROM OLD.workflow_status THEN
    IF NEW.workflow_status = 'published'
       AND coalesce(current_setting('record.publishing', true), '') <> NEW.id THEN
      RAISE EXCEPTION 'publish_via_publish_incident_only';
    END IF;
    IF NEW.workflow_status IN ('approved', 'returned')
       AND coalesce(current_setting('record.reviewing', true), '') <> NEW.id THEN
      RAISE EXCEPTION 'review_decisions_via_reviews_only';
    END IF;
    IF NEW.workflow_status = 'unpublished'
       AND coalesce(current_setting('record.publishing', true), '') <> NEW.id THEN
      RAISE EXCEPTION 'unpublish_via_unpublish_incident_only';
    END IF;
    IF NEW.workflow_status = 'in_review' THEN
      IF OLD.workflow_status NOT IN ('draft', 'returned', 'unpublished') THEN
        RAISE EXCEPTION 'cannot_submit_from_%', OLD.workflow_status;
      END IF;
      PERFORM record.current_actor();
      NEW.submitted_at := now();
    END IF;
    IF NEW.workflow_status = 'excluded' THEN
      PERFORM record.current_actor();
      IF EXISTS (SELECT 1 FROM record.published_incidents p WHERE p.id = NEW.id) THEN
        RAISE EXCEPTION 'unpublish_before_excluding';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- Map position: lat/lng plus a small random offset for anything less precise
-- than an exact public place. Computed once and kept until lat, lng or
-- precision change, so markers do not move between page loads.
CREATE OR REPLACE FUNCTION record.set_map_position() RETURNS trigger
LANGUAGE plpgsql SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  radius double precision;
  angle double precision;
  dist double precision;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.lat IS NOT DISTINCT FROM OLD.lat
     AND NEW.lng IS NOT DISTINCT FROM OLD.lng
     AND NEW.location_precision = OLD.location_precision THEN
    NEW.map_lat := OLD.map_lat;
    NEW.map_lng := OLD.map_lng;
    RETURN NEW;
  END IF;
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    NEW.map_lat := NULL;
    NEW.map_lng := NULL;
    RETURN NEW;
  END IF;
  radius := CASE NEW.location_precision
    WHEN 'exact_public_place' THEN 0
    WHEN 'neighborhood' THEN 0.004
    WHEN 'city' THEN 0.02
    ELSE 0.25 END;
  angle := random() * 2 * pi();
  dist := radius * sqrt(random());
  NEW.map_lat := round((NEW.lat + dist * sin(angle))::numeric, 5)::double precision;
  NEW.map_lng := round((NEW.lng + dist * cos(angle) / greatest(cos(radians(NEW.lat)), 0.2))::numeric, 5)::double precision;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- 4. Change log --------------------------------------------------------------
CREATE OR REPLACE FUNCTION record.incidents_log_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  k text;
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
  actor uuid := nullif(current_setting('app.actor_id', true), '')::uuid;
BEGIN
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    CONTINUE WHEN k = ANY (ARRAY['revision', 'revision_txid', 'updated_at', 'geom', 'map_lat', 'map_lng']);
    IF (o -> k) IS DISTINCT FROM (n -> k) THEN
      INSERT INTO record.change_log (incident_id, revision, actor_id, field, old_value, new_value, reason)
      VALUES (NEW.id, NEW.revision, actor, k, o -> k, n -> k, record.change_reason());
    END IF;
  END LOOP;
  RETURN NULL;
END
$$;
--> statement-breakpoint
-- Sources, legal events, statements and case links are part of the record:
-- changing them logs the change and creates a new revision of the incident.
CREATE OR REPLACE FUNCTION record.child_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  inc_id text;
  o jsonb;
  n jsonb;
  actor uuid;
  rev integer;
  archive_cols text[] := ARRAY['archived_url', 'archive_status', 'archive_attempts', 'archive_job_id', 'archive_last_error', 'archived_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    inc_id := OLD.incident_id; o := to_jsonb(OLD); n := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    inc_id := NEW.incident_id; o := NULL; n := to_jsonb(NEW);
  ELSE
    inc_id := NEW.incident_id; o := to_jsonb(OLD); n := to_jsonb(NEW);
    IF OLD.incident_id IS DISTINCT FROM NEW.incident_id THEN
      RAISE EXCEPTION 'child_rows_cannot_move_between_records';
    END IF;
    -- Archiving bookkeeping on a source is automated, not an editorial change.
    IF TG_TABLE_NAME = 'sources' AND (o - archive_cols) = (n - archive_cols) THEN
      RETURN NULL;
    END IF;
    IF o = n THEN
      RETURN NULL;
    END IF;
  END IF;
  -- Rows removed by a cascading delete of the incident itself.
  IF NOT EXISTS (SELECT 1 FROM record.incidents WHERE id = inc_id) THEN
    RETURN NULL;
  END IF;
  actor := record.current_actor();
  PERFORM record.bump_revision(inc_id, actor);
  SELECT revision INTO rev FROM record.incidents WHERE id = inc_id;
  INSERT INTO record.change_log (incident_id, revision, actor_id, field, old_value, new_value, reason)
  VALUES (inc_id, rev, actor, TG_TABLE_NAME, o, n, record.change_reason());
  RETURN NULL;
END
$$;
--> statement-breakpoint
-- Legal events and statements must cite a source of the same record.
CREATE OR REPLACE FUNCTION record.check_source_same_incident() RETURNS trigger
LANGUAGE plpgsql SET search_path = record, pg_catalog, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM record.sources s WHERE s.id = NEW.source_id AND s.incident_id = NEW.incident_id) THEN
    RAISE EXCEPTION 'source_must_belong_to_the_same_record';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- 5. Publish preconditions and two-person review -----------------------------
-- Everything that stops the current working copy from being approved or
-- published, as a list of codes. Empty means ready.
CREATE OR REPLACE FUNCTION record.publish_blockers(p_incident_id text) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  inc record.incidents%ROWTYPE;
  b text[] := '{}';
BEGIN
  SELECT * INTO inc FROM record.incidents WHERE id = p_incident_id;
  IF NOT FOUND THEN
    RETURN ARRAY['incident_not_found'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM record.sources s WHERE s.incident_id = inc.id) THEN
    b := b || 'no_source'::text;
  END IF;
  IF inc.verification_level = 'V0' THEN
    b := b || 'verification_level_v0'::text;
  END IF;
  IF inc.legal_status IS NULL THEN
    b := b || 'legal_status_missing'::text;
  ELSIF inc.legal_status <> 'unknown' AND NOT EXISTS (
    SELECT 1 FROM record.legal_events e
    WHERE e.incident_id = inc.id AND record.legal_event_establishes(e.event_type, inc.legal_status)
  ) THEN
    b := b || 'legal_status_without_event'::text;
  END IF;
  IF btrim(inc.summary) = '' THEN
    b := b || 'summary_missing'::text;
  END IF;
  IF cardinality(inc.bias_indicators) = 0 THEN
    b := b || 'bias_indicator_missing'::text;
  END IF;
  IF cardinality(inc.perpetrator_names) > 0 AND NOT record.is_charged_or_later(inc.legal_status) THEN
    b := b || 'names_require_charge'::text;
  END IF;
  IF inc.date_start < DATE '2020-01-01' AND NOT ('backfill' = ANY (inc.tags)) THEN
    b := b || 'before_inclusion_window'::text;
  END IF;
  IF inc.workflow_status = 'excluded' THEN
    b := b || 'excluded'::text;
  END IF;
  RETURN b;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.reviews_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  inc record.incidents%ROWTYPE;
  reviewer_role record.user_role;
  blockers text[];
BEGIN
  SELECT * INTO inc FROM record.incidents WHERE id = NEW.incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident_not_found';
  END IF;
  IF NEW.reviewer_id IS DISTINCT FROM record.current_actor() THEN
    RAISE EXCEPTION 'review_actor_mismatch';
  END IF;
  SELECT u.role INTO reviewer_role FROM record.users u WHERE u.id = NEW.reviewer_id AND u.active;
  IF reviewer_role IS NULL OR reviewer_role NOT IN ('editor', 'senior_editor', 'admin') THEN
    RAISE EXCEPTION 'review_requires_editor_role';
  END IF;
  IF inc.workflow_status <> 'in_review' THEN
    RAISE EXCEPTION 'review_requires_in_review_status';
  END IF;
  IF NEW.reviewer_id = inc.created_by THEN
    RAISE EXCEPTION 'reviewer_is_author';
  END IF;
  IF EXISTS (
    SELECT 1 FROM record.incident_edits e
    WHERE e.incident_id = inc.id AND e.revision = inc.revision AND e.actor_id = NEW.reviewer_id
  ) THEN
    RAISE EXCEPTION 'reviewer_edited_revision';
  END IF;
  IF NEW.decision = 'approved' THEN
    blockers := record.publish_blockers(inc.id);
    IF cardinality(blockers) > 0 THEN
      RAISE EXCEPTION 'approval_blocked: %', array_to_string(blockers, ', ');
    END IF;
  END IF;
  NEW.revision := inc.revision;
  NEW.created_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.reviews_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
BEGIN
  PERFORM set_config('record.reviewing', NEW.incident_id, true);
  UPDATE record.incidents
  SET workflow_status = CASE WHEN NEW.decision = 'approved' THEN 'approved'::record.workflow_status
                             ELSE 'returned'::record.workflow_status END
  WHERE id = NEW.incident_id;
  PERFORM set_config('record.reviewing', '', true);
  INSERT INTO record.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (NEW.reviewer_id, 'incident.review.' || NEW.decision, 'incident', NEW.incident_id,
          jsonb_build_object('review_id', NEW.id, 'revision', NEW.revision));
  RETURN NULL;
END
$$;
--> statement-breakpoint

-- 6. Publishing --------------------------------------------------------------
-- Re-checked on every write to the public snapshot, whatever the caller.
CREATE OR REPLACE FUNCTION record.enforce_publish_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  inc record.incidents%ROWTYPE;
  rev record.reviews%ROWTYPE;
  skip_cols text[] := ARRAY['sources', 'updated_at', 'search_document', 'geom'];
BEGIN
  SELECT * INTO inc FROM record.incidents WHERE id = NEW.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident_not_found';
  END IF;
  SELECT * INTO rev FROM record.reviews WHERE id = NEW.approved_review_id;
  IF NOT FOUND OR rev.incident_id <> NEW.id OR rev.decision <> 'approved' OR rev.revision <> NEW.revision THEN
    RAISE EXCEPTION 'publish_requires_second_editor_approval';
  END IF;
  IF rev.reviewer_id = inc.created_by THEN
    RAISE EXCEPTION 'publish_requires_second_editor_approval: reviewer is the author';
  END IF;
  IF EXISTS (
    SELECT 1 FROM record.incident_edits e
    WHERE e.incident_id = NEW.id AND e.revision = rev.revision AND e.actor_id = rev.reviewer_id
  ) THEN
    RAISE EXCEPTION 'publish_requires_second_editor_approval: reviewer edited this revision';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM record.users u WHERE u.id = NEW.published_by AND u.role IN ('senior_editor', 'admin')) THEN
    RAISE EXCEPTION 'publish_requires_senior_editor';
  END IF;
  IF NEW.verification_level IS NULL OR NEW.verification_level = 'V0' THEN
    RAISE EXCEPTION 'publish_requires_verification_level';
  END IF;
  IF NEW.legal_status IS NULL THEN
    RAISE EXCEPTION 'publish_requires_legal_status';
  END IF;
  IF NEW.source_count < 1 OR jsonb_array_length(NEW.sources) < 1 THEN
    RAISE EXCEPTION 'publish_requires_source';
  END IF;
  IF cardinality(NEW.perpetrator_names) > 0 AND NOT record.is_charged_or_later(NEW.legal_status) THEN
    RAISE EXCEPTION 'names_require_charge';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.revision <> inc.revision THEN
    RAISE EXCEPTION 'publish_revision_mismatch';
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - skip_cols) IS DISTINCT FROM (to_jsonb(OLD) - skip_cols) THEN
    RAISE EXCEPTION 'published_snapshot_is_immutable: republish through publish_incident()';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record.publish_incident(p_incident_id text, p_note text, p_methodology_version text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  actor uuid := record.current_actor();
  actor_role record.user_role;
  inc record.incidents%ROWTYPE;
  rev record.reviews%ROWTYPE;
  blockers text[];
  prev record.published_incidents%ROWTYPE;
  is_live boolean;
  last_published_revision integer;
  st record.us_states%ROWTYPE;
  v_sources jsonb;
  v_source_count integer;
  v_source_types record.source_type[];
  v_events jsonb;
  v_statements jsonb;
  v_cases jsonb;
  v_case_ids text[];
  v_case_names text;
  v_changed text[];
  v_action record.publication_action;
  v_note text;
BEGIN
  SELECT u.role INTO actor_role FROM record.users u WHERE u.id = actor AND u.active;
  IF actor_role IS NULL OR actor_role NOT IN ('senior_editor', 'admin') THEN
    RAISE EXCEPTION 'publish_requires_senior_editor';
  END IF;
  IF p_methodology_version IS NULL OR btrim(p_methodology_version) = '' THEN
    RAISE EXCEPTION 'publish_requires_methodology_version';
  END IF;

  SELECT * INTO inc FROM record.incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident_not_found';
  END IF;
  IF inc.workflow_status <> 'approved' THEN
    RAISE EXCEPTION 'publish_requires_second_editor_approval';
  END IF;
  SELECT * INTO rev FROM record.reviews r
  WHERE r.incident_id = inc.id AND r.revision = inc.revision AND r.decision = 'approved'
  ORDER BY r.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publish_requires_second_editor_approval';
  END IF;
  blockers := record.publish_blockers(inc.id);
  IF cardinality(blockers) > 0 THEN
    RAISE EXCEPTION 'publish_blocked: %', array_to_string(blockers, ', ');
  END IF;

  SELECT * INTO st FROM record.us_states WHERE fips = inc.state_fips;
  SELECT * INTO prev FROM record.published_incidents WHERE id = inc.id;
  is_live := FOUND;
  SELECT max(p.revision) INTO last_published_revision FROM record.publications p
  WHERE p.incident_id = inc.id AND p.action IN ('published', 'updated');

  IF last_published_revision IS NULL THEN
    v_action := 'published';
    v_note := 'Published.';
    v_changed := '{}';
  ELSE
    IF p_note IS NULL OR btrim(p_note) = '' THEN
      RAISE EXCEPTION 'publish_requires_public_note';
    END IF;
    v_action := CASE WHEN is_live THEN 'updated'::record.publication_action ELSE 'published'::record.publication_action END;
    v_note := btrim(p_note);
    SELECT coalesce(array_agg(DISTINCT c.field ORDER BY c.field), '{}') INTO v_changed
    FROM record.change_log c
    WHERE c.incident_id = inc.id AND c.revision > last_published_revision AND c.revision <= inc.revision
      AND c.field NOT IN ('record', 'workflow_status', 'editor_notes', 'exclusion_reason', 'next_review_due',
                          'published_at', 'first_published_at', 'submitted_at', 'lead_id');
  END IF;

  -- Sources are numbered in editor order; summary markers [n] refer to these.
  WITH s AS (
    SELECT src.*, row_number() OVER (ORDER BY src.position, src.created_at, src.id) AS n
    FROM record.sources src WHERE src.incident_id = inc.id
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'n', s.n, 'outlet', s.outlet, 'title', s.title, 'author', s.author, 'url', s.url,
      'archived_url', s.archived_url, 'published_date', s.published_date, 'accessed_date', s.accessed_date,
      'source_type', s.source_type, 'claim_attribution', s.claim_attribution) ORDER BY s.n), '[]'::jsonb),
    count(*),
    coalesce(array_agg(DISTINCT s.source_type), '{}')
  INTO v_sources, v_source_count, v_source_types
  FROM s;

  WITH s AS (
    SELECT src.id, row_number() OVER (ORDER BY src.position, src.created_at, src.id) AS n
    FROM record.sources src WHERE src.incident_id = inc.id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'date', e.date, 'event_type', e.event_type, 'description', e.description,
      'case_id', e.case_id, 'source_n', s.n) ORDER BY e.date, e.created_at, e.id), '[]'::jsonb)
  INTO v_events
  FROM record.legal_events e LEFT JOIN s ON s.id = e.source_id
  WHERE e.incident_id = inc.id;

  WITH s AS (
    SELECT src.id, row_number() OVER (ORDER BY src.position, src.created_at, src.id) AS n
    FROM record.sources src WHERE src.incident_id = inc.id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'speaker', m.speaker, 'speaker_role', m.speaker_role, 'organization', m.organization,
      'statement_type', m.statement_type, 'date', m.date, 'quote', m.quote,
      'paraphrase', m.paraphrase, 'source_n', s.n) ORDER BY m.date NULLS LAST, m.created_at, m.id), '[]'::jsonb)
  INTO v_statements
  FROM record.statements m LEFT JOIN s ON s.id = m.source_id
  WHERE m.incident_id = inc.id;

  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'court', c.court, 'jurisdiction', c.jurisdiction,
      'docket_number', c.docket_number, 'case_type', c.case_type, 'parties', to_jsonb(c.parties),
      'stage', c.stage, 'next_date', c.next_date, 'courtlistener_url', c.courtlistener_url) ORDER BY c.id), '[]'::jsonb),
    coalesce(array_agg(c.id ORDER BY c.id), '{}'),
    coalesce(string_agg(c.name, ' '), '')
  INTO v_cases, v_case_ids, v_case_names
  FROM record.incident_cases ic JOIN record.cases c ON c.id = ic.case_id
  WHERE ic.incident_id = inc.id;

  DELETE FROM record.published_incidents WHERE id = inc.id;
  INSERT INTO record.published_incidents (
    id, revision, slug, title, summary, date_start, date_end, date_precision, state_fips, county_fips, city,
    lat, lng, map_lat, map_lng, location_precision, incident_types, target_type, target_attributes, severity,
    deaths, injuries, property_damage, perpetrator_type, perpetrator_count, perpetrator_names, bias_indicators,
    hate_crime_charged, agencies_involved, related_incident_ids, tags, state_code, verification_level,
    legal_status, case_ids, source_types, source_count, sources, legal_events, statements, cases,
    methodology_version, is_demo, created_at, published_at, updated_at, approved_review_id, published_by,
    search_text
  ) VALUES (
    inc.id, inc.revision, inc.slug, inc.title, inc.summary, inc.date_start, inc.date_end, inc.date_precision,
    inc.state_fips, inc.county_fips, inc.city, inc.lat, inc.lng, inc.map_lat, inc.map_lng, inc.location_precision,
    inc.incident_types, inc.target_type, inc.target_attributes, inc.severity, inc.deaths, inc.injuries,
    inc.property_damage, inc.perpetrator_type, inc.perpetrator_count, inc.perpetrator_names, inc.bias_indicators,
    inc.hate_crime_charged, inc.agencies_involved, inc.related_incident_ids, inc.tags, st.code,
    inc.verification_level, inc.legal_status, v_case_ids, v_source_types, v_source_count, v_sources, v_events,
    v_statements, v_cases, p_methodology_version, inc.is_demo, inc.created_at,
    coalesce(inc.first_published_at, now()), now(), rev.id, actor,
    concat_ws(' ', inc.title, regexp_replace(inc.summary, '\[[0-9]+\]', '', 'g'), inc.city, st.name, v_case_names)
  );

  PERFORM set_config('record.publishing', inc.id, true);
  UPDATE record.incidents SET
    workflow_status = 'published',
    published_at = now(),
    first_published_at = coalesce(first_published_at, now()),
    next_review_due = CASE WHEN record.is_final_status(inc.legal_status) THEN NULL ELSE current_date + 30 END
  WHERE id = inc.id;
  PERFORM set_config('record.publishing', '', true);

  INSERT INTO record.publications (incident_id, revision, action, public_note, changed_fields, actor_id, review_id)
  VALUES (inc.id, inc.revision, v_action, v_note, v_changed, actor, rev.id);
  INSERT INTO record.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (actor, 'incident.' || v_action, 'incident', inc.id,
          jsonb_build_object('revision', inc.revision, 'review_id', rev.id, 'note', v_note));
  RETURN inc.revision;
END
$$;
--> statement-breakpoint
-- Takedown. One senior editor may remove a record at once (e.g. a victim's
-- privacy request); putting it back goes through review again.
CREATE OR REPLACE FUNCTION record.unpublish_incident(p_incident_id text, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
DECLARE
  actor uuid := record.current_actor();
  actor_role record.user_role;
  snap record.published_incidents%ROWTYPE;
BEGIN
  SELECT u.role INTO actor_role FROM record.users u WHERE u.id = actor AND u.active;
  IF actor_role IS NULL OR actor_role NOT IN ('senior_editor', 'admin') THEN
    RAISE EXCEPTION 'unpublish_requires_senior_editor';
  END IF;
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RAISE EXCEPTION 'unpublish_requires_reason';
  END IF;
  DELETE FROM record.published_incidents WHERE id = p_incident_id RETURNING * INTO snap;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_published';
  END IF;
  PERFORM set_config('record.publishing', p_incident_id, true);
  UPDATE record.incidents SET workflow_status = 'unpublished' WHERE id = p_incident_id;
  PERFORM set_config('record.publishing', '', true);
  INSERT INTO record.publications (incident_id, revision, action, public_note, actor_id)
  VALUES (p_incident_id, snap.revision, 'unpublished', btrim(p_note), actor);
  INSERT INTO record.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (actor, 'incident.unpublished', 'incident', p_incident_id, jsonb_build_object('note', btrim(p_note)));
END
$$;
--> statement-breakpoint
-- The archiving job may fill in archived_url on a live record without a new
-- review: it only adds the archived copy of a source that was already reviewed.
CREATE OR REPLACE FUNCTION record.refresh_archived_urls(p_incident_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = record, pg_catalog, pg_temp AS $$
BEGIN
  UPDATE record.published_incidents p SET
    sources = (
      SELECT coalesce(jsonb_agg(
        CASE WHEN (elem ->> 'archived_url') IS NULL AND a.archived_url IS NOT NULL
             THEN jsonb_set(elem, '{archived_url}', to_jsonb(a.archived_url))
             ELSE elem END
        ORDER BY (elem ->> 'n')::int), '[]'::jsonb)
      FROM jsonb_array_elements(p.sources) elem
      LEFT JOIN LATERAL (
        SELECT s.archived_url FROM record.sources s
        WHERE s.incident_id = p.id AND s.url = elem ->> 'url' AND s.archived_url IS NOT NULL
        ORDER BY s.archived_at DESC NULLS LAST LIMIT 1
      ) a ON true
    ),
    updated_at = p.updated_at
  WHERE p.id = p_incident_id;
END
$$;
--> statement-breakpoint

-- 7. Append-only tables ------------------------------------------------------
CREATE OR REPLACE FUNCTION record.forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only: % rows cannot be changed or deleted', TG_TABLE_NAME;
END
$$;
--> statement-breakpoint

-- Triggers --------------------------------------------------------------------
CREATE TRIGGER a_incidents_before_insert BEFORE INSERT ON record.incidents
  FOR EACH ROW EXECUTE FUNCTION record.incidents_before_insert();
--> statement-breakpoint
CREATE TRIGGER b_incidents_map_position BEFORE INSERT OR UPDATE ON record.incidents
  FOR EACH ROW EXECUTE FUNCTION record.set_map_position();
--> statement-breakpoint
CREATE TRIGGER c_incidents_before_update BEFORE UPDATE ON record.incidents
  FOR EACH ROW EXECUTE FUNCTION record.incidents_before_update();
--> statement-breakpoint
CREATE TRIGGER incidents_after_insert AFTER INSERT ON record.incidents
  FOR EACH ROW EXECUTE FUNCTION record.incidents_after_insert();
--> statement-breakpoint
CREATE TRIGGER incidents_log_changes AFTER UPDATE ON record.incidents
  FOR EACH ROW EXECUTE FUNCTION record.incidents_log_changes();
--> statement-breakpoint
CREATE TRIGGER sources_changed AFTER INSERT OR UPDATE OR DELETE ON record.sources
  FOR EACH ROW EXECUTE FUNCTION record.child_changed();
--> statement-breakpoint
CREATE TRIGGER legal_events_changed AFTER INSERT OR UPDATE OR DELETE ON record.legal_events
  FOR EACH ROW EXECUTE FUNCTION record.child_changed();
--> statement-breakpoint
CREATE TRIGGER statements_changed AFTER INSERT OR UPDATE OR DELETE ON record.statements
  FOR EACH ROW EXECUTE FUNCTION record.child_changed();
--> statement-breakpoint
CREATE TRIGGER incident_cases_changed AFTER INSERT OR UPDATE OR DELETE ON record.incident_cases
  FOR EACH ROW EXECUTE FUNCTION record.child_changed();
--> statement-breakpoint
CREATE TRIGGER legal_events_source_check BEFORE INSERT OR UPDATE ON record.legal_events
  FOR EACH ROW EXECUTE FUNCTION record.check_source_same_incident();
--> statement-breakpoint
CREATE TRIGGER statements_source_check BEFORE INSERT OR UPDATE ON record.statements
  FOR EACH ROW EXECUTE FUNCTION record.check_source_same_incident();
--> statement-breakpoint
CREATE TRIGGER reviews_before_insert BEFORE INSERT ON record.reviews
  FOR EACH ROW EXECUTE FUNCTION record.reviews_before_insert();
--> statement-breakpoint
CREATE TRIGGER reviews_after_insert AFTER INSERT ON record.reviews
  FOR EACH ROW EXECUTE FUNCTION record.reviews_after_insert();
--> statement-breakpoint
CREATE TRIGGER published_incidents_rules BEFORE INSERT OR UPDATE ON record.published_incidents
  FOR EACH ROW EXECUTE FUNCTION record.enforce_publish_rules();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON record.audit_log
  FOR EACH ROW EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON record.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER reviews_append_only BEFORE UPDATE OR DELETE ON record.reviews
  FOR EACH ROW EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER reviews_no_truncate BEFORE TRUNCATE ON record.reviews
  FOR EACH STATEMENT EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER publications_append_only BEFORE UPDATE OR DELETE ON record.publications
  FOR EACH ROW EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER publications_no_truncate BEFORE TRUNCATE ON record.publications
  FOR EACH STATEMENT EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER change_log_append_only BEFORE UPDATE OR DELETE ON record.change_log
  FOR EACH ROW EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER change_log_no_truncate BEFORE TRUNCATE ON record.change_log
  FOR EACH STATEMENT EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint
CREATE TRIGGER incident_edits_append_only BEFORE UPDATE OR DELETE ON record.incident_edits
  FOR EACH ROW EXECUTE FUNCTION record.forbid_change();
--> statement-breakpoint

-- 9. Public views ----------------------------------------------------------------
-- Demo records are visible only where the database sets record.allow_demo=on
-- (local development and tests). Production never sets it.
CREATE VIEW record_public.incidents WITH (security_barrier = true) AS
-- Enum columns are exposed as text so the public role needs no access to the
-- internal schema, not even to resolve type names.
SELECT
  p.id, p.slug, p.title, p.summary, p.date_start, p.date_end,
  p.date_precision::text AS date_precision,
  p.state_fips, p.state_code, p.county_fips, p.city, p.lat, p.lng, p.map_lat, p.map_lng,
  p.location_precision::text AS location_precision,
  p.incident_types::text[] AS incident_types,
  p.target_type::text AS target_type,
  p.target_attributes::text[] AS target_attributes,
  p.severity, p.deaths, p.injuries,
  p.property_damage::text AS property_damage,
  p.perpetrator_type::text AS perpetrator_type,
  p.perpetrator_count, p.perpetrator_names,
  p.bias_indicators::text[] AS bias_indicators,
  p.verification_level::text AS verification_level,
  p.legal_status::text AS legal_status,
  p.hate_crime_charged::text AS hate_crime_charged,
  p.agencies_involved, p.case_ids, p.related_incident_ids, p.tags,
  p.source_types::text[] AS source_types,
  p.source_count, p.sources, p.legal_events, p.statements, p.cases,
  coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'date', to_char(pub.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'action', pub.action,
      'note', pub.public_note,
      'changed_fields', to_jsonb(pub.changed_fields),
      'revision', pub.revision) ORDER BY pub.id)
    FROM record.publications pub
    WHERE pub.incident_id = p.id
  ), '[]'::jsonb) AS change_log,
  p.methodology_version, p.is_demo, p.created_at, p.published_at, p.updated_at,
  p.search_text, p.search_document
FROM record.published_incidents p
WHERE p.verification_level IN ('V1', 'V2', 'V3')
  AND (NOT p.is_demo OR coalesce(current_setting('record.allow_demo', true), '') = 'on');
--> statement-breakpoint
CREATE VIEW record_public.dataset_releases AS
SELECT version, created_at, methodology_version, record_count, csv_sha256, json_sha256,
       octet_length(csv) AS csv_bytes, octet_length(json) AS json_bytes, previous_version, changelog
FROM record.dataset_releases;
--> statement-breakpoint
CREATE VIEW record_public.dataset_files AS
SELECT version, csv, json, csv_sha256, json_sha256 FROM record.dataset_releases;
--> statement-breakpoint

-- 8. Privileges and row-level security ----------------------------------------
REVOKE ALL ON SCHEMA record FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SCHEMA record_public FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA record FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA record FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA record TO record_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA record_public TO record_app, record_public;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA record_public TO record_app, record_public;
--> statement-breakpoint
-- Working tables the admin app edits.
GRANT SELECT, INSERT, UPDATE ON
  record.incidents, record.cases, record.leads, record.submissions, record.correction_tickets,
  record.users, record.dataset_releases, record.id_counters
TO record_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  record.sources, record.legal_events, record.statements, record.incident_cases, record.sessions,
  record.rate_limits, record.submission_private, record.submission_files
TO record_app;
--> statement-breakpoint
-- Append-only from the app's side.
GRANT SELECT, INSERT ON record.reviews, record.audit_log TO record_app;
--> statement-breakpoint
-- Written only by triggers and SECURITY DEFINER functions.
GRANT SELECT ON record.change_log, record.incident_edits, record.publications, record.published_incidents, record.us_states TO record_app;
--> statement-breakpoint
GRANT USAGE ON ALL SEQUENCES IN SCHEMA record TO record_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  record.current_actor(), record.change_reason(), record.next_id(text, integer),
  record.publish_blockers(text), record.publish_incident(text, text, text), record.unpublish_incident(text, text),
  record.refresh_archived_urls(text), record.legal_event_establishes(record.legal_event_type, record.legal_status),
  record.is_charged_or_later(record.legal_status), record.is_final_status(record.legal_status)
TO record_app;
--> statement-breakpoint
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'record' LOOP
    EXECUTE format('ALTER TABLE record.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('CREATE POLICY record_app_access ON record.%I TO record_app USING (true) WITH CHECK (true)', t.tablename);
  END LOOP;
END
$$;
--> statement-breakpoint
-- Supabase installs PostGIS and pg_trgm in an `extensions` schema. The runtime
-- roles need to resolve those functions (search, duplicate finder).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    BEGIN
      GRANT USAGE ON SCHEMA extensions TO record_app, record_public;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Could not grant USAGE on schema extensions; grant it manually (see docs/DEPLOY.md).';
    END;
    ALTER ROLE record_app SET search_path = "$user", public, extensions;
    ALTER ROLE record_public SET search_path = "$user", public, extensions;
  END IF;
END
$$;

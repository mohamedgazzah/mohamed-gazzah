CREATE SCHEMA "record_public";
--> statement-breakpoint
CREATE SCHEMA "record";
--> statement-breakpoint
CREATE TYPE "record"."archive_status" AS ENUM('pending', 'archived', 'failed');--> statement-breakpoint
CREATE TYPE "record"."bias_indicator" AS ENUM('slur', 'stated_motive', 'symbol', 'target_selection', 'official_finding', 'hate_crime_charge');--> statement-breakpoint
CREATE TYPE "record"."case_type" AS ENUM('criminal', 'civil_rights', 'administrative');--> statement-breakpoint
CREATE TYPE "record"."correction_status" AS ENUM('open', 'responded', 'resolved', 'declined');--> statement-breakpoint
CREATE TYPE "record"."temporal_precision" AS ENUM('day', 'month', 'year');--> statement-breakpoint
CREATE TYPE "record"."incident_type" AS ENUM('HOM', 'ASLT', 'THRT', 'HARS', 'VAND', 'ARSN', 'DESC', 'MASS', 'PLOT', 'OFCL', 'SCHL', 'EMPL');--> statement-breakpoint
CREATE TYPE "record"."lead_source" AS ENUM('submission', 'news_monitor', 'org_feed', 'docket_alert', 'manual');--> statement-breakpoint
CREATE TYPE "record"."lead_status" AS ENUM('new', 'new_incident', 'update', 'duplicate', 'out_of_scope');--> statement-breakpoint
CREATE TYPE "record"."legal_event_type" AS ENUM('reported', 'under_investigation', 'suspect_identified', 'arrested', 'charged', 'hate_crime_charge_filed', 'arraignment', 'in_court', 'plea_entered', 'plea_deal', 'trial', 'verdict', 'convicted', 'acquitted', 'dismissed', 'deferred', 'sentenced', 'no_arrest', 'suspect_deceased', 'not_prosecuted', 'civil_suit', 'other');--> statement-breakpoint
CREATE TYPE "record"."legal_status" AS ENUM('reported', 'under_investigation', 'suspect_identified', 'arrested', 'charged', 'in_court', 'convicted', 'acquitted', 'dismissed', 'plea_deal', 'deferred', 'sentenced', 'no_arrest', 'suspect_deceased', 'not_prosecuted', 'unknown');--> statement-breakpoint
CREATE TYPE "record"."location_precision" AS ENUM('exact_public_place', 'neighborhood', 'city', 'state');--> statement-breakpoint
CREATE TYPE "record"."perpetrator_type" AS ENUM('individual', 'group', 'organized_extremist_group', 'public_official', 'law_enforcement', 'unknown');--> statement-breakpoint
CREATE TYPE "record"."publication_action" AS ENUM('published', 'updated', 'unpublished');--> statement-breakpoint
CREATE TYPE "record"."reporter_relation" AS ENUM('victim', 'witness', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "record"."review_decision" AS ENUM('approved', 'returned');--> statement-breakpoint
CREATE TYPE "record"."source_type" AS ENUM('news', 'police', 'prosecutor', 'court_record', 'government', 'advocacy_org', 'academic', 'social_media', 'victim_statement');--> statement-breakpoint
CREATE TYPE "record"."statement_type" AS ENUM('official', 'defense', 'community');--> statement-breakpoint
CREATE TYPE "record"."submission_kind" AS ENUM('report', 'correction');--> statement-breakpoint
CREATE TYPE "record"."target_attribute" AS ENUM('woman_wearing_hijab', 'child', 'student', 'religious_leader', 'arab', 'south_asian', 'black_muslim', 'perceived_muslim');--> statement-breakpoint
CREATE TYPE "record"."target_type" AS ENUM('individual', 'multiple_individuals', 'mosque_islamic_center', 'school', 'business', 'home', 'vehicle', 'other');--> statement-breakpoint
CREATE TYPE "record"."user_role" AS ENUM('contributor', 'editor', 'senior_editor', 'admin');--> statement-breakpoint
CREATE TYPE "record"."verification_level" AS ENUM('V0', 'V1', 'V2', 'V3');--> statement-breakpoint
CREATE TYPE "record"."workflow_status" AS ENUM('draft', 'in_review', 'returned', 'approved', 'published', 'unpublished', 'excluded');--> statement-breakpoint
CREATE TYPE "record"."yes_no_unknown" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TABLE "record"."audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."cases" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"court" text,
	"jurisdiction" text,
	"docket_number" text,
	"case_type" "record"."case_type" NOT NULL,
	"parties" text[] DEFAULT '{}' NOT NULL,
	"stage" text,
	"next_date" date,
	"courtlistener_url" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cases_id_format" CHECK ("record"."cases"."id" ~ '^(CASE|DEMO-CASE)-[0-9]{4}-[0-9]{4,}$')
);
--> statement-breakpoint
CREATE TABLE "record"."change_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"revision" integer NOT NULL,
	"actor_id" uuid,
	"field" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."correction_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" text NOT NULL,
	"submission_id" uuid NOT NULL,
	"status" "record"."correction_status" DEFAULT 'open' NOT NULL,
	"is_privacy_request" boolean DEFAULT false NOT NULL,
	"response_due_at" timestamp with time zone NOT NULL,
	"fix_due_at" timestamp with time zone NOT NULL,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."dataset_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"methodology_version" text NOT NULL,
	"record_count" integer NOT NULL,
	"csv" text NOT NULL,
	"json" text NOT NULL,
	"csv_sha256" char(64) NOT NULL,
	"json_sha256" char(64) NOT NULL,
	"previous_version" text,
	"changelog" jsonb NOT NULL,
	CONSTRAINT "dataset_releases_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "record"."id_counters" (
	"scope" text PRIMARY KEY NOT NULL,
	"next" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."incident_cases" (
	"incident_id" text NOT NULL,
	"case_id" text NOT NULL,
	CONSTRAINT "incident_cases_incident_id_case_id_pk" PRIMARY KEY("incident_id","case_id")
);
--> statement-breakpoint
CREATE TABLE "record"."incident_edits" (
	"incident_id" text NOT NULL,
	"revision" integer NOT NULL,
	"actor_id" uuid NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incident_edits_incident_id_revision_actor_id_pk" PRIMARY KEY("incident_id","revision","actor_id")
);
--> statement-breakpoint
CREATE TABLE "record"."incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" varchar(110) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"date_start" date NOT NULL,
	"date_end" date,
	"date_precision" "record"."temporal_precision" DEFAULT 'day' NOT NULL,
	"state_fips" char(2) NOT NULL,
	"county_fips" char(5),
	"city" text,
	"lat" double precision,
	"lng" double precision,
	"map_lat" double precision,
	"map_lng" double precision,
	"location_precision" "record"."location_precision" DEFAULT 'city' NOT NULL,
	"incident_types" "record"."incident_type"[] NOT NULL,
	"target_type" "record"."target_type" NOT NULL,
	"target_attributes" "record"."target_attribute"[] DEFAULT '{}' NOT NULL,
	"severity" smallint NOT NULL,
	"deaths" integer,
	"injuries" integer,
	"property_damage" "record"."yes_no_unknown" DEFAULT 'unknown' NOT NULL,
	"perpetrator_type" "record"."perpetrator_type" DEFAULT 'unknown' NOT NULL,
	"perpetrator_count" integer,
	"perpetrator_names" text[] DEFAULT '{}' NOT NULL,
	"bias_indicators" "record"."bias_indicator"[] DEFAULT '{}' NOT NULL,
	"hate_crime_charged" "record"."yes_no_unknown" DEFAULT 'unknown' NOT NULL,
	"agencies_involved" text[] DEFAULT '{}' NOT NULL,
	"related_incident_ids" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"verification_level" "record"."verification_level" DEFAULT 'V0' NOT NULL,
	"legal_status" "record"."legal_status",
	"editor_notes" text DEFAULT '' NOT NULL,
	"workflow_status" "record"."workflow_status" DEFAULT 'draft' NOT NULL,
	"exclusion_reason" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"revision_txid" bigint,
	"is_demo" boolean DEFAULT false NOT NULL,
	"lead_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"first_published_at" timestamp with time zone,
	"next_review_due" date,
	"geom" geometry(point) GENERATED ALWAYS AS (CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326) END) STORED,
	CONSTRAINT "incidents_id_format" CHECK ("record"."incidents"."id" ~ '^(US|DEMO)-[0-9]{4}-[0-9]{4,}$'),
	CONSTRAINT "incidents_demo_flag" CHECK ("record"."incidents"."is_demo" = ("record"."incidents"."id" LIKE 'DEMO-%')),
	CONSTRAINT "incidents_title_length" CHECK (char_length("record"."incidents"."title") BETWEEN 1 AND 110),
	CONSTRAINT "incidents_dates" CHECK ("record"."incidents"."date_end" IS NULL OR "record"."incidents"."date_end" >= "record"."incidents"."date_start"),
	CONSTRAINT "incidents_severity" CHECK ("record"."incidents"."severity" BETWEEN 1 AND 5),
	CONSTRAINT "incidents_types_nonempty" CHECK (cardinality("record"."incidents"."incident_types") >= 1),
	CONSTRAINT "incidents_counts" CHECK (coalesce("record"."incidents"."deaths", 0) >= 0 AND coalesce("record"."incidents"."injuries", 0) >= 0 AND coalesce("record"."incidents"."perpetrator_count", 0) >= 0),
	CONSTRAINT "incidents_lat" CHECK ("record"."incidents"."lat" IS NULL OR "record"."incidents"."lat" BETWEEN -90 AND 90),
	CONSTRAINT "incidents_lng" CHECK ("record"."incidents"."lng" IS NULL OR "record"."incidents"."lng" BETWEEN -180 AND 180),
	CONSTRAINT "incidents_county_fips" CHECK ("record"."incidents"."county_fips" IS NULL OR "record"."incidents"."county_fips" ~ '^[0-9]{5}$'),
	CONSTRAINT "incidents_excluded_reason" CHECK ("record"."incidents"."workflow_status" <> 'excluded' OR coalesce(trim("record"."incidents"."exclusion_reason"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "record"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "record"."lead_source" NOT NULL,
	"status" "record"."lead_status" DEFAULT 'new' NOT NULL,
	"headline" text NOT NULL,
	"url" text,
	"outlet" text,
	"published_date" date,
	"matched_terms" text[] DEFAULT '{}' NOT NULL,
	"submission_id" uuid,
	"incident_id" text,
	"triage_reason" text,
	"triaged_by" uuid,
	"triaged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_out_of_scope_reason" CHECK ("record"."leads"."status" <> 'out_of_scope' OR coalesce(trim("record"."leads"."triage_reason"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "record"."legal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" text NOT NULL,
	"case_id" text,
	"date" date NOT NULL,
	"event_type" "record"."legal_event_type" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."publications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"revision" integer NOT NULL,
	"action" "record"."publication_action" NOT NULL,
	"public_note" text NOT NULL,
	"changed_fields" text[] DEFAULT '{}' NOT NULL,
	"actor_id" uuid NOT NULL,
	"review_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publications_note" CHECK (btrim("record"."publications"."public_note") <> '')
);
--> statement-breakpoint
CREATE TABLE "record"."published_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"slug" text NOT NULL,
	"title" varchar(110) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"date_start" date NOT NULL,
	"date_end" date,
	"date_precision" "record"."temporal_precision" DEFAULT 'day' NOT NULL,
	"state_fips" char(2) NOT NULL,
	"county_fips" char(5),
	"city" text,
	"lat" double precision,
	"lng" double precision,
	"map_lat" double precision,
	"map_lng" double precision,
	"location_precision" "record"."location_precision" DEFAULT 'city' NOT NULL,
	"incident_types" "record"."incident_type"[] NOT NULL,
	"target_type" "record"."target_type" NOT NULL,
	"target_attributes" "record"."target_attribute"[] DEFAULT '{}' NOT NULL,
	"severity" smallint NOT NULL,
	"deaths" integer,
	"injuries" integer,
	"property_damage" "record"."yes_no_unknown" DEFAULT 'unknown' NOT NULL,
	"perpetrator_type" "record"."perpetrator_type" DEFAULT 'unknown' NOT NULL,
	"perpetrator_count" integer,
	"perpetrator_names" text[] DEFAULT '{}' NOT NULL,
	"bias_indicators" "record"."bias_indicator"[] DEFAULT '{}' NOT NULL,
	"hate_crime_charged" "record"."yes_no_unknown" DEFAULT 'unknown' NOT NULL,
	"agencies_involved" text[] DEFAULT '{}' NOT NULL,
	"related_incident_ids" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"state_code" char(2) NOT NULL,
	"verification_level" "record"."verification_level" NOT NULL,
	"legal_status" "record"."legal_status" NOT NULL,
	"case_ids" text[] DEFAULT '{}' NOT NULL,
	"source_types" "record"."source_type"[] NOT NULL,
	"source_count" integer NOT NULL,
	"sources" jsonb NOT NULL,
	"legal_events" jsonb NOT NULL,
	"statements" jsonb NOT NULL,
	"cases" jsonb NOT NULL,
	"methodology_version" text NOT NULL,
	"is_demo" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"approved_review_id" uuid NOT NULL,
	"published_by" uuid NOT NULL,
	"search_text" text NOT NULL,
	"search_document" "tsvector" GENERATED ALWAYS AS (to_tsvector('english'::regconfig, search_text)) STORED,
	"geom" geometry(point) GENERATED ALWAYS AS (CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326) END) STORED,
	CONSTRAINT "published_not_v0" CHECK ("record"."published_incidents"."verification_level" <> 'V0'),
	CONSTRAINT "published_has_sources" CHECK ("record"."published_incidents"."source_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "record"."rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "record"."reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" text NOT NULL,
	"revision" integer NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" "record"."review_decision" NOT NULL,
	"comments" text DEFAULT '' NOT NULL,
	"chk_sources_cited" boolean DEFAULT false NOT NULL,
	"chk_allegations_labelled" boolean DEFAULT false NOT NULL,
	"chk_victim_privacy" boolean DEFAULT false NOT NULL,
	"chk_location_precision" boolean DEFAULT false NOT NULL,
	"chk_taxonomy_correct" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_checklist_complete" CHECK ("record"."reviews"."decision" <> 'approved' OR ("record"."reviews"."chk_sources_cited" AND "record"."reviews"."chk_allegations_labelled" AND "record"."reviews"."chk_victim_privacy" AND "record"."reviews"."chk_location_precision" AND "record"."reviews"."chk_taxonomy_correct")),
	CONSTRAINT "reviews_return_comments" CHECK ("record"."reviews"."decision" <> 'returned' OR btrim("record"."reviews"."comments") <> '')
);
--> statement-breakpoint
CREATE TABLE "record"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"mfa_verified_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" text NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	"archived_url" text,
	"archive_status" "record"."archive_status" DEFAULT 'pending' NOT NULL,
	"archive_attempts" integer DEFAULT 0 NOT NULL,
	"archive_job_id" text,
	"archive_last_error" text,
	"archived_at" timestamp with time zone,
	"outlet" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"published_date" date,
	"accessed_date" date DEFAULT CURRENT_DATE NOT NULL,
	"source_type" "record"."source_type" NOT NULL,
	"claim_attribution" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_url_scheme" CHECK ("record"."sources"."url" ~* '^https?://')
);
--> statement-breakpoint
CREATE TABLE "record"."statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" text NOT NULL,
	"speaker" text NOT NULL,
	"speaker_role" text,
	"organization" text,
	"statement_type" "record"."statement_type" NOT NULL,
	"date" date,
	"quote" text,
	"paraphrase" text,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statements_has_text" CHECK ("record"."statements"."quote" IS NOT NULL OR "record"."statements"."paraphrase" IS NOT NULL),
	CONSTRAINT "statements_quote_25_words" CHECK ("record"."statements"."quote" IS NULL OR cardinality(regexp_split_to_array(btrim("record"."statements"."quote"), '\s+')) <= 25)
);
--> statement-breakpoint
CREATE TABLE "record"."submission_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"original_name_enc" text,
	"metadata_stripped" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."submission_private" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"contact_enc" text,
	"address_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record"."submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "record"."submission_kind" NOT NULL,
	"what_happened" text NOT NULL,
	"incident_date" date,
	"city" text,
	"state_fips" char(2),
	"links" text[] DEFAULT '{}' NOT NULL,
	"reporter_relation" "record"."reporter_relation",
	"correction_record_id" text,
	"is_privacy_request" boolean DEFAULT false NOT NULL,
	"keep_consent" boolean DEFAULT false NOT NULL,
	"has_contact" boolean DEFAULT false NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	CONSTRAINT "submissions_city_required" CHECK ("record"."submissions"."kind" = 'correction' OR "record"."submissions"."city" IS NOT NULL),
	CONSTRAINT "submissions_correction_record" CHECK ("record"."submissions"."kind" = 'report' OR "record"."submissions"."correction_record_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "record"."us_states" (
	"fips" char(2) PRIMARY KEY NOT NULL,
	"code" char(2) NOT NULL,
	"name" text NOT NULL,
	"territory" boolean DEFAULT false NOT NULL,
	CONSTRAINT "us_states_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "record"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "record"."user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"totp_secret_enc" text,
	"totp_pending_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"totp_last_step" bigint,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "record"."audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."cases" ADD CONSTRAINT "cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."change_log" ADD CONSTRAINT "change_log_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."change_log" ADD CONSTRAINT "change_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."correction_tickets" ADD CONSTRAINT "correction_tickets_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "record"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."correction_tickets" ADD CONSTRAINT "correction_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."incident_cases" ADD CONSTRAINT "incident_cases_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."incident_cases" ADD CONSTRAINT "incident_cases_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "record"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."incident_edits" ADD CONSTRAINT "incident_edits_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."incident_edits" ADD CONSTRAINT "incident_edits_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."incidents" ADD CONSTRAINT "incidents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "record"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."incidents" ADD CONSTRAINT "incidents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."leads" ADD CONSTRAINT "leads_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "record"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."leads" ADD CONSTRAINT "leads_triaged_by_users_id_fk" FOREIGN KEY ("triaged_by") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."legal_events" ADD CONSTRAINT "legal_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."legal_events" ADD CONSTRAINT "legal_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "record"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."legal_events" ADD CONSTRAINT "legal_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "record"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."publications" ADD CONSTRAINT "publications_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."publications" ADD CONSTRAINT "publications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."publications" ADD CONSTRAINT "publications_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "record"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."published_incidents" ADD CONSTRAINT "published_incidents_id_incidents_id_fk" FOREIGN KEY ("id") REFERENCES "record"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."published_incidents" ADD CONSTRAINT "published_incidents_approved_review_id_reviews_id_fk" FOREIGN KEY ("approved_review_id") REFERENCES "record"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."published_incidents" ADD CONSTRAINT "published_incidents_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."reviews" ADD CONSTRAINT "reviews_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "record"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."sources" ADD CONSTRAINT "sources_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."sources" ADD CONSTRAINT "sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "record"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."statements" ADD CONSTRAINT "statements_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "record"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."statements" ADD CONSTRAINT "statements_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "record"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "record"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."submission_private" ADD CONSTRAINT "submission_private_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "record"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record"."submissions" ADD CONSTRAINT "submissions_state_fips_us_states_fips_fk" FOREIGN KEY ("state_fips") REFERENCES "record"."us_states"("fips") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "record"."audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "record"."audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "change_log_incident_idx" ON "record"."change_log" USING btree ("incident_id","id");--> statement-breakpoint
CREATE INDEX "corrections_status_idx" ON "record"."correction_tickets" USING btree ("status","response_due_at");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "record"."incidents" USING btree ("workflow_status");--> statement-breakpoint
CREATE INDEX "incidents_date_idx" ON "record"."incidents" USING btree ("date_start");--> statement-breakpoint
CREATE INDEX "incidents_geom_idx" ON "record"."incidents" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "incidents_title_trgm_idx" ON "record"."incidents" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "record"."leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "legal_events_incident_idx" ON "record"."legal_events" USING btree ("incident_id","date");--> statement-breakpoint
CREATE INDEX "publications_incident_idx" ON "record"."publications" USING btree ("incident_id","id");--> statement-breakpoint
CREATE INDEX "published_date_idx" ON "record"."published_incidents" USING btree ("date_start","id");--> statement-breakpoint
CREATE INDEX "published_state_idx" ON "record"."published_incidents" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "published_search_idx" ON "record"."published_incidents" USING gin ("search_document");--> statement-breakpoint
CREATE INDEX "published_search_trgm_idx" ON "record"."published_incidents" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "published_types_idx" ON "record"."published_incidents" USING gin ("incident_types");--> statement-breakpoint
CREATE INDEX "published_geom_idx" ON "record"."published_incidents" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "reviews_incident_idx" ON "record"."reviews" USING btree ("incident_id","revision");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "record"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sources_incident_idx" ON "record"."sources" USING btree ("incident_id","position");--> statement-breakpoint
CREATE INDEX "sources_archive_idx" ON "record"."sources" USING btree ("archive_status","created_at");--> statement-breakpoint
CREATE INDEX "statements_incident_idx" ON "record"."statements" USING btree ("incident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "record"."users" USING btree (lower("email"));
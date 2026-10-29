CREATE TYPE "record"."news_candidate_status" AS ENUM('pending', 'working', 'lead', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "record"."news_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"headline" text NOT NULL,
	"outlet" text,
	"published_at" timestamp with time zone,
	"feed" text NOT NULL,
	"lead_source" "record"."lead_source" NOT NULL,
	"matched_terms" text[] DEFAULT '{}' NOT NULL,
	"snippet" text,
	"status" "record"."news_candidate_status" DEFAULT 'pending' NOT NULL,
	"assessment" jsonb,
	"model" text,
	"usage" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"note" text,
	"lead_id" uuid,
	"claimed_at" timestamp with time zone,
	"assessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "record"."news_candidates" ADD CONSTRAINT "news_candidates_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "record"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_candidates_url_key" ON "record"."news_candidates" USING btree ("url");--> statement-breakpoint
CREATE INDEX "news_candidates_status_idx" ON "record"."news_candidates" USING btree ("status","created_at");--> statement-breakpoint
-- Private, like leads: the admin app and the scan job (record_app) use it; the public role never sees it.
REVOKE ALL ON record.news_candidates FROM PUBLIC;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON record.news_candidates TO record_app;
--> statement-breakpoint
-- Row-level security on every internal table (see 0002_rules.sql): the app role sees all, other roles nothing.
ALTER TABLE record.news_candidates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY record_app_access ON record.news_candidates TO record_app USING (true) WITH CHECK (true);

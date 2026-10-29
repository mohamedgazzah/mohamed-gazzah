-- Extensions the schema depends on. On Supabase these already exist in the
-- `extensions` schema; IF NOT EXISTS makes this a no-op there.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- Runtime roles. They start without LOGIN; `npm run db:migrate` then gives
-- them the passwords in DATABASE_URL and PUBLIC_DATABASE_URL. Creating roles
-- needs CREATEROLE, which the migration owner has locally and on Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'record_app') THEN
    CREATE ROLE record_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'record_public') THEN
    CREATE ROLE record_public NOLOGIN;
  END IF;
END
$$;

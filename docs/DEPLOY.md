# Deploying to Vercel and Supabase

This guide takes the app from this repository to a public site on Vercel, with
the database and evidence storage on Supabase, behind Cloudflare. Everything
below works on the free tiers except where marked **paid**; nothing paid is
required to launch.

Before you start, have: a Supabase account, a Vercel account, a Cloudflare
account with the site's domain, and Node.js 22 locally.

## 1. Database (Supabase)

1. **Create a project.** Choose a region near the team. Save the database password.
2. **Extensions.** Database → Extensions: enable `postgis` and `pg_trgm` (the first
   migration also tries to create them).
3. **Do not expose the app's schemas to the Data API.** Project Settings → API →
   "Exposed schemas" must not list `record` or `record_public` (the default lists only
   `public`). The app talks to Postgres directly; nothing goes through PostgREST.
4. **Run the migrations** from your machine as the owner (`postgres`), using the
   *direct* or *session pooler* connection string (port 5432):

   ```bash
   export MIGRATION_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
   export DATABASE_CA_CERT="$(cat prod-ca-2021.crt)"   # see step 6
   npm run db:migrate
   ```

   This creates the `record` and `record_public` schemas, every table, the
   database rules (two-person review, publish checks, append-only history),
   row-level security, and two runtime roles without passwords. Supabase keeps
   PostGIS and pg_trgm in an `extensions` schema; the migration grants both roles
   access to it. If it prints a notice that it could not, run
   `GRANT USAGE ON SCHEMA extensions TO record_app, record_public;` in the SQL editor.
5. **Give the runtime roles passwords.** In the SQL editor (use two long random passwords):

   ```sql
   ALTER ROLE record_app    WITH LOGIN PASSWORD '<app password>';
   ALTER ROLE record_public WITH LOGIN PASSWORD '<public password>';
   ```

   With Supabase's pooler, custom roles connect as `<role>.<project-ref>`. Use the
   **transaction pooler** (port 6543) for both runtime URLs:

   ```
   DATABASE_URL=postgresql://record_app.<ref>:<app password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   PUBLIC_DATABASE_URL=postgresql://record_public.<ref>:<public password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

   Never set `record.allow_demo` on this database: it is what lets demo records show,
   and only local and test databases use it.
6. **TLS.** Database settings → SSL configuration: turn on "Enforce SSL" and download the
   certificate. Put its contents in `DATABASE_CA_CERT` (Vercel accepts multi-line values;
   `\n` sequences also work). Connections then verify the server certificate fully.
7. **Backups.** Daily backups with point-in-time restore are a **paid** Supabase feature
   (Pro). Free alternative: a scheduled GitHub Action that runs `pg_dump`, encrypts the
   file with `age` to a key the team holds offline, and stores it in a private bucket.
   Either way, restore a backup into a scratch project every quarter and record the test.

## 2. Evidence storage (Supabase Storage)

1. Storage → New bucket → name `evidence`, **private** (not public).
2. Storage → Settings → S3 connection: enable it and create an access key.
3. Environment variables:

   ```
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3
   S3_REGION=<project region, e.g. us-east-1>
   S3_BUCKET=evidence
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   ```

Files are encrypted with `SUBMISSIONS_ENCRYPTION_KEY` before upload, so the bucket
only ever holds ciphertext. Losing that key means losing the files: store it in a
password manager as well as in Vercel.

## 3. Spam protection (Cloudflare Turnstile, free)

Cloudflare dashboard → Turnstile → Add widget for your domain, widget mode
**Invisible** (or Managed). Copy the site key and secret key into
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Never set
`TURNSTILE_DISABLED` in production (the app refuses it when `APP_ENV=production`).

## 4. The app (Vercel)

1. **Import the repository** in Vercel. Framework: Next.js. Node.js 22.
2. **Build command:**

   ```
   npm run db:migrate && npm run check:no-demo && npm run build
   ```

   Migrations are idempotent; `check:no-demo` stops a deploy if any demo record or demo
   account exists. The build reads published records to prerender incident pages, so the
   database must be reachable at build time. (Prefer not to keep the owner credential in
   Vercel? Remove `db:migrate` from the build command and run it from CI or your machine
   before each deploy.)
3. **Environment variables** (Production; set Preview separately against a separate
   Supabase project — never point previews at production data):

   | Variable | Value |
   | --- | --- |
   | `APP_ENV` | `production` |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.org` |
   | `MIGRATION_DATABASE_URL` | owner URL from step 1.4 (only needed if migrations run in the build) |
   | `DATABASE_URL`, `PUBLIC_DATABASE_URL` | runtime URLs from step 1.5 |
   | `DATABASE_CA_CERT` | certificate from step 1.6 |
   | `APP_ENCRYPTION_KEY`, `SUBMISSIONS_ENCRYPTION_KEY`, `RATE_LIMIT_SECRET`, `CRON_SECRET` | each `openssl rand -base64 32` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | step 3 |
   | `STORAGE_*`, `S3_*` | step 2 |
   | `WAYBACK_ACCESS_KEY`, `WAYBACK_SECRET_KEY` | optional, from archive.org/account/s3.php (higher archiving limits) |
   | `NEXT_PUBLIC_MAP_STYLE_LIGHT`, `NEXT_PUBLIC_MAP_STYLE_DARK` | defaults to OpenFreeMap; change for Protomaps or another style |
   | `NEXT_PUBLIC_ANALYTICS_SCRIPT`, `NEXT_PUBLIC_ANALYTICS_SITE_ID` | optional: Plausible or self-hosted Umami (cookie-free) |

4. **Scheduled jobs.** `vercel.json` runs `/api/jobs/nightly` once a day (export,
   retention and an archiving pass), which fits Vercel's free plan. New sources are also
   archived right after each save. To retry archiving every 5 minutes as well, either:
   - use GitHub's scheduler: add the repository variable `ENABLE_SCHEDULED_JOBS=true` and
     the secrets `SITE_URL` (`https://your-domain.org`) and `CRON_SECRET` (same value as in
     Vercel); `.github/workflows/scheduled-jobs.yml` then calls the jobs. Free for public
     repositories; on a private repository a 5-minute schedule uses about 8,600 runner-minutes
     a month, beyond the free allowance, so slow it down or use the next option; or
   - on Vercel Pro (**paid**), add `{ "path": "/api/jobs/archive", "schedule": "*/5 * * * *" }`
     to `vercel.json`.
5. **Deploy.** Then create the first admin from your machine, against production:

   ```bash
   DATABASE_URL='<record_app runtime URL>' DATABASE_CA_CERT="$(cat prod-ca-2021.crt)" \
     npm run admin:create -- --email editors@your-domain.org --name "First Admin"
   ```

   Sign in at `/admin/login` with the temporary password, enroll an authenticator app,
   choose a new password, then add the other editors under Users.

## 5. Cloudflare in front

1. Add the domain to Cloudflare, point it at Vercel (CNAME to `cname.vercel-dns.com`),
   proxy status **Proxied**, SSL/TLS mode **Full (strict)**.
2. Caching: leave "Respect existing headers". Incident pages, Methodology and Data are
   static with `s-maxage` headers; admin pages send `Cache-Control: no-store`.
3. Security → WAF → rate limiting rules (free tier allows one): limit `POST` requests to
   `/report` and `/admin/login`.
4. Keep **Under Attack Mode** one click away (Overview → Quick Actions) for harassment
   campaigns.
5. The app reads the visitor IP from `CF-Connecting-IP` (then `X-Real-IP`) for rate
   limiting; only an HMAC of it is stored.

## 6. Before launch

- [ ] `npm run check:no-demo` passes against production.
- [ ] Only real, role-based addresses in `src/lib/site.ts` (editors@, corrections@, …).
- [ ] About page and privacy policy completed and reviewed by counsel (and the IRB, if a
      university hosts the project).
- [ ] A media lawyer has reviewed the editorial standards and 10 sample records.
- [ ] 50 seed records drafted, reviewed by a second editor and published.
- [ ] Every editor has two-factor authentication (Users page shows "on").
- [ ] A backup has been restored into a scratch project once.
- [ ] Turnstile, the scheduled-job settings and the Cloudflare rules are in place.

## Upgrades and schema changes

1. Edit `src/db/schema.ts`; run `npm run db:generate` to create a migration.
2. New tables need explicit grants and row-level security, as in `drizzle/0002_rules.sql`
   (the public role should only ever get views in `record_public`).
3. If you add a column to the public view, document it in `PUBLIC_FIELD_DOCS` (the type
   check fails otherwise) and run `npm run dictionary`.
4. Run `npm test` and `npm run test:e2e` before deploying.

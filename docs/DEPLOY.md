# Going live

This takes the app from this repository to a public site. Everything runs on
free plans; the only cost is the domain (about $11 a year for a `.org` at
Cloudflare's at-cost price). Allow about an hour. No terminal is needed except
to generate secrets (step 1) and, later, to make backup keys (step 8).

| Service | Used for | Plan |
| --- | --- | --- |
| Cloudflare | domain and DNS; CDN and DDoS protection in front of the site; Turnstile spam check; email forwarding for the role addresses; R2 storage for evidence files and backups | Free (domain about $11/year) |
| Supabase | PostgreSQL database | Free |
| Vercel | runs the app and the nightly job | Hobby (free) |
| GitHub | the code; archive retries every 5 minutes; daily encrypted backups | Free (public repository) |
| Anthropic (optional) | the morning news scan reads each article with Claude (step 8.5); without it the scan uses a keyword rule | **Paid** per use, about $0.02 an article |

Free-plan limits worth knowing:

- **Supabase Free**: 500 MB of database, two projects. A project is paused after 7 days
  without database activity; the nightly job writes to the database every night, which
  keeps it active. Free projects have no backups you can download, so step 8 sets up your own.
- **Vercel Hobby** is for non-commercial use. If the project takes funding or moves under
  an organization, Vercel expects Pro (**paid**, $20 a month).
- **Cloudflare R2**: 10 GB free. Cloudflare asks for a payment method before turning R2
  on (you will have one on file from buying the domain); use within the free allowance is
  not charged.

Keep a password manager open: you will create about a dozen secrets. Never paste them
into chats, issues or commits.

## 1. Generate the secrets

In Terminal (macOS, Linux, or Git Bash on Windows):

| Values | Command |
| --- | --- |
| `APP_ENCRYPTION_KEY`, `SUBMISSIONS_ENCRYPTION_KEY`, `RATE_LIMIT_SECRET`, `CRON_SECRET` | `openssl rand -base64 32` (run it four times) |
| app database password, public database password, `ADMIN_SETUP_TOKEN` | `openssl rand -hex 24` (run it three times) |

`SUBMISSIONS_ENCRYPTION_KEY` encrypts every uploaded file and submitter detail. Lose it and
they cannot be read again; keep it in the password manager as well as in Vercel.

## 2. Domain (Cloudflare)

1. Create a Cloudflare account and turn on two-factor authentication for it.
2. **Domain Registration → Register Domains**: search for the name, choose `.org`, buy it.
   Cloudflare charges the registry's price with no markup, renewals included, and hides the
   owner's contact details in public WHOIS by default. Avoid `.us`: its rules forbid that
   privacy, so the registrant's name and address would be public.
3. The domain appears in the account with Cloudflare's DNS already in charge.

## 3. Database (Supabase)

1. At supabase.com, create a **New project**: name `the-record`, generate a strong database
   password (save it), region **East US (North Virginia)**, next to Vercel's default region.
2. **Database → Extensions**: enable `postgis` and `pg_trgm`, keeping the suggested
   `extensions` schema.
3. **Project Settings → Data API**: the app does not use it. Leave only `public` in the
   exposed schemas (the default); if the page offers to turn the Data API off, do.
4. **Connect** (top of the dashboard) → connection string → **Session pooler**. Copy the URI
   and put your database password in it. This is `MIGRATION_DATABASE_URL`:

   ```
   postgresql://postgres.<project-ref>:<database password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

   Copy the host exactly as shown (it may read `aws-1-…`).
5. Build the two runtime connection strings from the same host, with port **6543** (the
   transaction pooler) and the two passwords from step 1:

   ```
   DATABASE_URL=postgresql://record_app.<project-ref>:<app password>@<same host>:6543/postgres
   PUBLIC_DATABASE_URL=postgresql://record_public.<project-ref>:<public password>@<same host>:6543/postgres
   ```

   You do not create these roles. The first deploy creates them and gives them these
   passwords (`npm run db:migrate` does it, storing only a SCRAM verifier).
6. **Project Settings → Database → SSL Configuration**: download the certificate and turn on
   **Enforce SSL**. The certificate file's contents are `DATABASE_CA_CERT`. Production always
   connects with TLS and verifies the server; without this certificate the deploy stops with
   "self-signed certificate in certificate chain". Do not add `?sslmode=` to the URLs.

Never set `record.allow_demo` on this database: it is what lets demo records show, and only
local and test databases use it.

## 4. Files, spam check and email (Cloudflare)

**Evidence storage (R2).**

1. **R2 Object Storage**: add a payment method if asked, then create two buckets,
   `record-evidence` and `record-backups` (location Automatic, Standard storage). Leave both
   private: no public access, no custom domain.
2. **R2 → Manage API tokens → Create API token**: permission **Object Read & Write**,
   applied to `record-evidence` only. Copy the access key ID and secret. The account ID is on
   the R2 overview page.

   ```
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=record-evidence
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   ```

   Files are encrypted with `SUBMISSIONS_ENCRYPTION_KEY` before upload, so the bucket only ever
   holds ciphertext. (Supabase Storage works too: enable its S3 connection, create a private
   bucket and use `https://<project-ref>.supabase.co/storage/v1/s3` with the project's region.)

**Spam check (Turnstile).**

3. **Turnstile → Add widget**: hostname your domain, mode **Managed** (the report form shows it
   only when Cloudflare needs an interaction). Copy the site key and secret key into
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Never set `TURNSTILE_DISABLED` in
   production; the app refuses it there.

**Role addresses (Email Routing).** The site lists `editors@`, `corrections@`, `privacy@` and
`legal@` at your domain (`src/lib/site.ts`), never personal addresses.

4. Your domain → **Email → Email Routing**: turn it on, add and verify the inbox that should
   receive the mail, and create a route for each of the four addresses. Cloudflare adds the
   DNS records it needs.

## 5. The app (Vercel)

1. At vercel.com, sign up with GitHub (Hobby). **Add New → Project** and import
   `mohamedgazzah/mohamed-gazzah`, letting Vercel's GitHub app see that repository.
2. Framework: Next.js (detected). Leave the build settings alone: `vercel.json` runs
   `npm run build:vercel` (migrations, the no-demo check, then the build) and skips preview
   deployments (see [Preview deployments](#preview-deployments)). Node.js 22 comes from
   `package.json`.
3. **Environment variables**: paste this block into the first field (Vercel splits a pasted
   `.env` into variables), with your values:

   ```
   APP_ENV=production
   NEXT_PUBLIC_SITE_URL=https://your-domain.org
   MIGRATION_DATABASE_URL=
   DATABASE_URL=
   PUBLIC_DATABASE_URL=
   APP_ENCRYPTION_KEY=
   SUBMISSIONS_ENCRYPTION_KEY=
   RATE_LIMIT_SECRET=
   CRON_SECRET=
   ADMIN_SETUP_TOKEN=
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=
   TURNSTILE_SECRET_KEY=
   STORAGE_DRIVER=s3
   S3_ENDPOINT=
   S3_REGION=auto
   S3_BUCKET=record-evidence
   S3_ACCESS_KEY_ID=
   S3_SECRET_ACCESS_KEY=
   ```

   Then add `DATABASE_CA_CERT` on its own: the whole certificate, `BEGIN` and `END` lines
   included. Leave `SITE_INDEXING` unset until launch (step 9). Optional:
   `WAYBACK_ACCESS_KEY`/`WAYBACK_SECRET_KEY` from archive.org/account/s3.php (higher archiving
   limits), and `NEXT_PUBLIC_ANALYTICS_SCRIPT`/`NEXT_PUBLIC_ANALYTICS_SITE_ID` for Plausible or Umami.
4. **Deploy.** The first build creates the schemas, the database rules and the two roles,
   checks there is no demo data, and builds the site. If it fails, the build log says why
   (see [Troubleshooting](#troubleshooting)). Open the project's `.vercel.app` address to look
   around before the domain is connected. It is public, but marked noindex until launch.

## 6. Connect the domain

1. Vercel → the project → **Settings → Domains**: add `your-domain.org` and
   `www.your-domain.org` (redirecting to the first). Vercel shows the DNS records to create.
2. Cloudflare → your domain → **DNS → Records**: create exactly those records with proxy
   status **DNS only** (grey cloud). Wait until Vercel shows the domain as valid with a
   certificate (minutes).
3. Cloudflare → **SSL/TLS**: set the mode to **Full (strict)**. Then switch both records to
   **Proxied** (orange cloud). Cloudflare now sits in front of Vercel as the specification asks
   (caching, DDoS protection, Under Attack mode). Vercel may show a notice that the domain is
   behind a proxy; that is expected. In the Vercel domain list, set the project's `.vercel.app`
   domain to redirect to your domain, so visitors always come through Cloudflare. (The app reads
   the visitor's address from `CF-Connecting-IP` only when a request really arrived from
   Cloudflare, and stores only an HMAC of it.)
4. Cloudflare → **Security → WAF → Rate limiting rules** (the free plan allows one): limit
   `POST` requests to `/report` and `/admin/login`. Know where **Under Attack mode** is (the
   domain's overview or security settings) for harassment campaigns. If you ever turn the
   proxy off, Vercel's Firewall has its own Attack Challenge Mode.

## 7. The first admin

Open `https://your-domain.org/admin/setup`, enter `ADMIN_SETUP_TOKEN`, your name, the email you
will sign in with (it is never shown publicly) and a password. You go straight to two-factor
setup: scan the code with an authenticator app. The setup page disappears for good once an
account exists; you can then delete `ADMIN_SETUP_TOKEN` from Vercel. Add the other editors under
**Users**; each enrolls two-factor authentication at first sign-in.

From a terminal instead: `npm run admin:create -- --email you@example.org --name "Your Name"`
with `DATABASE_URL` and `DATABASE_CA_CERT` set prints a one-time temporary password.

## 8. Scheduled jobs and backups (GitHub)

The repository is public, so GitHub Actions costs nothing. Vercel's cron already runs the
nightly job (dataset release, retention, an archiving pass); new sources are archived right
after each save.

1. GitHub → the repository → **Settings → Actions → General**: allow actions.
2. **Archive retries every 5 minutes.** Settings → **Secrets and variables → Actions**: secrets
   `SITE_URL` (`https://your-domain.org`) and `CRON_SECRET` (same value as in Vercel); variable
   `ENABLE_SCHEDULED_JOBS` = `true`. This runs `.github/workflows/scheduled-jobs.yml`.
3. **Daily encrypted backups** (`.github/workflows/backup.yml`, `scripts/backup.sh`):
   1. On your computer, install [age](https://age-encryption.org) (`brew install age`, or
      `winget install FiloSottile.age`) and run `age-keygen -o record-backup-key.txt`. It prints
      a public key starting `age1`. Keep the key file offline, in the password manager and on a
      USB stick: it is the only way to read the backups.
   2. Cloudflare R2: create an API token with **Object Read & Write** on `record-backups` only,
      and on that bucket add a lifecycle rule that deletes objects after 35 days.
   3. GitHub secrets: `BACKUP_DATABASE_URL` (the session pooler URL from step 3.4),
      `DATABASE_CA_CERT`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`. Variables:
      `BACKUP_AGE_RECIPIENT` (the `age1…` key), `BACKUP_S3_ENDPOINT`
      (`https://<account-id>.r2.cloudflarestorage.com`), `BACKUP_S3_BUCKET` (`record-backups`),
      `ENABLE_BACKUPS` = `true`.
   4. **Actions → Database backup → Run workflow** once. A `record-<date>.dump.age` file
      appears in the bucket; after that it runs daily.
4. **Restore** (and test it every quarter in a scratch Supabase project, noting the date):
   1. New project; enable `postgis` and `pg_trgm` as in step 3.2.
   2. SQL editor: `CREATE ROLE record_app NOLOGIN; CREATE ROLE record_public NOLOGIN;`
   3. Download a backup from R2, then
      `age --decrypt -i record-backup-key.txt record-<date>.dump.age > record.dump` and
      `pg_restore --no-owner --dbname "<the new project's session pooler URL>" record.dump`.
   4. Point the three Vercel URLs at the new project and redeploy (or run `npm run db:migrate`
      with them): it restores the roles' settings and passwords.

5. **Morning news scan** (`src/server/jobs/news/`). Every morning, about 6 a.m. Eastern,
   Vercel's cron calls `/api/jobs/news-scan`; with step 8.2 done, this workflow runs a second
   pass at 10:45 UTC for anything left. Each pass reads new articles from Google News
   searches, GDELT's news index and CAIR's press releases, and sends possible incidents to
   **Admin → Leads**. It never drafts, edits or publishes a record.
   1. With no setup it uses a keyword rule (a Muslim target and an incident word in the
      headline). To have Claude read each article against the inclusion criteria instead,
      create an API key at [console.anthropic.com](https://console.anthropic.com) and set a
      monthly spend limit there. In Vercel → Settings → Environment Variables (Production), add
      `ANTHROPIC_API_KEY` and redeploy.
   2. Cost (**paid**, billed by Anthropic per use): about $0.02 an article with the default model,
      Claude Opus 5.5 at low effort with its instructions cached. At 30 new articles a day that is
      roughly $15–20 a month. `NEWS_SCAN_MODEL=claude-haiku-5-5` costs about a twentieth as
      much, with less careful judgments; editors still read everything it passes on. The scan
      log shows the tokens used and their cost over the last 7 days.
   3. Options: `NEWS_SCAN_MAX_LEADS_PER_DAY` (default 40), `NEWS_SCAN_EXTRA_FEEDS`
      (comma-separated RSS or Atom addresses, for example a state civil rights office's press
      releases), `NEWS_SCAN_AI=off` (keyword rule even with a key).
   4. After the first morning, open **Admin → Leads → Morning news scan**: what it found, the
      leads it made, and what it skipped, with the model's reason. If nothing was found and the
      job answered 502 (Vercel → Logs, or the workflow run), no source could be reached.
   5. To run a pass by hand: Actions → Scheduled jobs → Run workflow → `news-scan`, or
      `npm run news:scan` locally against the database in `.env`.

## 9. Launch

Until launch every response carries `X-Robots-Tag: noindex` and robots.txt does not list the
sitemap, so the site stays out of search engines while it is being prepared. When the
checklist below is done, set `SITE_INDEXING=on` in Vercel and redeploy.

- [ ] `npm run check:no-demo` passes against production (every deploy runs it).
- [ ] The final name in `src/lib/site.ts`; the role addresses forward to a monitored inbox.
- [ ] About page and privacy policy completed and reviewed by counsel (and the IRB, if a
      university hosts the project).
- [ ] A media lawyer has reviewed the editorial standards and 10 sample records.
- [ ] 50 seed records drafted, reviewed by a second editor and published.
- [ ] Every editor has two-factor authentication (Users shows "on").
- [ ] A backup has been restored into a scratch project once.
- [ ] Turnstile, the scheduled jobs and the Cloudflare rules are in place.

## Preview deployments

Vercel builds every branch pushed to GitHub. A preview build would run migrations against the
database named in the Preview variables, and Vercel's import screen gives Preview the same
values as Production. So `scripts/vercel-ignore.mjs` skips previews ("Canceled by Ignored Build
Step"). To use them, create a second Supabase project (the free plan allows two), set the
Preview variables to it, never to production's, and add `ENABLE_PREVIEW_DEPLOYMENTS=true` for
Preview.

## Troubleshooting

| Build log says | Fix |
| --- | --- |
| `self-signed certificate in certificate chain` | `DATABASE_CA_CERT` is missing or is not the project's certificate. |
| `password authentication failed for user "postgres"` | The database password in `MIGRATION_DATABASE_URL` is wrong. |
| `Tenant or user not found` | The user name lacks `.<project-ref>`, or the host is not the one Supabase shows. |
| `This connection string is for "…"; it must use the record_app role` | `DATABASE_URL` (or `PUBLIC_DATABASE_URL`) names the wrong role. |
| `Give record_app a password of at least 16 characters` | Use the `openssl rand -hex 24` values in the URLs. |
| `Demo data found` | Demo data was seeded into production. Never run `db:seed` there; restore a backup or start a new project. |
| `Skipping this preview deployment` | Expected for branches other than the production branch. |

## Upgrades and schema changes

1. Edit `src/db/schema.ts`; run `npm run db:generate` to create a migration.
2. New tables need explicit grants and row-level security, as in `drizzle/0002_rules.sql`
   (the public role should only ever get views in `record_public`).
3. If you add a column to the public view, document it in `PUBLIC_FIELD_DOCS` (the type
   check fails otherwise) and run `npm run dictionary`.
4. Run `npm test` and `npm run test:e2e`, then push to the production branch; the deploy
   applies the migration.

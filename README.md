# The Record: Anti-Muslim Incidents in America

A public, searchable record of anti-Muslim incidents in the United States. Each
incident is linked to its sources and tracked through its legal outcome. The
name is a placeholder: change it in `src/lib/site.ts`.

This repository is **Phase 1 (Foundation)** of the build specification: the
schema, the admin record editor with two-person review, the public Explore and
Incident pages, Methodology, the Report form, and the nightly CSV/JSON export.
See [What is built](#what-is-built-phase-1) and [What remains](#what-remains).

- Decisions made where the specification was silent: [`DECISIONS.md`](DECISIONS.md)
- Going live (Cloudflare, Supabase, Vercel, all on free plans): [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Acceptance tests and their results: [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md)
- Data dictionary (generated from the schema): [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md)

> The seed data is **five clearly fictional DEMO records** for development.
> Real records must be drafted and verified by people. Demo records are hidden
> by the database itself unless it is configured for development, the seed
> refuses to run in production, and `npm run check:no-demo` fails a deploy if
> any demo data exists.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| Database | PostgreSQL 16 + PostGIS + pg_trgm (Supabase in production) |
| Schema, migrations, types | Drizzle ORM + drizzle-kit, from one file: `src/db/schema.ts` |
| Rules that must always hold | SQL triggers and functions: `drizzle/0002_rules.sql` |
| Styling | Tailwind CSS 4 over the design tokens in `src/styles/tokens.css` |
| Type | Newsreader (headlines, reading), Libre Franklin (interface), IBM Plex Mono (ids, dates); self-hosted |
| Map | MapLibre GL JS (OpenFreeMap basemap by default, no key) |
| Admin sign-in | Email + password, then mandatory TOTP two-factor authentication |
| Spam protection | Cloudflare Turnstile (invisible), honeypot, Postgres rate limits |
| Evidence storage | Private S3-compatible bucket; files encrypted before upload |
| Source archiving | Internet Archive Save Page Now |
| Tests | Vitest (unit + database integration), Playwright + axe-core, Lighthouse |

## Quick start (local)

Requirements: Node.js 22 and PostgreSQL 16 with PostGIS.

```bash
# macOS: brew install postgresql@16 postgis
# Ubuntu: apt install postgresql-16 postgresql-16-postgis-3
npm install
cp .env.example .env
# Fill the four secrets in .env with: openssl rand -base64 32
# Set POSTGRES_SUPERUSER_URL if your local superuser is not postgres:postgres.

npm run db:setup        # creates roles, the database, extensions; runs migrations
npm run db:seed         # demo users and 5 fictional DEMO records (development only)
npm run dev             # http://localhost:3000
```

`db:seed` prints the demo accounts. Sign in at `/admin/login` with, for example,
`author@demo.invalid` / `demo-author-password`; add the printed TOTP secret to
an authenticator app (or compute codes from it) for the second step.

To create a real first admin instead: `npm run admin:create -- --email you@example.org --name "Your Name"`.
It prints a temporary password; at first sign-in the person must enroll two-factor
authentication and choose a new password. A new deployment can also create its
first admin in the browser at `/admin/setup` (see `docs/DEPLOY.md`, step 7).

Reset the local database at any time with `npm run db:setup -- --reset`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | Route types + `tsc --noEmit` |
| `npm run db:generate` | Diff `src/db/schema.ts` into a new SQL migration |
| `npm run db:setup [-- --reset]` | Local database: roles, extensions, migrations (development only) |
| `npm run db:migrate` | Apply migrations as the schema owner, then give the runtime roles their passwords from their URLs (every deploy) |
| `npm run build:vercel` | What Vercel runs: `db:migrate`, `check:no-demo`, `build` |
| `npm run db:seed` | Demo data (refuses in production) |
| `npm run admin:create` | Create a user from the command line |
| `npm run check:no-demo` | Fail if demo data exists (use before production deploys) |
| `npm run dictionary` | Regenerate `docs/DATA_DICTIONARY.md` from the schema |
| `npm test` | Unit and database integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright): builds the app against a fresh `record_e2e` database |
| `npm run test:db-down` | After `test:e2e`: incident pages load with the database unreachable |
| `npm run test:lighthouse` | After `test:e2e`: mobile Lighthouse scores for Home, Explore, Incident |
| `scripts/backup.sh` | Encrypted database backup to R2 (run daily by `.github/workflows/backup.yml`) |

## How it fits together

```
src/
  app/(public)/        Public pages: /, /incidents, /incidents/[id]-[slug], /methodology,
                       /data, /report, /about. Read only through the public role.
  app/admin/           Admin area: sign-in + TOTP, records, review queue, leads,
                       corrections, cases, audit log, users. Server actions in _actions/.
  app/api/jobs/        Scheduled jobs (nightly, export, archive, retention), behind CRON_SECRET.
  db/enums.ts          Every enumerated value with its label and definition.
  db/schema.ts         Tables, the published snapshot, the public views, field docs.
  db/admin.ts          record_app connection + withActor() for attributed writes.
  db/public.ts         record_public connection: can read only record_public views.
  server/admin/        Workflow (save, submit, review, publish), sessions, leads, ...
  server/public/       Explore queries, downloads, submissions.
  server/jobs/         Nightly release, archiving, retention.
  lib/                 Filters ⇄ URL, validation, citations, CSV, crypto, TOTP, ...
drizzle/               Migrations. 0002_rules.sql holds the database-enforced rules.
tests/unit, tests/db, tests/e2e
```

### Three database roles

| Role | Used by | Can |
| --- | --- | --- |
| schema owner | migrations, scripts | everything (but still cannot bypass the publish trigger or edit history) |
| `record_app` | admin area, jobs, report form | edit working tables; **cannot** write the public snapshot, edit or delete the audit log, reviews or change log |
| `record_public` | public pages, downloads, sitemap | read the `record_public` views only — nothing in the internal schema |

Editor notes, submitter contact details, exact addresses, uploaded files and
V0 drafts are simply not in anything the public role can read. Row-level
security is enabled on every internal table.

### The two-person rule, in the database

A record is edited as a working copy (`record.incidents`). What the public sees
is a snapshot (`record.published_incidents`) written only by
`record.publish_incident()`, and a trigger re-checks every precondition on each
write, whoever the caller is:

- at least one source, a verification level (V1–V3), a legal status backed by a
  dated and sourced legal event, and at least one bias indicator;
- an approved review of **that exact revision**, with every checklist item
  ticked, by an editor who is **not the author** and **did not edit that
  revision**;
- the publisher is a senior editor.

Any content change (including a source or legal event) creates a new revision,
voids pending approvals and leaves the live page unchanged until the new
revision is reviewed and published. Every field change is written to an
internal change log by trigger, attributed to the acting user with a reason;
the public change log lists each publication with its note and the fields that
changed. The audit log, reviews, change log and publications are append-only.

## What is built (Phase 1)

- **Schema** with migrations, inferred TypeScript types and a generated public data dictionary.
- **Admin**: TOTP-enforced sign-in with 12-hour sessions and lockout; roles
  (contributor, editor, senior editor, admin); record editor with field
  validation, sources with link auto-fill, legal events, statements, cases,
  live preview of the public page, summary checks and a side-by-side
  duplicate finder; review queue with the checklist; publish, unpublish,
  exclude; leads inbox with triage; corrections queue with SLA timers; cases;
  permanent audit log; user management.
- **Public**: Home (headline sentence, four stat tiles with as-of dates linking
  to Explore, latest verified incidents); Explore with every filter in the URL,
  table / cards / map views, CSV of the current results, 50-per-page
  pagination; statically generated Incident pages with key facts, legal
  timeline, statements, numbered sources with archived copies, change log,
  related records and citations (APA, Chicago, BibTeX); Methodology; Data with
  nightly versioned downloads, checksums, changelog and dictionary; Report form
  (incident or correction) with Turnstile, EXIF stripping and encryption; About
  with a plain-language privacy policy; sitemap and robots.
- **Jobs**: nightly CSV/JSON release with SHA-256 and changelog; source
  archiving right after each save, with scheduled retries; 12-month retention purge.
- **Design**: the Section 5 colors exactly, an editorial type system (Newsreader,
  Libre Franklin, IBM Plex Mono), register-style lists, a year strip on the home page,
  light and dark themes (system or manual toggle), WCAG 2.2 AA, logical CSS properties
  for future RTL.

## What remains

Phase 2 and 3 items from the specification, not built yet:

- Trends and State pages, charts (Observable Plot), choropleth, Cases page.
- Public API v1 (`/api/v1/incidents`, `/cases`, `/stats`) with OpenAPI docs and API keys.
- Home map and the FBI/CAIR context figures (needs the first annual reconciliation).
- News, press-release and docket monitors feeding the Leads inbox; record merge.
- Arabic and Spanish translations; partner logins; embeddable charts.
- Sentry error tracking (optional; not added to avoid a new third-party service without approval).

Before launch, people must: choose the organizational home and a media lawyer,
draft and verify the 50 seed records, review 10 with counsel, finalize the
name, the About page and the privacy policy. See `DECISIONS.md` for open
questions.

## Licenses

Code: MIT. Data: CC BY 4.0.

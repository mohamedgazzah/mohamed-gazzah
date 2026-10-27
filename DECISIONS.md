# Decisions

Choices made where the specification was silent, left room, or where building
it surfaced a trade-off. Each says what was decided and why. Items marked
**Ask** need a decision from the project before launch.

## Platform

1. **Next.js 16.4 (App Router, Turbopack)** — the current stable release. Request-time
   APIs are async (`params`, `searchParams`), and pages without them are statically
   generated with ISR.
2. **TypeScript 5.9, not 7.** TypeScript 7 (the native compiler) has no JavaScript API
   yet, which Next.js uses for its build-time type check.
3. **Drizzle over Prisma.** The spec allowed either. Drizzle keeps the schema in plain
   TypeScript next to hand-written SQL, generates migrations without a running database,
   and lets the public view be declared once and reused for queries, types and the data
   dictionary.
4. **Self-hosted fonts.** Newsreader, Libre Franklin, IBM Plex Mono and Noto Naskh Arabic
   are bundled from npm (`@fontsource`, with `next/font/local` loading the Latin files).
   No request goes to Google: fewer third parties see readers' IP addresses, and builds
   need no network. (The typefaces themselves changed in the redesign; see item 47.)

## Authentication

5. **A small built-in auth module instead of Supabase Auth or Auth.js.** The spec named
   either. Auth.js has since been folded into Better Auth, and neither option gives
   mandatory TOTP for credentials sign-in without custom code. The module is about 300
   lines: scrypt password hashing, RFC 6238 TOTP (tested against the RFC vectors),
   TOTP secrets encrypted with AES-256-GCM, replay protection, lockout after 5 failures,
   database sessions (only a SHA-256 of the token is stored) with an absolute 12-hour
   expiry, `HttpOnly`/`Secure`/`SameSite=Lax` cookies. Enrollment is forced at first
   sign-in, and a half-signed-in session reaches nothing but the code page.
6. **Passwords at first sign-in are temporary** and must be changed; admins never see
   a password again after creating it.

## Data model

7. **Working copy and published snapshot.** Editors change `record.incidents`; the public
   reads `record.published_incidents` through views. A live record therefore stays
   unchanged while a correction is drafted and reviewed, which the spec's "any change in
   legal status sends the record back through drafting and review" requires.
8. **Two runtime database roles.** `record_app` (admin) and `record_public` (public site).
   The public role can read only the `record_public` views, so editor notes, drafts, V0
   records and submitter data are out of reach by privilege, not by query discipline.
   Enum columns are exposed as text in the views so the public role needs no access to
   the internal schema at all.
9. **Two-person rule details.** The reviewer must not be the author (`created_by`, always
   the acting user, never a client value) and must not have edited the revision under
   review. If a reviewer fixes something themselves, a third editor approves. This is the
   strict reading of "a second editor who is not the author".
10. **Publish preconditions enforced in SQL** (`record.publish_blockers()`): at least one
    source; verification V1–V3; a legal status; the legal status backed by a dated legal
    event with a source ("Every status change is a dated Legal Event with a source");
    at least one bias indicator (inclusion criterion 2); names only once a person is
    charged; date on or after 2020-01-01 unless tagged `backfill`.
11. **Optional fields added** (no required field changed): `property_damage` and
    `agencies_involved` (the Incident page's key-facts table lists both, the data model
    did not); `map_lat`/`map_lng` (the jittered map position, stored once as the spec
    asks); `state_code` in the snapshot; `statement_type` (official / accused's counsel /
    community, to group statements as the Incident page describes). Case `stage` is free
    text.
12. **Record ids** are `US-YYYY-NNNN`, numbered per year of the incident date and never
    reused; changing the date later does not change the id. Old slugs redirect.
13. **Public change log** = one entry per publication (first entry always "Published."),
    each with a one-line note and the names of the fields that changed. Internal edits
    between publications are in the private change log (who, when, field, old, new,
    reason).
14. **Excluded records** are a workflow status with a required reason, kept internally.
15. **Unpublishing** takes one senior editor and is immediate (a victim's 48-hour removal
    request should not wait for two people); putting a record back requires review again.

## Intake

16. **Submissions land in the Leads inbox**, not directly as V0 drafts. Triage ("New
    incident") creates the V0 draft, pre-filled and linked. This matches workflow step 1
    and keeps spam and duplicates out of the records table. **Ask** if you prefer every
    submission to create a draft immediately.
17. **Upload limits: 5 files, 3.5 MB in total**, because Vercel caps request bodies at
    4.5 MB. Images (JPEG, PNG, WebP, GIF) are type-checked from their bytes, auto-rotated
    and re-encoded, which removes EXIF/GPS/XMP. PDFs are stored as sent and flagged in the
    admin area ("check for metadata before sharing"). Larger evidence would need direct
    browser-to-bucket uploads (Phase 2).
18. **Rate limits live in Postgres**, keyed by an HMAC of the IP address, so they work
    across serverless instances and never store an IP.
19. **Turnstile** uses Cloudflare's documented test keys in `.env.example`; tests disable it
    (`TURNSTILE_DISABLED=true`, refused when `APP_ENV=production`).
20. **Retention clock.** "12 months after the incident is resolved": a submission is resolved
    when its lead is triaged as duplicate or out of scope, its correction ticket closes, or
    the linked record reaches a final legal status (sentenced, acquitted, dismissed,
    suspect deceased, not prosecuted) or is excluded.

## Public site

21. **One URL per view.** Explore redirects loose or repeated parameters to one canonical
    query string (fixed key order, values in taxonomy order, defaults omitted). Stability
    contract, published on /methodology: no `v` means V2+V3, no `sort` means newest first.
22. **Filters are a plain GET form**, so Explore works without JavaScript. On small screens
    the rail is a bottom-sheet dialog; without JavaScript it shows inline.
23. **Search**: Postgres full-text (English) over title, summary, city, state and case names,
    plus trigram word similarity ≥ 0.5 for typos. Highlighting is done in the page with the
    same tolerance. Searches are not logged.
24. **Map**: MapLibre with OpenFreeMap's styles by default (free, no key, no per-view fees);
    set `NEXT_PUBLIC_MAP_STYLE_LIGHT/DARK` for Protomaps or another style. MapLibre 6 loads
    its web worker from a separate file, copied to `public/vendor/` at install and build.
    Fill shows severity in the muted palette; outline width and opacity show verification.
25. **Home page** includes the four stat tiles and the latest verified incidents (cheap, and
    a site needs a front page). The home map and the FBI/CAIR comparison figures are left
    for Phase 2: the comparison sentence links to Methodology, and **no external figures
    were invented**.
26. **"Today"** (stat tiles, as-of dates, release versions) is the US Eastern calendar date,
    and so is the date shown for a timestamp ("Updated Oct. 26, 2026", change logs).
27. **Badges** are status-colored text on the page or surface color, never on a tinted fill:
    the spec's light `--status-reported` on a 10% tint measures 4.30:1, below AA, while on
    the page and the surface it passes. Each badge also carries text and, for verification,
    a shape (solid, half, ring). See item 49 for their form.
28. **Demo records** are visible only where the database sets `record.allow_demo = on`
    (local and test databases). A production database never sets it, so even an accidental
    seed would not show.
29. **No favicon** until the project has its final name and mark.

## Jobs and hosting

30. **Nightly releases are stored in Postgres** (`record.dataset_releases`) and served at
    `/data/downloads/record-vYYYY.MM.DD.csv|json`: no separate file store to run, and the
    release is built from the same public view as the site.
31. **Scheduling without paid plans.** Vercel's free plan allows only daily cron jobs, so
    `vercel.json` has one nightly job (`/api/jobs/nightly`: release, retention, archive pass).
    Each new source is archived immediately after the save (`after()`), so archiving normally
    finishes within a minute. For a 5-minute retry, `.github/workflows/scheduled-jobs.yml` is
    included but **off until enabled** with a repository variable: it is free on public
    repositories (this one is public) but would exceed the free Actions minutes on a private
    one. On Vercel Pro the schedule can live in `vercel.json` instead.
32. **Archived links reach live pages without a new review**: `record.refresh_archived_urls()`
    only fills in the archived copy of a source that was already reviewed.
33. **Content Security Policy** allows inline scripts because statically generated pages
    cannot carry per-request nonces; everything else is restricted to the site, the map
    host and Turnstile, with `frame-ancestors 'none'`.
34. **Sentry is not included** in Phase 1, to avoid adding a third-party service without
    approval. Errors go to the platform logs; the code never logs submitter data.

## Deployment

35. **Supabase Free for the database, not Neon or Cloudflare D1.** Supabase keeps a small
    compute running all the time, so the public site never waits for a database to wake and
    there is no compute-hours cap to run out of mid-month (Neon's free plan stops at 100
    compute-hours a month, which steady crawler traffic alone can use up). Its one catch, a
    pause after 7 days without database activity, cannot happen while the nightly release job
    writes every night. D1 (SQLite) has no roles, row-level security or PL/pgSQL, so the
    two-person rule and the public/private split would have to move from the database into
    application code.
36. **Cloudflare R2 for evidence files and backups.** 10 GB free against Supabase Storage's 1 GB,
    no egress fees, and the evidence sits in a different account from the database. The
    Cloudflare account is needed anyway for the domain, DNS and Turnstile. The S3 driver works
    with either.
37. **Domain from Cloudflare Registrar, `.org`.** At-cost pricing with renewals at the same price
    and WHOIS privacy by default. `.us` is cheaper but forbids WHOIS privacy, which would
    publish the registrant's name and address on a project that may be targeted.
38. **Cloudflare proxied in front of Vercel**, as the specification asks (Vercel advises against
    reverse proxies, but supports them). Because Vercel overwrites `X-Forwarded-For`, the
    visitor's address arrives in `CF-Connecting-IP`; the app believes that header only when the
    connecting address is in Cloudflare's published ranges, so requests sent straight to the
    `.vercel.app` origin cannot pick their own rate-limit bucket.
39. **Pre-launch mode by default.** Until `SITE_INDEXING=on`, every response carries
    `X-Robots-Tag: noindex` and robots.txt leaves out the sitemap: a deployed site with a
    placeholder name and an unreviewed About page should not be indexed. Turning it on is the
    last launch step.
40. **First admin from the browser.** `/admin/setup` creates the first account while no account
    exists and `ADMIN_SETUP_TOKEN` (32+ characters) is set, under an advisory lock so two people
    cannot both succeed; it then forces two-factor enrollment. The terminal command remains.
41. **Runtime role passwords come from their connection strings.** `npm run db:migrate` checks
    that `DATABASE_URL` and `PUBLIC_DATABASE_URL` can sign in and, if not, sets those passwords
    as SCRAM verifiers (so statement logs never see them). It refuses a connection string for any
    other role, so a misconfigured URL can never change, say, the owner. It also reapplies the
    roles' search path and `extensions` grant, which a restored backup lacks.
42. **Production database connections always use verified TLS.** Without `DATABASE_CA_CERT` (or a
    publicly trusted certificate) the deploy fails instead of falling back to plain text.
43. **Previews are skipped by default** (`vercel.json` ignore step). A preview build runs
    migrations against the Preview database, and Vercel's import screen gives Preview the
    production values. `ENABLE_PREVIEW_DEPLOYMENTS=true` turns them on once Preview points at a
    separate database.
44. **Daily backups with GitHub Actions**: `pg_dump` of the app's schemas, encrypted with `age` to
    a public key (the private key stays offline, so neither GitHub nor Cloudflare can read the
    backups), uploaded to R2 with a 35-day lifecycle rule. Supabase's free plan expects you to keep
    your own copies. Restore was tested locally: row counts, the migration journal, triggers and
    policies all came back.
45. **Role addresses follow the domain** (`editors@` and so on at the host of
    `NEXT_PUBLIC_SITE_URL`); Cloudflare Email Routing forwards them for free.
46. **Node.js 22** is pinned in `package.json` (`engines`), the version the tests ran on.

## Design (redesign, October 27, 2026)

The first build followed Section 5 literally and looked like a template. At the project's
request the look was redone; the colors, tone rules and components of Section 5 stand.

47. **Typefaces replace Source Serif 4 and Inter** (the project's call). Newsreader, drawn for
    news reading, sets headlines and reading text; its optical-size axis gives the finer
    display cut at headline sizes. Libre Franklin, a revival of the American newspaper gothic,
    sets the interface, labels and tables. IBM Plex Mono sets record ids, dates and other
    reference data, so they read like docket entries. All three are under the SIL Open Font
    License. Four pairings were compared on the same home-page mock-up before choosing. To keep
    Lighthouse above 90 on mobile, Newsreader is trimmed to the weights the site uses
    (400–600: 90 KB instead of 132 KB), the home headline's italic comes from a 14 KB cut that
    is preloaded, the full italic loads only where running text uses it, and record pages set
    quotations upright (`src/fonts/README.md`).
48. **Type scale extended** beyond 14–40 px with fluid display steps (up to 60, 88 and 112 px)
    for page titles, the home headline and headline numbers. Reading text is the serif at
    19 px / 1.6, which reads like the specified 17 px because Newsreader's x-height is
    smaller than a UI sans.
49. **Badges** are a mark and a word (verification: solid, half or ring; severity: a square)
    or a square-cornered stamp (legal status, demo), instead of rounded pills. They are still
    text, never color alone, and each keeps its tooltip and link to the method.
50. **Layout as a register**: ruled lists with the reference data in the margin instead of card
    grids, numbered sections with ink rules, contents rails on long pages, square corners, and
    an ink band for the footer and tooltips (new `--band-*` tokens, contrast-tested in both
    themes like every other pair).
51. **A year strip on the home page**: one line per verified record on a date axis, taller for
    more severe incidents, with a "today" marker. Each month links to Explore filtered to that
    month, each line opens its record, and the month links, a text summary and the list below
    are the accessible version. The Phase 2 charts are still to come.
52. **Date ranges in newsroom style**: "Aug. 1–2, 2026", "Aug. 30 – Sept. 2, 2026".

## Open questions (**Ask**)

- Organizational home, media lawyer, and the contents of About (team, board, funding).
- Final project name and domain; then the favicon in `src/lib/site.ts`. Suggested neutral `.org` names: antimuslimincidents.org (matches the working subtitle), amirecord.org ("Anti-Muslim Incident Record"), antimuslimincidentrecord.org. Avoid names that could be read either way, such as muslimincidents or antimuslimrecord.
- Whether submissions should create drafts directly (item 16).
- A US Muslim population source for per-capita rates (Phase 2 choropleth).

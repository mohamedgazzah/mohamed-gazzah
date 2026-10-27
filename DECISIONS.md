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
4. **Self-hosted fonts.** Instrument Sans and Noto Naskh Arabic are bundled from npm
   (`@fontsource`, with `next/font/local` loading the Latin file). No request goes to
   Google: fewer third parties see readers' IP addresses, and builds need no network.
   (The typefaces changed twice in the redesigns; see items 47 and 62.)

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
24. **Map**: superseded by item 53. (Phase 1 used MapLibre points on an OpenFreeMap basemap.)
25. **Home page** includes the four stat tiles, the state map, records per month and by type
    (item 55), and the latest verified incidents. The FBI/CAIR comparison figures are left
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

47. **Typefaces replace Source Serif 4 and Inter** (the project's call; replaced again by item 62). Newsreader, drawn for
    news reading, sets headlines and reading text; its optical-size axis gives the finer
    display cut at headline sizes. Libre Franklin, a revival of the American newspaper gothic,
    sets the interface, labels and tables. IBM Plex Mono sets record ids, dates and other
    reference data, so they read like docket entries. All three are under the SIL Open Font
    License. Four pairings were compared on the same home-page mock-up before choosing. To keep
    Lighthouse above 90 on mobile, Newsreader is trimmed to the weights the site uses
    (400–600: 90 KB instead of 132 KB), the home headline's italic comes from a 14 KB cut that
    is preloaded, the full italic loads only where running text uses it, and record pages set
    quotations upright (`src/fonts/README.md`).
48. **Type scale extended** (reading size changed by item 62) beyond 14–40 px with fluid display steps (up to 60, 88 and 112 px)
    for page titles, the home headline and headline numbers. Reading text is the serif at
    19 px / 1.6, which reads like the specified 17 px because Newsreader's x-height is
    smaller than a UI sans.
49. **Badges** (shape changed by item 65) are a mark and a word (verification: solid, half or ring; severity: a square)
    or a square-cornered stamp (legal status, demo), instead of rounded pills. They are still
    text, never color alone, and each keeps its tooltip and link to the method.
50. **Layout as a register** (replaced by items 64–65): ruled lists with the reference data in the margin instead of card
    grids, numbered sections with ink rules, contents rails on long pages, square corners, and
    an ink band for the footer and tooltips (new `--band-*` tokens, contrast-tested in both
    themes like every other pair).
51. **The home page's year strip was removed** (October 27, 2026): one line per record, taller
    for severity, was hard to read. Item 55 replaces it.
52. **Date ranges in newsroom style**: "Aug. 1–2, 2026", "Aug. 30 – Sept. 2, 2026".

## Data presentation (October 27, 2026)

Modeled on how established trackers present this kind of data (SPLC's Hate Map, ADL's
H.E.A.T. Map): a state map, filters for type and date above it, a click-through into each
state, a table beside every chart, and downloads.

53. **State map** (`src/components/charts/StateMap.tsx`): a choropleth of records per state on
    the Albers USA projection, Alaska and Hawaii inset, from US Census Bureau boundaries via
    us-atlas (`scripts/build-geo.mjs`). Five classes on the Section 5 `--chart-seq` ramp, on a
    rough log scale with round bounds (1–3, 4–9, 10–39…) so a few large states do not wash out
    the rest; zero is drawn empty. Selecting a state zooms the map into it (an animated
    viewBox, off with reduced motion): county lines for orientation, and a circle per city,
    sized by area. Territories, outside the projection, are listed under the map. Totals, not
    per-capita rates: no reliable Muslim population figures exist by state (open question
    below). The map is an SVG drawn on the server, so it works without JavaScript, prints,
    and needs no tile service; shapes are SVG sprites in `public/geo/<content hash>/`,
    referenced with `<use>`, so pages carry 51 references instead of the path data and the
    files cache for good. MapLibre and OpenFreeMap were removed.
54. **Explore** puts the two filters people reach for first in one row above the map and the
    list: date presets (all dates, this year, last 12 months, last 30 days — the same ranges as
    the home tiles) with a custom range, and incident-type toggles that show how many records
    each would give. The rest stay in the rail. The map's state and city are ordinary filters
    (`state`, `city`), so a zoomed view has a URL, a CSV and a printout like any other. Every
    filter form is keyed by the filters, so it never shows values a link has since changed.
55. **Charts** are drawn on the server in plain HTML and SVG (bars with values printed at
    their ends, monthly columns with round ticks), with a tooltip on hover and focus, a table
    or list as the accessible version, and a link from every mark to Explore with the same
    count (tested). Built by hand rather than with Observable Plot (the specification's
    suggestion): no client-side chart code, and they print and theme like the rest of the
    page. A record counts in every month its dates touch, as Explore's date filter selects it,
    and under each of its types; both are stated under the charts. Big numbers are set in the
    interface sans with proportional figures.
56. **Print and download**: "Print or save as PDF" opens `/incidents/print`, the current filters
    as a report (the map, totals by state and by type, and every matching record up to 2,000,
    with a source line). It prints in the light theme's colors whatever the screen shows.
    Downloads: the matching records (CSV, as before) and totals by state (CSV).

## Morning news scan (October 27, 2026)

57. **What it does** (`src/server/jobs/news/`): each morning it reads new articles from Google
    News searches, GDELT's news index (direct article links) and CAIR's press releases (extra
    feeds by setting), skipping any already seen, already a lead or already a record's source,
    and the same story under another address. Claude reads each article (its text, or the
    headline when the page cannot be read) against the inclusion criteria — the published
    text, word for word, from `src/lib/inclusion.ts` — and returns a structured reading:
    relevance, confidence, reason, and the date, place, types, target, legal status and a
    neutral summary as stated. Relevant or unclear articles become leads; clearly irrelevant
    ones are kept with the reason in the scan log, for editors to check its judgment.
58. **It never publishes.** It only adds leads (source "news monitor" or "organization feed");
    an editor triages each, a draft is written and reviewed, and publishing takes two people,
    as the database enforces. The reading pre-fills triage (state, type, date, city) and is
    copied into the draft's private notes, marked unverified. The methodology page says an AI
    model screens articles. Lead creation is in the audit log, with no human actor.
59. **Model and cost**: Claude Opus 5.5 by default (`NEWS_SCAN_MODEL` to change), at low effort,
    with the instructions cached across the run and a structured-output format so every reply
    parses; refusals fall back server-side to another model. About $0.02 an article; see
    `docs/DEPLOY.md`, step 8.5. Claude Haiku 5.5 is about a twentieth of the cost. Without an
    API key the scan still runs, with a keyword rule. At most 40 leads a day by default.
    The Batch API would halve the cost, but results can take hours; not used, so leads are
    in the inbox the same morning.
60. **Runs** as a 5-minute job from Vercel's daily cron, plus a follow-up pass from the GitHub
    workflow. Articles are claimed with `FOR UPDATE SKIP LOCKED`, so overlapping passes never
    read one twice; each article gets three tries over separate passes, then is marked failed.
    A pass that reaches no source at all answers 502, so the run shows as failed. Article pages
    are fetched only from public web addresses, each redirect checked, since feed items are
    third-party content. Articles are private (row-level security like every internal table);
    skipped and failed ones are deleted after a year by the retention job.
61. **Untested against the live sources from the build environment**, whose network blocks
    them: the feed formats are tested with samples, and the first live mornings should be
    checked in the scan log (`docs/DEPLOY.md`, step 8.5).

## Design, second pass (October 27, 2026)

At the project's request — cleaner, a modern look, icons that respond on hover, and glass
for parts of the page — the look was redone again and then reviewed in three rounds, each
by one design critic per page working from screenshots (desktop and phone, light and dark);
the findings that held up were applied after each round. Section 5's colors, tone rules
and components stand.

62. **One typeface, Instrument Sans** (SIL Open Font License), for headlines, reading text,
    the interface and tables, replacing Newsreader, Libre Franklin and IBM Plex Mono. A
    modern grotesque that is plain at 12 px in a table and still has character at headline
    sizes; Inter and Geist were rendered beside it and read as default app type. One
    variable file (30 KB, weights 400–700) serves the whole site, preloaded with a
    metric-matched fallback so nothing reflows; the italic loads only where a page uses it.
    Record ids and code use the reader's system monospace, so no second file is fetched.
    Reading text is 17.5 px / 1.65 (`src/fonts/README.md`).
63. **Icons from Lucide** (`lucide-react`, ISC license), rendered on the server as inline SVG,
    so they add no JavaScript. They mark navigation, section heads, actions and stat tiles,
    sit in tinted chips that lift and nudge on hover or focus (unless the reader asks for
    reduced motion), and never stand alone as a label.
64. **Glass for what floats above the page**: the header bar and menu sheet, the Explore
    toolbar and results bar, tooltips, side notes and the panels of the home page. A
    translucent fill with backdrop blur, a lit rim and a soft shadow, over a faint wash of
    the accent colors so there is something to frost. Running text, forms and tables sit
    on solid surfaces. The glass colors are tokens, and the contrast tests composite them
    over the backdrops they sit on in both themes. Printing drops the effect.
65. **Shapes**: rounded corners (8–26 px), pill badges and buttons, and cards with a shadow
    that lifts on hover, instead of square stamps and ink rules. Whole cards and table rows
    open their record; badges inside keep their own tooltips and links.
66. **Map ramp re-stepped**: the five classes keep Section 5's end points (`--accent`, and its
    dark-theme pair) with evenly spaced steps between, checked with a palette validator in
    both themes so neighboring classes stay apart for common color-vision deficiencies and
    the lightest class stays visible against an empty state.

67. **One type scale, in tokens**: 12, 13, 14, 16, 17.5 (reading), 18, 22 and 28 px, plus fluid
    sizes for page titles, section titles and headline figures (`--step-h1`, `--step-h2`,
    `--step-figure`). Components use only these; half-pixel sizes were removed after two
    critics found fifteen sizes on one page.
68. **Records table in two columns** (date and place; the incident with its status on a line
    under the title) at every width: the content column is never wider than about 850 px, too
    narrow for status columns of their own. Sorting by severity is in the sort control.
69. **A short list reads as a sentence**: under the Explore map, three rows or fewer, or rows
    of equal value, are written out ("One record each in California, Illinois, Tennessee and
    Texas.") instead of bars of equal length. The list sits under the map at every width.
70. **Downloads say what they hold**: "Download records" and "Totals by state" cover verified
    records (V2 and V3), the site's counts; a third link adds single-source (V1) reports. The
    file names say the same (`record-verified-…`, `record-all-…`, `record-results-…`).
71. **The report form keeps everything on any error**: it is sent by script rather than by
    the form's own action, so React does not reset it, and the link, email and length rules
    run in the browser too. A pasted `www.` address is accepted as a link. Without JavaScript
    the spam check cannot run, so the form says to email the editors instead. (Accepting
    posts without the check would open a path around it for bots; not done.)
72. **The form says it is not a police report**, on the form and on the confirmation, with
    where to report a crime (local police, the FBI at tips.fbi.gov).
73. **Status explained once**: on a record page the status panel prints each rule in words,
    so its badges carry no tooltip; in lists the badges keep theirs. The legal status and
    "Alleged" form one group with a gavel, so a reader never takes the verification next to
    it for a verdict. Before any charge the record says "No charges known", not "Unknown".

### Third critique round

74. **The legal lifecycle is drawn in stages**: investigation, charges and court, the outcome
    (one of five), and "Sentenced" only after a conviction or plea agreement. The earlier
    diagram ran every outcome into "Sentenced", which implied that acquittals and dismissals
    end in a sentence. Source precedence is a numbered ranking, not a chain of arrows.
75. **Contents on phones**: a pill under the header names the section being read; its list
    opens at that section, over a clear layer that takes a tap outside (so the tap presses
    nothing underneath), and closes on a choice, on Escape or when focus leaves it. After a
    jump to an anchor, the section holding it stays current until the reader scrolls on.
    Without JavaScript the list is a plain disclosure in the page and does not stick.
76. **A record on paper** is one full-width column with a first line naming the site and the
    record; buttons, the breadcrumb and the sidebar are left out. On a record page the
    status badges are plain text (the rule and its link are printed beside them), and only
    the contents card sticks, so it stays reachable on short screens.
77. **Report drafts survive leaving the page, in memory only**: an unsent report is kept in
    the tab's memory while the reader follows a link (the privacy policy, say) and comes
    back; it is never written to storage or cookies, closing or reloading the tab forgets it
    (the browser asks first), and sending clears it. Choosing files again adds to the list.
    Without JavaScript the form says at the top that the spam check needs it and offers the
    editors' email instead of a Send button that cannot work.

## Open questions (**Ask**)

- Organizational home, media lawyer, and the contents of About (team, board, funding).
- Final project name and domain; then the favicon in `src/lib/site.ts`. Suggested neutral `.org` names: antimuslimincidents.org (matches the working subtitle), amirecord.org ("Anti-Muslim Incident Record"), antimuslimincidentrecord.org. Avoid names that could be read either way, such as muslimincidents or antimuslimrecord.
- Whether submissions should create drafts directly (item 16).
- A US Muslim population source for per-capita rates (Phase 2 choropleth).

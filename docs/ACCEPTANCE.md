# Acceptance tests (Phase 1)

Results from the build environment on 2026-10-26: Node 22, PostgreSQL 16.15 with
PostGIS, Chromium 147 (Playwright 1.63). Re-run everything with:

```bash
npm run typecheck && npm test && npm run test:e2e && npm run test:db-down && npm run test:lighthouse
```

| Suite | Result |
| --- | --- |
| Type check (`tsc --noEmit`, app + tests) | clean |
| Unit tests (Vitest, `tests/unit`) | 77 passed |
| Database integration tests (Vitest, `tests/db`, real Postgres) | 50 passed |
| End-to-end tests (Playwright, `tests/e2e`, production build) | 69 passed (67 desktop, 2 mobile) |
| Database-down check (`scripts/test-db-down.ts`) | 9 of 9 pages served |
| Lighthouse, mobile (`scripts/lighthouse.ts`) | see item 6 |

External services could not be reached from the build environment (the
Internet Archive, Cloudflare Turnstile, OpenFreeMap tiles), so tests use a
local stand-in for Save Page Now, Turnstile's test mode, and a basemap-free
map style. Check those three by hand after the first deploy.

## The list from the specification

**1. A record cannot be published without at least one source, a verification
level, a legal status, and approval by a second editor who is not the author.**
**Pass.** Enforced by the database (`drizzle/0002_rules.sql`) and checked again in
the app. `tests/db/rules.test.ts` proves each refusal at the database layer,
including attempts that bypass the app's own role checks: approval without a
source, at V0, or without a legal status; a review by the author, by an editor
of the revision, by a contributor, or recorded under someone else's name; an
incomplete checklist; publishing without approval or by a non-senior editor; a
change after approval (approval voided); and the schema owner inserting an
unreviewed snapshot directly. `tests/e2e/admin.spec.ts` walks the same rule
through the UI: author drafts, cannot review, second editor approves with the
full checklist, senior editor publishes, the record appears publicly.

**2. V0 records and editor notes never appear in any public page, API response,
sitemap, or download.** **Pass** for every public surface that exists in Phase 1.
`tests/db/public-access.test.ts`: the public database role cannot read any of the
internal tables or call workflow functions; the public view's columns match the
schema declaration and include no private field; canary strings in editor notes
and a canary V0 draft never appear in the view or the query layer.
`tests/e2e/privacy.spec.ts` crawls every public page, the sitemap, robots.txt,
the data dictionary JSON, the Explore CSV and tonight's CSV/JSON release, raw
and rendered, for the canaries; the V0 record's URL returns 404. The public API
(`/api/v1`) is Phase 2; it will read the same view.

**3. Every filter combination produces a shareable URL. Reloading that URL gives
identical results.** **Pass.** `tests/e2e/explore.spec.ts` loads 12 filter
combinations, reloads each, opens it in a fresh browser context, and compares the
ordered record list; non-canonical URLs redirect to one canonical form.
`tests/unit/filters.test.ts` covers parsing, canonical order and round trips.

**4. Clicking any chart element or map region opens Explore with matching
filters, and the counts match.** **Partly applicable.** Charts and the state
choropleth are Phase 2. The home stat tiles do this today and are tested
(`explore.spec.ts`, "home stat tiles"): each opens Explore filtered to exactly the
records it counts. Map points open their record.

**5. Stat tiles, charts, API /stats, and the CSV all give the same totals for the
same filters.** **Pass** for what exists (stat counts, Explore, CSV):
`tests/db/exports.test.ts` checks 9 filter sets; all three come from one SQL
WHERE clause (`src/server/public/incidents.ts`). Charts and `/stats` are Phase 2
and should reuse `whereClause()`.

**6. Lighthouse scores of at least 90 for performance and accessibility on Home,
Explore, and an Incident page, on mobile.** **Pass** (Lighthouse 13, default
mobile emulation, production build on localhost):

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home `/` | 97 | 100 | 100 | 100 |
| Explore `/incidents` | 96 | 100 | 100 | 100 |
| Incident `/incidents/DEMO-2026-0002…` | 97 | 100 | 100 | 66* |

\* Demo records are deliberately `noindex`; real records are indexable.

**7. axe-core reports zero serious accessibility violations. Full keyboard
navigation works on Explore and the Report form.** **Pass.**
`tests/e2e/a11y.spec.ts` runs axe (WCAG 2.0/2.1/2.2 A and AA plus best practices)
on 13 pages in light and dark themes: zero serious or critical violations. It
also checks reflow at 200% zoom and reduced motion. Keyboard: filters set and
applied with Tab/Space/Enter, arrow-key row navigation, skip link
(`explore.spec.ts`); a full report sent with the keyboard alone, with focus moved
to the confirmation (`report.spec.ts`).

**8. Every new source gets an archived URL within 10 minutes of saving.**
**Pass for the mechanism; the live archive was not reachable here.** Each save
archives its new sources right away (normally within a minute), and the archive
job retries pending ones: nightly on Vercel's free plan, every 5 minutes once the
included GitHub Actions schedule is switched on (see `docs/DEPLOY.md`, step 4.4;
choose that or Vercel Pro so a failed first attempt is retried within 10
minutes). `tests/db/archive.test.ts` runs
the job against a local stand-in for Save Page Now: archived URL stored, the live
page updated without a new review, failures retried and marked failed after six
attempts. Confirm against web.archive.org after deploying.

**9. Uploaded images have EXIF data removed. Submitter details are encrypted and
never leave the admin area.** **Pass.** `tests/db/submissions.test.ts`: a JPEG
with GPS and camera EXIF is stored encrypted at rest and, decrypted, has no
metadata; contact details and the exact address are ciphertext in a separate
table; the public role cannot read any submission table; retention deletes them
after 12 months unless the submitter agreed otherwise. `tests/unit/uploads.test.ts`
covers JPEG and PNG stripping and type sniffing. Evidence downloads require a
signed-in editor and are audited.

**10. Both themes (light and dark) pass contrast checks. No hard-coded colors
outside the token file.** **Pass.** `tests/unit/design-tokens.test.ts` checks every
text/background pair, derived tints (zebra rows, hover, search highlight), button
text and control borders in both themes, confirms the exact Section 5 values, and
scans the source for any color literal outside `src/styles/tokens.css`. axe's
color-contrast rule passes in both themes. Note: the spec's light
`--status-reported` on a 10% tint is 4.30:1, so badges use the surface color with
a status border instead (4.90:1). See `DECISIONS.md` item 27.

**11. Incident pages are statically generated and still load if the database is
down.** **Pass.** The build prerenders every published record. `npm run test:db-down`
starts the production build with both database URLs pointing at a closed port:
all 5 incident pages and the static pages return 200 with their content. Explore
search needs the database and shows the error page (expected).

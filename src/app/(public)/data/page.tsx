import { ChevronDown, Copy, Database, Download, FileDown, FileJson, FileSpreadsheet, PackageCheck, Quote, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cache, type ReactNode } from 'react'
import { CopyButton } from '@/components/CopyButton'
import { PageHeader } from '@/components/PageHeader'
import * as E from '@/db/enums'
import { METHODOLOGY_VERSION, PUBLIC_VERIFICATION_LEVELS } from '@/db/enums'
import { datasetCitation } from '@/lib/citations'
import { EXPORT_FIELDS, type DictionaryField } from '@/lib/dictionary'
import { EMPTY_FILTERS } from '@/lib/filters'
import { formatNumber, formatTimestamp, plural, todayIso } from '@/lib/format'
import { SITE } from '@/lib/site'
import { countIncidents } from '@/server/public/incidents'
import { listReleases, releaseFileName } from '@/server/public/releases'

export const revalidate = 3600

/** Read once per render: the description and the page both depend on whether a release exists. */
const getReleases = cache(() => listReleases())

export async function generateMetadata(): Promise<Metadata> {
  const [latest] = await getReleases()
  return {
    title: 'Data and downloads',
    // Promises only what exists: versioned CSV and JSON files start with the first nightly build.
    description: latest
      ? 'Every published record as CSV and JSON, rebuilt nightly and versioned, with checksums, a data dictionary and a citation.'
      : 'The verified records, or every published record, as CSV, with a data dictionary and a citation.',
  }
}

function bytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

const COLUMNS = new Set(EXPORT_FIELDS.map((f) => f.column))

// The scope of each file, in the words its label and file name use.
const VERIFIED_LEVELS = 'V2–V3'
const ALL_LEVELS = 'V1–V3'

/** What each coded value means, from the same definitions the site uses (src/db/enums.ts). */
const VALUE_LABELS: Partial<Record<string, Record<string, { label: string }>>> = {
  datePrecision: E.DATE_PRECISION_META,
  locationPrecision: E.LOCATION_PRECISION_META,
  incidentTypes: E.INCIDENT_TYPE_META,
  targetType: E.TARGET_TYPE_META,
  targetAttributes: E.TARGET_ATTRIBUTE_META,
  severity: E.SEVERITY_META as Record<string, { label: string }>,
  propertyDamage: E.YES_NO_UNKNOWN_META,
  perpetratorType: E.PERPETRATOR_TYPE_META,
  biasIndicators: E.BIAS_INDICATOR_META,
  verificationLevel: E.VERIFICATION_META,
  legalStatus: E.LEGAL_STATUS_META,
  hateCrimeCharged: E.YES_NO_UNKNOWN_META,
  sourceTypes: E.SOURCE_TYPE_META,
}

// Small words that never make a label say more than its code ("Mosque or Islamic center").
const FILLER = new Set(['a', 'an', 'and', 'as', 'of', 'or', 'the'])
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** A value's meaning, only when it says more than the code: "Homicide" for `HOM`, nothing for `unknown`. */
function meaningOf(f: DictionaryField, value: string | number): string | null {
  const label = VALUE_LABELS[f.key]?.[String(value)]?.label
  if (!label) return null
  const code = new Set(words(String(value)))
  return words(label).some((w) => !code.has(w) && !FILLER.has(w)) ? label : null
}

/** Dictionary text: `code` becomes a chip, /methodology#… a link, a known column a link to its row. */
function DescriptionText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\/methodology#[a-z0-9-]+)/g)
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (p.startsWith('`') && p.endsWith('`')) {
          const code = p.slice(1, -1)
          return COLUMNS.has(code) ? (
            <a key={i} href={`#field-${code}`} className="token">
              {code}
            </a>
          ) : (
            <code key={i} className="token">
              {code}
            </code>
          )
        }
        if (p.startsWith('/methodology#')) {
          return (
            <Link key={i} href={p}>
              the methodology
            </Link>
          )
        }
        return p
      })}
    </>
  )
}

/**
 * A field's coded values. When every code needs explaining (HOM, V1, 1–5) they are listed with their
 * meanings; otherwise they are chips, and the few whose label says more carry it inside the chip.
 */
function AllowedValues({ field }: { field: DictionaryField }) {
  const values = field.allowed ?? []
  const meanings = values.map((v) => meaningOf(field, v))
  if (meanings.every(Boolean)) {
    return (
      <dl className="dict-codes">
        {values.flatMap((v, i) => [
          <dt key={`${v}-code`}>
            <code className="token">{String(v)}</code>
          </dt>,
          <dd key={`${v}-label`}>{meanings[i]}</dd>,
        ])}
      </dl>
    )
  }
  return (
    <ul className="dict-chips">
      {values.map((v, i) => (
        <li key={String(v)} className={meanings[i] ? 'dict-pair' : undefined}>
          <code className="token">{String(v)}</code>
          {meanings[i] ? <span>{meanings[i]}</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** The coded keys of a JSON field's entries, with their values, or a link to the column that shares them. */
function KeyValues({ field }: { field: DictionaryField }) {
  return Object.entries(field.keyValues ?? {}).map(([key, values]) => {
    const same = EXPORT_FIELDS.find((g) => g.allowed && g.allowed.join() === values.join())
    return (
      <p key={key} className="dict-inline">
        <code className="code-id">{key}</code>{' '}
        {same ? (
          <>
            takes the{' '}
            <a href={`#field-${same.column}`} className="token">
              {same.column}
            </a>{' '}
            values.
          </>
        ) : (
          <>
            is one of:{' '}
            {values.map((v) => (
              <code key={v} className="token">
                {v}
              </code>
            ))}
          </>
        )}
      </p>
    )
  })
}

/** "Jump to a field": every column, in the dictionary's order. */
function FieldLinks() {
  return (
    <ul>
      {EXPORT_FIELDS.map((f) => (
        <li key={f.column}>
          <a href={`#field-${f.column}`}>{f.column}</a>
        </li>
      ))}
    </ul>
  )
}

/** Added, updated and removed counts, dotted so a wrapped line never ends on a dot. */
function ChangeCounts({ c }: { c: { added: unknown[]; updated: unknown[]; removed: unknown[] } }) {
  return (
    <span className="meta-line tabular">
      <span>{formatNumber(c.added.length)} added</span>
      <span>{formatNumber(c.updated.length)} updated</span>
      <span>{formatNumber(c.removed.length)} removed</span>
    </span>
  )
}

type LiveFile = { id: string; href: string; label: string; icon: ReactNode; facts: string[] }

/** Live files, each with the records it holds beside its label. The first is the main download when `primary`. */
function LiveFiles({ files, primary }: { files: LiveFile[]; primary: boolean }) {
  return (
    <ul className="dl-list">
      {files.map((f, i) => (
        <li key={f.id}>
          <a className={primary && i === 0 ? 'btn' : 'btn btn-secondary'} href={f.href} download aria-describedby={f.id}>
            {f.icon}
            {f.label}
          </a>
          <p id={f.id} className="meta-line text-sm text-muted">
            {f.facts.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default async function DataPage() {
  const [releases, verified, all] = await Promise.all([
    getReleases(),
    countIncidents(EMPTY_FILTERS),
    countIncidents({ ...EMPTY_FILTERS, v: [...PUBLIC_VERIFICATION_LEVELS] }),
  ])
  const latest = releases[0]
  const today = todayIso()
  const citation = datasetCitation(latest?.version ?? null, today)

  // Each label uses its file's word (record-verified-…, record-all-…), and says what the file holds.
  const verifiedFile: LiveFile = {
    id: 'dl-verified',
    href: '/incidents/download',
    label: 'Verified records (CSV)',
    icon: <Download aria-hidden="true" className="nudge-down" />,
    facts: [plural(verified.incidents, 'record'), VERIFIED_LEVELS, 'matches the site’s counts'],
  }
  const statesFile: LiveFile = {
    id: 'dl-states',
    href: '/incidents/download/states',
    label: 'Verified totals by state (CSV)',
    icon: <FileSpreadsheet aria-hidden="true" className="nudge-down" />,
    facts: ['One row per state and territory', VERIFIED_LEVELS],
  }
  const allFile: LiveFile = {
    id: 'dl-all',
    href: '/incidents/download?v=1,2,3',
    label: 'All records (CSV)',
    icon: <Download aria-hidden="true" className="nudge-down" />,
    facts: [plural(all.incidents, 'record'), ALL_LEVELS, 'adds single-source reports'],
  }

  return (
    <main className="data-page wrap pt-6 md:pt-8">
      <PageHeader kicker={`Open data · ${SITE.dataLicense.name}`} icon={<Database aria-hidden="true" />} title="Data and downloads">
        {latest
          ? 'Download every published record as CSV or JSON. The files are rebuilt each night, versioned and checksummed, and free to reuse under '
          : 'Download the verified records the site counts, or every published record including single-source reports, as CSV. Free to reuse under '}
        <a href={SITE.dataLicense.url}>{SITE.dataLicense.name}</a> with a citation.
      </PageHeader>

      <section aria-labelledby="latest-h" className="glass mt-8 rounded-[var(--radius-lg)] p-5 md:p-8">
        {latest ? (
          <>
            <div className="flex items-start gap-4">
              <span className="icon-chip icon-chip-lg" aria-hidden="true">
                <PackageCheck />
              </span>
              <div>
                <h2 id="latest-h" className="text-xl leading-tight">
                  Latest release
                </h2>
                <p className="meta-line tabular mt-1 text-sm text-muted">
                  <span>Version {latest.version}</span>
                  <span>{plural(latest.recordCount, 'record')}</span>
                  <span>Methodology {latest.methodologyVersion}</span>
                  <span>Built {formatTimestamp(latest.createdAt)}</span>
                </p>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              {(['csv', 'json'] as const).map((ext) => {
                const name = releaseFileName(latest.version, ext)
                return (
                  <li key={ext}>
                    <a href={`/data/downloads/${name}`} className="dl-tile lift hover-icon" download>
                      <span className="icon-chip" aria-hidden="true">
                        {ext === 'csv' ? <FileSpreadsheet /> : <FileJson />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold">All records ({ext.toUpperCase()})</span>
                        <span className="meta-line tabular text-xs text-muted">
                          <span>{ALL_LEVELS}</span>
                          <span>{bytes(ext === 'csv' ? latest.csvBytes : latest.jsonBytes)}</span>
                        </span>
                        {/* Without break-all the name can break only after "record-", never inside ".json". */}
                        <span className="block text-xs text-muted">{name}</span>
                      </span>
                      <Download aria-hidden="true" size={20} className="nudge-down text-accent" />
                    </a>
                  </li>
                )
              })}
            </ul>
            <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5 text-base">
              <span>Changes since {latest.previousVersion ? `version ${latest.previousVersion}` : 'the start'}:</span>
              <ChangeCounts c={latest.changelog} />
            </p>
            <details className="group mt-3">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
                Verify your download (SHA-256)
                <ChevronDown aria-hidden="true" size={16} className="nudge-down transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 space-y-2 text-xs">
                {(['csv', 'json'] as const).map((ext) => (
                  <li key={ext}>
                    <span className="font-semibold">{ext.toUpperCase()}</span>{' '}
                    <code className="code-id [overflow-wrap:anywhere]">{ext === 'csv' ? latest.csvSha256 : latest.jsonSha256}</code> ·{' '}
                    <a href={`/data/downloads/${releaseFileName(latest.version, ext)}.sha256`}>{ext.toUpperCase()} checksum file</a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                To check a file, run{' '}
                <code className="code-id [overflow-wrap:anywhere]">shasum -a 256 {releaseFileName(latest.version, 'csv')}</code> (macOS, Linux)
                or <code className="code-id [overflow-wrap:anywhere]">Get-FileHash {releaseFileName(latest.version, 'csv')}</code> (Windows
                PowerShell) and compare the result with the checksum above.
              </p>
            </details>
            <p className="mt-6 text-sm text-muted">
              The site’s counts use V2 and V3 only. To match them, filter the release on{' '}
              <a href="#field-verification_level" className="token">
                verification_level
              </a>
              , or download the live verified files:
            </p>
            <div className="mt-3">
              <LiveFiles files={[verifiedFile, statesFile]} primary={false} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <span className="icon-chip icon-chip-lg" aria-hidden="true">
                <FileDown />
              </span>
              <h2 id="latest-h" className="text-xl leading-tight">
                Download the records
              </h2>
            </div>
            <p className="mt-3 max-w-[62ch] text-muted">
              Each file is made when you download it, so it is always up to date. The columns are described in the dictionary below.
            </p>
            <div className="mt-6">
              <LiveFiles files={[verifiedFile, statesFile, allFile]} primary />
            </div>
            <p className="mt-6 max-w-[70ch] text-sm text-muted">
              Versioned nightly releases in CSV and JSON, with checksums, start after the first build, at about 05:15 UTC (after midnight
              Eastern).
            </p>
          </>
        )}
        <p className="mt-5 border-t border-rule pt-4 text-sm text-muted">
          No API yet. A read-only API at <code className="token">/api/v1/</code> with an OpenAPI description is planned. Until then, use{' '}
          {latest ? 'the nightly files or ' : ''}the CSV export of any <Link href="/incidents">Explore</Link> view.
        </p>
      </section>

      {releases.length > 1 ? (
        <section aria-labelledby="history-h" className="mt-14">
          <h2 id="history-h" className="mb-4 text-xl leading-tight">
            Earlier releases
          </h2>
          <div className="table-scroll history-scroll">
            {/* Explicit roles: some browsers drop table semantics when the rows are restyled as cards. */}
            <table className="data-table data-table-static history" role="table">
              <caption className="sr-only">Earlier dataset releases</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Version
                  </th>
                  <th scope="col" role="columnheader">
                    Changes
                  </th>
                  <th scope="col" role="columnheader" className="text-end">
                    Files
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {releases.slice(1).map((r) => (
                  <tr key={r.version} role="row">
                    <th scope="row" role="rowheader" className="text-start font-semibold">
                      <span className="tabular">Version {r.version}</span>
                      <span className="block text-xs font-normal text-muted">{plural(r.recordCount, 'record')}</span>
                    </th>
                    <td role="cell">
                      <ChangeCounts c={r.changelog} />
                    </td>
                    <td role="cell" className="whitespace-nowrap md:text-end">
                      {(['csv', 'json'] as const).map((ext) => (
                        <a
                          key={ext}
                          href={`/data/downloads/${releaseFileName(r.version, ext)}`}
                          className={`btn btn-secondary btn-sm${ext === 'csv' ? ' me-2' : ''}`}
                          download
                        >
                          <Download aria-hidden="true" className="nudge-down" />
                          {ext.toUpperCase()}
                          <span className="sr-only">, version {r.version}</span>
                        </a>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="cite-h" className="panel">
          <span className="icon-chip" aria-hidden="true">
            <Quote />
          </span>
          <h2 id="cite-h" className="section-head mt-3 mb-3 text-xl leading-[1.2]">
            How to cite
          </h2>
          <p className="rounded-[var(--radius-sm)] bg-row-alt p-4 text-base leading-relaxed">{citation}</p>
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>License: {SITE.dataLicense.name}.</span>
            {/* It needs JavaScript, so it is hidden without it and on paper. */}
            <CopyButton
              text={citation}
              label="Copy citation"
              className="btn btn-quiet btn-sm needs-script no-print -me-2"
              icon={<Copy aria-hidden="true" />}
            />
          </p>
          <p className="mt-3 text-base">Each record also has its own citation in APA, Chicago and BibTeX formats on its page.</p>
        </section>

        <section aria-labelledby="never-h" className="panel">
          <span className="icon-chip" aria-hidden="true">
            <ShieldCheck />
          </span>
          <h2 id="never-h" className="section-head mt-3 mb-3 text-xl leading-[1.2]">
            What is never included
          </h2>
          <p className="text-base leading-relaxed">
            Editors’ private notes, submitters’ contact details, exact private addresses, uploaded files, and unpublished or unverified (V0)
            records are never in any download, page or feed. The public site reads from a database role that cannot see them.
          </p>
        </section>
      </div>

      <section aria-labelledby="dict-h" className="mt-20 border-t border-rule pt-10">
        <h2 id="dict-h" className="section-head mb-3 text-h2">
          Data dictionary
        </h2>
        <p className="max-w-[70ch] text-base text-muted">
          Every column in the CSV and JSON files, generated from the database schema (methodology {METHODOLOGY_VERSION}). CSV files are UTF-8 and
          comma-separated; in Excel, open them with Data › From Text/CSV. List fields are separated by a semicolon and a space (
          <code className="token">; </code>); nested fields are JSON. <a href="/data/dictionary.json">Download this dictionary as JSON</a>.
        </p>
        {/* On phones the 46 names would fill a screen, so they fold into a disclosure there. */}
        <nav aria-label="Jump to a field" className="dict-index mt-5 mb-5 sm:hidden">
          <details className="group">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
              Jump to a field
              <ChevronDown aria-hidden="true" size={16} className="nudge-down transition-transform group-open:rotate-180" />
            </summary>
            <FieldLinks />
          </details>
        </nav>
        <nav aria-labelledby="dict-index-h" className="dict-index mt-6 mb-6 max-sm:hidden">
          <h3 id="dict-index-h" className="text-sm font-semibold">
            Jump to a field
          </h3>
          <FieldLinks />
        </nav>
        <div className="table-scroll sticky-head dict-scroll">
          <table className="data-table data-table-static dict" role="table">
            <caption className="sr-only">Every field in the dataset with its type, definition and allowed values</caption>
            {/* Explicit roles: some browsers drop table semantics when the rows are restyled as cards. */}
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  Field
                </th>
                <th scope="col" role="columnheader">
                  Definition
                </th>
                <th scope="col" role="columnheader">
                  Allowed values
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {EXPORT_FIELDS.map((f) => (
                <tr key={f.column} id={`field-${f.column}`} role="row">
                  <th scope="row" role="rowheader" className="dict-field text-start align-top font-normal">
                    <a href={`#field-${f.column}`} className="code-id dict-name no-underline hover:underline">
                      {f.column}
                    </a>
                    <span className="meta-line mt-0.5 text-xs text-muted">
                      <span>{f.type}</span>
                      {f.nullable ? <span>may be empty</span> : null}
                    </span>
                  </th>
                  <td role="cell" className="dict-def">
                    <DescriptionText text={f.description} />
                    {f.keys ? (
                      <p className="dict-inline mt-2">
                        Each entry has:{' '}
                        {f.keys.map((k) => (
                          <code key={k} className="token">
                            {k}
                          </code>
                        ))}
                      </p>
                    ) : null}
                  </td>
                  <td role="cell" className="dict-allowed" data-empty={f.allowed || f.keyValues ? undefined : ''}>
                    {f.allowed ? <AllowedValues field={f} /> : null}
                    {f.keyValues ? <KeyValues field={f} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

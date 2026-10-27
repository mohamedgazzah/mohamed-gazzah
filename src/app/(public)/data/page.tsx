import { ArrowRight, CalendarClock, Copy, Database, Download, FileJson, FileSpreadsheet, PackageCheck, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CopyButton } from '@/components/CopyButton'
import { PageHeader } from '@/components/PageHeader'
import { METHODOLOGY_VERSION } from '@/db/enums'
import { datasetCitation } from '@/lib/citations'
import { EXPORT_FIELDS } from '@/lib/dictionary'
import { formatNumber, formatTimestamp, todayIso } from '@/lib/format'
import { SITE } from '@/lib/site'
import { listReleases, releaseFileName } from '@/server/public/releases'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Data and downloads',
  description: 'The full dataset as CSV and JSON, rebuilt nightly and versioned, with checksums, a data dictionary and a citation.',
}

function bytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

const COLUMNS = new Set(EXPORT_FIELDS.map((f) => f.column))

/** Dictionary text: `code` becomes a chip, /methodology#… a link, a known column a link to its row. */
function DescriptionText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\/methodology#[a-z0-9-]+)/g)
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (p.startsWith('`') && p.endsWith('`')) {
          const code = p.slice(1, -1)
          return COLUMNS.has(code) ? (
            <a key={i} href={`#field-${code}`} className="token no-underline hover:underline">
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

export default async function DataPage() {
  const releases = await listReleases()
  const latest = releases[0]
  const today = todayIso()
  const citation = datasetCitation(latest?.version ?? null, today)

  return (
    <main className="wrap pt-6 pb-4 md:pt-8">
      <PageHeader kicker={`Open data · ${SITE.dataLicense.name}`} icon={<Database aria-hidden="true" />} title="Data and downloads">
        Download every published record as CSV or JSON. The files are rebuilt each night, versioned and checksummed, and free to reuse under{' '}
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
                <h2 id="latest-h" className="text-[22px] leading-tight">
                  Latest release
                </h2>
                <p className="tabular mt-1 text-[15px] text-muted">
                  v{latest.version} · built {formatTimestamp(latest.createdAt)} · {formatNumber(latest.recordCount)} records · methodology{' '}
                  <span className="whitespace-nowrap">{latest.methodologyVersion}</span>
                </p>
              </div>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {(['csv', 'json'] as const).map((ext) => (
                <li key={ext}>
                  <a
                    href={`/data/downloads/${releaseFileName(latest.version, ext)}`}
                    className="dl-tile lift hover-icon"
                    download
                    aria-describedby={`dl-${ext}-meta`}
                  >
                    <span className="icon-chip" aria-hidden="true">
                      {ext === 'csv' ? <FileSpreadsheet /> : <FileJson />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[18px] font-semibold">Download {ext.toUpperCase()}</span>
                      <span id={`dl-${ext}-meta`} className="block truncate text-[13px] text-muted">
                        {releaseFileName(latest.version, ext)} · {bytes(ext === 'csv' ? latest.csvBytes : latest.jsonBytes)}
                      </span>
                    </span>
                    <Download aria-hidden="true" size={20} className="nudge-down text-accent" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[15.5px]">
              Changes since {latest.previousVersion ?? 'the start'}: {formatNumber(latest.changelog.added.length)} added,{' '}
              {formatNumber(latest.changelog.updated.length)} updated, {formatNumber(latest.changelog.removed.length)} removed.
            </p>
            <p className="mt-1 text-sm text-muted">
              Includes every published record (V1 to V3). The site’s counts use V2 and V3 only; filter on{' '}
              <a href="#field-verification_level" className="token no-underline hover:underline">
                verification_level
              </a>{' '}
              to match them.
            </p>
            <details className="group mt-4">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
                Verify your download (SHA-256)
              </summary>
              <ul className="mt-2 space-y-2 text-[13px]">
                {(['csv', 'json'] as const).map((ext) => (
                  <li key={ext}>
                    <span className="font-semibold">{ext.toUpperCase()}</span>{' '}
                    <code className="code-id [overflow-wrap:anywhere]">{ext === 'csv' ? latest.csvSha256 : latest.jsonSha256}</code> ·{' '}
                    <a href={`/data/downloads/${releaseFileName(latest.version, ext)}.sha256`}>checksum file</a>
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <span className="icon-chip icon-chip-lg" aria-hidden="true">
                <CalendarClock />
              </span>
              <div>
                <h2 id="latest-h" className="text-[22px] leading-tight">
                  Latest release
                </h2>
                <p className="mt-2 max-w-[62ch] text-muted">
                  The first versioned release hasn’t been built yet. Releases are built every night at about 05:15 UTC. Until then, download the
                  live records: they have the same columns, described in the dictionary below.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn" href="/incidents/download?v=1,2,3" download>
                <Download aria-hidden="true" className="nudge-down" />
                Download all records (CSV)
              </a>
              <a className="btn btn-secondary" href="/incidents/download/states" download>
                <FileSpreadsheet aria-hidden="true" />
                State totals (CSV)
              </a>
              <Link className="btn btn-quiet" href="/incidents">
                Filter on Explore first <ArrowRight aria-hidden="true" className="nudge" />
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">All records includes single-source (V1) reports; the site’s counts use V2 and V3.</p>
          </>
        )}
        <p className="mt-5 border-t border-rule pt-4 text-sm text-muted">
          No API yet. A read-only API at <code className="token">/api/v1/</code> with an OpenAPI description is planned. Until then, use the nightly
          files or the CSV export of any <Link href="/incidents">Explore</Link> view.
        </p>
      </section>

      {releases.length > 1 ? (
        <section aria-labelledby="history-h" className="mt-14">
          <h2 id="history-h" className="mb-4 text-[28px] leading-[1.1]">
            Earlier releases
          </h2>
          <div className="table-scroll" role="region" aria-label="Release history" tabIndex={0}>
            <table className="data-table data-table-static">
              <caption className="sr-only">Earlier dataset releases</caption>
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Changes</th>
                  <th scope="col" className="text-end">
                    Files
                  </th>
                </tr>
              </thead>
              <tbody>
                {releases.slice(1).map((r) => (
                  <tr key={r.version}>
                    <th scope="row" className="text-start font-semibold">
                      <span className="tabular">{r.version}</span>
                      <span className="block text-[13px] font-normal text-muted">{formatNumber(r.recordCount)} records</span>
                    </th>
                    <td className="tabular">
                      +{r.changelog.added.length} · {r.changelog.updated.length} updated · {r.changelog.removed.length} removed
                    </td>
                    <td className="text-end whitespace-nowrap">
                      <a href={`/data/downloads/${releaseFileName(r.version, 'csv')}`} className="btn btn-secondary btn-sm me-2" download>
                        <Download aria-hidden="true" /> CSV
                      </a>
                      <a href={`/data/downloads/${releaseFileName(r.version, 'json')}`} className="btn btn-secondary btn-sm" download>
                        <Download aria-hidden="true" /> JSON
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="mt-14 grid gap-x-6 gap-y-8 md:grid-cols-2">
        <section aria-labelledby="cite-h">
          <h2 id="cite-h" className="section-head mb-4 text-[28px] leading-[1.1]">
            How to cite
          </h2>
          <p className="rounded-[var(--radius-sm)] border border-rule bg-surface p-4 text-[15px] leading-relaxed shadow-[var(--shadow-sm)]">{citation}</p>
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>License: {SITE.dataLicense.name}.</span>
            <CopyButton text={citation} label="Copy citation" className="btn btn-quiet btn-sm -me-2" icon={<Copy aria-hidden="true" />} />
          </p>
          <p className="mt-3 text-[15.5px]">Each record also has its own citation in APA, Chicago and BibTeX formats on its page.</p>
        </section>

        <section aria-labelledby="never-h" className="panel">
          <span className="icon-chip" aria-hidden="true">
            <ShieldCheck />
          </span>
          <h2 id="never-h" className="section-head mt-3 mb-2 text-[20px] leading-[1.2]">
            What is never included
          </h2>
          <p className="text-[15.5px] leading-relaxed">
            Editors’ private notes, submitters’ contact details, exact private addresses, uploaded files, and unpublished or unverified (V0)
            records are never in any download, page or feed. The public site reads from a database role that cannot see them.
          </p>
        </section>
      </div>

      <section aria-labelledby="dict-h" className="mt-20 border-t border-rule pt-10">
        <h2 id="dict-h" className="section-head mb-3 text-[28px] leading-[1.1]">
          Data dictionary
        </h2>
        <p className="mb-6 max-w-[70ch] text-[15.5px] text-muted">
          Every column in the CSV and JSON files, generated from the database schema (methodology {METHODOLOGY_VERSION}). In CSV, list fields are
          separated by a semicolon and a space (<code className="token">; </code>); nested fields are JSON. Also available as{' '}
          <a href="/data/dictionary.json">JSON</a>.
        </p>
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
                  <th scope="row" role="rowheader" className="dict-field text-start align-top font-normal sm:whitespace-nowrap">
                    <a href={`#field-${f.column}`} className="code-id no-underline hover:underline">
                      {f.column}
                    </a>
                    <span className="block text-[13px] text-muted">
                      {f.type}
                      {f.nullable ? ' · may be empty' : ''}
                    </span>
                  </th>
                  <td role="cell" className="dict-def max-w-[60ch] sm:min-w-64">
                    <DescriptionText text={f.description} />
                  </td>
                  <td role="cell" className="dict-allowed sm:min-w-48" data-empty={f.allowed ? undefined : ''}>
                    {f.allowed ? (
                      <span className="flex flex-wrap gap-1">
                        {f.allowed.map((a) => (
                          <code key={String(a)} className="token">
                            {String(a)}
                          </code>
                        ))}
                      </span>
                    ) : null}
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

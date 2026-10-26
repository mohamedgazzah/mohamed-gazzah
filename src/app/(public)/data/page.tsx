import type { Metadata } from 'next'
import Link from 'next/link'
import { CopyButton } from '@/components/CopyButton'
import { EmptyState } from '@/components/EmptyState'
import { METHODOLOGY_VERSION } from '@/db/enums'
import { datasetCitation } from '@/lib/citations'
import { EXPORT_FIELDS } from '@/lib/dictionary'
import { formatNumber, formatTimestamp } from '@/lib/format'
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

export default async function DataPage() {
  const releases = await listReleases()
  const latest = releases[0]

  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <div className="max-w-reading">
        <h1 className="text-3xl">Data and downloads</h1>
        <p className="mt-3 reading">
          The full dataset is rebuilt every night as CSV and JSON. Each release has a version number, a SHA-256 checksum and a list of what
          changed since the previous release. Data is licensed <a href={SITE.dataLicense.url}>{SITE.dataLicense.name}</a>; please cite it.
        </p>
      </div>

      <section aria-labelledby="latest-h" className="mt-8">
        <h2 id="latest-h" className="mb-3 text-2xl">
          Latest release
        </h2>
        {latest ? (
          <div className="card space-y-3 p-5">
            <p className="text-lg">
              Version <strong className="tabular">{latest.version}</strong> · {formatNumber(latest.recordCount)} records · methodology{' '}
              {latest.methodologyVersion} · built {formatTimestamp(latest.createdAt)}
            </p>
            <ul className="space-y-2 text-base">
              {(['csv', 'json'] as const).map((ext) => (
                <li key={ext}>
                  <a href={`/data/downloads/${releaseFileName(latest.version, ext)}`} className="font-semibold" download>
                    {releaseFileName(latest.version, ext)}
                  </a>{' '}
                  <span className="text-muted">({bytes(ext === 'csv' ? latest.csvBytes : latest.jsonBytes)})</span>
                  <span className="block text-sm break-all text-muted tabular">
                    SHA-256 {ext === 'csv' ? latest.csvSha256 : latest.jsonSha256} ·{' '}
                    <a href={`/data/downloads/${releaseFileName(latest.version, ext)}.sha256`}>checksum file</a>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-base">
              Changes since {latest.previousVersion ?? 'the start'}: {formatNumber(latest.changelog.added.length)} added,{' '}
              {formatNumber(latest.changelog.updated.length)} updated, {formatNumber(latest.changelog.removed.length)} removed.
            </p>
            <p className="text-sm text-muted">
              Includes every published record, V1 to V3; filter on <code>verification_level</code> to match the default counts (V2 and V3).
            </p>
          </div>
        ) : (
          <EmptyState>The first nightly release has not been built yet. Until then, use “Download these results” on the Explore page.</EmptyState>
        )}
      </section>

      {releases.length > 1 ? (
        <section aria-labelledby="history-h" className="mt-10">
          <h2 id="history-h" className="mb-3 text-2xl">
            Earlier releases
          </h2>
          <div className="table-scroll card" role="region" aria-label="Release history" tabIndex={0}>
            <table className="data-table">
              <caption className="sr-only">Earlier dataset releases</caption>
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col" className="num">
                    Records
                  </th>
                  <th scope="col">Added / updated / removed</th>
                  <th scope="col">Files</th>
                </tr>
              </thead>
              <tbody>
                {releases.slice(1).map((r) => (
                  <tr key={r.version}>
                    <td className="tabular">{r.version}</td>
                    <td className="num">{formatNumber(r.recordCount)}</td>
                    <td className="tabular">
                      {r.changelog.added.length} / {r.changelog.updated.length} / {r.changelog.removed.length}
                    </td>
                    <td>
                      <a href={`/data/downloads/${releaseFileName(r.version, 'csv')}`}>CSV</a> ·{' '}
                      <a href={`/data/downloads/${releaseFileName(r.version, 'json')}`}>JSON</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="cite-h" className="mt-10 max-w-reading">
        <h2 id="cite-h" className="mb-3 text-2xl">
          How to cite
        </h2>
        <pre className="card p-3 text-sm whitespace-pre-wrap">{datasetCitation(latest?.version ?? 'latest')}</pre>
        <CopyButton text={datasetCitation(latest?.version ?? 'latest')} label="Copy citation" className="btn btn-quiet mt-1" />
        <p className="mt-3 reading">Each record also has its own citation in APA, Chicago and BibTeX formats on its page.</p>
      </section>

      <section aria-labelledby="never-h" className="mt-10 max-w-reading">
        <h2 id="never-h" className="mb-3 text-2xl">
          What is never included
        </h2>
        <p className="reading">
          Editors’ private notes, submitters’ contact details, exact private addresses, uploaded files, and unpublished or unverified (V0)
          records are never in any download, page or feed. The public site reads from a database role that cannot see them.
        </p>
      </section>

      <section aria-labelledby="dict-h" className="mt-10">
        <h2 id="dict-h" className="mb-1 text-2xl">
          Data dictionary
        </h2>
        <p className="mb-3 reading text-muted">
          Generated from the same schema the database uses (methodology {METHODOLOGY_VERSION}). Also available as{' '}
          <a href="/data/dictionary.json">JSON</a>. Lists in CSV cells are separated by “; ”; nested fields are JSON.
        </p>
        <div className="table-scroll card" role="region" aria-label="Data dictionary" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">Every field in the dataset with its type, allowed values and definition</caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Type</th>
                <th scope="col">Definition</th>
                <th scope="col">Allowed values</th>
              </tr>
            </thead>
            <tbody>
              {EXPORT_FIELDS.map((f) => (
                <tr key={f.column} id={`field-${f.column}`}>
                  <td className="font-semibold whitespace-nowrap">
                    <code>{f.column}</code>
                  </td>
                  <td className="whitespace-nowrap">
                    {f.type}
                    {f.nullable ? <span className="block text-muted">may be empty</span> : null}
                  </td>
                  <td className="min-w-64">{f.description}</td>
                  <td className="min-w-48">{f.allowed ? <code className="text-sm">{f.allowed.join(', ')}</code> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="api-h" className="mt-10 max-w-reading">
        <h2 id="api-h" className="mb-3 text-2xl">
          API
        </h2>
        <p className="reading">
          A public read-only API at <code>/api/v1/</code> with an OpenAPI description is planned for the next phase. Until then, use the
          nightly files or the CSV export of any <Link href="/incidents">Explore</Link> view.
        </p>
      </section>
    </main>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE } from '@/lib/site'
import { ReportForm } from './ReportForm'

export const metadata: Metadata = {
  title: 'Report an incident or a correction',
  description: 'Send an incident or a correction to the editors. Submissions are reviewed and never published automatically.',
}

export default async function ReportPage(props: PageProps<'/report'>) {
  const sp = await props.searchParams
  const mode = sp.mode === 'correction' ? 'correction' : 'report'
  const recordId = typeof sp.record === 'string' ? sp.record.slice(0, 40) : ''
  const siteKey = process.env.TURNSTILE_DISABLED === 'true' ? null : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null)

  return (
    <main className="mx-auto max-w-reading px-4 py-10 sm:px-6">
      <h1 className="text-2xl sm:text-3xl">{mode === 'correction' ? 'Request a correction' : 'Report an incident'}</h1>

      <nav aria-label="Form type" className="mt-4 flex flex-wrap gap-2">
        <Link href="/report" aria-current={mode === 'report' ? 'page' : undefined} className={mode === 'report' ? 'btn' : 'btn btn-secondary'}>
          Report an incident
        </Link>
        <Link
          href={`/report?mode=correction${recordId ? `&record=${encodeURIComponent(recordId)}` : ''}`}
          aria-current={mode === 'correction' ? 'page' : undefined}
          className={mode === 'correction' ? 'btn' : 'btn btn-secondary'}
        >
          Request a correction
        </Link>
      </nav>

      <div id="report-notice" className="card my-6 space-y-2 p-4 text-base">
        <p>
          <strong>If someone is in danger, call 911.</strong>
        </p>
        <p>
          Submissions are reviewed by editors and are not published automatically. Your personal details stay private: they are encrypted,
          seen only by editors, and deleted 12 months after the matter is resolved unless you ask us to keep them.{' '}
          <Link href="/about#privacy">Privacy policy</Link>.
        </p>
        {mode === 'correction' ? (
          <p>
            We respond to correction requests within 72 hours and fix material errors within 7 days, with a note in the record’s change log.
            You can also write to <a href={`mailto:${SITE.emails.corrections}`}>{SITE.emails.corrections}</a>.
          </p>
        ) : null}
      </div>

      <ReportForm key={mode} mode={mode} recordId={recordId} siteKey={siteKey} />
    </main>
  )
}

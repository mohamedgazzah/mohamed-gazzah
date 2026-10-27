import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { ReadingLayout } from '@/components/ReadingLayout'
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

  const steps = [
    'Editors read every submission. Nothing is published automatically.',
    'They look for public sources: news reports, police statements, court records.',
    'A record is published only after a second editor reviews it, and never with your name, contact details or exact address.',
  ]

  return (
    <main className="wrap pt-10 pb-4 md:pt-14">
      <PageHeader kicker="Report · Private and encrypted" title={mode === 'correction' ? 'Request a correction' : 'Report an incident'}>
        Tell the editors about an anti-Muslim incident, or about an error in a published record.
      </PageHeader>

      <ReadingLayout
        rail={
          <div className="border-t border-ink pt-3">
            <p className="kicker">What happens next</p>
            <ol className="mt-4 space-y-4 text-[14.5px]">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="mono w-5 shrink-0 pt-px text-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        }
      >
        <nav aria-label="Form type" className="segmented">
          <Link href="/report" aria-current={mode === 'report' ? 'page' : undefined}>
            Report an incident
          </Link>
          <Link
            href={`/report?mode=correction${recordId ? `&record=${encodeURIComponent(recordId)}` : ''}`}
            aria-current={mode === 'correction' ? 'page' : undefined}
          >
            Request a correction
          </Link>
        </nav>

        <div id="report-notice" className="notice my-8 space-y-2 text-[15.5px]">
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
      </ReadingLayout>
    </main>
  )
}

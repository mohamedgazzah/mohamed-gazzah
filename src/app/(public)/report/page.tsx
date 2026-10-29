import { ArrowRight, CalendarClock, EyeOff, Landmark, LockKeyhole, Mail, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { ReadingLayout } from '@/components/ReadingLayout'
import { SLA } from '@/db/enums'
import { todayIso } from '@/lib/format'
import { SITE } from '@/lib/site'
import { ReportForm } from './ReportForm'

export async function generateMetadata(props: PageProps<'/report'>): Promise<Metadata> {
  const sp = await props.searchParams
  const correction = sp.mode === 'correction'
  return {
    title: correction ? 'Request a correction' : 'Report an incident',
    description: correction
      ? 'Point out an error in a published record, or ask for details that identify you to be removed.'
      : 'Send an incident to the editors. Submissions are reviewed and never published automatically.',
  }
}

export default async function ReportPage(props: PageProps<'/report'>) {
  const sp = await props.searchParams
  const mode = sp.mode === 'correction' ? 'correction' : 'report'
  const recordId = typeof sp.record === 'string' ? sp.record.slice(0, 40) : ''
  const siteKey = process.env.TURNSTILE_DISABLED === 'true' ? null : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null)
  const isCorrection = mode === 'correction'

  // The notice says what is protected; these steps say what happens and when. Each promise is made once.
  const steps = isCorrection
    ? [
        `If you leave an email, an editor replies within ${SLA.correctionResponseHours} hours.`,
        `Material errors are fixed within ${SLA.correctionFixDays} days, with a note in the record’s change log.`,
        `Requests to remove identifying details are handled within ${SLA.privacyRemovalHours} hours.`,
      ]
    : [
        'Editors read every submission.',
        'They look for public sources: news reports, police statements, court records.',
        'A second editor reviews a record before it is published.',
        'If you leave an email, an editor may write to you.',
      ]
  const title = isCorrection ? 'Request a correction' : 'Report an incident'

  return (
    <main className="wrap pt-6 md:pt-8">
      <PageHeader
        compact
        kicker="Private and encrypted"
        icon={<LockKeyhole aria-hidden="true" />}
        title={
          // Once the form is sent the title says so (globals.css swaps them).
          <>
            <span className="when-editing">{title}</span>
            <span className="when-done">{isCorrection ? 'Request received' : 'Report received'}</span>
          </>
        }
      >
        {isCorrection
          ? 'Point out an error in a published record, or ask us to remove details that identify you.'
          : 'Tell us what happened. Only two questions are required, and you don’t have to give your name.'}
      </PageHeader>

      <ReadingLayout
        railSide="end"
        railClassName="report-rail"
        rail={
          <div className="glass rounded-[var(--radius-md)] p-5">
            <p className="kicker">What happens next</p>
            <ol className="mt-4 space-y-4 text-sm">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="step-disk tabular inline-grid h-6 min-w-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        }
      >
        <div className="report-intro">
          <div id="report-notice" className="notice text-base">
            <p className="flex items-center gap-3 border-b border-rule pb-4 text-lg">
              <span className="icon-chip" aria-hidden="true">
                <Phone />
              </span>
              <strong>If someone is in danger, call 911.</strong>
            </p>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-3">
                <LockKeyhole aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>Encrypted, and seen only by the project’s editors, after two-factor sign-in.</span>
              </li>
              <li className="flex gap-3">
                <EyeOff aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  Submissions are reviewed by editors and are not published automatically. A published record never includes your name, contact
                  details or exact address.
                </span>
              </li>
              <li className="flex gap-3">
                <CalendarClock aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  Personal details are deleted {SLA.submitterDataRetentionMonths} months after the matter is resolved, unless you ask us to keep them.{' '}
                  <Link href="/about#privacy">Privacy policy</Link>.
                </span>
              </li>
              {isCorrection ? (
                <li className="flex gap-3">
                  <Mail aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    You can also write to <a href={`mailto:${SITE.emails.corrections}`}>{SITE.emails.corrections}</a>.
                  </span>
                </li>
              ) : (
                <li className="flex gap-3">
                  <Landmark aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    This form does not report a crime to the police. For that, contact your local police or the FBI at{' '}
                    {/* A new tab, so the form and what is typed in it stay open. */}
                    <a href="https://tips.fbi.gov" target="_blank" rel="noopener noreferrer">
                      tips.fbi.gov<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    .
                  </span>
                </li>
              )}
            </ul>
          </div>
          <p className="mt-5 mb-10 text-sm text-muted">
            {isCorrection ? 'Want to report an incident instead? ' : 'Found a mistake in a published record? '}
            <Link
              href={isCorrection ? '/report' : `/report?mode=correction${recordId ? `&record=${encodeURIComponent(recordId)}` : ''}`}
              className="arrow-link"
            >
              {isCorrection ? 'Report an incident' : 'Request a correction'}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </p>
        </div>

        <ReportForm key={mode} mode={mode} recordId={recordId} siteKey={siteKey} today={todayIso()} />
      </ReadingLayout>
    </main>
  )
}

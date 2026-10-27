import { ArrowRight, CalendarClock, Clock3, EyeOff, LockKeyhole, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { ReadingLayout } from '@/components/ReadingLayout'
import { SLA } from '@/db/enums'
import { todayIso } from '@/lib/format'
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
  const isCorrection = mode === 'correction'

  const steps = isCorrection
    ? [
        `An editor replies within ${SLA.correctionResponseHours} hours.`,
        `Material errors are fixed within ${SLA.correctionFixDays} days, with a note in the record’s change log.`,
        `Requests to remove identifying details are handled within ${SLA.privacyRemovalHours} hours.`,
      ]
    : [
        'Editors read every submission. Nothing is published automatically.',
        'They look for public sources: news reports, police statements, court records.',
        'A record is published only after a second editor reviews it, and never with your name, contact details or exact address.',
      ]

  return (
    <main className="wrap pt-6 pb-4 md:pt-8">
      <PageHeader kicker="Private and encrypted" icon={<LockKeyhole aria-hidden="true" />} title={isCorrection ? 'Request a correction' : 'Report an incident'}>
        {isCorrection
          ? 'Point out an error in a published record, or ask us to remove details that identify you.'
          : 'Tell us what happened, in your own words. Only two questions are required, and you don’t have to give your name.'}
      </PageHeader>

      <ReadingLayout
        railSide="end"
        railClassName="report-rail"
        rail={
          <div className="glass rounded-[var(--radius-md)] p-5">
            <p className="kicker">What happens next</p>
            <ol className="mt-4 space-y-4 text-[14.5px]">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="tabular inline-grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-accent-tint text-[12.5px] font-semibold text-accent">
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
          <div id="report-notice" className="notice text-[15.5px]">
            <p className="flex items-center gap-3 border-b border-rule pb-4 text-[17px]">
              <span className="icon-chip" aria-hidden="true">
                <Phone />
              </span>
              <strong>If someone is in danger, call 911.</strong>
            </p>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-3">
                <LockKeyhole aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>Encrypted, and seen only by the project’s editors after they sign in with two-factor authentication.</span>
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
                  <Clock3 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    We respond within {SLA.correctionResponseHours} hours and fix material errors within {SLA.correctionFixDays} days. You can also write
                    to <a href={`mailto:${SITE.emails.corrections}`}>{SITE.emails.corrections}</a>.
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
          <p className="mt-5 mb-10 text-[15px] text-muted">
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

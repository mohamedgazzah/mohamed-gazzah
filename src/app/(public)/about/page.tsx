import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { SLA } from '@/db/enums'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About and privacy',
  description: 'Who runs this record, how it is funded, how to reach the editors, and the privacy policy.',
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 border-t border-rule pt-8">
      <h2 id={`${id}-h`} className="mb-4 text-2xl">
        {title}
      </h2>
      <div className="reading space-y-4">{children}</div>
    </section>
  )
}

/** Content the project's people must supply before launch. Shown plainly, never filled with guesses. */
function ToComplete({ children }: { children: ReactNode }) {
  return <p className="card border-dashed p-3 text-base text-muted">To be completed before launch: {children}</p>
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-reading space-y-10">
        <div>
          <h1 className="text-3xl">About</h1>
          <p className="mt-3 reading">
            {SITE.fullName} is a public, searchable record of anti-Muslim incidents in the United States. Each incident is linked to its
            sources and followed through its legal outcome. It exists because the available data — police-reported hate crimes, complaints to
            advocacy groups, surveys, and state counts — is spread across systems that cannot be joined, and none lists individual incidents
            with sources and case status.
          </p>
          <p className="mt-3 reading">
            It is a record, not a campaign: the dataset stands on its stated <Link href="/methodology">methodology</Link>. Partners are credited
            here, but they do not decide what is published.
          </p>
        </div>

        <Section id="team" title="Team and advisory board">
          <ToComplete>names and roles of the editors, the senior editors and the advisory board, and the organizational home (fiscal sponsor or university research center).</ToComplete>
        </Section>

        <Section id="partners" title="Partners and funding">
          <ToComplete>partner organizations and funders, with the amount and period of each grant. No funder has a say in editorial decisions.</ToComplete>
        </Section>

        <Section id="contact" title="Contact">
          <ul className="list-disc space-y-1 ps-6">
            <li>
              Editors: <a href={`mailto:${SITE.emails.editors}`}>{SITE.emails.editors}</a>
            </li>
            <li>
              Corrections: <a href={`mailto:${SITE.emails.corrections}`}>{SITE.emails.corrections}</a>, or the{' '}
              <Link href="/report?mode=correction">correction form</Link>
            </li>
            <li>
              Privacy and deletion requests: <a href={`mailto:${SITE.emails.privacy}`}>{SITE.emails.privacy}</a>
            </li>
            <li>
              Legal: <a href={`mailto:${SITE.emails.legal}`}>{SITE.emails.legal}</a>
            </li>
          </ul>
          <p>To report an incident, use the <Link href="/report">report form</Link>. If someone is in danger, call 911.</p>
        </Section>

        <Section id="privacy" title="Privacy policy">
          <p>This policy is written in plain language. It covers the public website and the report form.</p>
          <h3 className="text-xl">When you browse</h3>
          <ul className="list-disc space-y-1 ps-6">
            <li>Public pages set no cookies, except one setting in your own browser if you choose a light or dark theme.</li>
            <li>There are no ad trackers. Visits are counted with a cookie-free analytics tool that does not identify you.</li>
            <li>Searches are not stored on our servers.</li>
          </ul>
          <h3 className="text-xl">When you send a report or a correction</h3>
          <ul className="list-disc space-y-1 ps-6">
            <li>
              <strong>What we collect:</strong> what you tell us, the date and place, links, any files you attach, whether you were targeted or a
              witness, and contact details only if you give them.
            </li>
            <li>
              <strong>Who sees it:</strong> only the project’s editors, after signing in with two-factor authentication. Nothing you send is
              published automatically. A record is published only after editors verify it against public sources, and it never includes your name,
              contact details or exact address.
            </li>
            <li>
              <strong>How it is protected:</strong> contact details, exact addresses and files are encrypted and kept apart from incident data.
              Location data is removed from photos when they arrive.
            </li>
            <li>
              <strong>How long we keep it:</strong> contact details and files are deleted {SLA.submitterDataRetentionMonths} months after the
              matter is resolved, unless you ask us to keep them.
            </li>
            <li>
              <strong>Deleting it sooner:</strong> write to <a href={`mailto:${SITE.emails.privacy}`}>{SITE.emails.privacy}</a> and we will delete
              what you sent. If a published record describes you, you can ask for identifying details to be removed at any time; we do this within{' '}
              {SLA.privacyRemovalHours} hours.
            </li>
            <li>To limit abuse, the form uses Cloudflare Turnstile and counts submissions per connection using a one-way code, not your IP address.</li>
          </ul>
          <ToComplete>the legal entity responsible for the data and its address, and review of this policy by counsel (and by the host institution’s IRB, if it applies).</ToComplete>
        </Section>
      </div>
    </main>
  )
}

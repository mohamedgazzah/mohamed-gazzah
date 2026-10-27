import { CircleDashed, Copy, Eraser, EyeOff, Handshake, Inbox, Info, Mail, PenLine, Phone, Scale, ShieldCheck, UserLock, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CopyButton } from '@/components/CopyButton'
import { PageHeader } from '@/components/PageHeader'
import { ReadingLayout, ReadingSection } from '@/components/ReadingLayout'
import { SLA } from '@/db/enums'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About and privacy',
  description: 'Who runs this record, how it is funded, how to reach the editors, and the privacy policy.',
}

const SECTIONS = [
  ['team', 'Team and advisory board', 'Team and board'],
  ['partners', 'Partners and funding'],
  ['contact', 'Contact'],
  ['privacy', 'Privacy policy'],
] as const

const ICONS: Record<(typeof SECTIONS)[number][0], ReactNode> = {
  team: <Users />,
  partners: <Handshake />,
  contact: <Mail />,
  privacy: <ShieldCheck />,
}

function Section({ id, title, children }: { id: (typeof SECTIONS)[number][0]; title: string; children: ReactNode }) {
  return (
    <ReadingSection id={id} icon={ICONS[id]} title={title}>
      {children}
    </ReadingSection>
  )
}

/** Content the project's people must supply before launch. Shown plainly, never filled with guesses. */
function ToComplete({ children }: { children: ReactNode }) {
  return (
    <div className="note" role="note">
      <CircleDashed aria-hidden="true" />
      <p>
        <span className="note-label">To be completed before launch</span>
        {children}
      </p>
    </div>
  )
}

const CONTACTS = [
  { Icon: Inbox, label: 'Editors', email: SITE.emails.editors, purpose: 'Questions about the record or the project.' },
  {
    Icon: PenLine,
    label: 'Corrections',
    email: SITE.emails.corrections,
    purpose: `Errors in a published record. We respond within ${SLA.correctionResponseHours} hours.`,
    extra: { href: '/report?mode=correction', text: 'or use the correction form' },
  },
  {
    Icon: Eraser,
    label: 'Privacy and deletion',
    email: SITE.emails.privacy,
    purpose: `Identifying details removed within ${SLA.privacyRemovalHours} hours of a request.`,
  },
  { Icon: Scale, label: 'Legal', email: SITE.emails.legal, purpose: 'Subpoenas, takedown requests and other legal notices, handled by counsel.' },
]

export default function AboutPage() {
  return (
    <main className="wrap pt-6 md:pt-8">
      <PageHeader kicker="The project and your data" icon={<Info aria-hidden="true" />} title="About and privacy">
        {SITE.name} is a public, searchable record of anti-Muslim incidents in the United States. Each incident is linked to its sources and
        followed through its legal outcome.
      </PageHeader>

      <ul aria-label="Privacy at a glance" className="glass mt-6 grid gap-1 rounded-[var(--radius-lg)] p-2 md:grid-cols-3">
        {[
          { Icon: EyeOff, title: 'No ad trackers', text: 'Public pages set no cookies.' },
          { Icon: UserLock, title: 'Only editors see what you send', text: 'After two-factor sign-in. Never published automatically.' },
          {
            Icon: Eraser,
            title: `Identifying details removed within ${SLA.privacyRemovalHours} hours`,
            text: 'Ask at any time if a published record describes you.',
            link: true,
          },
        ].map(({ Icon, title, text, link }) => (
          <li key={title} className="flex items-start gap-3 p-3">
            <span className="icon-chip h-9 w-9" aria-hidden="true">
              <Icon />
            </span>
            <span>
              <span className="block text-base font-semibold">{title}</span>
              <span className="block text-sm text-muted">
                {text}
                {link ? (
                  <>
                    {' '}
                    {/* Lands on the answer itself, which is highlighted there. */}
                    <span className="whitespace-nowrap">
                      <a href="#deletion">How to ask</a>
                    </span>
                  </>
                ) : null}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <ReadingLayout contents={SECTIONS} icons={ICONS}>
        <p className="max-w-[40rem] text-reading">
          {SITE.name} exists because the available data — police-reported hate crimes, complaints to advocacy groups, surveys, and state counts — is spread
          across systems that cannot be joined, and none lists individual incidents with sources and case status. It is a record, not a campaign:
          the dataset stands on its stated <Link href="/methodology">methodology</Link>.
        </p>

        <Section id="team" title="Team and advisory board">
          <ToComplete>
            Names and roles of the editors, the senior editors and the advisory board, and the organizational home (fiscal sponsor or university
            research center).
          </ToComplete>
        </Section>

        <Section id="partners" title="Partners and funding">
          <p>Partners are credited here, but they do not decide what is published. No funder has a say in editorial decisions.</p>
          <ToComplete>Partner organizations and funders, with the amount and period of each grant.</ToComplete>
        </Section>

        <Section id="contact" title="Contact">
          {/* The same message as the report form, set the same way; a quiet panel, not a fifth card. */}
          <div className="notice-quiet flex items-start gap-3">
            <span className="icon-chip" aria-hidden="true">
              <Phone />
            </span>
            <p className="text-base">
              <strong className="block text-lg">If someone is in danger, call 911.</strong>
              To report an incident, use the <Link href="/report">report form</Link>. Nothing you send is published automatically. The form does
              not reach the police: to report a crime, contact your local police or the FBI at <a href="https://tips.fbi.gov">tips.fbi.gov</a>.
            </p>
          </div>
          {/* Cards lift only while their address is pointed at: the address is the link, and it stays easy to copy. */}
          <ul className="ledger ledger-static mt-5 md:grid-cols-2">
            {CONTACTS.map(({ Icon, label, email, purpose, extra }) => (
              <li key={label} className="flex gap-4 p-4 sm:p-5">
                <span className="icon-chip" aria-hidden="true">
                  <Icon />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="block text-base font-semibold">{label}</span>
                  <span className="block text-sm leading-snug text-muted">{purpose}</span>
                  <span className="mt-auto pt-2">
                    <span className="block text-base font-medium">
                      <a href={`mailto:${email}`}>
                        {email.split('@')[0]}
                        <wbr />@{email.split('@')[1]}
                      </a>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted [&>a]:inline-block [&>a]:py-1">
                      <CopyButton text={email} label="Copy address" className="btn btn-quiet btn-sm -ms-3" icon={<Copy aria-hidden="true" />} />
                      {extra ? <Link href={extra.href}>{extra.text}</Link> : null}
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="privacy" title="Privacy policy">
          <p className="text-sm text-muted">Covers this website and the report form.</p>
          <h3>When you browse</h3>
          <dl className="terms">
            <div>
              <dt>Cookies</dt>
              <dd>Public pages set none. If you choose a light or dark theme, that choice is kept in your own browser and never sent to us.</dd>
            </div>
            <div>
              <dt>Ad trackers</dt>
              <dd>None.</dd>
            </div>
            <div>
              <dt>Analytics</dt>
              <dd>Visits are counted with a cookie-free analytics tool that does not identify you.</dd>
            </div>
            <div>
              <dt>Searches</dt>
              <dd>
                Search terms are part of the page address. We don’t save them or link them to you, though our host’s request logs record page
                addresses for a limited time.
              </dd>
            </div>
          </dl>
          <h3>When you send a report or a correction</h3>
          <dl className="terms">
            <div>
              <dt>What we collect</dt>
              <dd>
                What you tell us, the date and place, links, any files you attach, whether you were targeted or a witness, and contact details
                only if you give them.
              </dd>
            </div>
            <div>
              <dt>Who sees it</dt>
              <dd>
                Only the project’s editors, after signing in with two-factor authentication. Nothing you send is published automatically. A
                record is published only after editors verify it against public sources, and it never includes your name, contact details or
                exact address.
              </dd>
            </div>
            <div>
              <dt>How it is protected</dt>
              <dd>
                Contact details, exact addresses and files are encrypted and kept apart from incident data. Location data is removed from photos
                when they arrive.
              </dd>
            </div>
            <div>
              <dt>How long we keep it</dt>
              <dd>
                Contact details and files are deleted <strong className="tabular whitespace-nowrap">{SLA.submitterDataRetentionMonths} months</strong> after the
                matter is resolved, unless you ask us to keep them.
              </dd>
            </div>
            <div id="deletion">
              <dt>Deleting it sooner</dt>
              <dd>
                Write to <a href={`mailto:${SITE.emails.privacy}`}>{SITE.emails.privacy}</a> and we will delete what you sent. If a published
                record describes you, you can ask for identifying details to be removed at any time; we do this within{' '}
                <strong className="tabular whitespace-nowrap">{SLA.privacyRemovalHours} hours</strong>.
              </dd>
            </div>
            <div>
              <dt>Preventing abuse</dt>
              <dd>The form uses Cloudflare Turnstile and counts submissions per connection using a one-way code, not your IP address.</dd>
            </div>
          </dl>
          <ToComplete>
            The legal entity responsible for the data and its address, the effective date of this policy, and review of the policy by counsel
            (and by the host institution’s IRB, if it applies).
          </ToComplete>
        </Section>
      </ReadingLayout>
    </main>
  )
}

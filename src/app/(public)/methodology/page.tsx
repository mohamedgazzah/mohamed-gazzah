import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_META,
  LEGAL_STATUSES,
  LEGAL_STATUS_META,
  METHODOLOGY_EFFECTIVE_DATE,
  METHODOLOGY_VERSION,
  REVIEW_CHECKLIST,
  SEVERITIES,
  SEVERITY_META,
  SLA,
  SOURCE_AUTHORITY_ORDER,
  SOURCE_TYPE_META,
  VERIFICATION_META,
  BIAS_INDICATORS,
  BIAS_INDICATOR_META,
} from '@/db/enums'
import { VerificationMark } from '@/components/VerificationMark'
import { formatDate } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'Inclusion rules, taxonomy, verification levels, legal status, editorial standards, corrections, and how these counts compare with others.',
}

const SECTIONS = [
  ['inclusion', 'What is included'],
  ['taxonomy', 'Incident types'],
  ['severity', 'Severity'],
  ['verification', 'Verification levels'],
  ['legal', 'Legal status'],
  ['language', 'Language and naming'],
  ['standards', 'Editorial standards'],
  ['process', 'How a record is made'],
  ['corrections', 'Corrections and takedowns'],
  ['privacy-standards', 'Privacy'],
  ['comparison', 'Comparison with other counts'],
  ['limits', 'Limits'],
  ['urls', 'Stable links'],
  ['versions', 'Methodology versions'],
] as const

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

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-reading">
        <h1 className="text-3xl">Methodology</h1>
        <p className="mt-3 reading text-muted">
          Version {METHODOLOGY_VERSION}, effective {formatDate(METHODOLOGY_EFFECTIVE_DATE, 'day', 'long')}. Every dataset release and every
          published record states the version it was produced under.
        </p>

        <nav aria-label="On this page" className="card my-8 p-4">
          <p className="mb-2 font-semibold">On this page</p>
          <ol className="grid list-decimal gap-x-6 gap-y-1 ps-5 text-base sm:grid-cols-2">
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          <Section id="inclusion" title="What is included">
            <p>
              The unit of this record is one <strong>incident</strong>: a single event, at one time and place, that targets a person, a group or
              a property because the victim is, or is perceived to be, Muslim. One incident can have many sources, legal events and statements.
              Several incidents can belong to one court case or one perpetrator.
            </p>
            <p>An incident is included when all three of these are true (inclusion criteria, version {METHODOLOGY_VERSION}):</p>
            <ol className="list-decimal space-y-2 ps-6">
              <li>It happened in the United States or its territories, on or after January 1, 2020. Earlier records may be added only as a separate, labelled backfill.</li>
              <li>
                At least one public source describes an anti-Muslim element: a slur, a stated motive, a target that is a Muslim institution, a
                hate-crime charge, or an official statement calling it bias-motivated.
              </li>
              <li>
                It is either a crime (assault, threat, vandalism, arson, homicide and others) or a non-criminal act that is concrete and targeted,
                such as harassment of named people, threats to a mosque, or slurs by a public official acting in office.
              </li>
            </ol>
            <p>Excluded:</p>
            <ul className="list-disc space-y-1 ps-6">
              <li>General online speech not aimed at a specific target.</li>
              <li>Opinion pieces.</li>
              <li>Policy disputes.</li>
              <li>
                Incidents where the investigating agency clearly ruled out an anti-Muslim element. These are kept internally as “excluded”, with
                the reason.
              </li>
            </ul>
            <p>
              Government actions such as detentions, designations of organizations and travel restrictions are tracked separately as policy and
              litigation, not counted as incidents. This keeps incident counts comparable from year to year.
            </p>
            <p>The anti-Muslim elements a source can state are recorded as bias indicators:</p>
            <ul className="list-disc space-y-1 ps-6">
              {BIAS_INDICATORS.map((b) => (
                <li key={b}>
                  <strong>{BIAS_INDICATOR_META[b].label}.</strong> {BIAS_INDICATOR_META[b].description}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="taxonomy" title="Incident types">
            <p>Each record has one or more of these types.</p>
            <div className="table-scroll card" role="region" aria-label="Incident type taxonomy" tabIndex={0}>
              <table className="data-table">
                <caption className="sr-only">Incident type codes, labels and examples</caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Type</th>
                    <th scope="col">Examples</th>
                  </tr>
                </thead>
                <tbody>
                  {INCIDENT_TYPES.map((t) => (
                    <tr key={t} id={`type-${t}`}>
                      <td className="font-semibold tabular">{t}</td>
                      <td>{INCIDENT_TYPE_META[t].label}</td>
                      <td>{INCIDENT_TYPE_META[t].description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="severity" title="Severity">
            <p>Severity records the most serious harm a source reports. Death and injury counts are shown as numbers, and are left empty when unknown rather than shown as zero.</p>
            <dl className="space-y-2">
              {SEVERITIES.map((s) => (
                <div key={s} id={`severity-${s}`} className="scroll-mt-6">
                  <dt className="font-semibold">
                    {s} — {SEVERITY_META[s].label}
                  </dt>
                  <dd>{SEVERITY_META[s].description}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="verification" title="Verification levels">
            <p>Every record shows how well it is confirmed. Public counts include V3 and V2 by default; V1 records appear only when you choose to include them.</p>
            <dl className="space-y-3">
              {(['V3', 'V2', 'V1', 'V0'] as const).map((v) => (
                <div key={v} id={`verification-${v.toLowerCase()}`} className="scroll-mt-6">
                  <dt className="font-semibold">
                    {v} — {VERIFICATION_META[v].label}
                  </dt>
                  <dd>{VERIFICATION_META[v].rule}</dd>
                </div>
              ))}
            </dl>
            <p>
              A V3 badge names the authority when sources say which: “Confirmed by police”, “Confirmed by prosecutors” or “Confirmed by court record”.
              Badges carry text and a shape — solid <VerificationMark level="V3" /> for V3, half <VerificationMark level="V2" /> for V2, ring{' '}
              <VerificationMark level="V1" /> for V1 — never color alone.
            </p>
          </Section>

          <Section id="legal" title="Legal status">
            <p>
              Each record follows a lifecycle: reported → under investigation → suspect identified → arrested → charged → in court → convicted,
              acquitted, dismissed, plea agreement or deferred → sentenced. Side states are no arrest, suspect deceased, not prosecuted and unknown.
              Whether a hate-crime or bias charge was filed is recorded separately.
            </p>
            <p>Every status is supported by a dated legal event with a source, shown on the record’s legal timeline.</p>
            <dl className="space-y-2">
              {LEGAL_STATUSES.map((s) => (
                <div key={s} id={`legal-${s}`} className="scroll-mt-6">
                  <dt className="font-semibold">{LEGAL_STATUS_META[s].label}</dt>
                  <dd>{LEGAL_STATUS_META[s].description}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="language" title="Language and naming">
            <ul className="list-disc space-y-2 ps-6">
              <li>“Alleged” is used for anyone who has not been convicted. “Reported” is used for accounts that have not been independently confirmed.</li>
              <li>Allegations are never presented as convictions.</li>
              <li>Records use no adjectives about motive beyond what sources state, and never speculate about motive.</li>
              <li>
                A suspect is named only if authorities or court records have named them publicly and they have been charged. If charges are
                dropped or the defendant is acquitted, the record is updated within {SLA.acquittalUpdateDays} days; on request the person’s name
                is removed and the incident kept.
              </li>
              <li>
                Private individuals who were targeted are not named unless they named themselves publicly or are named in court records. Minors
                are never named. There are no home addresses and no photos of victims.
              </li>
              <li>Quotes are short (25 words or fewer) and always attributed.</li>
            </ul>
          </Section>

          <Section id="standards" title="Editorial standards">
            <ul className="list-disc space-y-2 ps-6">
              <li>No incident is published without at least one public, linkable source. Each claim states who made it.</li>
              <li>
                The most authoritative source available is used for each fact, in this order:{' '}
                {SOURCE_AUTHORITY_ORDER.map((t) => SOURCE_TYPE_META[t].label.toLowerCase()).join(' > ')}.
              </li>
              <li>When sources conflict, the record shows both and says which source says what.</li>
              <li>Summaries are two to four neutral sentences; each ends with a marker pointing to its source.</li>
              <li>Every source is archived (Internet Archive) when it is saved, so it survives link rot. Archived copies are for verification; articles are never republished.</li>
              <li>The data pages carry no calls to action, donation prompts or political endorsements.</li>
            </ul>
          </Section>

          <Section id="process" title="How a record is made">
            <p>Nothing goes public without two people: one editor drafts the record, and a second editor, who did not write or edit that version, approves it. The database itself refuses to publish a record without that approval. Automation finds leads and keeps cases current; it never publishes.</p>
            <ol className="list-decimal space-y-2 ps-6">
              <li>Leads come from public submissions, news monitoring, organization and agency press releases, and court dockets.</li>
              <li>An editor triages each lead: new incident, update to an existing record, duplicate, or out of scope (with a reason). Possible duplicates are suggested by date (within three days), city and similar text.</li>
              <li>The editor drafts the record, attaches every source and writes the summary, then sets the verification level. For single-source reports the editor tries to reach a second source.</li>
              <li>
                A second editor checks a fixed list before approving:
                <ul className="mt-1 list-disc space-y-1 ps-6">
                  {REVIEW_CHECKLIST.map((c) => (
                    <li key={c.key}>{c.label}</li>
                  ))}
                </ul>
              </li>
              <li>A senior editor publishes. The first change-log entry reads “Published.”</li>
              <li>Records whose legal status is not final get a review reminder every {SLA.openCaseReviewDays} days. Any later change goes back through drafting and review before it appears.</li>
            </ol>
          </Section>

          <Section id="corrections" title="Corrections and takedowns">
            <ul className="list-disc space-y-2 ps-6">
              <li>
                Anyone can request a correction from any record (<Link href="/report?mode=correction">correction form</Link>). We respond within{' '}
                {SLA.correctionResponseHours} hours and fix material errors within {SLA.correctionFixDays} days, with a public note in the record’s
                change log.
              </li>
              <li>People described in a record can ask for identifying details to be removed at any time. We do this within {SLA.privacyRemovalHours} hours, no questions asked.</li>
              <li>Legal demands go to counsel. Records are not removed because of pressure alone, only on a legal or factual basis.</li>
              <li>Every change to a published record is listed in its change log, with the date and a one-line reason.</li>
            </ul>
          </Section>

          <Section id="privacy-standards" title="Privacy">
            <p>
              Locations are shown no more precisely than needed: usually the city, with map markers offset slightly so they do not point to a
              specific address. Exact locations are used only for public places such as a mosque, a school or a park, never for a private home.
              Submissions, contact details and files are encrypted, seen only by editors, and never published. See the{' '}
              <Link href="/about#privacy">privacy policy</Link>.
            </p>
          </Section>

          <Section id="comparison" title="Comparison with other counts">
            <p>No single source counts every anti-Muslim incident, and each measures something different:</p>
            <ul className="list-disc space-y-2 ps-6">
              <li>
                <strong>FBI hate crime statistics</strong> count crimes reported by participating police agencies. Participation is voluntary
                and uneven, and many incidents are never reported to police, so these figures are known to undercount.
              </li>
              <li>
                <strong>CAIR</strong> counts complaints made to it, including civil-rights complaints that are not crimes and that may not be
                public.
              </li>
              <li>
                <strong>ISPU</strong> and other surveys measure attitudes and experiences across a sample of people, not individual events.
              </li>
              <li>
                <strong>State attorneys general</strong> publish counts using their own definitions and methods.
              </li>
            </ul>
            <p>
              This record lists individual incidents that have at least one public source, with their legal outcome. Its totals will differ from
              all of the above: it misses incidents never made public, and it includes non-criminal targeted acts that police data does not.
              Each year the project compares its counts with FBI and state figures and publishes the differences here, starting with the first
              annual reconciliation.
            </p>
          </Section>

          <Section id="limits" title="Limits">
            <ul className="list-disc space-y-2 ps-6">
              <li>The record depends on public sources. Incidents that were never reported publicly are missing, and some places get more news coverage than others.</li>
              <li>Changes in how leads are found (for example, the start of automated news monitoring) can create breaks in trends. Charts mark these changes.</li>
              <li>Legal outcomes lag: a case may take years to resolve, and recent records are more likely to show early stages.</li>
              <li>Rates per Muslim resident are shown only where a credible population estimate exists, and always name the estimate used.</li>
            </ul>
          </Section>

          <Section id="urls" title="Stable links">
            <p>
              Every filtered view of the record has its own address, for example <code>/incidents?state=MI&amp;type=VAND,THRT&amp;from=2026-01-01</code>.
              An address without a <code>v</code> parameter means verification levels V2 and V3; without <code>sort</code>, newest first. These
              defaults will not change, so a cited address keeps its meaning. Lists are paginated in a stable order rather than scrolled endlessly,
              so page numbers can be cited too.
            </p>
            <p>Record ids such as <code>US-2026-0412</code> are permanent. If a record’s title changes, its old address redirects to the new one.</p>
          </Section>

          <Section id="versions" title="Methodology versions">
            <table className="data-table">
              <caption className="sr-only">Methodology version history</caption>
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Effective</th>
                  <th scope="col">Changes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="tabular">1.0</td>
                  <td className="tabular">{formatDate(METHODOLOGY_EFFECTIVE_DATE)}</td>
                  <td>First published version.</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </div>
      </div>
    </main>
  )
}

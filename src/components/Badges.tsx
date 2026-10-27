import Link from 'next/link'
import {
  ALLEGATION_STATUSES,
  LEGAL_STATUS_META,
  SEVERITY_META,
  VERIFICATION_META,
  type LegalStatus,
  type PublicVerificationLevel,
  type Severity,
  type SourceType,
  type YesNoUnknown,
} from '@/db/enums'
import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import { VerificationMark } from './VerificationMark'

type BadgeTone = 'confirmed' | 'reported' | 'neutral' | 'severe'

const TONE: Record<BadgeTone, string> = {
  confirmed: 'text-confirmed',
  reported: 'text-reported',
  neutral: 'text-text',
  severe: 'text-severe',
}

/**
 * A mark and a word, linked to the method, with a tooltip that explains it.
 * Verification and severity carry a mark; legal status is boxed like a stamp.
 */
function Pill({ tone, href, label, tip, tipId, marker }: {
  tone: BadgeTone
  href: string
  label: string
  tip: string
  tipId: string
  marker?: ReactNode
}) {
  return (
    <Tooltip id={tipId} tip={<>{tip} <span className="text-muted">Select to see how this is decided.</span></>}>
      <Link href={href} aria-describedby={tipId} className={`badge ${marker ? '' : 'badge-box'} ${TONE[tone]}`}>
        {marker ? (
          <span aria-hidden="true" className="inline-flex w-2.5 items-center justify-center">
            {marker}
          </span>
        ) : null}
        {label}
      </Link>
    </Tooltip>
  )
}

/** The V3 label names the authority that confirmed it, when sources say. */
export function verificationLabel(level: PublicVerificationLevel, sourceTypes: readonly SourceType[] = []): string {
  if (level !== 'V3') return VERIFICATION_META[level].label
  if (sourceTypes.includes('court_record')) return 'Confirmed by court record'
  if (sourceTypes.includes('prosecutor')) return 'Confirmed by prosecutors'
  if (sourceTypes.includes('police')) return 'Confirmed by police'
  return VERIFICATION_META.V3.label
}

export function VerificationBadge({ level, sourceTypes, idPrefix }: { level: PublicVerificationLevel; sourceTypes?: readonly SourceType[]; idPrefix: string }) {
  return (
    <Pill
      tone={level === 'V3' ? 'confirmed' : 'reported'}
      marker={<VerificationMark level={level} />}
      href={`/methodology#verification-${level.toLowerCase()}`}
      label={verificationLabel(level, sourceTypes)}
      tip={`Level ${level}. ${VERIFICATION_META[level].rule}`}
      tipId={`${idPrefix}-verification`}
    />
  )
}

export function legalLabel(status: LegalStatus, hateCrimeCharged: YesNoUnknown): string {
  const base = LEGAL_STATUS_META[status].label
  if (hateCrimeCharged === 'yes' && (status === 'charged' || status === 'in_court')) return `${base} — hate crime`
  return base
}

export function LegalStatusBadges({
  status,
  hateCrimeCharged,
  idPrefix,
  alleged: showAlleged = true,
}: {
  status: LegalStatus
  hateCrimeCharged: YesNoUnknown
  idPrefix: string
  /** The "Alleged" pill; off where the status is explained in words beside it. */
  alleged?: boolean
}) {
  const alleged = showAlleged && ALLEGATION_STATUSES.includes(status)
  return (
    <>
      <Pill
        tone="neutral"
        href={`/methodology#legal-${status}`}
        label={legalLabel(status, hateCrimeCharged)}
        tip={`${LEGAL_STATUS_META[status].description}${hateCrimeCharged === 'yes' ? ' A hate-crime or bias charge was filed.' : ''}`}
        tipId={`${idPrefix}-legal`}
      />
      {alleged ? (
        <Pill
          tone="neutral"
          href="/methodology#language"
          label="Alleged"
          tip="No one has been convicted. Anyone accused is presumed innocent."
          tipId={`${idPrefix}-alleged`}
        />
      ) : null}
    </>
  )
}

/** Severity 4–5 only, in the severe tone, used sparingly. */
export function SeverityMarker({ severity, idPrefix }: { severity: Severity; idPrefix: string }) {
  if (severity < 4) return null
  return (
    <Pill
      tone="severe"
      marker={<span className="badge-square" />}
      href={`/methodology#severity-${severity}`}
      label={SEVERITY_META[severity].label}
      tip={`Severity ${severity}: ${SEVERITY_META[severity].description}`}
      tipId={`${idPrefix}-severity`}
    />
  )
}

export function DemoBadge() {
  return (
    <span className="badge badge-box border-dashed text-muted">Demo record — fictional</span>
  )
}

/** Editor-only warnings in the preview (V0, missing legal status). */
export function WarningBadge({ children }: { children: ReactNode }) {
  return (
    <span className="badge text-severe">
      <span aria-hidden="true" className="badge-square" />
      {children}
    </span>
  )
}

import { Gavel } from 'lucide-react'
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
 * Where the explanation and its link are already printed beside the badge,
 * it is plain text: no tooltip, no link (no second tab stop to the same place).
 */
function Pill({ tone, href, label, tip, tipId, marker, tooltip = true }: {
  tone: BadgeTone
  href?: string
  label: string
  tip: string
  tipId: string
  marker?: ReactNode
  tooltip?: boolean
}) {
  const className = `badge ${marker ? '' : 'badge-box'} ${TONE[tone]}`
  const inner = (
    <>
      {marker ? (
        <span aria-hidden="true" className="inline-flex w-2.5 items-center justify-center">
          {marker}
        </span>
      ) : null}
      {label}
    </>
  )
  if (!href) return <span className={className}>{inner}</span>
  const badge = (
    <Link href={href} aria-describedby={tooltip ? tipId : undefined} className={className}>
      {inner}
    </Link>
  )
  if (!tooltip) return badge
  return (
    <Tooltip id={tipId} tip={<>{tip} <span className="text-muted">Select for the full definition.</span></>}>
      {badge}
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

// Tooltip ids carry "-tip-" so they never collide with the page's section ids.
export function VerificationBadge({
  level,
  sourceTypes,
  idPrefix,
  tooltip,
  plain = false,
}: {
  level: PublicVerificationLevel
  sourceTypes?: readonly SourceType[]
  idPrefix: string
  tooltip?: boolean
  /** Text only, where the rule and its link are printed beside the badge. */
  plain?: boolean
}) {
  return (
    <Pill
      tone={level === 'V3' ? 'confirmed' : 'reported'}
      marker={<VerificationMark level={level} />}
      href={plain ? undefined : `/methodology#verification-${level.toLowerCase()}`}
      label={verificationLabel(level, sourceTypes)}
      tip={VERIFICATION_META[level].rule}
      tipId={`${idPrefix}-tip-verification`}
      tooltip={tooltip}
    />
  )
}

export function legalLabel(status: LegalStatus, hateCrimeCharged: YesNoUnknown): string {
  const base = LEGAL_STATUS_META[status].label
  if (hateCrimeCharged === 'yes' && (status === 'charged' || status === 'in_court')) return `${base} — hate crime`
  return base
}

/** The legal-status tooltip names a hate-crime charge once, before the presumption of innocence. */
function legalTip(status: LegalStatus, hateCrimeCharged: YesNoUnknown): string {
  if (hateCrimeCharged === 'yes' && status === 'charged') return 'Charges were filed, including a hate-crime or bias charge. The accused is presumed innocent.'
  if (hateCrimeCharged === 'yes' && status === 'in_court') return 'The case, which includes a hate-crime or bias charge, is before a court. The accused is presumed innocent.'
  return LEGAL_STATUS_META[status].description
}

/**
 * Where the case stands, as one group with a gavel: the status, and
 * "Alleged" joined to it while no one is convicted, so a reader never takes
 * the verification beside it for a verdict.
 */
export function LegalStatusBadges({
  status,
  hateCrimeCharged,
  idPrefix,
  alleged: showAlleged = true,
  tooltip,
  plain = false,
}: {
  status: LegalStatus
  hateCrimeCharged: YesNoUnknown
  idPrefix: string
  /** The "Alleged" part; off where the status is explained in words beside it. */
  alleged?: boolean
  tooltip?: boolean
  /** Text only, where the status is explained and linked beside the badge. */
  plain?: boolean
}) {
  const alleged = showAlleged && ALLEGATION_STATUSES.includes(status)
  return (
    <span className="badge-group">
      <Gavel aria-hidden="true" className="badge-group-icon" />
      <Pill
        tone="neutral"
        href={plain ? undefined : `/methodology#legal-${status}`}
        label={legalLabel(status, hateCrimeCharged)}
        tip={legalTip(status, hateCrimeCharged)}
        tipId={`${idPrefix}-tip-legal`}
        tooltip={tooltip}
      />
      {alleged ? (
        <Pill
          tone="neutral"
          href={plain ? undefined : '/methodology#language'}
          label="Alleged"
          tip="No one has been convicted. Anyone accused is presumed innocent."
          tipId={`${idPrefix}-tip-alleged`}
          tooltip={tooltip}
        />
      ) : null}
    </span>
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
      tip={`Severity ${severity} of 5: ${SEVERITY_META[severity].description}`}
      tipId={`${idPrefix}-tip-severity`}
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

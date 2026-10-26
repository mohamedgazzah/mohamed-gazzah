import type { PublicVerificationLevel } from '@/db/enums'

/**
 * Shape for a verification level, so it never depends on color alone:
 * V3 solid, V2 half-filled, V1 ring. Drawn in the current text color.
 */
export function VerificationMark({ level, size = 10 }: { level: PublicVerificationLevel; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 10 10" className="inline-block shrink-0 align-[-1px]">
      <circle cx="5" cy="5" r="4" fill={level === 'V3' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
      {level === 'V2' ? <path d="M5 1 A4 4 0 0 0 5 9 Z" fill="currentColor" /> : null}
    </svg>
  )
}

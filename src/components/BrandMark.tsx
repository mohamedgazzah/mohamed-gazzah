/**
 * The mark beside the name: a page's margin rule and two lines of text that
 * end in a full stop, the stop the largest part, so the mark reads as "on
 * the record" and not as a menu icon. The stop sits apart from the line and
 * a little low, as punctuation does, so it never reads as a slider's knob.
 * Drawn, so it needs no font.
 */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      <path d="M5.5 4.5v15M9.5 8.5h9M9.5 14h4.5" />
      <circle cx="18.9" cy="14.6" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

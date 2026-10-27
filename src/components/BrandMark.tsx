/** The mark beside the name: lines of a record, drawn so it needs no font. */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M5 7h14M5 12h10M5 17h6" />
    </svg>
  )
}

/** The mark beside the name: a ledger page, lines ending in a full stop. Drawn, so it needs no font. */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6.5 4.5v15M10.5 8h8M10.5 12h8M10.5 16h4" />
      <circle cx="17.6" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

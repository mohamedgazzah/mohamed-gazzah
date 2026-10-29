/** A small arrow for links that lead somewhere (drawn, so every font shows the same glyph). */
export function Arrow({ direction = 'right', size = 12 }: { direction?: 'right' | 'down' | 'up' | 'up-right'; size?: number }) {
  const rotate = { right: 0, down: 90, up: -90, 'up-right': -45 }[direction]
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="shrink-0" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M1 6h9.5M6.5 2l4 4-4 4" strokeLinecap="square" />
    </svg>
  )
}

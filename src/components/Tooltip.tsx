import type { ReactNode } from 'react'

/**
 * Text tooltip shown on hover and keyboard focus (WCAG 1.4.13: it can be
 * hovered, it persists, and Escape dismisses it — see TooltipDismisser).
 * The trigger must be focusable (a link or button).
 */
export function Tooltip({ id, tip, children }: { id: string; tip: ReactNode; children: ReactNode }) {
  return (
    <span className="tip">
      {children}
      <span role="tooltip" id={id} className="tip-body">
        {tip}
      </span>
    </span>
  )
}

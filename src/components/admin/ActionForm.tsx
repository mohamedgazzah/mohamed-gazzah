'use client'

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from 'react'

export type ActionState = { ok?: boolean; error?: string; message?: string }
export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

/**
 * A form bound to a server action, with an announced error or success
 * message. Works without JavaScript (progressive enhancement). With
 * JavaScript, what the person typed is kept when the action reports an
 * error (React would otherwise reset the form), and cleared on success.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Working…',
  className = 'space-y-4',
  buttonClassName = 'btn',
  confirm,
}: {
  action: FormAction
  children?: ReactNode
  submitLabel: string
  pendingLabel?: string
  className?: string
  buttonClassName?: string
  confirm?: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const msgRef = useRef<HTMLParagraphElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.message && !state.error) formRef.current?.reset()
    if (state.error || state.message) msgRef.current?.focus()
  }, [state])
  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        if (confirm && !window.confirm(confirm)) return
        const data = new FormData(e.currentTarget)
        startTransition(() => formAction(data))
      }}
    >
      {children}
      {state.error ? (
        <p ref={msgRef} tabIndex={-1} role="alert" className="field-error outline-none">
          {state.error}
        </p>
      ) : state.message ? (
        <p ref={msgRef} tabIndex={-1} role="status" className="font-semibold text-confirmed outline-none">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className={buttonClassName} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}

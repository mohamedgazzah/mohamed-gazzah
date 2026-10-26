import { redirect } from 'next/navigation'
import { ActionForm } from '@/components/admin/ActionForm'
import { getSession } from '@/server/admin/session'
import { logout, verifyCode } from '../../../_actions/auth'

export default async function VerifyPage() {
  const s = await getSession()
  if (!s) redirect('/admin/login')
  if (s.mfaVerified) redirect('/admin')
  if (!s.user.totpEnabledAt) redirect('/admin/login/enroll')
  return (
    <>
      <h1 className="text-2xl">Enter your code</h1>
      <p className="mt-2 hint">Open your authenticator app and enter the 6-digit code for {s.user.email}.</p>
      <ActionForm action={verifyCode} submitLabel="Sign in" pendingLabel="Checking…" className="mt-6 space-y-4">
        <div>
          <label htmlFor="code" className="label">
            6-digit code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            pattern="[0-9 ]{6,7}"
            autoComplete="one-time-code"
            required
            autoFocus
            className="control max-w-40 text-xl tracking-widest tabular"
          />
        </div>
      </ActionForm>
      <form action={logout} className="mt-6">
        <button type="submit" className="btn btn-quiet">
          Use a different account
        </button>
      </form>
    </>
  )
}

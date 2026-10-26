import { redirect } from 'next/navigation'
import { ActionForm } from '@/components/admin/ActionForm'
import { getSession } from '@/server/admin/session'
import { login } from '../../_actions/auth'

export default async function LoginPage() {
  const s = await getSession()
  if (s?.mfaVerified) redirect('/admin')
  return (
    <>
      <h1 className="text-2xl">Sign in</h1>
      <p className="mt-2 hint">For editors only. Two-factor authentication is required.</p>
      <ActionForm action={login} submitLabel="Continue" pendingLabel="Checking…" className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="username" required className="control" />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="control" />
        </div>
      </ActionForm>
    </>
  )
}

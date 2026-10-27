import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { ActionForm } from '@/components/admin/ActionForm'
import { MIN_PASSWORD_LENGTH } from '@/lib/passwords'
import { setupOpen } from '@/server/admin/setup'
import { setupFirstAdmin } from '../../_actions/auth'

/** Exists only on a new deployment: ADMIN_SETUP_TOKEN set and no accounts yet. */
export default async function SetupPage() {
  await connection()
  if (!(await setupOpen())) notFound()
  return (
    <>
      <h1 className="text-2xl">Create the first admin account</h1>
      <p className="mt-2 reading">
        This page works once, on a new site. Enter the setup token from the deployment settings (<code>ADMIN_SETUP_TOKEN</code>), then set up
        two-factor authentication. Add everyone else afterwards under Users.
      </p>
      <ActionForm action={setupFirstAdmin} submitLabel="Create account" pendingLabel="Creating…" className="mt-6 space-y-4">
        <div>
          <label htmlFor="token" className="label">
            Setup token
          </label>
          <input id="token" name="token" type="password" autoComplete="off" required className="control" />
        </div>
        <div>
          <label htmlFor="name" className="label">
            Your name
          </label>
          <input id="name" name="name" type="text" autoComplete="name" required className="control" />
        </div>
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
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="control"
            aria-describedby="pw-hint"
          />
          <p id="pw-hint" className="hint mt-1">
            At least {MIN_PASSWORD_LENGTH} characters. A long phrase is easiest.
          </p>
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Password again
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="control" />
        </div>
      </ActionForm>
    </>
  )
}

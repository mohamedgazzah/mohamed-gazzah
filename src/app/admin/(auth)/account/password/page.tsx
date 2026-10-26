import { ActionForm } from '@/components/admin/ActionForm'
import { MIN_PASSWORD_LENGTH } from '@/lib/passwords'
import { requireSignedIn } from '@/server/admin/session'
import { changePassword } from '../../../_actions/auth'

export default async function PasswordPage() {
  const me = await requireSignedIn()
  return (
    <>
      <h1 className="text-2xl">{me.mustChangePassword ? 'Choose your password' : 'Change your password'}</h1>
      {me.mustChangePassword ? <p className="mt-2 reading">Replace the temporary password you were given before continuing.</p> : null}
      <ActionForm action={changePassword} submitLabel="Save password" className="mt-6 space-y-4">
        <div>
          <label htmlFor="current" className="label">
            Current password
          </label>
          <input id="current" name="current" type="password" autoComplete="current-password" required className="control" />
        </div>
        <div>
          <label htmlFor="next" className="label">
            New password
          </label>
          <input id="next" name="next" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required className="control" aria-describedby="pw-hint" />
          <p id="pw-hint" className="hint mt-1">
            At least {MIN_PASSWORD_LENGTH} characters. A long phrase is easiest.
          </p>
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            New password again
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="control" />
        </div>
      </ActionForm>
    </>
  )
}

import { ActionForm } from '@/components/admin/ActionForm'
import { USER_ROLES, USER_ROLE_META } from '@/db/enums'
import { formatTimestamp } from '@/lib/format'
import { requireUser } from '@/server/admin/session'
import { listUsers } from '@/server/admin/users'
import { createUserAction, updateUserAction } from '../../_actions/manage'

export const metadata = { title: 'Users' }

export default async function UsersPage() {
  const me = await requireUser('admin')
  const rows = await listUsers()
  return (
    <>
      <h1 className="text-2xl">Users</h1>
      <p className="mt-2 hint">Roles: contributors draft; editors draft and review; senior editors publish and unpublish; admins manage users. Every account must use two-factor authentication.</p>
      <ul className="mt-6 space-y-3">
        {rows.map((u) => (
          <li key={u.id} className="card space-y-2 p-4">
            <p>
              <strong>{u.displayName}</strong> · {u.email} · {USER_ROLE_META[u.role].label}
              {u.isDemo ? ' · demo account' : ''}
              {!u.active ? ' · deactivated' : ''}
            </p>
            <p className="text-sm text-muted">
              Two-factor: {u.totpEnabledAt ? `on since ${formatTimestamp(u.totpEnabledAt)}` : 'not set up yet'} · last sign-in {u.lastLoginAt ? formatTimestamp(u.lastLoginAt) : 'never'}
              {u.lockedUntil && u.lockedUntil > new Date() ? ' · locked after failed attempts' : ''}
            </p>
            {u.id !== me.id ? (
              <div className="flex flex-wrap items-end gap-4">
                <ActionForm action={updateUserAction} submitLabel="Change role" buttonClassName="btn btn-secondary" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="action" value="role" />
                  <label className="sr-only" htmlFor={`role-${u.id}`}>
                    Role for {u.displayName}
                  </label>
                  <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="control w-auto">
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {USER_ROLE_META[r].label}
                      </option>
                    ))}
                  </select>
                </ActionForm>
                {(['reset_password', 'reset_2fa', u.active ? 'deactivate' : 'activate'] as const).map((a) => (
                  <ActionForm
                    key={a}
                    action={updateUserAction}
                    submitLabel={a === 'reset_password' ? 'Reset password' : a === 'reset_2fa' ? 'Reset two-factor' : a === 'deactivate' ? 'Deactivate' : 'Reactivate'}
                    buttonClassName="btn btn-secondary"
                    confirm={a === 'deactivate' ? `Deactivate ${u.displayName}? They will be signed out.` : undefined}
                  >
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="action" value={a} />
                  </ActionForm>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">This is you. Another admin must change your role or status.</p>
            )}
          </li>
        ))}
      </ul>
      <section aria-labelledby="new-user" className="card mt-8 max-w-xl p-4">
        <h2 id="new-user" className="mb-3 text-xl">
          Add a user
        </h2>
        <ActionForm action={createUserAction} submitLabel="Create account" className="space-y-3">
          <div>
            <label htmlFor="displayName" className="label">
              Name
            </label>
            <input id="displayName" name="displayName" required className="control" />
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email (use a role or project address, not a personal one, where possible)
            </label>
            <input id="email" name="email" type="email" required className="control" />
          </div>
          <div>
            <label htmlFor="role" className="label">
              Role
            </label>
            <select id="role" name="role" defaultValue="contributor" className="control">
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_META[r].label} — {USER_ROLE_META[r].description}
                </option>
              ))}
            </select>
          </div>
        </ActionForm>
      </section>
    </>
  )
}

import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { ActionForm } from '@/components/admin/ActionForm'
import { SITE } from '@/lib/site'
import { otpauthUri } from '@/lib/totp'
import { getSession } from '@/server/admin/session'
import { ensurePendingSecret } from '@/server/admin/totp-enrollment'
import { enroll } from '../../../_actions/auth'

export default async function EnrollPage() {
  const s = await getSession()
  if (!s) redirect('/admin/login')
  if (s.mfaVerified) redirect('/admin')
  if (s.user.totpEnabledAt) redirect('/admin/login/verify')
  const secret = await ensurePendingSecret(s.user.id)
  const uri = otpauthUri(secret, s.user.email, `${SITE.name} editors`)
  // Colors come from tokens: dark modules on a light field in both themes, so it always scans.
  const svg = (await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }))
    .replace(/fill="#f{6}"/gi, 'style="fill:var(--qr-light)"')
    .replace(/stroke="#0{6}"/gi, 'style="stroke:var(--qr-dark)"')
    .replace(/fill="#0{6}"/gi, 'style="fill:var(--qr-dark)"')
  return (
    <>
      <h1 className="text-2xl">Set up two-factor authentication</h1>
      <p className="mt-2 reading">Every editor account needs a second factor. Scan this code with an authenticator app, then enter the 6-digit code it shows.</p>
      <div className="mt-6 w-56 rounded-lg border border-rule bg-[var(--qr-light)] p-3" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: svg }} />
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold">Can’t scan? Enter this key instead</summary>
        <p className="mt-2 break-all font-mono text-base tabular" aria-label="Setup key">
          {secret.match(/.{1,4}/g)?.join(' ')}
        </p>
      </details>
      <ActionForm action={enroll} submitLabel="Turn on two-factor authentication" className="mt-6 space-y-4">
        <div>
          <label htmlFor="code" className="label">
            6-digit code from the app
          </label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className="control max-w-40 text-xl tracking-widest tabular" />
        </div>
      </ActionForm>
    </>
  )
}

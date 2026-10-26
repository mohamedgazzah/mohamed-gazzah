import 'server-only'

/** Cloudflare Turnstile: an invisible challenge instead of a CAPTCHA puzzle. */
export async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  if (process.env.TURNSTILE_DISABLED === 'true') {
    if (process.env.APP_ENV === 'production') throw new Error('TURNSTILE_DISABLED must not be set in production')
    return true
  }
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not set')
  if (!token) return false
  const body = new URLSearchParams({ secret, response: token })
  if (ip && ip !== 'unknown') body.set('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error('[turnstile] verification request failed', (err as Error).message)
    return false
  }
}

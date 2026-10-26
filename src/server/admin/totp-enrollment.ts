import 'server-only'
import { eq } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { users } from '@/db/schema'
import { decryptText, encryptText } from '@/lib/crypto'
import { generateTotpSecret } from '@/lib/totp'

/** Create (or reuse) the pending enrollment secret shown on the enroll page. Server only, never an action. */
export async function ensurePendingSecret(userId: string): Promise<string> {
  const [user] = await adminDb().select().from(users).where(eq(users.id, userId))
  if (!user) throw new Error('User not found')
  if (user.totpPendingSecretEnc) return decryptText(user.totpPendingSecretEnc, 'APP_ENCRYPTION_KEY', `totp-pending:${user.id}`)
  const secret = generateTotpSecret()
  await adminDb()
    .update(users)
    .set({ totpPendingSecretEnc: encryptText(secret, 'APP_ENCRYPTION_KEY', `totp-pending:${user.id}`) })
    .where(eq(users.id, user.id))
  return secret
}

import { eq } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { submissionFiles } from '@/db/schema'
import { decryptBytes } from '@/lib/crypto'
import { audit } from '@/server/admin/audit'
import { can } from '@/server/admin/permissions'
import { getSession } from '@/server/admin/session'
import { getObject } from '@/server/shared/storage'

export const dynamic = 'force-dynamic'

/** Submitted evidence, decrypted for signed-in editors only. Never cached, never public. */
export async function GET(_req: Request, ctx: RouteContext<'/admin/files/[id]'>) {
  const s = await getSession()
  if (!s || !s.mfaVerified || !can.viewSubmitterDetails(s.user.role)) return new Response('Not found', { status: 404 })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 })
  const [file] = await adminDb().select().from(submissionFiles).where(eq(submissionFiles.id, id))
  if (!file) return new Response('Not found', { status: 404 })
  const bytes = decryptBytes(await getObject(file.storageKey), 'SUBMISSIONS_ENCRYPTION_KEY', file.storageKey)
  await audit(null, s.user.id, 'submission.file_download', 'submission_file', id)
  const ext = file.mimeType.split('/')[1] ?? 'bin'
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="evidence-${id.slice(0, 8)}.${ext}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

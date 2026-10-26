import 'server-only'
import { auditLog } from '@/db/schema'
import { adminDb, type AdminTx } from '@/db/admin'

/** Append to the permanent audit log. Pass the transaction when inside one. */
export async function audit(
  tx: AdminTx | null,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await (tx ?? adminDb()).insert(auditLog).values({ actorId, action, entityType, entityId, details })
}

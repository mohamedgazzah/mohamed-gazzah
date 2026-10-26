'use server'

import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/components/admin/ActionForm'
import { REVIEW_CHECKLIST } from '@/db/enums'
import { incidentDraftInput, issuesByPath, type IncidentDraftInput } from '@/lib/validation'
import { friendlyDbError } from '@/server/admin/errors'
import {
  WorkflowError,
  excludeIncident,
  findDuplicates,
  publishIncident,
  restoreIncident,
  reviewIncident,
  saveIncident,
  submitForReview,
  unpublishIncident,
  withdrawFromReview,
  type Checklist,
  type DuplicateCandidate,
} from '@/server/admin/incidents'
import { can } from '@/server/admin/permissions'
import { requireUser } from '@/server/admin/session'
import { fetchSourceMetadata, type SourceMetadata } from '@/server/admin/source-metadata'
import { archivePending, retryArchive } from '@/server/jobs/archive'

function message(err: unknown): string {
  if (err instanceof WorkflowError) return err.message
  if (err instanceof z.ZodError) return 'Some fields need attention.'
  return friendlyDbError(err)
}

export type SaveRecordResult = { ok: true; id: string; revision: number } | { ok: false; error: string; fieldErrors?: Record<string, string> }

export async function saveRecord(input: IncidentDraftInput, reason: string): Promise<SaveRecordResult> {
  const me = await requireUser('contributor')
  const parsed = incidentDraftInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Some fields need attention.', fieldErrors: issuesByPath(parsed.error) }
  try {
    const res = await saveIncident(me, parsed.data, reason)
    if (res.newSourceIds.length) {
      // Archive new sources straight away; the scheduled job retries any that fail.
      after(() => archivePending({ ids: res.newSourceIds }).catch((e) => console.error('[archive]', (e as Error).message)))
    }
    revalidatePath(`/admin/incidents/${res.id}`)
    return { ok: true, id: res.id, revision: res.revision }
  } catch (err) {
    return { ok: false, error: message(err) }
  }
}

export async function lookupSource(url: string): Promise<{ ok: true; data: SourceMetadata } | { ok: false; error: string }> {
  await requireUser('contributor')
  try {
    return { ok: true, data: await fetchSourceMetadata(url) }
  } catch (err) {
    return { ok: false, error: `Could not read that page: ${(err as Error).message}` }
  }
}

export async function duplicateCandidates(p: Parameters<typeof findDuplicates>[0]): Promise<DuplicateCandidate[]> {
  await requireUser('contributor')
  return findDuplicates(p)
}

const id = (fd: FormData) => String(fd.get('id') ?? '')

export async function submitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('contributor')
  try {
    await submitForReview(me, id(fd))
  } catch (err) {
    return { error: message(err) }
  }
  revalidatePath(`/admin/incidents/${id(fd)}`)
  redirect(`/admin/incidents/${id(fd)}?done=submitted`)
}

export async function withdrawAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('contributor')
  try {
    await withdrawFromReview(me, id(fd))
  } catch (err) {
    return { error: message(err) }
  }
  revalidatePath(`/admin/incidents/${id(fd)}`)
  redirect(`/admin/incidents/${id(fd)}?done=withdrawn`)
}

export async function reviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('editor')
  const decision = fd.get('decision') === 'approved' ? 'approved' : 'returned'
  const checklist = Object.fromEntries(REVIEW_CHECKLIST.map((c) => [c.key, fd.get(c.key) === 'on'])) as Checklist
  try {
    await reviewIncident(me, id(fd), decision, checklist, String(fd.get('comments') ?? ''))
  } catch (err) {
    return { error: message(err) }
  }
  revalidatePath('/admin/review')
  redirect(`/admin/incidents/${id(fd)}?reviewed=${decision}`)
}

export async function publishAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('senior_editor')
  try {
    await publishIncident(me, id(fd), String(fd.get('note') ?? ''))
  } catch (err) {
    return { error: message(err) }
  }
  revalidatePath(`/admin/incidents/${id(fd)}`)
  redirect(`/admin/incidents/${id(fd)}?done=published`)
}

export async function unpublishAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('senior_editor')
  try {
    await unpublishIncident(me, id(fd), String(fd.get('reason') ?? ''))
  } catch (err) {
    return { error: message(err) }
  }
  revalidatePath(`/admin/incidents/${id(fd)}`)
  redirect(`/admin/incidents/${id(fd)}?done=unpublished`)
}

export async function excludeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('editor')
  try {
    await excludeIncident(me, id(fd), String(fd.get('reason') ?? ''))
  } catch (err) {
    return { error: message(err) }
  }
  revalidatePath(`/admin/incidents/${id(fd)}`)
  redirect(`/admin/incidents/${id(fd)}?done=excluded`)
}

export async function restoreAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('editor')
  try {
    await restoreIncident(me, id(fd))
  } catch (err) {
    return { error: message(err) }
  }
  revalidatePath(`/admin/incidents/${id(fd)}`)
  redirect(`/admin/incidents/${id(fd)}?done=restored`)
}

export async function retryArchiveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('contributor')
  if (!can.draft(me.role)) return { error: 'Not allowed.' }
  const result = await retryArchive(String(fd.get('sourceId') ?? ''))
  revalidatePath(`/admin/incidents/${id(fd)}`)
  return result.archived ? { message: 'Archived.' } : { error: 'The archive did not respond with a copy yet. The scheduled job will keep trying.' }
}

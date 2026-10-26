'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ActionState } from '@/components/admin/ActionForm'
import { CASE_TYPES, LEAD_SOURCES, USER_ROLES, type IncidentType, type LeadSource, type UserRole } from '@/db/enums'
import { saveCase } from '@/server/admin/cases'
import { updateTicket } from '@/server/admin/corrections'
import { friendlyDbError } from '@/server/admin/errors'
import { WorkflowError } from '@/server/admin/incidents'
import { createManualLead, triageLead, type TriageDecision } from '@/server/admin/leads'
import { requireUser } from '@/server/admin/session'
import { createUser, updateUser } from '@/server/admin/users'

function fail(err: unknown): ActionState {
  if (err instanceof WorkflowError) return { error: err.message }
  if (err instanceof z.ZodError) return { error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ') }
  return { error: friendlyDbError(err) }
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

export async function triageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('editor')
  const decision = str(fd, 'decision') as TriageDecision
  if (!['new_incident', 'update', 'duplicate', 'out_of_scope'].includes(decision)) return { error: 'Choose a triage decision.' }
  let incidentId: string | null = null
  try {
    const res = await triageLead(me, str(fd, 'id'), decision, {
      reason: str(fd, 'reason'),
      incidentId: str(fd, 'incidentId'),
      stateFips: str(fd, 'stateFips'),
      incidentType: (str(fd, 'incidentType') || undefined) as IncidentType | undefined,
    })
    incidentId = res.incidentId
  } catch (err) {
    return fail(err)
  }
  revalidatePath('/admin/leads')
  if (decision === 'new_incident' && incidentId) redirect(`/admin/incidents/${incidentId}`)
  return { message: 'Triaged.' }
}

export async function addLeadAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('editor')
  const source = (LEAD_SOURCES.includes(str(fd, 'source') as LeadSource) ? str(fd, 'source') : 'manual') as LeadSource
  try {
    await createManualLead(me, { headline: str(fd, 'headline'), url: str(fd, 'url') || null, outlet: str(fd, 'outlet') || null, source })
  } catch (err) {
    return fail(err)
  }
  revalidatePath('/admin/leads')
  return { message: 'Lead added to the inbox.' }
}

export async function correctionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('editor')
  const action = str(fd, 'action') as 'assign' | 'respond' | 'resolve' | 'decline'
  if (!['assign', 'respond', 'resolve', 'decline'].includes(action)) return { error: 'Unknown action.' }
  try {
    await updateTicket(me, str(fd, 'id'), action, str(fd, 'note'))
  } catch (err) {
    return fail(err)
  }
  revalidatePath('/admin/corrections')
  return { message: 'Saved.' }
}

export async function caseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('editor')
  let id: string
  try {
    id = await saveCase(me, {
      id: str(fd, 'id') || null,
      name: str(fd, 'name'),
      court: str(fd, 'court') || null,
      jurisdiction: str(fd, 'jurisdiction') || null,
      docketNumber: str(fd, 'docketNumber') || null,
      caseType: (CASE_TYPES as readonly string[]).includes(str(fd, 'caseType')) ? (str(fd, 'caseType') as (typeof CASE_TYPES)[number]) : 'criminal',
      parties: str(fd, 'parties').split('\n').map((p) => p.trim()).filter(Boolean),
      stage: str(fd, 'stage') || null,
      nextDate: str(fd, 'nextDate') || null,
      courtlistenerUrl: str(fd, 'courtlistenerUrl') || null,
    })
  } catch (err) {
    return fail(err)
  }
  revalidatePath('/admin/cases')
  redirect(`/admin/cases/${id}?saved=1`)
}

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('admin')
  const role = str(fd, 'role') as UserRole
  try {
    const { password } = await createUser(me, { email: str(fd, 'email'), displayName: str(fd, 'displayName'), role: USER_ROLES.includes(role) ? role : 'contributor' })
    revalidatePath('/admin/users')
    return { message: `Account created. Temporary password (shown once): ${password} — they must set up two-factor authentication and change it at first sign-in.` }
  } catch (err) {
    return fail(err)
  }
}

export async function updateUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser('admin')
  const action = str(fd, 'action') as Parameters<typeof updateUser>[2]
  if (!['role', 'deactivate', 'activate', 'reset_2fa', 'reset_password'].includes(action)) return { error: 'Unknown action.' }
  try {
    const { password } = await updateUser(me, str(fd, 'id'), action, (str(fd, 'role') || undefined) as UserRole | undefined)
    revalidatePath('/admin/users')
    return { message: password ? `New temporary password (shown once): ${password}` : 'Saved.' }
  } catch (err) {
    return fail(err)
  }
}

import type { UserRole } from '@/db/enums'

const RANK: Record<UserRole, number> = { contributor: 1, editor: 2, senior_editor: 3, admin: 4 }

export function atLeast(role: UserRole, min: UserRole): boolean {
  return RANK[role] >= RANK[min]
}

export const can = {
  draft: (r: UserRole) => atLeast(r, 'contributor'),
  editAnyRecord: (r: UserRole) => atLeast(r, 'editor'),
  review: (r: UserRole) => atLeast(r, 'editor'),
  triage: (r: UserRole) => atLeast(r, 'editor'),
  handleCorrections: (r: UserRole) => atLeast(r, 'editor'),
  viewSubmitterDetails: (r: UserRole) => atLeast(r, 'editor'),
  manageCases: (r: UserRole) => atLeast(r, 'editor'),
  publish: (r: UserRole) => atLeast(r, 'senior_editor'),
  viewAudit: (r: UserRole) => atLeast(r, 'senior_editor'),
  manageUsers: (r: UserRole) => r === 'admin',
}

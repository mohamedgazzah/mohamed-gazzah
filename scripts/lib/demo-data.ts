/** Demo accounts and canary strings shared by the seed script and the tests. Development and tests only. */
export const EDITOR_NOTE_CANARY = 'EDITOR-NOTE-CANARY-7f3a91'
export const V0_CANARY = 'V0-CANARY-c41d'

/** Fixed TOTP secrets for demo accounts only, so tests can sign in. */
export const DEMO_USERS = [
  { email: 'author@demo.invalid', displayName: 'Demo Author', role: 'editor', password: 'demo-author-password', totp: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' },
  { email: 'reviewer@demo.invalid', displayName: 'Demo Reviewer', role: 'editor', password: 'demo-reviewer-password', totp: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU' },
  { email: 'senior@demo.invalid', displayName: 'Demo Senior Editor', role: 'senior_editor', password: 'demo-senior-password', totp: 'MFRGGZDFMZTWQ2LKMFRGGZDFMZTWQ2LK' },
  { email: 'admin@demo.invalid', displayName: 'Demo Admin', role: 'admin', password: 'demo-admin-password', totp: 'NBSWY3DPNBSWY3DPNBSWY3DPNBSWY3DP' },
  { email: 'contributor@demo.invalid', displayName: 'Demo Contributor', role: 'contributor', password: 'demo-contributor-password', totp: 'ONSWG4TFORSXG5DFONSWG4TFORSXG5DF' },
] as const

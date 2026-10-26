import { expect, type Locator, type Page } from '@playwright/test'
import { DEMO_USERS, EDITOR_NOTE_CANARY, V0_CANARY } from '../../scripts/lib/demo-data'
import { currentStep, totpAt } from '../../src/lib/totp'

export { EDITOR_NOTE_CANARY, V0_CANARY }
export const V0_RECORD_ID = 'DEMO-2026-0005'
export const CRON_SECRET = 'e2e-cron-secret'

type Role = 'author' | 'reviewer' | 'senior' | 'admin' | 'contributor'
const account = (role: Role) => DEMO_USERS.find((u) => u.email.startsWith(`${role}@`))!

const usedSteps = new Map<string, number>()

/** A TOTP code the server has not seen yet for this account (codes cannot be replayed). */
async function freshCode(secret: string): Promise<string> {
  for (;;) {
    const step = currentStep()
    if ((usedSteps.get(secret) ?? -1) < step) {
      usedSteps.set(secret, step)
      return totpAt(secret, step)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
}

export async function signIn(page: Page, role: Role) {
  const u = account(role)
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(u.email)
  await page.getByLabel('Password').fill(u.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/admin\/login\/verify/)
  await page.getByLabel('6-digit code').fill(await freshCode(u.totp))
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin(\?|$)/)
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login/)
}

/** Record ids and titles in the Explore table, in order. */
export async function tableIds(page: Page): Promise<string[]> {
  return page.locator('table.data-table tbody tr[data-record-id]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-record-id')!))
}

/** Press Tab until the target has focus, like a keyboard user would. */
export async function tabTo(page: Page, target: Locator, max = 120) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('Could not reach the element with Tab')
}

/** The page's own alert, not Next's route announcer (which also has role="alert"). */
export function appAlert(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)')
}

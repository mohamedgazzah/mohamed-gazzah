/**
 * The two-person rule from the editor's side: an author drafts, cannot
 * approve their own work, a second editor approves with the checklist, a
 * senior editor publishes, and the record appears on the public site.
 */
import { expect, test } from '@playwright/test'
import { appAlert, signIn, signOut } from './helpers'

test.describe.configure({ mode: 'serial' })

const title = `Vandalism reported at a fictional community center ${Date.now().toString().slice(-6)}`
let recordId = ''

test('sign-in requires the second factor', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login/)
  await page.getByLabel('Email').fill('author@demo.invalid')
  await page.getByLabel('Password').fill('wrong password here')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(appAlert(page)).toHaveText('Email or password is incorrect.')
  await page.getByLabel('Password').fill('demo-author-password')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/admin\/login\/verify/)
  // A half-signed-in session cannot reach the admin area.
  await page.goto('/admin/incidents')
  await expect(page).toHaveURL(/\/admin\/login\/verify/)
  await page.getByLabel('6-digit code').fill('000000')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(appAlert(page)).toContainText('not valid')
})

test('an author drafts a record and submits it for review', async ({ page }) => {
  await signIn(page, 'author')
  await page.goto('/admin/incidents/new')
  await page.getByLabel(/^Title/).fill(title)
  await page.getByRole('textbox', { name: 'Summary' }).fill('Staff reported graffiti on an outside wall of a fictional community center.[1] Police said they were investigating.[1]')
  await page.getByLabel('Date', { exact: true }).fill('2026-10-20')
  await page.getByLabel('State or territory').selectOption('26')
  await page.getByLabel('City').fill('Lansing')
  await page.getByLabel('VAND — Vandalism').check()
  await page.getByLabel('Target', { exact: true }).selectOption('mosque_islamic_center')
  await page.getByLabel('2 — Property').check()
  await page.getByLabel('Target selection').check()
  await page.getByLabel(/^V2 — Independently reported/).check()
  await page.getByLabel('Legal status').selectOption('under_investigation')
  await page.getByRole('button', { name: 'Add a source' }).click()
  await page.getByLabel('Link').fill('https://example.org/e2e/lansing-graffiti')
  await page.getByLabel('Outlet or organization').fill('Example Lansing News')
  await page.getByLabel('Title', { exact: true }).fill('Graffiti found at community center')
  // Live preview updates as the editor types.
  await expect(page.getByRole('tabpanel')).toContainText(title)
  await page.getByRole('button', { name: 'Add a legal event' }).click()
  await page.locator('[id="ed-legalEvents-0-eventType"]').selectOption('under_investigation')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page).toHaveURL(/\/admin\/incidents\/US-2026-\d{4}\?saved=1/)
  recordId = /US-2026-\d{4}/.exec(page.url())![0]
  await expect(page.getByText('Meets every publishing precondition checked by the database.')).toBeVisible()
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByText('Submitted for review.')).toBeVisible()
  // The author is told someone else must review it.
  await page.reload()
  await expect(page.getByText('You wrote this record, so another editor must review it.')).toBeVisible()
  await page.goto(`/admin/review/${recordId}`)
  await expect(page.getByText('You wrote this record. Another editor must review it.')).toBeVisible()
  await signOut(page)
})

test('a second editor must tick every checklist item to approve', async ({ page }) => {
  await signIn(page, 'reviewer')
  await page.goto('/admin/review')
  await page.getByRole('listitem').filter({ hasText: title }).getByRole('link', { name: 'Review' }).click()
  await page.getByLabel(/Approve/).check()
  await page.getByRole('button', { name: 'Record decision' }).click()
  await expect(appAlert(page)).toContainText('Tick every item on the checklist before approving.')
  for (const box of await page.locator('input[type=checkbox][name^=chk]').all()) await box.check()
  await page.getByLabel(/Approve/).check()
  await page.getByRole('button', { name: 'Record decision' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/incidents/${recordId}\\?reviewed=approved`))
  // An editor cannot publish.
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0)
  await signOut(page)
})

test('a senior editor publishes, and the record appears publicly', async ({ page }) => {
  await signIn(page, 'senior')
  await page.goto(`/admin/incidents/${recordId}`)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Published. The public page is updating now.')).toBeVisible()
  await signOut(page)

  await page.goto(`/incidents/${recordId}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  await expect(page.getByText('Published.')).toBeVisible()
  await page.goto('/incidents?q=Lansing')
  await expect(page.getByRole('link', { name: title })).toBeVisible()
})

test('a contributor cannot review or publish', async ({ page }) => {
  await signIn(page, 'contributor')
  await page.goto('/admin/review')
  await expect(page).toHaveURL(/\/admin\?denied=1/)
  await expect(appAlert(page)).toContainText('Your role does not allow that page.')
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/denied=1/)
})

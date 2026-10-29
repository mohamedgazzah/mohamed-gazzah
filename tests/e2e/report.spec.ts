/**
 * Acceptance: full keyboard navigation works on the Report form. Uploaded
 * images are accepted (EXIF removal and encryption are verified in
 * tests/db/submissions.test.ts).
 */
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { appAlert, tabTo } from './helpers'

test('a report can be completed and sent with the keyboard alone', async ({ page }) => {
  await page.goto('/report')
  await expect(page.getByText('If someone is in danger, call 911.')).toBeVisible()
  await expect(page.getByText('Submissions are reviewed by editors and are not published automatically.', { exact: false }).first()).toBeVisible()

  await tabTo(page, page.getByLabel(/What happened\?/))
  await page.keyboard.type('A man shouted slurs at a family outside a grocery store and followed them to their car.')
  await page.keyboard.press('Tab') // date
  await page.keyboard.type('09012026')
  await tabTo(page, page.getByLabel(/City or town/))
  await page.keyboard.type('Dearborn')
  await page.keyboard.press('Tab') // state
  await page.keyboard.type('Michigan')
  await tabTo(page, page.getByLabel(/It happened to me/))
  await page.keyboard.press('ArrowDown') // radio group: move to "I saw it happen"
  await expect(page.getByLabel('I saw it happen')).toBeChecked()
  await tabTo(page, page.getByRole('button', { name: 'Send report' }))
  await page.keyboard.press('Enter')
  const done = page.getByRole('heading', { name: /Thank you for telling us/ })
  await expect(done).toBeVisible()
  await expect(done).toBeFocused()
  await expect(page.getByRole('heading', { level: 1, name: 'Report received' })).toBeVisible()
  await expect(page.getByRole('status').getByText(/^[0-9A-F]{8}$/)).toBeVisible()
})

test('missing required fields are listed and linked, and typed text is kept', async ({ page }) => {
  await page.goto('/report')
  await page.getByLabel(/What happened\?/).fill('Too short')
  await page.getByRole('button', { name: 'Send report' }).click()
  const alert = appAlert(page)
  await expect(alert).toContainText('Please check the highlighted fields.')
  await expect(alert.getByRole('link', { name: /City or town: Enter the city or town/ })).toBeVisible()
  await expect(page.getByLabel(/What happened\?/)).toHaveValue('Too short')
  await expect(page.getByLabel(/City or town/)).toHaveAttribute('aria-invalid', 'true')
})

test('photos upload with the report', async ({ page }) => {
  await page.goto('/report')
  await page.getByLabel(/What happened\?/).fill('Graffiti with an anti-Muslim slur was painted on the wall of the community center overnight.')
  await page.getByLabel(/City or town/).fill('Lansing')
  await page.getByLabel(/Photos or documents/).setInputFiles(path.resolve('tests/fixtures/photo-with-gps.jpg'))
  await page.getByRole('button', { name: 'Send report' }).click()
  await expect(page.getByRole('heading', { name: /Thank you for telling us/ })).toBeVisible()
})

test('a report in progress survives following a link and coming back, attachments included', async ({ page }) => {
  await page.goto('/report')
  await page.getByLabel(/What happened\?/).fill('A man shouted slurs at a family outside a grocery store and followed them to their car.')
  await page.getByLabel(/City or town/).fill('Dearborn')
  await page.getByLabel(/Photos or documents/).setInputFiles(path.resolve('tests/fixtures/photo-with-gps.jpg'))
  await page.locator('#report-notice').getByRole('link', { name: 'Privacy policy' }).click()
  await expect(page).toHaveURL(/\/about/)
  await page.goBack()
  await expect(page.getByLabel(/What happened\?/)).toHaveValue(/^A man shouted slurs/)
  await expect(page.getByLabel(/City or town/)).toHaveValue('Dearborn')
  await expect(page.getByRole('button', { name: 'Remove photo-with-gps.jpg' })).toBeVisible()
})

test('attachments add up, and Remove keeps keyboard focus in the list', async ({ page }) => {
  await page.goto('/report')
  const files = page.getByLabel(/Photos or documents/)
  await files.setInputFiles(path.resolve('tests/fixtures/photo-with-gps.jpg'))
  await files.setInputFiles({ name: 'screenshot.png', mimeType: 'image/png', buffer: Buffer.from('not sent') })
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(2)
  await page.getByRole('button', { name: 'Remove photo-with-gps.jpg' }).press('Enter')
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remove screenshot.png' })).toBeFocused()
})

test('correction mode is tied to a record id and offers privacy removal', async ({ page }) => {
  await page.goto('/incidents/DEMO-2026-0001')
  await page.getByRole('link', { name: 'Request a correction' }).first().click()
  await expect(page).toHaveURL(/\/report\?mode=correction&record=DEMO-2026-0001/)
  await expect(page.getByLabel(/Record id/)).toHaveValue('DEMO-2026-0001')
  await page.getByLabel(/What should be corrected/).fill('The second sentence names the wrong police department; the county sheriff responded.')
  await page.getByLabel(/I am a person described in this record/).check()
  await page.getByRole('button', { name: 'Send correction request' }).click()
  await expect(page.getByRole('heading', { name: /Thank you for your request/ })).toBeVisible()
  // The confirmation says what happens next (the notes beside the form are hidden once it is sent).
  await expect(page.getByRole('status').getByText(/within 48 hours/)).toBeVisible()
})

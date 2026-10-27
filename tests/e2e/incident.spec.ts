import { expect, test } from '@playwright/test'

test('an incident page shows facts, sources, timeline, change log and citations', async ({ page }) => {
  await page.goto('/incidents/DEMO-2026-0002')
  // The id alone redirects to the canonical slug URL.
  await expect(page).toHaveURL(/\/incidents\/DEMO-2026-0002-demo-man-charged/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Man charged with hate crime')
  await expect(page.getByRole('link', { name: /Confirmed by court record/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Charged — hate crime/ })).toBeVisible()
  // The status panel says in words that a charge is not a conviction.
  await expect(page.getByRole('region', { name: 'Record status' })).toContainText('Not convicted.')
  await expect(page.getByRole('heading', { name: 'Key facts' })).toBeVisible()
  await expect(page.getByText('Charged, not convicted: Demo Defendant A')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Legal timeline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Change log' })).toBeVisible()
  await expect(page.getByText('Published.')).toBeVisible()
  // Source markers link to the numbered sources.
  await page.getByRole('link', { name: 'Source 2' }).first().click()
  await expect(page).toHaveURL(/#rec-DEMO-2026-0002-source-2$/)
  // Citations.
  await page.getByText('Cite this record (APA, Chicago, BibTeX)').click()
  await expect(page.getByText(/^@misc\{record_DEMO20260002,/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Request a correction' }).first()).toHaveAttribute('href', '/report?mode=correction&record=DEMO-2026-0002')
})

test('badge tooltips explain each badge and link to the method', async ({ page }) => {
  await page.goto('/incidents/DEMO-2026-0001')
  const badge = page.getByRole('link', { name: /Confirmed by police/ }).first()
  await badge.focus()
  const tipId = await badge.getAttribute('aria-describedby')
  await expect(page.locator(`[id="${tipId}"]`)).toBeVisible()
  await expect(page.locator(`[id="${tipId}"]`)).toContainText('V3')
  await page.keyboard.press('Escape')
  await expect(page.locator(`[id="${tipId}"]`)).toBeHidden()
  await expect(badge).toHaveAttribute('href', '/methodology#verification-v3')
})

test('a death or injury is shown plainly, without icons', async ({ page }) => {
  await page.goto('/incidents/DEMO-2026-0003')
  await expect(page.getByText('1 person injured')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Injury' })).toBeVisible()
})

test('theme toggle overrides the system setting and persists', async ({ page }) => {
  await page.goto('/methodology')
  await page.getByLabel('Dark').check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(18, 20, 23)')
  await page.getByLabel('System').check()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

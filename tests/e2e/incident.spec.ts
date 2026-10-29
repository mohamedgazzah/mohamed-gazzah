import { expect, test } from '@playwright/test'

test('an incident page shows facts, sources, timeline, change log and citations', async ({ page }) => {
  await page.goto('/incidents/DEMO-2026-0002')
  // The id alone redirects to the canonical slug URL.
  await expect(page).toHaveURL(/\/incidents\/DEMO-2026-0002-demo-man-charged/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Man charged with hate crime')
  // The status panel names both, and says in words that a charge is not a conviction.
  const status = page.getByRole('region', { name: 'Record status' })
  await expect(status).toContainText('Confirmed by court record')
  await expect(status).toContainText('Charged — hate crime')
  await expect(status).toContainText('Not convicted.')
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
  // In lists the badges stand alone, so they carry tooltips.
  await page.goto('/incidents?view=cards')
  const badge = page.getByRole('link', { name: /Confirmed by police/ }).first()
  await badge.focus()
  const tipId = await badge.getAttribute('aria-describedby')
  await expect(page.locator(`[id="${tipId}"]`)).toBeVisible()
  await expect(page.locator(`[id="${tipId}"]`)).toContainText('Police, prosecutor, or court record confirms')
  await page.keyboard.press('Escape')
  await expect(page.locator(`[id="${tipId}"]`)).toBeHidden()
  await expect(badge).toHaveAttribute('href', '/methodology#verification-v3')
  // On a record page the status panel explains its badges in words, with one link to the method:
  // the badges themselves are plain text, with no tooltip and no second link to the same place.
  await page.goto('/incidents/DEMO-2026-0001')
  const panel = page.getByRole('region', { name: 'Record status' })
  await expect(panel).toContainText('Confirmed by police')
  await expect(panel.getByRole('link', { name: /Confirmed by police/ })).toHaveCount(0)
  await expect(panel).toContainText('Police, prosecutor, or court record confirms the incident occurred.')
  await expect(panel.getByRole('link', { name: /How we verify/ })).toHaveAttribute('href', '/methodology#verification-v3')
})

test('every id on a record page is unique, so its contents links land', async ({ page }) => {
  await page.goto('/incidents/DEMO-2026-0002')
  const dupes = await page.evaluate(() => {
    const seen = new Map<string, number>()
    for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) ?? 0) + 1)
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id)
  })
  expect(dupes).toEqual([])
  await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Legal timeline' }).click()
  await expect(page).toHaveURL(/#rec-DEMO-2026-0002-legal$/)
  await expect(page.getByRole('heading', { name: 'Legal timeline' })).toBeInViewport()
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

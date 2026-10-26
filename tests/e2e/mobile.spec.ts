/** Mobile: filters in a bottom-sheet drawer; tables scroll inside their container, never the page. */
import { expect, test } from '@playwright/test'

test('the filter rail opens as a drawer and closes with Escape', async ({ page }) => {
  await page.goto('/incidents')
  const open = page.getByRole('button', { name: /^Filters/ })
  await expect(open).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply filters' })).toBeHidden()
  await open.click()
  const sheet = page.getByRole('dialog', { name: 'Filters' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Close' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(open).toBeFocused()
})

test('no page scrolls horizontally; tables scroll inside their container', async ({ page }) => {
  for (const url of ['/', '/incidents?v=1,2,3', '/incidents/DEMO-2026-0002', '/report', '/data', '/methodology', '/about']) {
    await page.goto(url)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, url).toBeLessThanOrEqual(0)
  }
  await page.goto('/incidents?v=1,2,3')
  const scroller = page.locator('.table-scroll').first()
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
})

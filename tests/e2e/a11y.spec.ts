/**
 * Acceptance: axe-core reports zero serious accessibility violations, in
 * both themes.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const pages = [
  '/',
  '/incidents',
  '/incidents?view=cards&v=1,2,3',
  '/incidents?view=map',
  '/incidents?q=mosque&type=THRT',
  '/incidents/DEMO-2026-0002',
  '/incidents/DEMO-2026-0003',
  '/methodology',
  '/data',
  '/report',
  '/report?mode=correction&record=DEMO-2026-0001',
  '/about',
  '/admin/login',
]

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme })
    for (const url of pages) {
      test(`no serious or critical axe violations on ${url}`, async ({ page }) => {
        await page.goto(url)
        await page.waitForLoadState('networkidle')
        // @axe-core/playwright bundles its own Playwright types; the page object is the same at runtime.
        const results = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
        const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`)).toEqual([])
      })
    }
  })
}

test('content stays usable at 200% zoom (reflow without horizontal page scroll)', async ({ page }) => {
  // 1280px at 200% zoom is a 640 CSS px viewport.
  await page.setViewportSize({ width: 640, height: 800 })
  for (const url of ['/', '/incidents', '/incidents/DEMO-2026-0002', '/report', '/methodology']) {
    await page.goto(url)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, url).toBeLessThanOrEqual(0)
  }
})

test('animations are disabled when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const duration = await page.evaluate(() => getComputedStyle(document.querySelector('a')!).transitionDuration)
  expect(['0s', '1e-05s']).toContain(duration)
})

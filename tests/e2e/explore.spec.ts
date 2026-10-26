/**
 * Acceptance: every filter combination produces a shareable URL, and
 * reloading it gives identical results. Stat tiles, Explore and the CSV
 * agree.
 */
import { expect, test } from '@playwright/test'
import { tabTo, tableIds } from './helpers'

const combos = [
  '/incidents',
  '/incidents?v=1,2,3',
  '/incidents?type=VAND',
  '/incidents?state=CA,IL&v=1,2,3',
  '/incidents?from=2026-01-01&to=2026-08-31&v=1,2,3',
  '/incidents?sev=2,3,4&sort=severity',
  '/incidents?status=charged&hc=yes',
  '/incidents?q=grafiti',
  '/incidents?src=police,court_record&sort=oldest',
  '/incidents?target=mosque_islamic_center&perp=individual,unknown',
  '/incidents?city=Riverside',
  '/incidents?v=1',
]

test.describe('Explore URLs', () => {
  for (const url of combos) {
    test(`reloading ${url} gives identical results, and the CSV matches`, async ({ page, request }) => {
      await page.goto(url)
      const first = await tableIds(page)
      const heading = await page.locator('#results-heading').innerText()
      await page.reload()
      expect(await tableIds(page)).toEqual(first)
      expect(await page.locator('#results-heading').innerText()).toBe(heading)
      // Shared with someone else: a brand-new browser context sees the same.
      const other = await page.context().browser()!.newContext()
      const p2 = await other.newPage()
      await p2.goto(page.url())
      expect(await tableIds(p2)).toEqual(first)
      await other.close()
      // "Download these results" has exactly the listed records.
      const href = await page.getByRole('link', { name: 'Download these results (CSV)' }).getAttribute('href')
      const csv = await (await request.get(href!)).text()
      const rows = csv.trim().split('\r\n').slice(1)
      expect(rows.length).toBe(first.length)
      for (const id of first) expect(csv).toContain(id)
    })
  }

  test('loose or repeated parameters redirect to one canonical URL', async ({ page }) => {
    await page.goto('/incidents?type=VAND&type=THRT&v=3,2&state=ca&utm_source=x')
    await expect(page).toHaveURL(/\/incidents\?state=CA&type=THRT,VAND$/)
  })

  test('filters set in the form end up in the URL', async ({ page }) => {
    await page.goto('/incidents')
    await page.locator('summary', { hasText: 'Incident type' }).click()
    await page.getByRole('checkbox', { name: 'Threat', exact: true }).check()
    await page.getByLabel('Include V1 — single-source reports').check()
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(/type=THRT/)
    await expect(page).toHaveURL(/v=1,2,3/)
    expect(await tableIds(page)).toEqual(['DEMO-2026-0002'])
    // Each chip removes only its own filter.
    await page.getByRole('link', { name: 'Remove filter: Threat' }).click()
    await expect(page).toHaveURL(/\/incidents\?v=1,2,3$/)
  })

  test('the map view has a list alternative with the same filters', async ({ page }) => {
    await page.goto('/incidents?view=map&type=VAND')
    await expect(page.getByRole('region', { name: /Map of \d+ incidents/ })).toBeVisible()
    await expect(page.getByText('The same incidents as a list')).toBeVisible()
    expect((await tableIds(page)).length).toBeGreaterThan(0)
  })

  test('cards view shows date, place, badges and source count', async ({ page }) => {
    await page.goto('/incidents?view=cards')
    const card = page.locator('article').first()
    await expect(card).toContainText(/\d+ sources?/)
    await expect(card.getByRole('link').first()).toBeVisible()
  })

  test('an empty result explains itself', async ({ page }) => {
    await page.goto('/incidents?from=2020-01-01&to=2020-01-02')
    await expect(page.getByText('No verified incidents match these filters.')).toBeVisible()
  })
})

test.describe('home stat tiles', () => {
  test('each tile links to Explore filtered to exactly the records it counts', async ({ page }) => {
    await page.goto('/')
    const tiles = page.getByRole('list').filter({ has: page.getByText('As of') }).getByRole('link')
    const n = await tiles.count()
    expect(n).toBe(4)
    for (let i = 0; i < n; i++) {
      await page.goto('/')
      const tile = page.getByRole('list').filter({ has: page.getByText('As of') }).getByRole('link').nth(i)
      const value = Number((await tile.locator('span').first().innerText()).replace(/,/g, ''))
      const label = await tile.locator('span').nth(1).innerText()
      await expect(tile).toContainText('As of')
      await tile.click()
      await expect(page).toHaveURL(/\/incidents/)
      if (/States/.test(label)) {
        const states = new Set(await page.locator('table.data-table tbody tr td:first-child span.block').allInnerTexts().then((t) => t.map((x) => x.split(', ').pop())))
        expect(states.size).toBe(value)
      } else {
        expect((await tableIds(page)).length).toBe(value)
      }
    }
  })
})

test.describe('keyboard', () => {
  test('filters can be set and applied with the keyboard alone', async ({ page }) => {
    await page.goto('/incidents')
    const summary = page.locator('summary', { hasText: 'Incident type' })
    await summary.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Homicide')).toBeFocused()
    await page.keyboard.press('Tab') // Physical assault
    await page.keyboard.press('Space')
    await tabTo(page, page.getByRole('button', { name: 'Apply filters' }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/type=ASLT/)
  })

  test('arrow keys move between table rows', async ({ page }) => {
    await page.goto('/incidents?v=1,2,3')
    const links = page.locator('table.data-table tbody tr td:nth-child(2) a')
    await links.first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(links.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(links.last()).toBeFocused()
    await page.keyboard.press('Home')
    await expect(links.first()).toBeFocused()
  })

  test('skip link jumps to the content', async ({ page }) => {
    await page.goto('/incidents')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })
})

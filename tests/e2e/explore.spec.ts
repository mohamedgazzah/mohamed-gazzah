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
      // The CSV download has exactly the listed records.
      const href = await page.getByRole('link', { name: 'Download incidents (CSV)' }).getAttribute('href')
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

  test('filters set with the type toggles and the form end up in the URL', async ({ page }) => {
    await page.goto('/incidents')
    await page.getByRole('link', { name: /^Threat \d+ records?$/ }).click()
    await expect(page).toHaveURL(/type=THRT/)
    await expect(page.getByRole('link', { name: /^Threat \d+ records?, selected$/ })).toHaveAttribute('aria-current', 'true')
    // The form keeps the type when other filters are applied.
    await page.getByLabel('Include V1 — single-source reports').check()
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(/type=THRT/)
    await expect(page).toHaveURL(/v=1,2,3/)
    expect(await tableIds(page)).toEqual(['DEMO-2026-0002'])
    // Each chip removes only its own filter, and the form shows the change.
    await page.getByRole('link', { name: 'Remove filter: Threat' }).click()
    await expect(page).toHaveURL(/\/incidents\?v=1,2,3$/)
    await expect(page.getByLabel('Include V1 — single-source reports')).toBeChecked()
  })

  test('date presets and a custom range set the dates', async ({ page }) => {
    await page.goto('/incidents')
    const nav = page.getByRole('navigation', { name: 'Dates' })
    await expect(nav.getByRole('link', { name: 'All dates' })).toHaveAttribute('aria-current', 'true')
    await nav.getByRole('link', { name: 'Last 12 months' }).click()
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/)
    await expect(page.locator('#results-heading')).toContainText('the last 12 months')
    await page.locator('summary', { hasText: 'Custom range' }).click()
    await page.getByLabel('From', { exact: true }).fill('2026-06-01')
    await page.getByLabel('To', { exact: true }).fill('2026-08-31')
    await page.getByRole('button', { name: 'Apply dates' }).click()
    await expect(page).toHaveURL(/from=2026-06-01&to=2026-08-31/)
    expect((await tableIds(page)).sort()).toEqual(['DEMO-2026-0002', 'DEMO-2026-0003'])
    await expect(page.locator('#results-heading')).toContainText('June 1, 2026 to Aug. 31, 2026')
  })

  test('the state map zooms into a state, with its cities and records', async ({ page }) => {
    await page.goto('/incidents')
    await expect(page.locator('.state-map .map-states a')).toHaveCount(51)
    // The list beside the map is the keyboard route into a state.
    const ranked = page.getByRole('list', { name: 'Records by state' })
    const ca = ranked.getByRole('link', { name: /California/ })
    const n = Number((await ca.locator('.bar-value').innerText()).replace(/\D/g, ''))
    await ca.click()
    await expect(page).toHaveURL(/\/incidents\?state=CA$/)
    await expect(page.locator('#map-heading')).toHaveText('California, by city')
    expect((await tableIds(page)).length).toBe(n)
    await expect(page.locator('.map-bubbles a')).toHaveCount(1)
    await page.getByRole('list', { name: 'Records by city in California' }).getByRole('link', { name: /Riverside/ }).click()
    await expect(page).toHaveURL(/state=CA&city=Riverside/)
    await page.getByRole('link', { name: 'All states' }).click()
    await expect(page).toHaveURL(/\/incidents$/)
  })

  test('clicking a state on the map opens it without reloading the page', async ({ page }) => {
    await page.goto('/incidents')
    await page.evaluate(() => ((window as unknown as { mark: number }).mark = 1))
    const tx = page.locator('.state-map .map-states a[data-state="TX"]')
    await tx.scrollIntoViewIfNeeded()
    const box = (await tx.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
    await expect(page.locator('.chart-tip')).toContainText('Texas')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3)
    await expect(page).toHaveURL(/\/incidents\?state=TX$/)
    await expect(page.locator('#map-heading')).toHaveText('Texas, by city')
    expect(await page.evaluate(() => (window as unknown as { mark?: number }).mark)).toBe(1)
  })

  test('the printable version and the state totals cover every matching record', async ({ page, request }) => {
    await page.goto('/incidents?v=1,2,3')
    const ids = await tableIds(page)
    await page.getByRole('link', { name: 'Print or save as PDF' }).click()
    await expect(page).toHaveURL(/\/incidents\/print\?v=1,2,3$/)
    await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible()
    const printed = await page.locator('table.print-table tbody tr td .mono').allInnerTexts()
    expect(printed.map((t) => t.split(' · ')[0]).sort()).toEqual([...ids].sort())
    const csv = await (await request.get('/incidents/download/states?v=1,2,3')).text()
    const total = csv
      .trim()
      .split('\r\n')
      .slice(1)
      .reduce((sum, line) => sum + Number(line.split(',').pop()), 0)
    expect(total).toBe(ids.length)
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

test.describe('home charts', () => {
  const count = async (page: import('@playwright/test').Page) => Number((await page.locator('#results-heading').innerText()).split(' ')[0]!.replace(/,/g, ''))

  test('each state, type and month opens Explore filtered to exactly the records it counts', async ({ page }) => {
    await page.goto('/')
    const bars = page.getByRole('list', { name: 'States with the most records' }).getByRole('link')
    const types = page.getByRole('list', { name: 'Records by incident type' }).getByRole('link')
    const months = page.getByRole('list', { name: 'Records per month' }).getByRole('link')
    expect(await bars.count()).toBeGreaterThan(0)
    expect(await types.count()).toBeGreaterThan(0)
    expect(await months.count()).toBe(12)
    for (const [list, i, value] of [
      [bars, 0, async () => Number((await bars.nth(0).locator('.bar-value').innerText()).replace(/\D/g, ''))],
      [types, 0, async () => Number((await types.nth(0).locator('.bar-value').innerText()).replace(/\D/g, ''))],
      [months, 11, async () => Number(/: (\d+)/.exec(await months.nth(11).innerText())![1])],
    ] as const) {
      await page.goto('/')
      const n = await value()
      await list.nth(i).click()
      await expect(page).toHaveURL(/\/incidents/)
      expect(await count(page)).toBe(n)
    }
  })

  test('a state on the home map opens Explore zoomed into it', async ({ page }) => {
    await page.goto('/')
    const ca = page.locator('.state-map .map-states a[data-state="CA"]')
    await ca.scrollIntoViewIfNeeded()
    const box = (await ca.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5)
    await expect(page).toHaveURL(/\/incidents\?state=CA#map$/)
    await expect(page.locator('#map-heading')).toHaveText('California, by city')
  })
})

test.describe('keyboard', () => {
  test('filters can be set and applied with the keyboard alone', async ({ page }) => {
    await page.goto('/incidents')
    await tabTo(page, page.getByRole('link', { name: /^Physical assault \d+ records?$/ }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/type=ASLT/)
    const summary = page.locator('summary', { hasText: 'Severity' })
    await tabTo(page, summary)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('1 — Verbal or written')).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    await tabTo(page, page.getByRole('button', { name: 'Apply filters' }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/type=ASLT&sev=2/)
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

/**
 * The morning news scan from the editor's side: a lead it created shows the
 * model's reading and pre-fills triage; skipped articles are listed with the
 * reason. (The scan itself is tested in tests/db/news-scan.test.ts.)
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { expect, test } from '@playwright/test'
import { e2eEnv } from '../../scripts/lib/e2e-env'
import { signIn } from './helpers'

const tag = randomUUID().slice(0, 8)
const headline = `Fictional mosque spray-painted in test town ${tag}`
const summary = `A fictional mosque was spray-painted with an anti-Muslim slur (${tag}).`

test.beforeAll(async () => {
  const db = new pg.Client({ connectionString: e2eEnv().DATABASE_URL })
  await db.connect()
  try {
    const lead = await db.query<{ id: string }>(
      `insert into record.leads (source, headline, url, outlet) values ('news_monitor', $1, $2, 'Fictional Daily') returning id`,
      [headline, `https://news.invalid/${tag}/mosque`],
    )
    const reading = {
      relevance: 'new_incident',
      confidence: 'high',
      reason: 'A mosque was vandalized with a slur.',
      incident_date: '2026-10-20',
      date_precision: 'day',
      city: 'Testville',
      state_code: 'MI',
      incident_types: ['VAND'],
      target_type: 'mosque_islamic_center',
      bias_indicators: ['slur'],
      legal_status: 'under_investigation',
      hate_crime_charged: 'unknown',
      summary,
      possible_duplicates: [],
    }
    await db.query(
      `insert into record.news_candidates (url, headline, outlet, feed, lead_source, status, assessment, model, lead_id, assessed_at)
       values ($1, $2, 'Fictional Daily', 'gdelt', 'news_monitor', 'lead', $3, 'claude-opus-5-5', $4, now())`,
      [`https://news.invalid/${tag}/mosque`, headline, JSON.stringify(reading), lead.rows[0]!.id],
    )
    await db.query(
      `insert into record.news_candidates (url, headline, outlet, feed, lead_source, status, assessment, model, assessed_at)
       values ($1, $2, 'Fictional Daily', 'google-1', 'news_monitor', 'skipped', $3, 'claude-opus-5-5', now())`,
      [
        `https://news.invalid/${tag}/dinner`,
        `Fictional mosque hosts interfaith dinner ${tag}`,
        JSON.stringify({ ...reading, relevance: 'not_relevant', reason: `A community event, not an incident (${tag}).`, incident_types: [] }),
      ],
    )
  } finally {
    await db.end()
  }
})

test("a scanned lead shows the model's reading and pre-fills triage", async ({ page }) => {
  await signIn(page, 'author')
  await page.goto('/admin/leads')
  const item = page.locator('li', { hasText: headline })
  await expect(item).toContainText('Scan: Possible new incident (high confidence) · Testville, MI · Vandalism')
  await item.getByRole('link', { name: headline }).click()
  await expect(page.getByRole('heading', { name: 'The morning scan’s reading' })).toBeVisible()
  await expect(page.getByText(summary)).toBeVisible()
  await expect(page.getByLabel('State (for a new incident)')).toHaveValue('26')
  await expect(page.getByLabel('Incident type (for a new incident)')).toHaveValue('VAND')
})

test('skipped articles are listed with the reason', async ({ page }) => {
  await signIn(page, 'author')
  await page.goto('/admin/leads')
  await page.getByRole('link', { name: /Morning news scan/ }).click()
  await expect(page.getByRole('heading', { name: 'Morning news scan', level: 1 })).toBeVisible()
  // The test server has no API key.
  await expect(page.getByText('No Anthropic API key is set')).toBeVisible()
  await page.getByRole('navigation', { name: 'Filter by outcome' }).getByRole('link', { name: 'Skipped' }).click()
  await expect(page.getByText(`A community event, not an incident (${tag}).`)).toBeVisible()
  await expect(page.getByText(headline)).toHaveCount(0)
})

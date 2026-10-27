import { afterEach, describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'
import robots from '@/app/robots'

async function siteWideHeaders() {
  const rules = await nextConfig.headers!()
  return rules.find((r) => r.source === '/:path*')!.headers
}

describe('pre-launch mode', () => {
  afterEach(() => {
    delete process.env.SITE_INDEXING
  })

  it('keeps every page out of search engines until launch', async () => {
    delete process.env.SITE_INDEXING
    expect(await siteWideHeaders()).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
    expect(robots().sitemap).toBeUndefined()
  })

  it('allows indexing once SITE_INDEXING=on', async () => {
    process.env.SITE_INDEXING = 'on'
    expect((await siteWideHeaders()).some((h) => h.key === 'X-Robots-Tag')).toBe(false)
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })
})

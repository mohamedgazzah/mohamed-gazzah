/**
 * Pre-launch mode. Until SITE_INDEXING=on, every response carries
 * `X-Robots-Tag: noindex` (next.config.ts) and robots.txt does not list the
 * sitemap, so a deployed site stays out of search engines while the name,
 * About page and first records are still being settled. Read at build time:
 * redeploy after changing it.
 */
export function indexingEnabled(): boolean {
  return process.env.SITE_INDEXING === 'on'
}

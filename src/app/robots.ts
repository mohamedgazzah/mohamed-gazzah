import type { MetadataRoute } from 'next'
import { indexingEnabled } from '@/lib/indexing'
import { absoluteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    // Before launch the sitemap is not advertised (see src/lib/indexing.ts).
    ...(indexingEnabled() ? { sitemap: absoluteUrl('/sitemap.xml') } : {}),
  }
}

import 'server-only'
import { revalidatePath } from 'next/cache'
import { incidentPath } from '@/lib/slug'

/**
 * Refresh statically generated public pages after a record goes live, changes
 * or is taken down. Safe to call outside a request (scripts, tests): there is
 * no cache to refresh there.
 */
export function revalidateRecord(id: string, slugs: (string | null | undefined)[] = []) {
  const paths = new Set<string>(['/', '/incidents', '/sitemap.xml', '/data'])
  for (const slug of slugs) if (slug) paths.add(incidentPath(id, slug))
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // Not inside a Next.js request: nothing to revalidate.
    }
  }
}

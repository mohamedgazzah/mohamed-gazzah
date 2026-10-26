/** URL slug from a title: lowercase ASCII, hyphens, at most 80 characters. */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return slug || 'record'
}

const RECORD_ID = /^((?:US|DEMO)-\d{4}-\d{4,})(?:-(.*))?$/

/** Split "/incidents/US-2026-0412-man-charged..." into id and slug. */
export function parseRecordParam(param: string): { id: string; slug: string | null } | null {
  const m = RECORD_ID.exec(decodeURIComponent(param))
  if (!m) return null
  return { id: m[1]!, slug: m[2] ?? null }
}

export function isRecordId(value: string): boolean {
  return /^(?:US|DEMO)-\d{4}-\d{4,}$/.test(value)
}

export function incidentPath(id: string, slug: string): string {
  return `/incidents/${id}-${slug}`
}

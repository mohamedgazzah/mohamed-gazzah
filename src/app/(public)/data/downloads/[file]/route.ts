import { releaseFile } from '@/server/public/releases'

/** Versioned dataset files: record-v2026.10.26.csv, .json, and their .sha256 checksums. */
export async function GET(_request: Request, ctx: RouteContext<'/data/downloads/[file]'>) {
  const { file } = await ctx.params
  const m = /^record-v(\d{4}\.\d{2}\.\d{2})\.(csv|json)(\.sha256)?$/.exec(file)
  if (!m) return new Response('Not found', { status: 404 })
  const [, version, ext, checksum] = m
  const release = await releaseFile(version!)
  if (!release) return new Response('Not found', { status: 404 })
  const sha = ext === 'csv' ? release.csvSha256 : release.jsonSha256
  const name = `record-v${version}.${ext}`
  const headers: Record<string, string> = {
    // A version never changes once published.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-SHA256': sha,
  }
  if (checksum) {
    return new Response(`${sha}  ${name}\n`, { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  return new Response(ext === 'csv' ? release.csv : release.json, {
    headers: {
      ...headers,
      'Content-Type': ext === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}

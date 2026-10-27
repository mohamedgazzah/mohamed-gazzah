const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Role addresses live on the site's own domain (example.org on localhost). */
function mailDomain(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '')
  return host.includes('.') && !/^[\d.]+$/.test(host) ? host : 'example.org'
}
const mail = mailDomain(siteUrl)

/** Project-wide settings. The name is a placeholder; change it here only. */
export const SITE = {
  name: 'The Record',
  fullName: 'The Record: Anti-Muslim Incidents in America',
  description:
    'A public, sourced record of anti-Muslim incidents in the United States, each linked to its sources and tracked through its legal outcome.',
  url: siteUrl,
  /** Role addresses only. Never list personal emails. Forward them with Cloudflare Email Routing (docs/DEPLOY.md). */
  emails: {
    editors: `editors@${mail}`,
    corrections: `corrections@${mail}`,
    privacy: `privacy@${mail}`,
    legal: `legal@${mail}`,
  },
  dataLicense: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  codeLicense: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  publisher: 'The Record',
} as const

export function absoluteUrl(path: string): string {
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`
}

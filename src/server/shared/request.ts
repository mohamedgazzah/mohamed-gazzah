import 'server-only'
import { BlockList, isIP } from 'node:net'
import { headers } from 'next/headers'

// Cloudflare's edge ranges, from cloudflare.com/ips (last changed September 2023).
// If Cloudflare adds a range, visitors behind it share one rate-limit key until
// the list is updated; nothing becomes spoofable.
const CLOUDFLARE_RANGES = {
  ipv4: [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
    '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
    '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  ],
  ipv6: ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'],
} as const

const cloudflare = new BlockList()
for (const type of ['ipv4', 'ipv6'] as const) {
  for (const range of CLOUDFLARE_RANGES[type]) {
    const [net, bits] = range.split('/')
    cloudflare.addSubnet(net!, Number(bits), type)
  }
}

export function isCloudflareIp(ip: string): boolean {
  const version = isIP(ip)
  return version !== 0 && cloudflare.check(ip, version === 4 ? 'ipv4' : 'ipv6')
}

/**
 * The visitor's IP, used only to derive HMAC rate-limit keys.
 *
 * Vercel overwrites X-Real-IP and X-Forwarded-For with the address that
 * connected to it. Behind Cloudflare's proxy that is a Cloudflare edge, and the
 * visitor is in CF-Connecting-IP. That header is believed only when the
 * connection really came from Cloudflare: anyone who reaches the origin
 * directly can send it.
 */
export function clientIpFrom(h: Pick<Headers, 'get'>): string {
  const peer = h.get('x-real-ip')?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const visitor = h.get('cf-connecting-ip')?.trim()
  if (peer && visitor && isCloudflareIp(peer) && isIP(visitor)) return visitor
  return peer ?? 'unknown'
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers())
}

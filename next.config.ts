import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

function origin(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

const analyticsOrigin = origin(process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT)
const turnstile = 'https://challenges.cloudflare.com'

// Static pages are prerendered and cached, so a per-request nonce is not
// possible; inline scripts are limited to Next's own payloads and the theme
// script. Everything else is same-origin or listed here.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile}${analyticsOrigin ? ` ${analyticsOrigin}` : ''}${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${turnstile}${analyticsOrigin ? ` ${analyticsOrigin}` : ''}${isDev ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  `frame-src ${turnstile}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const nextConfig: NextConfig = {
  // Lets tests build into a separate directory (NEXT_DIST_DIR=.next-e2e).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['sharp', 'pg'],
  experimental: {
    // Report form uploads. Vercel caps request bodies at 4.5 MB.
    serverActions: { bodySizeLimit: '4mb' },
  },
  async headers() {
    // Pre-launch mode, see src/lib/indexing.ts.
    const indexing = process.env.SITE_INDEXING === 'on'
    return [
      {
        source: '/:path*',
        headers: [
          ...(indexing ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]),
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
        ],
      },
      {
        // Map shapes live in a folder named by their content (scripts/build-geo.mjs).
        source: '/geo/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

export default nextConfig

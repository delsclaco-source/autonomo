import type { NextConfig } from 'next'

/**
 * Security headers.
 *
 * CSP is not here — it is set per-request in `proxy.ts` because it carries a
 * per-response nonce. Everything below is static and safe to apply globally.
 */
const securityHeaders = [
  // Force HTTPS for two years including subdomains. Vercel terminates TLS for
  // all three hosts, so there is no plaintext origin to break.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Stop the browser guessing a response is HTML/JS when the server said otherwise.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Leak only the origin cross-site. Customer request URLs can carry ids.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here needs these device APIs.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Legacy backstop; CSP frame-ancestors is the real control.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  // Do not advertise the framework version.
  poweredByHeader: false,

  // Fail the production build on type errors rather than shipping them.
  // Lint is not configurable here any more — Next 16 dropped the `eslint` key,
  // so linting runs as its own step (`npm run lint`) in CI.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Sales and admin dashboards must never appear in search results.
        //
        // Two patterns because `:path*` does not match the bare segment: with
        // only the first entry, `/sales` and `/admin` — the dashboard roots, the
        // pages most likely to be linked and crawled — shipped without the tag.
        source: '/(sales|admin)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        source: '/(sales|admin)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
    ]
  },
}

export default nextConfig

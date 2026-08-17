import 'server-only'
import { headers } from 'next/headers'

/**
 * Client IP, for per-address rate limits.
 *
 * `x-forwarded-for` is client-supplied in general, but on Vercel the platform
 * rewrites it at the edge, so the first entry is trustworthy here. Anywhere the
 * app is served without that guarantee this degrades to advisory — which is why
 * every caller pairs it with a per-phone limit as the primary control.
 *
 * Shared by the login form and the public request form. Two copies of this would
 * become two different definitions of "the same address" the moment one got a fix.
 */
export async function clientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

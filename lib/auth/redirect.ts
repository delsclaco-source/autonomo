/**
 * Post-login redirect target sanitisation.
 *
 * Shared by the proxy and by the login page so there is exactly one definition of
 * "safe destination". Duplicating this logic is how open redirects appear: one
 * copy gets a fix and the other does not.
 *
 * No `server-only` marker and no imports — the proxy runs on the edge runtime and
 * the login page runs on Node, so this has to stay a pure function.
 */

/**
 * Paths a `?next=` value is allowed to point at, plus anything beneath them.
 *
 * These are *visible* URLs, not internal route paths. On sales.autonomo.id the
 * user sees `/leads`; `proxy.ts` rewrites it to the internal `/sales/leads`.
 * Listing `/sales` here would only ever match a URL the proxy 404s.
 *
 * The list is deliberately not split per area. A cross-area entry cannot become
 * an open redirect — every value here is a same-origin path, and a sales path
 * requested on the customer host simply 404s.
 */
const ALLOWED_PREFIXES = [
  // customer
  '/request',
  '/katalog',
  '/top-diskon',
  // sales
  '/leads',
  '/crm',
  '/topup',
  '/referral',
  // admin
  '/users',
  '/credits',
  '/pricing',
  '/analytics',
]

/**
 * Return `raw` if it is a same-origin path we are willing to send a
 * freshly-authenticated user to, otherwise null.
 *
 * Rejected: absolute URLs, protocol-relative `//evil.example` (a browser reads
 * that as a host, not a path), backslashes (some parsers normalise `\` to `/`),
 * encoded slashes that could smuggle either of the above past this check, and any
 * path outside the allowlist.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.includes('\\')) return null
  if (raw.includes('%2f') || raw.includes('%2F') || raw.includes('%5c') || raw.includes('%5C')) {
    return null
  }
  if (raw.length > 512) return null

  const path = raw.split('?')[0]
  const allowed = ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
  return allowed ? raw : null
}

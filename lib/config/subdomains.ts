/**
 * Subdomain routing configuration.
 *
 * Three dashboards are served from one Next.js deployment. `proxy.ts` inspects
 * the request Host header and rewrites into an internal path namespace so each
 * area gets its own route group and layout without leaking the namespace into
 * the visible URL.
 *
 *   autonomo.id / www.autonomo.id  ->  app/(customer)/...        (no prefix)
 *   sales.autonomo.id              ->  app/(sales)/sales/...     (/sales prefix)
 *   admin.autonomo.id              ->  app/(admin)/admin/...     (/admin prefix)
 *
 * Route groups alone cannot disambiguate the three areas because parentheses are
 * stripped from the URL — `(customer)/page.tsx` and `(sales)/page.tsx` would both
 * resolve to `/` and collide at build time. The real `/sales` and `/admin`
 * segments keep them distinct; the proxy hides them from the user.
 */

export const ROLES = ['customer', 'sales', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const AREAS = ['customer', 'sales', 'admin'] as const
export type Area = (typeof AREAS)[number]

/** Internal path prefix each area's routes live under inside `app/`. */
export const AREA_PREFIX: Record<Area, string> = {
  customer: '',
  sales: '/sales',
  admin: '/admin',
}

/** Roles allowed to access each area. */
export const AREA_ROLES: Record<Area, readonly Role[]> = {
  customer: ['customer'],
  sales: ['sales'],
  admin: ['admin'],
}

/**
 * Root domain the three subdomains hang off. Set `NEXT_PUBLIC_ROOT_DOMAIN` in
 * Vercel; defaults to the production apex.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'autonomo.id'

/**
 * Explicit host-to-area map, for deployments whose hostnames cannot express the
 * subdomain shape the label rule below expects.
 *
 * A `*.vercel.app` deployment is exactly that case: Vercel reserves nested
 * subdomains, so `sales.autonomo-id.vercel.app` cannot be claimed and the only
 * name available is a flat one like `sales-autonomo-id.vercel.app` — whose first
 * label is the entire name, not `sales`. Without this map the sales and admin
 * areas are unreachable on the free domain.
 *
 * Bare hostnames, no port, no scheme. Leave all three unset on a deployment that
 * owns real subdomains; the label rule then handles everything and this map costs
 * one failed lookup per request.
 *
 * Read through static `process.env.X` references because `NEXT_PUBLIC_` values
 * are inlined at build time — a computed key would come back undefined.
 */
const AREA_HOSTS: Record<Area, string | undefined> = {
  customer: process.env.NEXT_PUBLIC_HOST_CUSTOMER,
  sales: process.env.NEXT_PUBLIC_HOST_SALES,
  admin: process.env.NEXT_PUBLIC_HOST_ADMIN,
}

/**
 * Match a hostname against the configured map.
 *
 * `AREAS` order decides a duplicate — customer first, then sales, then admin — so
 * a misconfiguration pointing two areas at one host resolves to the least
 * privileged of them rather than the most.
 */
function areaFromHostMap(hostname: string): Area | null {
  for (const area of AREAS) {
    if (AREA_HOSTS[area]?.toLowerCase() === hostname) return area
  }
  return null
}

/**
 * Hosts allowed to resolve to a privileged area.
 *
 * Without this, a Host header of `sales.attacker.example` pointed at the
 * deployment would resolve to the sales area. Vercel already rejects hosts that
 * are not attached to the project, so this is defence in depth rather than the
 * only control — but it costs nothing and removes the reliance.
 *
 * Vercel preview deployments (`*.vercel.app`) and local dev are allowed so the
 * subdomain flow stays testable; both are non-production surfaces.
 */
function isTrustedHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname === '127.0.0.1') return true
  if (hostname.endsWith('.vercel.app')) return true
  return hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`)
}

/**
 * Resolve an area from a Host header.
 *
 * Returns `customer` for the apex, `www`, untrusted hosts, and anything
 * unrecognised — the safest default, since customer routes are the only public
 * ones. An unknown host can therefore never reach the admin shell.
 *
 * The explicit map is consulted before the label rule, but only after the trust
 * check: order matters, because a mapped host must still be one this deployment
 * accepts. Checking the map first would let a stale or mistyped env value name a
 * host the trust rule was written to exclude.
 */
export function areaFromHost(host: string | null): Area {
  if (!host) return 'customer'

  const hostname = host.split(':')[0].toLowerCase()
  if (!isTrustedHost(hostname)) return 'customer'

  const mapped = areaFromHostMap(hostname)
  if (mapped) return mapped

  const label = hostname.split('.')[0]
  if (label === 'sales') return 'sales'
  if (label === 'admin') return 'admin'
  return 'customer'
}

/** Public origin for an area, used when building absolute cross-area links. */
export function originForArea(area: Area, currentHost: string, protocol: string): string {
  const [hostname, port] = currentHost.split(':')
  const isLocal = hostname === 'localhost' || hostname.endsWith('.localhost')

  const parts = hostname.split('.')
  const root = isLocal
    ? 'localhost'
    : parts.length > 2 && ['sales', 'admin', 'www'].includes(parts[0])
      ? parts.slice(1).join('.')
      : hostname

  const target = area === 'customer' ? root : `${area}.${root}`
  return `${protocol}//${target}${port ? `:${port}` : ''}`
}

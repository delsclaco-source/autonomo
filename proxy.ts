import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AREA_PREFIX, areaFromHost } from '@/lib/config/subdomains'
import { SESSION_COOKIE } from '@/lib/auth/cookie'
import { safeNextPath } from '@/lib/auth/redirect'

/**
 * Subdomain router and security header layer.
 *
 * Renamed from `middleware.ts` — Next.js 16 calls this convention `proxy`.
 *
 * Three jobs:
 *   1. Rewrite each subdomain into its internal path namespace so the three
 *      dashboards share one deployment while keeping separate layouts.
 *   2. Optimistic auth redirect — bounce obviously-signed-out visitors to the
 *      login page before rendering.
 *   3. Emit a per-request CSP nonce.
 *
 * Job 2 is a UX shortcut, NOT access control. The proxy only sees whether a
 * cookie exists, not whether it is valid or what role it carries. Every page and
 * every Server Function re-checks with `requireUser()` against the database.
 */

/**
 * Paths inside each area that do not require a session.
 *
 * `/gabung` is the sales marketing page. It has to be reachable without a
 * cookie or the sales subdomain has no front door: a recruit who lands on
 * sales.autonomo.id is redirected to a login form for an account nobody has
 * told them how to get.
 */
const PUBLIC_PATHS = ['/login', '/verify', '/gabung']

/**
 * Public paths that also live *outside* any area namespace.
 *
 * `app/login/page.tsx` is one route serving all three areas — it reads the host
 * itself to pick its copy. Prefixing it would rewrite sales.autonomo.id/login to
 * `/sales/login`, which does not exist.
 *
 * `/gabung` is deliberately not in this list: it is sales-area content and lives
 * at `app/(sales)/sales/gabung`, so it still needs the rewrite.
 */
const SHARED_PATHS = ['/login', '/verify']

function matchesPath(list: readonly string[], pathname: string): boolean {
  return list.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isPublic(pathname: string): boolean {
  return matchesPath(PUBLIC_PATHS, pathname)
}

/**
 * Sanitise the post-login redirect target.
 *
 * Lives in lib/auth/redirect.ts so the login page applies the identical rule when
 * it reads `?next=` back out of the URL.
 */

function buildCsp(nonce: string, isDev: boolean): string {
  // Next.js injects inline bootstrap scripts; the nonce covers them.
  // `strict-dynamic` lets those trusted scripts load chunks without host allowlists.
  // Dev needs 'unsafe-eval' for React Refresh — production does not.
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // next/font inlines font-face CSS; Tailwind emits a static sheet.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const area = areaFromHost(request.headers.get('host'))
  const prefix = AREA_PREFIX[area]
  const isDev = process.env.NODE_ENV !== 'production'

  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = buildCsp(nonce, isDev)

  // Forward the nonce so Server Components can attach it to any inline script.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  function withSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('content-security-policy', csp)
    return response
  }

  // Block direct access to internal namespaces from the wrong host. Without this,
  // autonomo.id/admin/users would render the admin UI shell to anyone.
  if (area === 'customer' && (pathname.startsWith('/sales') || pathname.startsWith('/admin'))) {
    return withSecurityHeaders(new NextResponse(null, { status: 404 }))
  }

  const hasSession = request.cookies.has(SESSION_COOKIE)

  // Sales and admin areas sit entirely behind auth; the customer area is public.
  const needsAuth = (area === 'sales' || area === 'admin') && !isPublic(pathname)

  if (needsAuth && !hasSession) {
    const url = request.nextUrl.clone()
    url.search = ''

    // A signed-out visitor at the root of the sales subdomain is far more likely
    // to be a recruit than someone who lost their session: they typed the bare
    // hostname. Sending them to a login form for an account nobody has offered
    // them is a dead end, so the root goes to the marketing page instead. Deep
    // links (`/leads`, `/crm`) still go to login — whoever follows one already
    // has an account and wants to land where they were headed.
    if (area === 'sales' && pathname === '/') {
      url.pathname = '/gabung'
      return withSecurityHeaders(NextResponse.redirect(url))
    }

    url.pathname = '/login'

    const target = safeNextPath(pathname + search)
    if (target && target !== '/') {
      url.searchParams.set('next', target)
    }

    return withSecurityHeaders(NextResponse.redirect(url))
  }

  if (!prefix) {
    return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  // Shared routes live at the top level (`app/login`), not inside an area
  // namespace, so they must not be prefixed. Area-owned public pages like
  // `/gabung` skip the auth check above but still get rewritten below.
  if (matchesPath(SHARED_PATHS, pathname)) {
    return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  const url = request.nextUrl.clone()

  // Idempotent prefixing. Links inside each area are written *without* the area
  // prefix (`/leads`, not `/sales/leads`) because that is the URL the user sees.
  // The guard exists anyway: a stray prefixed link would otherwise rewrite to
  // `/sales/sales/leads` and 404, and that failure looks like a missing page
  // rather than a routing bug. Cheap insurance against the whole dashboard
  // disappearing over one bad href.
  const alreadyPrefixed = pathname === prefix || pathname.startsWith(`${prefix}/`)

  url.pathname = alreadyPrefixed ? pathname : `${prefix}${pathname === '/' ? '' : pathname}`

  return withSecurityHeaders(
    NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
  )
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - api/webhooks  (payment callbacks; cross-subdomain by design)
     * - api/cron      (Vercel Cron hits the apex host with no cookie; the
     *                  rewrite would be a no-op anyway, and the route
     *                  authenticates itself with CRON_SECRET)
     * - _next/static, _next/image  (build output)
     * - static asset extensions, anchored to the end of the path
     *
     * The extension clause is an anchored allowlist, not `.*\..*`. The loose
     * version excluded any path containing a dot anywhere — so
     * `autonomo.id/admin/users/a.b` skipped the proxy entirely, taking with it
     * both the wrong-host 404 and the CSP header.
     */
    '/((?!api/webhooks|api/cron|_next/static|_next/image|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|txt|xml|webmanifest|map)$).*)',
  ],
}

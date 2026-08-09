import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { and, eq, gt, lt } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { sessions, users } from '@/lib/db/schema'
import type { Area, Role } from '@/lib/config/subdomains'
import { AREA_ROLES } from '@/lib/config/subdomains'
import { SESSION_COOKIE } from './cookie'

/**
 * Session handling.
 *
 * The cookie holds an opaque random token only — no role, no user id, nothing a
 * client could tamper with to escalate. Role is re-read from the database on
 * every server-side check, so revoking or suspending a user takes effect on
 * their next request rather than when their token happens to expire.
 *
 * The database stores an HMAC of the token, never the token itself. A leaked
 * database dump therefore does not hand an attacker a set of usable session
 * cookies — the same reason passwords are not stored in plaintext. HMAC rather
 * than a plain hash so the key must also leak; lookup stays a single indexed
 * read because the digest is deterministic.
 *
 * Cookies are host-only (no `Domain` attribute), scoping each session to the
 * subdomain that issued it. An admin session is never sent to sales.autonomo.id.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const TOKEN_BYTES = 32

export type SessionUser = {
  id: string
  role: Role
  phone: string
  fullName: string | null
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters')
  }
  return secret
}

/** Deterministic HMAC of a session token, used as the primary key. */
function hashToken(token: string): string {
  return createHmac('sha256', sessionSecret()).update(token).digest('base64url')
}

/**
 * Constant-time comparison, used when a caller has both halves in hand.
 * Length is compared first because `timingSafeEqual` throws on mismatched sizes.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
    // No `domain` — intentionally host-only so sessions do not cross subdomains.
  }
}

/**
 * Create a session and set the cookie. Call only after OTP verification.
 *
 * Any existing session for this browser is destroyed first: reusing a
 * pre-authentication session id would let an attacker who planted a cookie ride
 * the victim's login (session fixation).
 */
export async function createSession(userId: string, area: Area, userAgent?: string) {
  await destroySession()

  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await getDb().insert(sessions).values({
    id: hashToken(token),
    userId,
    area,
    userAgent: userAgent?.slice(0, 512),
    expiresAt,
  })

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt))

  return { expiresAt }
}

/**
 * Read the current user, or null.
 *
 * Validates that the session has not expired, that the user is not suspended,
 * that their phone is verified, and that the session was issued for `area`.
 * Pass `area` from the layout or server action doing the check; a session minted
 * on `sales.` must not authorise an admin page even if the cookie arrives there.
 */
export async function getSessionUser(area?: Area): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const rows = await getDb()
    .select({
      userId: users.id,
      role: users.role,
      phone: users.phone,
      fullName: users.fullName,
      suspendedAt: users.suspendedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
      sessionArea: sessions.area,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (row.suspendedAt) return null
  if (!row.phoneVerifiedAt) return null
  if (area && row.sessionArea !== area) return null
  if (area && !AREA_ROLES[area].includes(row.role)) return null

  return { id: row.userId, role: row.role, phone: row.phone, fullName: row.fullName }
}

/**
 * Require a signed-in user for `area`, or throw.
 *
 * Use this at the top of every server action and protected page. The proxy role
 * check is an optimistic UX guard only — Server Functions are POSTs to the page
 * route and a matcher change can silently drop proxy coverage, so authorisation
 * has to be re-asserted here.
 */
export async function requireUser(area: Area): Promise<SessionUser> {
  const user = await getSessionUser(area)
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

/** Require a signed-in user whose role is in `allowed`, or throw. */
export async function requireRole(area: Area, allowed: readonly Role[]): Promise<SessionUser> {
  const user = await requireUser(area)
  if (!allowed.includes(user.role)) throw new Error('FORBIDDEN')
  return user
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return

  await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)))
  jar.delete(SESSION_COOKIE)
}

/** Revoke every session for a user — call on suspend or on user request. */
export async function destroyAllSessionsFor(userId: string) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId))
}

/** Delete expired rows. Wire to a Vercel Cron job. */
export async function pruneExpiredSessions() {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()))
}

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env'
import { revokeStaleLeads, sweepDueAuctions } from '@/lib/auction/settle'

/**
 * Vercel Cron entry point for the auction lifecycle.
 *
 * The only route handler in this codebase. Everything else is a Server Action,
 * because Server Actions carry the session cookie and re-check the user; a cron
 * invocation has no user, so it needs a URL and a shared secret instead.
 *
 * The handler is deliberately thin. All of the locking, ordering, and
 * idempotency lives in `lib/auction/settle.ts`, which is also what the lazy
 * close-on-read path calls — one implementation, so a page render and a cron tick
 * cannot settle an auction two different ways.
 *
 * `force-dynamic` plus `maxDuration` because this is work, not a document: Next
 * must never cache the response, and a sweep of fifty auctions is fifty
 * transactions.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Constant-time bearer check.
 *
 * A plain `===` on a secret leaks its prefix length through timing. The length
 * guard before the compare is not a leak of the same kind — `timingSafeEqual`
 * throws on mismatched lengths, and the secret's length is fixed by `lib/env.ts`
 * at 32 characters minimum, not by anything an attacker supplies.
 */
function authorised(header: string | null, secret: string): boolean {
  if (!header?.startsWith('Bearer ')) return false

  const provided = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(secret)

  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

export async function GET(request: Request) {
  if (!authorised(request.headers.get('authorization'), serverEnv().CRON_SECRET)) {
    // 401 with no body. A cron endpoint that explains why it rejected you is
    // telling an unauthenticated caller what it does.
    return new NextResponse(null, { status: 401 })
  }

  const now = new Date()

  // Settle first, then revoke. A lead awarded in this same tick is nowhere near
  // its 24 hour contact deadline, so the order costs nothing there — but running
  // the revoke sweep first would mean a request freed by a revocation waits a
  // full cycle before anything looks at it again.
  const settled = await sweepDueAuctions(50, now)
  const revoked = await revokeStaleLeads(50, now)

  const tally = settled.reduce<Record<string, number>>((acc, result) => {
    const key = result.ok ? result.outcome : `error:${result.reason}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({ ok: true, settled: settled.length, tally, revoked })
}

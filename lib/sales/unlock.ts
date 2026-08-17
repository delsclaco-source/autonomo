import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  auctions,
  dailyUnlockQuota,
  leads,
  requests,
  salesProfile,
  tokenLedger,
  unlockPricingRules,
  type CarTier,
} from '@/lib/db/schema'
import { FREEMIUM_DAILY_UNLOCKS, jakartaDay } from './queries'

/**
 * Lead unlock — the one place tokens are spent.
 *
 * This is the *pool* lane. A request reaches it two ways: the customer named a
 * price nobody could take seriously (flagged at submission), or its auction
 * closed with no valid bid. The auction lane never comes through here and never
 * spends a token; see `lib/auction/settle.ts`.
 *
 * Everything happens inside a single transaction that begins by taking a row
 * lock on the sales user's profile (`SELECT ... FOR UPDATE`). That lock is what
 * makes the balance check meaningful: without it, the same sales user unlocking
 * two leads from a phone and a laptop at the same instant would both read the old
 * balance and both pass, spending tokens they do not have. CLAUDE.md § 3.
 *
 * Lock order is `sales_profile → auctions → requests`, globally. The auction row
 * is the mutex the settlement path also queues on, which is what stops a
 * well-funded sales user from buying a lead out of an auction that is still
 * running.
 *
 * Four independent guards, deliberately overlapping:
 *
 *  1. The profile row lock serialises this user's spending.
 *  2. The auction row lock plus its status check refuses a request that is being
 *     competed for right now.
 *  3. `leads_request_key` (UNIQUE on request_id) makes a second unlock of the same
 *     request impossible even if the locks were somehow bypassed — the database
 *     refuses the insert, so nobody is charged for a lead another sales user
 *     already owns. The constraint is per request, not per (request, sales): one
 *     request belongs to exactly one sales user, so a customer is never contacted
 *     by two of them about the same request.
 *  4. `token_ledger.idempotency_key` is `unlock:<lead_id>`, so a retry of this
 *     transaction cannot produce a second debit for the same lead.
 *
 * The price is read from `unlock_pricing_rules` inside the transaction and then
 * frozen onto the `leads` row. A later admin price change must not rewrite what a
 * sales user was actually charged.
 */

export type UnlockResult =
  | { ok: true; leadId: string; tokenCost: number; balanceAfter: number }
  | {
      ok: false
      reason:
        | 'not_found'
        /** Another sales user already owns this request. Not "you already did". */
        | 'already_taken'
        /** The auction on this request is still running. It is not for sale yet. */
        | 'in_auction'
        | 'insufficient_tokens'
        | 'daily_limit'
        | 'no_profile'
      /** Populated for `insufficient_tokens` so the UI can name the shortfall. */
      tokenCost?: number
      balance?: number
    }

export async function unlockLead(salesId: string, requestId: string): Promise<UnlockResult> {
  return getDb().transaction(async (tx) => {
    // The lock comes first, before any read whose value we act on. Taking it
    // after reading the balance would leave the classic check-then-act window.
    const [profile] = await tx
      .select({
        tokenBalance: salesProfile.tokenBalance,
        premiumUntil: salesProfile.premiumUntil,
      })
      .from(salesProfile)
      .where(eq(salesProfile.userId, salesId))
      .for('update')
      .limit(1)

    if (!profile) return { ok: false, reason: 'no_profile' } as const

    // Second in the lock order, before `requests`. An auction that is still open
    // is not merchandise: the sales users bidding on it have committed real
    // margin, and letting someone with a big balance buy the contact out from
    // under them would make every future auction a waste of their time.
    const [auction] = await tx
      .select({ id: auctions.id, status: auctions.status })
      .from(auctions)
      .where(eq(auctions.requestId, requestId))
      .for('update')
      .limit(1)

    if (auction?.status === 'open') return { ok: false, reason: 'in_auction' } as const

    const [request] = await tx
      .select({
        id: requests.id,
        brand: requests.brand,
        tier: requests.tier,
        status: requests.status,
        customerId: requests.customerId,
      })
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1)

    // `pool` is the only buyable status. `auction` means it is being competed
    // for, `claimed` means someone already has it, and the legacy `open` value
    // predates the three-lane split — none of them are for sale here.
    if (!request || request.status !== 'pool') {
      return { ok: false, reason: 'not_found' } as const
    }
    if (request.customerId === salesId) {
      return { ok: false, reason: 'not_found' } as const
    }

    // The question is "does anyone hold this request", not "do I hold it". With
    // one lead per request, a row from any sales user ends the matter — and
    // filtering by `salesId` here would let this path charge for an insert that
    // `leads_request_key` is about to reject.
    const [existing] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.requestId, requestId))
      .limit(1)

    if (existing) return { ok: false, reason: 'already_taken' } as const

    const premium = Boolean(profile.premiumUntil && profile.premiumUntil > new Date())
    const day = jakartaDay()

    if (!premium) {
      const [quota] = await tx
        .select({ count: dailyUnlockQuota.count })
        .from(dailyUnlockQuota)
        .where(and(eq(dailyUnlockQuota.salesId, salesId), eq(dailyUnlockQuota.day, day)))
        .limit(1)

      if ((quota?.count ?? 0) >= FREEMIUM_DAILY_UNLOCKS) {
        return { ok: false, reason: 'daily_limit' } as const
      }
    }

    const tokenCost = await priceFor(tx, request.tier, request.brand)

    if (profile.tokenBalance < tokenCost) {
      return {
        ok: false,
        reason: 'insufficient_tokens',
        tokenCost,
        balance: profile.tokenBalance,
      } as const
    }

    const [lead] = await tx
      .insert(leads)
      .values({
        requestId,
        salesId,
        tier: request.tier,
        tokenCost,
        // The lane this lead came from. `auction` rows cost zero tokens, so
        // without this column a settled auction and a paid unlock are
        // indistinguishable afterwards — and `revokeStaleLeads` only sweeps
        // auction awards, because a pool lead was paid for and taking it back
        // needs a refund decision, not a cron job.
        source: 'pool',
      })
      .returning({ id: leads.id })

    const balanceAfter = profile.tokenBalance - tokenCost

    await tx.insert(tokenLedger).values({
      salesId,
      delta: -tokenCost,
      balanceAfter,
      reason: 'unlock',
      refId: lead.id,
      idempotencyKey: `unlock:${lead.id}`,
    })

    await tx
      .update(salesProfile)
      .set({ tokenBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(salesProfile.userId, salesId))

    if (!premium) {
      await tx
        .insert(dailyUnlockQuota)
        .values({ salesId, day, count: 1 })
        .onConflictDoUpdate({
          target: [dailyUnlockQuota.salesId, dailyUnlockQuota.day],
          set: { count: sql`${dailyUnlockQuota.count} + 1` },
        })
    }

    return { ok: true, leadId: lead.id, tokenCost, balanceAfter } as const
  })
}

/**
 * Price for one tier, read inside the caller's transaction.
 *
 * A brand-specific active rule wins over the tier default. Defaults match the
 * floor of each band in CLAUDE.md § 2 and apply only when an admin has not
 * configured that tier — an unconfigured install should undercharge, not
 * overcharge.
 */
type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

async function priceFor(tx: Tx, tier: CarTier, brand: string): Promise<number> {
  const rules = await tx
    .select({ tokenCost: unlockPricingRules.tokenCost, brand: unlockPricingRules.brand })
    .from(unlockPricingRules)
    .where(and(eq(unlockPricingRules.tier, tier), eq(unlockPricingRules.active, true)))

  const branded = rules.find((r) => r.brand === brand)
  if (branded) return branded.tokenCost

  const generic = rules.find((r) => !r.brand)
  if (generic) return generic.tokenCost

  return { low: 5, mid: 20, high: 50 }[tier]
}

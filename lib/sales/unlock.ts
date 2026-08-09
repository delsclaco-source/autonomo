import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
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
 * Everything happens inside a single transaction that begins by taking a row
 * lock on the sales user's profile (`SELECT ... FOR UPDATE`). That lock is what
 * makes the balance check meaningful: without it, the same sales user unlocking
 * two leads from a phone and a laptop at the same instant would both read the old
 * balance and both pass, spending tokens they do not have. CLAUDE.md § 3.
 *
 * Three independent guards, deliberately overlapping:
 *
 *  1. The profile row lock serialises this user's spending.
 *  2. `leads_request_sales_key` (UNIQUE on request_id, sales_id) makes a double
 *     unlock of the same lead impossible even if the lock were somehow bypassed —
 *     the database refuses the second insert, so nobody is charged twice.
 *  3. `token_ledger.idempotency_key` is `unlock:<lead_id>`, so a retry of this
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
        | 'already_unlocked'
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

    // `flagged` requests are excluded here as well as in the marketplace query.
    // The listing hiding them is a UI decision; this is the rule.
    if (!request || request.status !== 'open') {
      return { ok: false, reason: 'not_found' } as const
    }
    if (request.customerId === salesId) {
      return { ok: false, reason: 'not_found' } as const
    }

    const [existing] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.requestId, requestId), eq(leads.salesId, salesId)))
      .limit(1)

    if (existing) return { ok: false, reason: 'already_unlocked' } as const

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

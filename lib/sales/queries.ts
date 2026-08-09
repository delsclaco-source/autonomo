import 'server-only'
import { and, count, desc, eq, gte, inArray, notInArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  dailyUnlockQuota,
  leads,
  requests,
  salesProfile,
  tokenLedger,
  unlockPricingRules,
  users,
  type CarTier,
} from '@/lib/db/schema'

/**
 * Read queries for the sales dashboard.
 *
 * The rule this module exists to enforce: a customer's name and phone number are
 * only ever selected for a request the calling sales user has already unlocked.
 * The marketplace query does not select those columns at all, so there is no path
 * where they reach a response and get filtered in the component — a filter can be
 * removed by accident, a column that was never selected cannot leak.
 *
 * Unlock prices come from `unlock_pricing_rules`, never from a constant here.
 * CLAUDE.md § 2 requires them to be admin-configurable, and a hardcoded price
 * would also disagree with what the unlock transaction actually charges.
 */

/** Freemium sales users get 3 unlocks per day. */
export const FREEMIUM_DAILY_UNLOCKS = 3

/** Jakarta day key, matching `daily_unlock_quota.day`. */
export function jakartaDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Jakarta month key (`YYYY-MM`), matching `referral_quota.month`. */
export function jakartaMonth(now = new Date()): string {
  return jakartaDay(now).slice(0, 7)
}

/**
 * Instant the current Jakarta month began, as UTC.
 *
 * Needed because `token_ledger.createdAt` is a timestamp, not a month key, so a
 * month filter has to be expressed as an absolute cut-off. Jakarta is UTC+7 with
 * no DST, hence the fixed offset: 2026-08-01 00:00 WIB is 2026-07-31 17:00 UTC.
 * Filtering on the UTC month start instead pulls in the first seven hours of
 * August 1 WIB while excluding the last seven of July 31 — the referral counter
 * shown to the user then disagrees with the `referral_quota` row the grant
 * transaction actually enforces the 300-token cap against.
 */
export function jakartaMonthStart(now = new Date()): Date {
  const [year, month] = jakartaMonth(now).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 7 * 60 * 60 * 1000)
}

export type SalesOverview = {
  tokenBalance: number
  premium: boolean
  verified: boolean
  brands: string[]
  referralCode: string
  unlocksToday: number
  dailyLimit: number | null
  leadsPending: number
  leadsNegotiation: number
  leadsWon: number
  leadsLost: number
}

export async function salesOverview(salesId: string): Promise<SalesOverview> {
  const db = getDb()

  const [profile] = await db
    .select({
      tokenBalance: salesProfile.tokenBalance,
      premiumUntil: salesProfile.premiumUntil,
      verifiedBadge: salesProfile.verifiedBadge,
      brands: salesProfile.brands,
      referralCode: salesProfile.referralCode,
    })
    .from(salesProfile)
    .where(eq(salesProfile.userId, salesId))
    .limit(1)

  const [quota] = await db
    .select({ count: dailyUnlockQuota.count })
    .from(dailyUnlockQuota)
    .where(
      and(eq(dailyUnlockQuota.salesId, salesId), eq(dailyUnlockQuota.day, jakartaDay())),
    )
    .limit(1)

  const byStatus = await db
    .select({ status: leads.status, total: count() })
    .from(leads)
    .where(eq(leads.salesId, salesId))
    .groupBy(leads.status)

  const tally = (status: string) =>
    Number(byStatus.find((row) => row.status === status)?.total ?? 0)

  const premium = Boolean(profile?.premiumUntil && profile.premiumUntil > new Date())

  return {
    tokenBalance: profile?.tokenBalance ?? 0,
    premium,
    verified: profile?.verifiedBadge ?? false,
    brands: profile?.brands ?? [],
    referralCode: profile?.referralCode ?? '',
    unlocksToday: quota?.count ?? 0,
    // Premium removes the daily cap; freemium keeps it. `null` means uncapped.
    dailyLimit: premium ? null : FREEMIUM_DAILY_UNLOCKS,
    leadsPending: tally('pending'),
    leadsNegotiation: tally('negotiation'),
    leadsWon: tally('won'),
    leadsLost: tally('lost'),
  }
}

/**
 * Current unlock price per tier, keyed by tier. Brand-specific rules win.
 *
 * Only meaningful when every price shown comes from the same brand. The lead
 * marketplace spans brands, so it resolves prices per row instead — see
 * `marketplaceLeads`. Calling this without `brand` there was the bug that made
 * the quoted price diverge from the charged one.
 */
export async function unlockPrices(brand?: string): Promise<Record<CarTier, number>> {
  const rules = await getDb()
    .select({
      tier: unlockPricingRules.tier,
      tokenCost: unlockPricingRules.tokenCost,
      brand: unlockPricingRules.brand,
    })
    .from(unlockPricingRules)
    .where(eq(unlockPricingRules.active, true))

  // Defaults mirror the bands in CLAUDE.md § 2 and only apply when an admin has
  // not configured a tier yet. They are the floor of each published band, so an
  // unconfigured install never overcharges.
  const prices: Record<CarTier, number> = { low: 5, mid: 20, high: 50 }

  // Generic rules first, then brand-specific ones overwrite them. Two passes
  // rather than one because the rule rows arrive unordered — a brand rule read
  // before its generic counterpart would otherwise be clobbered by it.
  for (const rule of rules) {
    if (!rule.brand) prices[rule.tier] = rule.tokenCost
  }
  if (brand) {
    for (const rule of rules) {
      if (rule.brand === brand) prices[rule.tier] = rule.tokenCost
    }
  }

  return prices
}

export type MarketplaceLead = {
  requestId: string
  brand: string
  model: string
  variant: string | null
  discountWanted: number
  tier: CarTier
  purchaseTimeframe: string | null
  notes: string | null
  createdAt: Date
  /** How many sales users already bought this lead. */
  competitors: number
  tokenCost: number
}

/**
 * Hot leads this sales user has not unlocked yet.
 *
 * Deliberately selects no customer identity columns. `flagged` requests are
 * excluded — those are pending fraud review and selling them would charge tokens
 * for a lead the platform itself does not trust.
 */
export async function marketplaceLeads(
  salesId: string,
  options: { brand?: string; tier?: CarTier; limit?: number } = {},
): Promise<MarketplaceLead[]> {
  const db = getDb()
  const limit = Math.min(options.limit ?? 30, 60)

  const alreadyUnlocked = db
    .select({ requestId: leads.requestId })
    .from(leads)
    .where(eq(leads.salesId, salesId))

  const conditions = [
    eq(requests.status, 'open'),
    notInArray(requests.id, alreadyUnlocked),
  ]
  if (options.brand) conditions.push(eq(requests.brand, options.brand))
  if (options.tier) conditions.push(eq(requests.tier, options.tier))

  const rows = await db
    .select({
      requestId: requests.id,
      brand: requests.brand,
      model: requests.model,
      variant: requests.variant,
      discountWanted: requests.discountWanted,
      tier: requests.tier,
      purchaseTimeframe: requests.purchaseTimeframe,
      notes: requests.notes,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(and(...conditions))
    .orderBy(desc(requests.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  const competitorRows = await db
    .select({ requestId: leads.requestId, total: count() })
    .from(leads)
    .where(
      inArray(
        leads.requestId,
        rows.map((r) => r.requestId),
      ),
    )
    .groupBy(leads.requestId)

  const competitors = new Map(competitorRows.map((r) => [r.requestId, Number(r.total)]))

  // Harga unlock per tier + brand. Generic rules apply to all brands; brand-specific
  // rules override the tier default. The charge logic in `unlock.ts` applies the
  // identical precedence so the marketplace never lies about the cost.
  const rules = await db
    .select({
      tier: unlockPricingRules.tier,
      tokenCost: unlockPricingRules.tokenCost,
      brand: unlockPricingRules.brand,
    })
    .from(unlockPricingRules)
    .where(eq(unlockPricingRules.active, true))

  const priceMap = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.tier}:${row.brand}`
    const branded = rules.find((r) => r.tier === row.tier && r.brand === row.brand)
    if (branded) {
      priceMap.set(key, branded.tokenCost)
      continue
    }
    const generic = rules.find((r) => r.tier === row.tier && !r.brand)
    if (generic) {
      priceMap.set(key, generic.tokenCost)
      continue
    }
    // Fallback defaults mirror the floor of CLAUDE.md § 2 bands.
    priceMap.set(key, { low: 5, mid: 20, high: 50 }[row.tier])
  }

  return rows.map((row) => ({
    ...row,
    discountWanted: Number(row.discountWanted),
    competitors: competitors.get(row.requestId) ?? 0,
    tokenCost: priceMap.get(`${row.tier}:${row.brand}`) ?? 5,
  }))
}

export type UnlockedLead = {
  leadId: string
  requestId: string
  status: string
  tokenCost: number
  unlockedAt: Date
  brand: string
  model: string
  variant: string | null
  discountWanted: number
  notes: string | null
  purchaseTimeframe: string | null
  /** Visible only because this row is, by definition, an unlocked lead. */
  customerName: string | null
  customerPhone: string
  internalNotes: string | null
}

/**
 * The sales user's CRM: leads they have paid for.
 *
 * This is the one query that selects `users.phone`, and the join to `leads` on
 * `salesId` is what authorises it — the row cannot exist without an unlock having
 * been recorded, which is the condition CLAUDE.md § 7 states.
 */
export async function unlockedLeads(
  salesId: string,
  status?: 'pending' | 'negotiation' | 'won' | 'lost',
): Promise<UnlockedLead[]> {
  const conditions = [eq(leads.salesId, salesId)]
  if (status) conditions.push(eq(leads.status, status))

  const rows = await getDb()
    .select({
      leadId: leads.id,
      requestId: leads.requestId,
      status: leads.status,
      tokenCost: leads.tokenCost,
      unlockedAt: leads.unlockedAt,
      internalNotes: leads.internalNotes,
      brand: requests.brand,
      model: requests.model,
      variant: requests.variant,
      discountWanted: requests.discountWanted,
      notes: requests.notes,
      purchaseTimeframe: requests.purchaseTimeframe,
      customerName: users.fullName,
      customerPhone: users.phone,
    })
    .from(leads)
    .innerJoin(requests, eq(requests.id, leads.requestId))
    .innerJoin(users, eq(users.id, requests.customerId))
    .where(and(...conditions))
    .orderBy(desc(leads.unlockedAt))
    .limit(100)

  return rows.map((row) => ({ ...row, discountWanted: Number(row.discountWanted) }))
}

export type LedgerEntry = {
  id: string
  delta: number
  balanceAfter: number
  reason: string
  note: string | null
  createdAt: Date
}

export async function tokenHistory(salesId: string, limit = 30): Promise<LedgerEntry[]> {
  return getDb()
    .select({
      id: tokenLedger.id,
      delta: tokenLedger.delta,
      balanceAfter: tokenLedger.balanceAfter,
      reason: tokenLedger.reason,
      note: tokenLedger.note,
      createdAt: tokenLedger.createdAt,
    })
    .from(tokenLedger)
    .where(eq(tokenLedger.salesId, salesId))
    .orderBy(desc(tokenLedger.createdAt))
    .limit(limit)
}

export type ReferralSummary = {
  code: string
  totalReferred: number
  tokensThisMonth: number
  monthlyCap: number
}

/** Referral bonus is capped at 300 tokens per month — CLAUDE.md § 2. */
export const REFERRAL_MONTHLY_CAP = 300
export const REFERRAL_BONUS = 30

export async function referralSummary(salesId: string): Promise<ReferralSummary> {
  const db = getDb()

  const [profile] = await db
    .select({ code: salesProfile.referralCode })
    .from(salesProfile)
    .where(eq(salesProfile.userId, salesId))
    .limit(1)

  const [referred] = await db
    .select({ total: count() })
    .from(salesProfile)
    .where(eq(salesProfile.referredBy, salesId))

  // Sum this month's referral rows straight from the ledger. The `referral_quota`
  // table is the counter the grant transaction locks against; this read does not
  // need that lock, and reading the ledger keeps the displayed number derived from
  // the same source of truth the invariant is stated against.
  const monthStart = jakartaMonthStart()

  const [granted] = await db
    .select({ total: sql<number>`coalesce(sum(${tokenLedger.delta}), 0)` })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.salesId, salesId),
        eq(tokenLedger.reason, 'referral'),
        gte(tokenLedger.createdAt, monthStart),
      ),
    )

  return {
    code: profile?.code ?? '',
    totalReferred: Number(referred?.total ?? 0),
    tokensThisMonth: Number(granted?.total ?? 0),
    monthlyCap: REFERRAL_MONTHLY_CAP,
  }
}

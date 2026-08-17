import 'server-only'
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { auctionEntries, auctions, requests, salesOffers, salesProfile } from '@/lib/db/schema'
import type { AuctionStatus, CarTier } from '@/lib/db/schema'

/**
 * Read side of the reverse auction.
 *
 * Same rule as `lib/sales/queries.ts`: no query in this module selects a
 * customer's name or phone number. The auction is the stage *before* anyone has
 * earned the contact, so those columns have no business being in a row that
 * reaches a bidder — and a column that is never selected cannot be leaked by a
 * filter someone deletes later.
 *
 * The mirror rule applies in the other direction. What a bidder sees about their
 * rivals is their own rank and the gap to the customer's target, never a rival's
 * price. A fully open auction invites penny-shaving (leader minus one rupiah); a
 * fully sealed one invites lazy bids. Rank plus target-gap applies losing
 * pressure without handing over a number to undercut, and anchors the bidding to
 * the figure the customer actually asked for.
 */

/** How long a new auction runs before its first close attempt. */
export const AUCTION_DURATION_MS = 48 * 60 * 60 * 1000

/** A best bid inside this window pushes the deadline back (soft close). */
export const SOFT_CLOSE_WINDOW_MS = 5 * 60 * 1000

/** Each extension adds this much. Same length as the window it protects. */
export const SOFT_CLOSE_EXTENSION_MS = 5 * 60 * 1000

/**
 * Cap on extensions. Six caps the tail at 30 extra minutes — long enough for a
 * genuine bidding war, short enough that the customer is not kept waiting
 * indefinitely by two sales users trading one-rupiah cuts.
 */
export const MAX_SOFT_CLOSE_EXTENSIONS = 6

export type SalesAuctionRow = {
  auctionId: string
  requestId: string
  brand: string
  model: string
  variant: string | null
  tier: CarTier
  targetPrice: number
  listPrice: number | null
  closesAt: Date
  status: AuctionStatus
  /** Total valid bidders. Shown as pressure, not as a leaderboard. */
  bidderCount: number
  /** This user's own standing, or null when they have not bid yet. */
  myPrice: number | null
  /** 1 = currently winning. Null when this user has not bid. */
  myRank: number | null
  /**
   * `myPrice - targetPrice`. Positive means still above what the customer asked
   * for; zero or below means the target has been met. Null when no bid yet.
   */
  gapToTarget: number | null
  /** The offer that entitles this user to bid, and the floor it imposes. */
  offerId: string
  maxDiscount: number
}

/**
 * Open auctions this sales user may bid on, with their own standing in each.
 *
 * Eligibility is the published-offer ticket: a sales user only sees auctions for
 * cars they already advertise. That is deliberate scope as well as
 * anti-spam — the screen stays about their own inventory instead of becoming a
 * firehose of every request on the platform.
 *
 * The offer join repeats the date predicates rather than trusting
 * `status = 'active'`, for the reason spelled out in `eligibleOffer()`: the
 * expiry cron runs daily, so between `ends_at` and the next run the column lies.
 * A bid screen built on that lie would show a bid button that `placeBid` refuses.
 */
export async function activeAuctionsForSales(
  salesId: string,
  options: { limit?: number; now?: Date } = {},
): Promise<SalesAuctionRow[]> {
  const db = getDb()
  const limit = Math.min(options.limit ?? 30, 60)
  const now = options.now ?? new Date()

  // Rank and bidder count are computed in SQL over `auction_entries`, whose index
  // is ordered (auction_id, status, best_price, best_price_at) — the same order as
  // the comparator, so the window function reads the index instead of sorting.
  const standings = db.$with('standings').as(
    db
      .select({
        auctionId: auctionEntries.auctionId,
        salesId: auctionEntries.salesId,
        bestPrice: auctionEntries.bestPrice,
        rank: sql<number>`rank() over (
          partition by ${auctionEntries.auctionId}
          order by ${auctionEntries.bestPrice} asc, ${auctionEntries.bestPriceAt} asc
        )`.as('rank'),
        bidders: sql<number>`count(*) over (partition by ${auctionEntries.auctionId})`.as(
          'bidders',
        ),
      })
      .from(auctionEntries)
      .where(eq(auctionEntries.status, 'valid')),
  )

  const rows = await db
    .with(standings)
    .select({
      auctionId: auctions.id,
      requestId: auctions.requestId,
      brand: requests.brand,
      model: requests.model,
      variant: requests.variant,
      tier: auctions.tier,
      targetPrice: auctions.targetPrice,
      listPrice: auctions.listPrice,
      closesAt: auctions.closesAt,
      status: auctions.status,
      offerId: salesOffers.id,
      maxDiscount: salesOffers.maxDiscount,
      // Aggregated with `max(case when ...)` so one row comes back per auction:
      // the join fans out over every competitor, and only this user's own row is
      // projected out of it. A rival's price never leaves the database.
      myPrice: sql<
        number | null
      >`max(case when ${standings.salesId} = ${salesId} then ${standings.bestPrice} end)`,
      myRank: sql<
        number | null
      >`max(case when ${standings.salesId} = ${salesId} then ${standings.rank} end)`,
      bidderCount: sql<number>`coalesce(max(${standings.bidders}), 0)::int`,
    })
    .from(auctions)
    .innerJoin(requests, eq(requests.id, auctions.requestId))
    .innerJoin(
      salesOffers,
      and(
        eq(salesOffers.salesId, salesId),
        eq(salesOffers.brand, requests.brand),
        eq(salesOffers.model, requests.model),
        eq(salesOffers.status, 'active'),
        sql`(${salesOffers.startsAt} is null or ${salesOffers.startsAt} <= ${now})`,
        sql`(${salesOffers.endsAt} is null or ${salesOffers.endsAt} > ${now})`,
      ),
    )
    .leftJoin(standings, eq(standings.auctionId, auctions.id))
    .where(and(eq(auctions.status, 'open'), gt(auctions.closesAt, now)))
    .groupBy(
      auctions.id,
      requests.brand,
      requests.model,
      requests.variant,
      salesOffers.id,
      salesOffers.maxDiscount,
    )
    .orderBy(asc(auctions.closesAt))
    .limit(limit)

  return rows.map((row) => {
    const myPrice = row.myPrice === null ? null : Number(row.myPrice)
    return {
      ...row,
      myPrice,
      myRank: row.myRank === null ? null : Number(row.myRank),
      bidderCount: Number(row.bidderCount),
      maxDiscount: Number(row.maxDiscount),
      gapToTarget: myPrice === null ? null : myPrice - Number(row.targetPrice),
    }
  })
}

export type AnonymousBid = {
  /** "Sales A", "Sales B" — assigned by rank, stable within one read. */
  label: string
  price: number
  rank: number
  placedAt: Date
  /** Reputation is shown because it is what the customer picks on. */
  rating: number | null
  transactionsWon: number
  verified: boolean
}

export type CustomerAuctionView = {
  auctionId: string
  status: AuctionStatus
  targetPrice: number
  listPrice: number | null
  closesAt: Date
  extensionCount: number
  bids: AnonymousBid[]
  winnerSalesId: string | null
  winningPrice: number | null
}

/**
 * The customer's view of their own auction: every valid bid, anonymised.
 *
 * Bidders are labelled by rank rather than named. Until settlement the customer
 * is choosing between prices and reputations, and putting real names on the list
 * turns that into a brand-recognition contest — the sales user from the most
 * familiar dealership wins bids they did not price for.
 *
 * `customerId` is joined into the predicate rather than checked afterwards: an
 * auction is only readable by the customer who owns the request behind it, and
 * writing that as a filter the query cannot return without is stronger than
 * writing it as an `if` a later edit can skip.
 */
export async function auctionForCustomer(
  requestId: string,
  customerId: string,
): Promise<CustomerAuctionView | null> {
  const byRequest = await auctionsForCustomer([requestId], customerId)
  return byRequest.get(requestId) ?? null
}

/**
 * The same view for a whole page of requests, keyed by request id.
 *
 * Two queries no matter how many requests are passed in. The dashboard lists up
 * to fifty rows, and calling `auctionForCustomer` per row would be a hundred
 * round trips to render one page — the same reason the unlock counts on that
 * page are a single grouped aggregate rather than a subquery per row.
 *
 * The customer scope lives in the first query's predicate, so an id belonging to
 * someone else simply does not come back. Bids are fetched only for auctions
 * that survived that filter, which means the second query cannot reach an
 * auction the first one refused.
 */
export async function auctionsForCustomer(
  requestIds: readonly string[],
  customerId: string,
): Promise<Map<string, CustomerAuctionView>> {
  const byRequest = new Map<string, CustomerAuctionView>()
  if (requestIds.length === 0) return byRequest

  const db = getDb()

  const auctionRows = await db
    .select({
      id: auctions.id,
      requestId: auctions.requestId,
      status: auctions.status,
      targetPrice: auctions.targetPrice,
      listPrice: auctions.listPrice,
      closesAt: auctions.closesAt,
      extensionCount: auctions.extensionCount,
      winnerSalesId: auctions.winnerSalesId,
      winningPrice: auctions.winningPrice,
    })
    .from(auctions)
    .innerJoin(requests, eq(requests.id, auctions.requestId))
    .where(and(inArray(auctions.requestId, [...requestIds]), eq(requests.customerId, customerId)))

  if (auctionRows.length === 0) return byRequest

  const bidRows = await db
    .select({
      auctionId: auctionEntries.auctionId,
      price: auctionEntries.bestPrice,
      placedAt: auctionEntries.bestPriceAt,
      rating: salesProfile.rating,
      transactionsWon: salesProfile.transactionsWon,
      verificationStatus: salesProfile.verificationStatus,
    })
    .from(auctionEntries)
    .leftJoin(salesProfile, eq(salesProfile.userId, auctionEntries.salesId))
    .where(
      and(
        inArray(
          auctionEntries.auctionId,
          auctionRows.map((row) => row.id),
        ),
        eq(auctionEntries.status, 'valid'),
      ),
    )
    .orderBy(
      asc(auctionEntries.auctionId),
      asc(auctionEntries.bestPrice),
      asc(auctionEntries.bestPriceAt),
    )

  // Labels are assigned per auction in comparator order, so "Sales A" is always
  // the standing best price for that auction and never a global counter.
  const bidsByAuction = new Map<string, AnonymousBid[]>()
  for (const row of bidRows) {
    const bids = bidsByAuction.get(row.auctionId) ?? []
    bids.push({
      label: `Sales ${salesLabel(bids.length)}`,
      price: Number(row.price),
      rank: bids.length + 1,
      placedAt: row.placedAt,
      rating: row.rating === null ? null : Number(row.rating),
      transactionsWon: row.transactionsWon ?? 0,
      verified: row.verificationStatus === 'verified',
    })
    bidsByAuction.set(row.auctionId, bids)
  }

  for (const row of auctionRows) {
    byRequest.set(row.requestId, {
      auctionId: row.id,
      status: row.status,
      targetPrice: Number(row.targetPrice),
      listPrice: row.listPrice === null ? null : Number(row.listPrice),
      closesAt: row.closesAt,
      extensionCount: row.extensionCount,
      winnerSalesId: row.winnerSalesId,
      winningPrice: row.winningPrice === null ? null : Number(row.winningPrice),
      bids: bidsByAuction.get(row.id) ?? [],
    })
  }

  return byRequest
}

/** A, B, … Z, AA, AB — enough labels that a busy auction never runs out. */
function salesLabel(index: number): string {
  let label = ''
  let n = index
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

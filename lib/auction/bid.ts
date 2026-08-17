import 'server-only'
import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { auctionBids, auctionEntries, auctions, notifications, requests } from '@/lib/db/schema'
import { eligibleOffer } from '@/lib/sales/offers'
import {
  MAX_SOFT_CLOSE_EXTENSIONS,
  SOFT_CLOSE_EXTENSION_MS,
  SOFT_CLOSE_WINDOW_MS,
} from '@/lib/auction/queries'

/**
 * Placing a bid in a reverse auction.
 *
 * Bidding costs no tokens. Nothing in this module touches `token_ledger` or
 * `sales_profile.token_balance`, and nothing that does should be added to
 * it — the product decision is that a sales user pays for a won auction with
 * margin, not with credit. What keeps a free bid honest lives elsewhere: the
 * published-offer ticket (you may only bid on cars you already advertise, and
 * never shallower than the discount you advertised), the monotonicity rule, the
 * Redis rate limit applied by the caller, and `committed_price` frozen onto the
 * lead at settlement.
 *
 * Lock order is `sales_profile → auctions → requests`, globally. This path takes
 * no `sales_profile` lock because no balance moves, so it starts at `auctions`.
 * Anything added here that needs `requests` must take it after the auction row,
 * never before.
 */

export type BidRefusal =
  | 'not_found'
  /** Auction already settled, cancelled, or past its deadline. */
  | 'closed'
  /** No active `sales_offers` row for this brand+model — no entry ticket. */
  | 'no_offer'
  /** Shallower than the discount this sales user already advertises publicly. */
  | 'below_advertised'
  /** Bids may only go down. A higher or equal price is refused. */
  | 'not_lower'
  /** An admin removed this bidder from the comparator. */
  | 'flagged'
  /** Not a positive whole number of rupiah. */
  | 'invalid_price'

export type BidResult =
  | {
      ok: true
      /** The price now standing for this sales user. */
      price: number
      /** 1 = currently winning. Recomputed under the lock. */
      rank: number
      /** `price - targetPrice`. Zero or below means the customer's target is met. */
      gapToTarget: number
      /** Deadline after any soft-close extension this bid triggered. */
      closesAt: Date
      extended: boolean
    }
  | { ok: false; reason: BidRefusal }

/**
 * Register a bid, or explain why not.
 *
 * Every check that matters happens after `SELECT ... FOR UPDATE` on the auction
 * row. Reading the auction first and validating afterwards would let two bids
 * that were each valid at read time both land, and the second could be the
 * higher one — exactly the monotonicity break the rule exists to prevent.
 *
 * Refusals are returned, never thrown. A sales user bidding one rupiah too high
 * has made an ordinary mistake, and an exception would turn it into an error
 * screen instead of a line next to the input.
 *
 * The caller is responsible for `requireUser('sales')` and for the Redis rate
 * limit (`bidRateLimiter()`), in that order, before calling this.
 */
export async function placeBid(
  salesId: string,
  auctionId: string,
  offeredPrice: number,
  now = new Date(),
): Promise<BidResult> {
  if (!Number.isSafeInteger(offeredPrice) || offeredPrice <= 0) {
    return { ok: false, reason: 'invalid_price' }
  }

  return getDb().transaction(async (tx): Promise<BidResult> => {
    // Step 1, always: the mutex. `placeBid`, `settleAuction`, and the token-paid
    // `unlockLead` all queue on this row, so a bid can never land on an auction
    // that is being settled or bought out from under it.
    const [auction] = await tx
      .select({
        id: auctions.id,
        requestId: auctions.requestId,
        status: auctions.status,
        targetPrice: auctions.targetPrice,
        listPrice: auctions.listPrice,
        closesAt: auctions.closesAt,
        extensionCount: auctions.extensionCount,
      })
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .for('update')
      .limit(1)

    if (!auction) return { ok: false, reason: 'not_found' }
    if (auction.status !== 'open') return { ok: false, reason: 'closed' }
    // Read under the lock rather than trusted from the page the bid came
    // from — that page may have been open for an hour.
    if (auction.closesAt.getTime() <= now.getTime()) return { ok: false, reason: 'closed' }

    // Brand and model come from the request, never from the form. A bidder who
    // could name them would claim an offer for a cheap car as the ticket to bid
    // on an expensive one.
    const [request] = await tx
      .select({ brand: requests.brand, model: requests.model })
      .from(requests)
      .where(eq(requests.id, auction.requestId))
      .limit(1)

    if (!request) return { ok: false, reason: 'not_found' }

    // `tx` is passed, not omitted: the pool is `max: 1`, so a nested `getDb()`
    // inside this transaction would wait for a connection this very transaction
    // is holding, then fail on `connectionTimeoutMillis`. It also has to read the
    // ticket in the same snapshot as the bid it authorises.
    const offer = await eligibleOffer(salesId, request.brand, request.model, now, tx)
    if (!offer) return { ok: false, reason: 'no_offer' }

    // The advertised floor. `auctions.listPrice` is the auction's own copy, frozen
    // at creation; the offer's own OTR price is the fallback for requests that
    // never carried one.
    const listPrice = auction.listPrice ?? offer.otrPrice
    if (listPrice !== null && offeredPrice > listPrice - offer.maxDiscount) {
      // Bidding shallower than your own public promise would make the catalogue a
      // place to post numbers nobody intends to honour.
      return { ok: false, reason: 'below_advertised' }
    }

    const [existing] = await tx
      .select({
        bestPrice: auctionEntries.bestPrice,
        status: auctionEntries.status,
      })
      .from(auctionEntries)
      .where(and(eq(auctionEntries.auctionId, auctionId), eq(auctionEntries.salesId, salesId)))
      .limit(1)

    if (existing?.status === 'flagged') return { ok: false, reason: 'flagged' }
    if (existing && offeredPrice >= existing.bestPrice) return { ok: false, reason: 'not_lower' }

    // Who leads right now, before this bid lands. Read under the lock so the
    // outbid notification cannot name someone already overtaken.
    const [previousLeader] = await tx
      .select({ salesId: auctionEntries.salesId, bestPrice: auctionEntries.bestPrice })
      .from(auctionEntries)
      .where(and(eq(auctionEntries.auctionId, auctionId), eq(auctionEntries.status, 'valid')))
      .orderBy(asc(auctionEntries.bestPrice), asc(auctionEntries.bestPriceAt))
      .limit(1)

    const discountAmount = listPrice === null ? 0 : listPrice - offeredPrice

    // History first, cache second. `auction_bids` is append-only for the same
    // reason `token_ledger` is: it is the evidence when a customer reports that a
    // committed price was not honoured.
    await tx.insert(auctionBids).values({
      auctionId,
      salesId,
      offerId: offer.id,
      offeredPrice,
      discountAmount,
    })

    // `bestPriceAt` moves only when the price actually improves, because it is
    // the tiebreaker — between two equal prices the earlier one wins, and
    // refreshing it would silently cost the bidder that tiebreak.
    await tx
      .insert(auctionEntries)
      .values({
        auctionId,
        salesId,
        bestPrice: offeredPrice,
        bestPriceAt: now,
        bidCount: 1,
      })
      .onConflictDoUpdate({
        target: [auctionEntries.auctionId, auctionEntries.salesId],
        set: {
          bestPrice: offeredPrice,
          bestPriceAt: now,
          bidCount: sql`${auctionEntries.bidCount} + 1`,
          updatedAt: now,
        },
      })

    // Soft close. A better bid arriving in the last five minutes pushes the
    // deadline back, so the auction is won by the best price rather than by
    // whoever's clock is most accurate. Capped so it cannot run forever.
    const isNewLeader = !previousLeader || offeredPrice < previousLeader.bestPrice
    const insideWindow = auction.closesAt.getTime() - now.getTime() < SOFT_CLOSE_WINDOW_MS
    const extended =
      isNewLeader && insideWindow && auction.extensionCount < MAX_SOFT_CLOSE_EXTENSIONS

    let closesAt = auction.closesAt
    if (extended) {
      closesAt = new Date(now.getTime() + SOFT_CLOSE_EXTENSION_MS)
      await tx
        .update(auctions)
        .set({ closesAt, extensionCount: auction.extensionCount + 1, updatedAt: now })
        .where(eq(auctions.id, auctionId))
    }

    // Tell the displaced leader they lost the lead — but not the price that beat
    // them. Handing over the number to beat is what turns an auction into a
    // penny-shaving loop.
    if (previousLeader && isNewLeader && previousLeader.salesId !== salesId) {
      await tx.insert(notifications).values({
        userId: previousLeader.salesId,
        kind: 'auction_outbid',
        title: 'Penawaran Anda tersalip',
        body: 'Ada sales lain menawarkan harga lebih rendah. Perbarui penawaran sebelum lelang tutup.',
        // No customer identity here. `notifications` is not behind the unlock
        // gate, so anything written into it is readable by someone who has
        // neither paid for nor won the lead.
        payload: { auctionId, closesAt: closesAt.toISOString() },
      })
    }

    // Rank is recomputed from the cache rather than inferred from the comparison
    // above, so it stays right when several entries share a price.
    const [ranked] = await tx
      .select({
        rank: sql<number>`(
          select count(*) + 1 from ${auctionEntries} peer
          where peer.auction_id = ${auctionId}
            and peer.status = 'valid'
            and (peer.best_price < ${offeredPrice}
              or (peer.best_price = ${offeredPrice} and peer.best_price_at < ${now}))
        )::int`,
      })
      .from(auctionEntries)
      .where(and(eq(auctionEntries.auctionId, auctionId), eq(auctionEntries.salesId, salesId)))
      .limit(1)

    return {
      ok: true,
      price: offeredPrice,
      rank: Number(ranked?.rank ?? 1),
      gapToTarget: offeredPrice - Number(auction.targetPrice),
      closesAt,
      extended,
    }
  })
}

/**
 * Remove a bidder from the comparator without erasing what they bid.
 *
 * Admin-only. The bids stay in `auction_bids` — a sales user removed for gaming
 * an auction is exactly the case where the history matters most, so this marks
 * the entry rather than deleting it.
 */
export async function flagEntry(auctionId: string, salesId: string): Promise<boolean> {
  const rows = await getDb()
    .update(auctionEntries)
    .set({ status: 'flagged', updatedAt: new Date() })
    .where(
      and(
        eq(auctionEntries.auctionId, auctionId),
        eq(auctionEntries.salesId, salesId),
        ne(auctionEntries.status, 'flagged'),
      ),
    )
    .returning({ id: auctionEntries.id })

  return rows.length > 0
}

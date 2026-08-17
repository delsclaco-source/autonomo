import 'server-only'
import { and, asc, eq, isNull, lt, ne } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { auctionEntries, auctions, leads, notifications, requests } from '@/lib/db/schema'
import { auctionsForCustomer, type CustomerAuctionView } from './queries'

/**
 * Closing a reverse auction and handing the contact to exactly one sales user.
 *
 * This module writes no `token_ledger` row, takes no `sales_profile` lock, and
 * performs no balance check. Winning an auction costs zero tokens — the winner
 * already paid in margin. The lead it writes carries `token_cost: 0` and
 * `source: 'auction'`, and that is not a hole in the balance invariant: the
 * invariant says every *balance mutation* needs a ledger row, and here no
 * balance moves.
 *
 * Do not add a "can the winner afford it" step. The comparator picks the best
 * price, full stop; walking down the ranking looking for someone solvent would
 * mean the deepest discount does not always win, which is the one promise the
 * whole mechanism rests on.
 *
 * Lock order is `sales_profile → auctions → requests`, globally. This path takes
 * no profile lock, so it starts at `auctions` and never touches `requests`
 * before it.
 */

type Db = ReturnType<typeof getDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type SettleResult =
  | { ok: true; outcome: 'awarded'; leadId: string; salesId: string; price: number }
  /** Closed with no valid bid. The request falls through to the token pool. */
  | { ok: true; outcome: 'no_bids' }
  /** Already settled, not yet due, or someone took the request from the pool. */
  | { ok: true; outcome: 'noop'; reason: 'already_settled' | 'not_due' | 'request_taken' }
  | { ok: false; reason: 'not_found' }

/**
 * The comparator, in one clause.
 *
 * The product states two rules — "deepest discount wins", and "if nobody meets
 * the target, closest to the target wins". They collapse into a single ORDER BY,
 * because when someone does meet the target the deepest discount *is* the lowest
 * price, and when nobody does, every bid sits above the target so closest *is*
 * lowest. One clause, so there is no branch where the two rules could disagree
 * about which applies.
 *
 * `best_price_at` breaks ties: identical prices go to whoever offered first.
 */
async function pickWinner(
  tx: Tx,
  auctionId: string,
): Promise<{ salesId: string; bestPrice: number } | null> {
  const [winner] = await tx
    .select({ salesId: auctionEntries.salesId, bestPrice: auctionEntries.bestPrice })
    .from(auctionEntries)
    .where(and(eq(auctionEntries.auctionId, auctionId), eq(auctionEntries.status, 'valid')))
    .orderBy(asc(auctionEntries.bestPrice), asc(auctionEntries.bestPriceAt))
    .limit(1)

  return winner ?? null
}

/**
 * Close one auction. Safe to call from anywhere, any number of times.
 *
 * Three callers can trigger this — the cron sweep, lazy close-on-read when a
 * page loads a due auction, and the customer awarding manually — and all three
 * can fire at once. Idempotency comes from step 1: the `FOR UPDATE` on the
 * auction row serialises them, and every caller after the first re-reads a
 * status that is no longer `open` and returns a no-op. There is no separate
 * "already settled" flag that could drift out of sync with the status.
 *
 * `force` is the customer's manual award: it skips the deadline check and
 * nothing else. Every lock and every other check is identical, so a manually
 * awarded auction and a cron-awarded one produce the same rows.
 */
export async function settleAuction(
  auctionId: string,
  options: { force?: boolean; now?: Date } = {},
): Promise<SettleResult> {
  const now = options.now ?? new Date()

  return getDb().transaction(async (tx): Promise<SettleResult> => {
    // Step 1: the mutex and the idempotency gate, in one statement.
    const [auction] = await tx
      .select({
        id: auctions.id,
        requestId: auctions.requestId,
        tier: auctions.tier,
        status: auctions.status,
        closesAt: auctions.closesAt,
      })
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .for('update')
      .limit(1)

    if (!auction) return { ok: false, reason: 'not_found' }
    if (auction.status !== 'open') {
      return { ok: true, outcome: 'noop', reason: 'already_settled' }
    }
    if (!options.force && auction.closesAt.getTime() > now.getTime()) {
      return { ok: true, outcome: 'noop', reason: 'not_due' }
    }

    // Step 2: `requests`, always after `auctions`. Re-read under the lock,
    // because between the auction opening and this moment the request may have
    // been taken through another lane.
    const [request] = await tx
      .select({ id: requests.id, status: requests.status, customerId: requests.customerId })
      .from(requests)
      .where(eq(requests.id, auction.requestId))
      .for('update')
      .limit(1)

    if (!request) return { ok: false, reason: 'not_found' }

    if (request.status === 'claimed' || request.status === 'closed') {
      // Someone got here first. Cancel rather than award: handing the contact to
      // a second sales user is the one outcome "satu data, satu sales" forbids,
      // and `leads_request_key` would reject the insert anyway — better a clean
      // cancellation than a constraint violation rolling back the transaction.
      await tx
        .update(auctions)
        .set({ status: 'cancelled', settledAt: now, updatedAt: now })
        .where(eq(auctions.id, auctionId))
      return { ok: true, outcome: 'noop', reason: 'request_taken' }
    }

    const winner = await pickWinner(tx, auctionId)

    if (!winner) {
      // Nobody bid, or every bid was flagged. The request moves to the pool,
      // where it becomes buyable with tokens. This is the only way a request
      // that started as an auction ever enters the paid lane.
      await tx
        .update(auctions)
        .set({ status: 'no_bids', settledAt: now, updatedAt: now })
        .where(eq(auctions.id, auctionId))

      await tx
        .update(requests)
        .set({ status: 'pool', updatedAt: now })
        .where(eq(requests.id, auction.requestId))

      await tx.insert(notifications).values({
        userId: request.customerId,
        kind: 'auction_lost',
        title: 'Lelang selesai tanpa penawaran',
        body: 'Belum ada sales yang menawar permintaan Anda. Permintaan tetap aktif dan bisa diambil sales lain.',
        payload: { requestId: auction.requestId },
      })

      return { ok: true, outcome: 'no_bids' }
    }

    // `token_cost: 0` plus `source: 'auction'` is what distinguishes this row
    // from a pool unlock. `committed_price` freezes what the winner promised, so
    // a later edit to their offer cannot restate it — it is the evidence when a
    // customer reports that the price was not honoured.
    const [lead] = await tx
      .insert(leads)
      .values({
        requestId: auction.requestId,
        salesId: winner.salesId,
        tier: auction.tier,
        tokenCost: 0,
        source: 'auction',
        committedPrice: winner.bestPrice,
        unlockedAt: now,
      })
      .returning({ id: leads.id })

    await tx
      .update(auctions)
      .set({
        status: 'awarded',
        winnerSalesId: winner.salesId,
        winningPrice: winner.bestPrice,
        settledAt: now,
        updatedAt: now,
      })
      .where(eq(auctions.id, auctionId))

    await tx
      .update(requests)
      .set({ status: 'claimed', updatedAt: now })
      .where(eq(requests.id, auction.requestId))

    // Neither notification carries the customer's name or number. The lead row
    // is the gate for that, and `notifications` sits outside the gate.
    await tx.insert(notifications).values({
      userId: winner.salesId,
      kind: 'auction_won',
      title: 'Anda memenangkan lelang',
      body: 'Kontak customer sudah terbuka di halaman Leads. Hubungi dalam 24 jam.',
      payload: { auctionId, leadId: lead.id, committedPrice: winner.bestPrice },
    })

    const losers = await tx
      .select({ salesId: auctionEntries.salesId })
      .from(auctionEntries)
      .where(
        and(
          eq(auctionEntries.auctionId, auctionId),
          eq(auctionEntries.status, 'valid'),
          ne(auctionEntries.salesId, winner.salesId),
        ),
      )

    if (losers.length > 0) {
      await tx.insert(notifications).values(
        losers.map((loser) => ({
          userId: loser.salesId,
          kind: 'auction_lost' as const,
          title: 'Lelang selesai',
          // Not "you lost by X". The winning price is the number a losing bidder
          // would use to price the next auction against that rival rather than
          // against their own margin.
          body: 'Penawaran Anda belum menang kali ini. Lelang lain menunggu di halaman Lelang.',
          payload: { auctionId },
        })),
      )
    }

    await tx.insert(notifications).values({
      userId: request.customerId,
      kind: 'auction_won',
      title: 'Lelang Anda selesai',
      body: 'Satu sales memenangkan permintaan Anda dan akan menghubungi lewat WhatsApp.',
      payload: { requestId: auction.requestId, price: winner.bestPrice },
    })

    return {
      ok: true,
      outcome: 'awarded',
      leadId: lead.id,
      salesId: winner.salesId,
      price: winner.bestPrice,
    }
  })
}

/**
 * Settle every auction whose deadline has passed.
 *
 * `skipLocked` is here as a filter, not as a lock — this SELECT runs outside a
 * transaction, so whatever it locks is released the moment the statement ends.
 * What it buys is the skip: a manual award holds its auction row for the length
 * of its own transaction, and without `skipLocked` the sweep would block on that
 * row before it could even list the batch. A skipped auction is picked up on the
 * next run, which on a five minute cron is a five minute delay on one auction
 * rather than a stalled batch. The real lock is taken by `settleAuction`.
 *
 * Ids are collected first and settled one at a time afterwards, each in its own
 * transaction, so one auction that fails cannot roll back the rest.
 */
export async function sweepDueAuctions(limit = 50, now = new Date()): Promise<SettleResult[]> {
  const due = await getDb()
    .select({ id: auctions.id })
    .from(auctions)
    .where(and(eq(auctions.status, 'open'), lt(auctions.closesAt, now)))
    .orderBy(asc(auctions.closesAt))
    .for('update', { skipLocked: true })
    .limit(limit)

  const results: SettleResult[] = []
  for (const row of due) {
    results.push(await settleAuction(row.id, { now }))
  }
  return results
}

/** A won lead the winner never acted on is revoked after this long. */
export const CONTACT_DEADLINE_MS = 24 * 60 * 60 * 1000

/**
 * Read a customer's auctions, closing on the way any whose deadline has passed.
 *
 * This is the second safety belt behind the cron. The sweep runs every five
 * minutes, so a page hit can land after a deadline but before the sweep reaches
 * it — and an auction that renders its open controls past its own close invites
 * the customer to award something the next cron tick is about to award anyway.
 *
 * It lives here rather than inline in the page for a mechanical reason: reading
 * the clock during render is impure, and `react-hooks/purity` refuses it even in
 * a Server Component. A module boundary is also the honest place for it — the
 * page asks for a view and gets a consistent one, without owning the decision of
 * when an auction is due.
 *
 * No `force` flag: these auctions are genuinely past their deadline, and forcing
 * would be lying to `settleAuction` about why it is closing. Settled rows are
 * re-read rather than patched in memory, so the caller never renders a view that
 * disagrees with the row that was just written.
 */
export async function readCustomerAuctionsClosingDue(
  requestIds: readonly string[],
  customerId: string,
): Promise<Map<string, CustomerAuctionView>> {
  const views = await auctionsForCustomer(requestIds, customerId)
  const now = Date.now()

  for (const [requestId, view] of views) {
    if (view.status !== 'open' || view.closesAt.getTime() > now) continue

    await settleAuction(view.auctionId)
    const refreshed = (await auctionsForCustomer([requestId], customerId)).get(requestId)
    if (refreshed) views.set(requestId, refreshed)
  }

  return views
}

/**
 * Take back auction leads the winner never contacted.
 *
 * Exclusivity created this risk. Before "one request, one sales", a customer
 * ignored by one sales user still had eight others who had unlocked them; now a
 * winner who never calls means the customer hears from nobody at all. So the
 * lead is revoked and the request returns to the pool, where somebody else can
 * take it.
 *
 * Only `source = 'auction'` rows are eligible. A pool lead was paid for with
 * tokens, and revoking it would destroy something the sales user bought — that
 * needs a refund decision, which is an admin action, not a sweep.
 */
export async function revokeStaleLeads(limit = 50, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CONTACT_DEADLINE_MS)
  const db = getDb()

  const stale = await db
    .select({ id: leads.id, requestId: leads.requestId, salesId: leads.salesId })
    .from(leads)
    .where(
      and(
        eq(leads.source, 'auction'),
        eq(leads.status, 'pending'),
        isNull(leads.lastContactedAt),
        lt(leads.unlockedAt, cutoff),
      ),
    )
    .limit(limit)

  let revoked = 0

  for (const stale_lead of stale) {
    await db.transaction(async (tx) => {
      // Re-read under the row lock. The sales user may have made contact between
      // the scan above and this transaction, and revoking then would punish
      // someone who did exactly what was asked of them.
      const [current] = await tx
        .select({ id: leads.id, lastContactedAt: leads.lastContactedAt })
        .from(leads)
        .where(eq(leads.id, stale_lead.id))
        .for('update')
        .limit(1)

      if (!current || current.lastContactedAt) return

      await tx.delete(leads).where(eq(leads.id, stale_lead.id))

      await tx
        .update(requests)
        .set({ status: 'pool', updatedAt: now })
        .where(eq(requests.id, stale_lead.requestId))

      await tx.insert(notifications).values({
        userId: stale_lead.salesId,
        kind: 'auction_lost',
        title: 'Lead dicabut',
        body: 'Anda tidak menghubungi customer dalam 24 jam, jadi lead dikembalikan ke marketplace.',
        payload: { requestId: stale_lead.requestId },
      })

      revoked += 1
    })
  }

  return revoked
}

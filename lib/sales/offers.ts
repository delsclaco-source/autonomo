import 'server-only'

import { and, desc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { offerBenefits, salesOffers } from '@/lib/db/schema'
import type { OfferBenefitKind, OfferStatus, SalesOffer } from '@/lib/db/schema'
import { findModel } from '@/lib/data/catalog'

/**
 * Sales offer reads.
 *
 * Every query here is scoped to one sales user's own rows. This is the owner's
 * view, so `min_discount` and `note` are selected — both are internal, and both
 * must stay out of any customer-facing projection (`PublicSalesOffer` exists for
 * that side). The rule is the same one the leads module states: a filter can be
 * removed by accident, a column that was never selected cannot leak. Keep the
 * customer read path in its own module rather than adding a flag here.
 */

export type OfferRow = SalesOffer & {
  /** Catalogue display names, resolved from the stored slugs. */
  brandName: string
  modelName: string
  /** `status` corrected for the clock — see `effectiveStatus`. */
  status: OfferStatus
  benefits: { benefit: OfferBenefitKind; note: string | null }[]
}

/**
 * Status as the user should see it right now.
 *
 * `sales_offers.status` is flipped to `expired` by a daily cron, so between the
 * end date and the next run the stored value still reads `active`. Showing that
 * would tell a sales user a promo is live on a day it is not. The stored column
 * stays the source of truth for writes; this is display only.
 */
export function effectiveStatus(
  offer: Pick<SalesOffer, 'status' | 'startsAt' | 'endsAt'>,
  now = new Date(),
): OfferStatus {
  if (offer.status !== 'active') return offer.status
  if (offer.endsAt && offer.endsAt.getTime() < now.getTime()) return 'expired'
  // A scheduled promo that has not opened yet is not live. `draft` is the closest
  // honest label — the row is complete but not working for the user.
  if (offer.startsAt && offer.startsAt.getTime() > now.getTime()) return 'draft'
  return offer.status
}

/**
 * All offers belonging to one sales user, newest first.
 *
 * Benefits are fetched in a second query keyed by the offer ids rather than
 * joined, so a row with four benefits does not arrive as four duplicated offer
 * rows that then need collapsing in JS.
 */
export async function listOffers(salesId: string): Promise<OfferRow[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(salesOffers)
    .where(eq(salesOffers.salesId, salesId))
    .orderBy(desc(salesOffers.createdAt))

  if (rows.length === 0) return []

  const benefitRows = await db
    .select({
      offerId: offerBenefits.offerId,
      benefit: offerBenefits.benefit,
      note: offerBenefits.note,
    })
    .from(offerBenefits)
    .where(
      inArray(
        offerBenefits.offerId,
        rows.map((r) => r.id),
      ),
    )

  const byOffer = new Map<string, { benefit: OfferBenefitKind; note: string | null }[]>()
  for (const b of benefitRows) {
    const list = byOffer.get(b.offerId) ?? []
    list.push({ benefit: b.benefit, note: b.note })
    byOffer.set(b.offerId, list)
  }

  const now = new Date()

  return rows.map((row) => {
    const entry = findModel(row.brand, row.model)
    return {
      ...row,
      // Falls back to the stored slug rather than dropping the row: a model
      // retired from the catalogue still has live offers against it, and a sales
      // user who cannot see them cannot take them down.
      brandName: entry?.brand.name ?? row.brand,
      modelName: entry?.name ?? row.model,
      status: effectiveStatus(row, now),
      benefits: byOffer.get(row.id) ?? [],
    }
  })
}

/** One offer, only if it belongs to this sales user. */
export async function findOffer(salesId: string, offerId: string): Promise<SalesOffer | null> {
  const rows = await getDb()
    .select()
    .from(salesOffers)
    .where(and(eq(salesOffers.id, offerId), eq(salesOffers.salesId, salesId)))
    .limit(1)

  return rows[0] ?? null
}

export type OfferCounts = Record<OfferStatus, number>

/** Tally by displayed status, for the summary strip above the list. */
export function countByStatus(offers: OfferRow[]): OfferCounts {
  const counts: OfferCounts = { draft: 0, active: 0, paused: 0, expired: 0 }
  for (const offer of offers) counts[offer.status] += 1
  return counts
}

/**
 * The connection or transaction a query runs on. Same shape as the `Tx` alias in
 * `lib/sales/unlock.ts` and `lib/auction/settle.ts`, widened to accept the plain
 * client so callers outside a transaction can omit it.
 */
type Executor =
  | ReturnType<typeof getDb>
  | Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

/**
 * The offer that entitles this sales user to bid on a brand+model, or null.
 *
 * Bidding is free, so something other than money has to keep the auction honest.
 * This is that something: a sales user may only bid on cars they have already
 * advertised publicly, and (in `placeBid`) may not bid shallower than the
 * `max_discount` they published. Undercutting your own advertised discount to win
 * an auction is then impossible, and the public catalogue stops being a place to
 * post numbers you have no intention of honouring.
 *
 * The date predicates are written inline rather than leaning on
 * `status = 'active'` alone, and that is the whole point of this function. The
 * cron that flips `status` to `expired` runs daily, so between `ends_at` and the
 * next run the column says `active` about an offer that is not. `effectiveStatus()`
 * corrects that for display; display correction is not authorisation. This query
 * asks the clock directly.
 *
 * Returns the offer with the deepest advertised discount when several match, so
 * the bid floor is the most generous promise the sales user has made.
 *
 * `db` exists because `placeBid` calls this from inside an open transaction. The
 * pool is `max: 1` (`lib/db/index.ts`), so a caller holding a transaction holds
 * the only connection — a nested `getDb()` here would queue for a second one
 * that can never be freed, and fail ten seconds later on
 * `connectionTimeoutMillis` rather than on anything wrong with the SQL. The
 * correctness reason stands on its own: the entry ticket has to be read in the
 * same snapshot, under the same locks, as the bid it authorises.
 */
export async function eligibleOffer(
  salesId: string,
  brand: string,
  model: string,
  now = new Date(),
  db: Executor = getDb(),
): Promise<SalesOffer | null> {
  const rows = await db
    .select()
    .from(salesOffers)
    .where(
      and(
        eq(salesOffers.salesId, salesId),
        eq(salesOffers.brand, brand),
        eq(salesOffers.model, model),
        eq(salesOffers.status, 'active'),
        // Null dates mean "no bound", which is how an open-ended promo is stored.
        or(isNull(salesOffers.startsAt), lte(salesOffers.startsAt, now)),
        or(isNull(salesOffers.endsAt), gt(salesOffers.endsAt, now)),
      ),
    )
    .orderBy(desc(salesOffers.maxDiscount))
    .limit(1)

  return rows[0] ?? null
}

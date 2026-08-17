import 'server-only'
import { and, asc, desc, eq, gt, isNull, lte, or } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { salesOffers } from '@/lib/db/schema'
import { cacheKey, cacheTtl, getRedis } from '@/lib/redis'

/**
 * Customer-facing read path for sales offers.
 *
 * Separate module from `lib/sales/offers.ts` on that file's own instruction: the
 * owner-scoped queries there select `min_discount` and `note`, which are the
 * sales user's internal negotiating position and must never reach a customer
 * response (`lib/db/schema.ts` § sales_offers). A column that is never selected
 * cannot leak when someone later deletes a filter by accident, so the split is
 * the enforcement mechanism, not just tidiness.
 *
 * `sales_id` is absent from the projection for a second reason: the homepage
 * shows *products per brand/model*, aggregated across every sales user. Which
 * sales user owns the deepest discount is matching-system territory and does not
 * belong in a public page's data.
 */

/** One product row: the deepest live discount anyone is advertising on a model. */
export type PublicBrandOffer = {
  /** Catalogue slug, e.g. `toyota` — joins to `findModel()` in lib/data/catalog. */
  brand: string
  /** Catalogue slug, e.g. `kijang-innova-zenix`. */
  model: string
  variant: string | null
  /** Rupiah. Null when the sales user did not quote one; fall back to the catalogue. */
  otrPrice: number | null
  /** Rupiah off. Public figure. */
  maxDiscount: number
  campaignName: string | null
  endsAt: Date | null
}

/** How many cards the homepage asks for by default. */
const DEFAULT_LIMIT = 6

/**
 * Ceiling on rows pulled back before the JS sort. The catalogue is 13 brands and
 * well under 200 models, and DISTINCT ON collapses per (brand, model) inside
 * Postgres, so this can only bite if the catalogue grows an order of magnitude —
 * at which point ranking belongs in SQL anyway.
 */
const SCAN_CEILING = 200

/**
 * What actually sits in Redis. `endsAt` is a string here because JSON has no date
 * type: a `Date` written to the cache comes back as an ISO string, so a shape
 * that claimed `Date` would be a lie on every cache hit. Both paths run through
 * `revive()` so the hit and the miss can never drift apart.
 */
type CachedOffer = Omit<PublicBrandOffer, 'endsAt'> & { endsAt: string | null }

function revive(row: CachedOffer): PublicBrandOffer {
  return { ...row, endsAt: row.endsAt === null ? null : new Date(row.endsAt) }
}

/**
 * Deepest live offer per (brand, model), sorted by discount, from Postgres.
 *
 * Filters on `status = 'active'` *and* the date window rather than trusting
 * status alone. The sweep that flips `active` to `expired` is a daily cron, so
 * between the end date and the next run the column is stale by up to a day —
 * same reasoning as `eligibleOffer()` in lib/sales/offers.ts.
 *
 * DISTINCT ON picks one coherent row per model instead of `max(max_discount)`
 * with the other columns aggregated separately, which would splice one offer's
 * campaign name onto another offer's discount.
 */
async function queryOffers(): Promise<CachedOffer[]> {
  const now = new Date()

  const rows = await getDb()
    .selectDistinctOn([salesOffers.brand, salesOffers.model], {
      brand: salesOffers.brand,
      model: salesOffers.model,
      variant: salesOffers.variant,
      otrPrice: salesOffers.otrPrice,
      maxDiscount: salesOffers.maxDiscount,
      campaignName: salesOffers.campaignName,
      endsAt: salesOffers.endsAt,
    })
    .from(salesOffers)
    .where(
      and(
        eq(salesOffers.status, 'active'),
        or(isNull(salesOffers.startsAt), lte(salesOffers.startsAt, now)),
        or(isNull(salesOffers.endsAt), gt(salesOffers.endsAt, now)),
      ),
    )
    // Postgres requires the ORDER BY to lead with the DISTINCT ON expressions;
    // `maxDiscount desc` is what decides which row survives per model.
    .orderBy(asc(salesOffers.brand), asc(salesOffers.model), desc(salesOffers.maxDiscount))
    .limit(SCAN_CEILING)

  return rows
    .map((row) => ({ ...row, endsAt: row.endsAt === null ? null : row.endsAt.toISOString() }))
    .sort((a, b) => b.maxDiscount - a.maxDiscount)
}

/**
 * Best live offer per model, deepest discount first.
 *
 * Read-through Redis cache, 45s (`cacheTtl.homeOffers`). The homepage is the
 * busiest page in the app and this query touches every active offer; without the
 * cache every anonymous visitor spends a pooler connection on it.
 *
 * The cached value is the whole deduped list, not a slice, so callers asking for
 * different `limit`s share one entry.
 */
export async function bestOffersByModel(limit = DEFAULT_LIMIT): Promise<PublicBrandOffer[]> {
  const key = cacheKey.homeOffers()
  const redis = getRedis()

  // A cache miss and a cache outage are the same event to this function: fall
  // through to Postgres, which is the source of truth. Letting an Upstash blip
  // blank the homepage would trade a slow page for no page.
  let cached: CachedOffer[] | null = null
  try {
    cached = await redis.get<CachedOffer[]>(key)
  } catch {
    cached = null
  }

  if (cached) return cached.slice(0, limit).map(revive)

  const fresh = await queryOffers()

  try {
    await redis.set(key, fresh, { ex: cacheTtl.homeOffers })
  } catch {
    // Serving the fresh rows matters more than caching them; the next request
    // simply pays for its own query.
  }

  return fresh.slice(0, limit).map(revive)
}

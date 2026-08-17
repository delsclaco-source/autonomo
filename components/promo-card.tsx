import Link from 'next/link'
import { CarImage } from '@/components/car-image'
import { Card } from '@/components/ui/card'
import { type CatalogEntry, formatRupiahFull } from '@/lib/data/catalog'
import type { PublicBrandOffer } from '@/lib/offers/public'

/**
 * Promo card for the customer homepage.
 *
 * A product card, not a sales-user card: one model, the deepest live discount
 * anyone is advertising on it, and no indication of who is advertising it. Which
 * sales user owns the offer is matching-system territory — `PublicBrandOffer`
 * has no `salesId` for that reason.
 *
 * Deliberately not `components/car-card.tsx`, which calls `marketFor()` from
 * lib/data/demo-market internally and therefore cannot render without inventing
 * a market price, a competing-sales count and a fake sales profile. This card
 * takes every number as a prop, so a figure on screen is a figure in Postgres.
 * That card keeps serving /katalog and /top-diskon, which carry a visible
 * "sample data" disclaimer.
 *
 * `offer === null` is the normal state, not an error: the catalogue has models
 * long before sales users have posted offers against them. In that case the card
 * still shows the real car at its real catalogue OTR and says plainly that no
 * discount has been posted. It never shows a discount figure it does not have.
 */

/**
 * Longest campaign label rendered. Free text written by a sales user, and
 * `campaign_name` is `text` in Postgres with no length limit, so a 400-character
 * "campaign name" would otherwise reflow the whole grid. CSS truncation alone
 * still ships the entire string to the browser.
 */
const CAMPAIGN_MAX = 42

export function PromoCard({
  model,
  offer,
}: {
  model: CatalogEntry
  /** Null when nobody is advertising a discount on this model yet. */
  offer: PublicBrandOffer | null
}) {
  // The sales user's quoted OTR wins over the catalogue: they are the one who
  // has to honour the arithmetic. Catalogue `priceFrom` is the fallback so the
  // card is never priceless.
  const otr = offer?.otrPrice ?? model.priceFrom
  const discount = offer?.maxDiscount ?? 0
  // Clamped at zero: an offer quoted against an OTR lower than its own discount
  // would otherwise render a negative price. Cheaper to clamp than to trust.
  const afterDiscount = Math.max(otr - discount, 0)
  const hasDiscount = offer !== null && discount > 0

  const campaign = offer?.campaignName?.trim()
    ? offer.campaignName.trim().slice(0, CAMPAIGN_MAX)
    : null

  // The customer area is one page, so this points back at the request card on it
  // rather than at a form route. The query seeds the brand/model selects; the
  // fragment is what actually moves the viewport.
  const href = `/?brand=${model.brand.slug}&model=${model.slug}#request`

  return (
    <Card className="group/promo gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none transition-all duration-200 hover:border-foreground/20 hover:shadow-md">
      <div className="relative border-b border-border">
        <CarImage
          bodyType={model.bodyType}
          brandName={model.brand.name}
          alt={`Ilustrasi ${model.brand.name} ${model.name}`}
        />

        {campaign !== null && (
          <span className="absolute right-3 top-3 max-w-[60%] truncate rounded-sm bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
            {campaign}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
          {model.brand.name}
        </p>
        <h3 className="mt-1 font-heading text-[17px] font-semibold leading-tight text-foreground">
          {model.name}
        </h3>
        <p className="mt-1 truncate text-[12px] text-foreground-muted">
          {offer?.variant ?? `${model.variants.length} varian`}
        </p>

        {hasDiscount ? (
          <dl className="mt-3.5 text-[13px]">
            <dt className="sr-only">Harga OTR</dt>
            <dd className="tabular text-foreground-muted line-through">{formatRupiahFull(otr)}</dd>

            <dt className="sr-only">Harga setelah diskon</dt>
            <dd className="tabular mt-0.5 font-heading text-[19px] font-bold leading-none text-foreground">
              {formatRupiahFull(afterDiscount)}
            </dd>

            <dt className="sr-only">Penghematan</dt>
            {/* `text-success` is the dark green, 5.3:1 on white. The brighter
                --color-success-fill never carries text. */}
            <dd className="tabular mt-1.5 text-[13px] font-semibold text-success">
              Hemat {formatRupiahFull(discount)}
            </dd>
          </dl>
        ) : (
          <dl className="mt-3.5 text-[13px]">
            <dt className="text-foreground-muted">Harga OTR</dt>
            <dd className="tabular mt-0.5 font-heading text-[19px] font-bold leading-none text-foreground">
              {formatRupiahFull(otr)}
            </dd>
            <dd className="mt-1.5 text-[12px] text-foreground-muted">Belum ada penawaran diskon</dd>
          </dl>
        )}

        <Link
          href={href}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-foreground/15 px-4 text-[13px] font-semibold text-foreground transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-on-primary"
        >
          {hasDiscount ? 'Klaim diskon' : 'Minta penawaran'}
        </Link>
      </div>
    </Card>
  )
}

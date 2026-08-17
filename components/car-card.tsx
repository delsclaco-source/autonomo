import Link from 'next/link'
import { BadgeCheck, MessageCircle, Star, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { CarImage } from '@/components/car-image'
import { formatRupiah, type CatalogEntry } from '@/lib/data/catalog'
import { marketFor } from '@/lib/data/demo-market'

const TIER_LABEL = { low: 'City', mid: 'Mid', high: 'Premium' } as const

/**
 * Catalogue card.
 *
 * Reading order matches how a buyer decides: what the car is, what it should
 * cost, what it can cost, then who is offering that.
 *
 * The price block is the point of the card. A bare "20% off" tells a buyer
 * nothing they can act on, so three numbers are shown together — list price
 * struck through, the going market price, and the best live offer — plus the
 * rupiah saved. The market price is what stops the best offer from being
 * unfalsifiable: without a baseline, any discount claim is just a badge.
 *
 * The sales figures below the image — rating, review count, contact count — are
 * public reputation data. The customer's own phone number is never on this
 * surface; it becomes visible to a sales user only after an unlock is recorded.
 */
export function CarCard({ model }: { model: CatalogEntry }) {
  const market = marketFor(model)
  const { sales } = market

  return (
    <Card className="group/car gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none transition-all duration-200 hover:border-foreground/20 hover:shadow-md">
      <div className="relative border-b border-border">
        <CarImage
          bodyType={model.bodyType}
          brandName={model.brand.name}
          alt={`Ilustrasi ${model.brand.name} ${model.name}`}
        />

        {/* Meta chips are ink-on-white, not coloured badges: the brand colour on
            this card is reserved for the price. */}
        <div className="absolute left-0 top-0 flex items-center gap-3 px-4 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
          {model.electric && <span className="text-primary">Listrik</span>}
          <span>{TIER_LABEL[model.tier]}</span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
          {model.brand.name}
        </p>
        <h3 className="mt-1 font-heading text-[17px] font-semibold leading-tight text-foreground">
          {model.name}
        </h3>

        {/* Price ladder */}
        <dl className="mt-3.5 space-y-1.5 text-[13px]">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-foreground-muted">Harga OTR</dt>
            <dd className="tabular text-foreground-muted line-through">
              {formatRupiah(market.listPrice)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-foreground-muted">
              Harga pasar
              <span className="ml-1 text-foreground-muted/70">
                (−{market.marketDiscountPercent}%)
              </span>
            </dt>
            <dd className="tabular font-medium text-foreground">
              {formatRupiah(market.marketPrice)}
            </dd>
          </div>
        </dl>

        <div className="mt-3 border-t border-dashed border-border pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
                Penawaran terbaik
              </p>
              <p className="tabular mt-0.5 font-heading text-xl font-bold leading-none text-primary">
                {formatRupiah(market.bestPrice)}
              </p>
            </div>
            <div className="text-right">
              <p className="tabular text-sm font-semibold text-foreground">
                −{market.bestDiscountPercent}%
              </p>
              <p className="tabular text-[11px] text-foreground-muted">
                hemat {formatRupiah(market.bestDiscountAmount)}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
          <Users width={12} height={12} aria-hidden="true" />
          {market.competingSales} sales bersaing
          <span className="text-border">·</span>
          {model.variants.length} varian
        </p>
      </div>

      {/* Sales reputation — sits below the image, on the grey band. */}
      <div className="mt-auto border-t border-border bg-muted px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0 rounded-md">
            <AvatarFallback className="rounded-md bg-foreground text-[11px] font-semibold text-on-accent">
              {sales.initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-[13px] font-medium text-foreground">
              {sales.name}
              {sales.verified && (
                <BadgeCheck
                  width={13}
                  height={13}
                  className="shrink-0 text-primary"
                  aria-label="Sales terverifikasi"
                />
              )}
            </p>
            <p className="truncate text-[11px] text-foreground-muted">{sales.dealer}</p>
          </div>

          <span className="tabular inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-foreground">
            <Star
              width={13}
              height={13}
              fill="currentColor"
              className="text-foreground"
              aria-hidden="true"
            />
            {sales.rating.toFixed(1)}
            <span className="font-normal text-foreground-muted">({sales.reviewCount})</span>
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="tabular inline-flex items-center gap-1 text-[11px] text-foreground-muted">
            <MessageCircle width={12} height={12} aria-hidden="true" />
            {sales.contactCount}× dihubungi
          </span>

          <Link
            href={`/request/baru?brand=${model.brand.slug}&model=${model.slug}`}
            className="ml-auto inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
          >
            Minta penawaran
          </Link>
        </div>
      </div>
    </Card>
  )
}

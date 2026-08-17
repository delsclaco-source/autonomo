import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarRange, Plus, Tag } from 'lucide-react'
import type { OfferStatus } from '@/lib/db/schema'
import { requirePageUser } from '@/lib/auth/guard'
import { formatRupiah } from '@/lib/data/catalog'
import { countByStatus, listOffers, type OfferRow } from '@/lib/sales/offers'
import { benefitLabel } from '@/lib/validation/offer'
import { OfferControls } from './offer-controls'

export const metadata: Metadata = { title: 'Penawaran saya' }
export const dynamic = 'force-dynamic'

/**
 * Sales offers.
 *
 * Hallmark - genre: editorial-catalogue - macrostructure: section-index
 * - design-system: design.md - designed-as-app
 *
 * The inventory side of the marketplace: what this sales user can discount, and
 * by how much. Grouped by brand because that is how a sales user's stock is
 * organised — one person usually covers one or two brands, and a flat
 * chronological list buries the second brand under the first.
 *
 * The status counts are rule-separated cells, not shadowed tiles: they are a
 * reading of the list below them, not four things to press (design.md § 4.5).
 * An offer card is one of the four objects that earn a card, so it keeps one.
 *
 * `minDiscount` is rendered here and only here. This page is behind the owner's
 * session; the customer-facing projection never selects the column.
 */

const STATUS_ORDER = ['active', 'draft', 'paused', 'expired'] as const

const STATUS_LABEL: Record<OfferStatus, string> = {
  active: 'Aktif',
  paused: 'Dijeda',
  draft: 'Draft',
  expired: 'Berakhir',
}

// Only the live state carries a fill; the rest are hairline outlines. Red is not
// spent here — it belongs to the one action and the discount figure (design.md § 2).
const STATUS_CLASS: Record<OfferStatus, string> = {
  active: 'border-foreground bg-foreground text-on-accent',
  paused: 'border-border text-foreground-muted',
  draft: 'border-border text-foreground-muted',
  expired: 'border-border text-foreground-muted',
}

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

export default async function SalesOffersPage() {
  const user = await requirePageUser('sales')
  const offers = await listOffers(user.id)
  const counts = countByStatus(offers)

  // Insertion order follows the list, which is newest first — the brand a user
  // last worked on stays at the top instead of jumping to an alphabetical slot.
  const byBrand = new Map<string, OfferRow[]>()
  for (const offer of offers) {
    const list = byBrand.get(offer.brandName) ?? []
    list.push(offer)
    byBrand.set(offer.brandName, list)
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Penawaran saya
          </h1>
          <p className="mt-1 max-w-xl text-sm text-foreground-muted">
            Diskon yang Anda sanggupi per model. Customer melihat angka maksimalnya saat mencari
            mobil yang sama.
          </p>
        </div>

        <Link
          href="/offers/baru"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
        >
          <Plus width={16} height={16} aria-hidden="true" />
          Tambah penawaran
        </Link>
      </header>

      {offers.length > 0 && (
        <dl className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-[repeat(4,minmax(0,1fr))] sm:divide-y-0">
          {STATUS_ORDER.map((key) => (
            <div key={key} className="min-w-0 px-4 py-3.5 first:pl-1 sm:first:pl-4">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                {STATUS_LABEL[key]}
              </dt>
              <dd className="tabular mt-1 font-heading text-2xl font-bold leading-none text-foreground">
                {counts[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {offers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <Tag
            width={22}
            height={22}
            className="mx-auto text-foreground-muted"
            aria-hidden="true"
          />
          <p className="mt-3 font-heading text-base font-semibold text-foreground">
            Belum ada penawaran
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-muted">
            Daftarkan mobil yang Anda pegang beserta diskon maksimalnya. Customer yang request model
            itu akan melihat penawaran Anda lebih dulu.
          </p>
          <Link
            href="/offers/baru"
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
          >
            <Plus width={16} height={16} aria-hidden="true" />
            Tambah penawaran pertama
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {[...byBrand.entries()].map(([brandName, rows]) => (
            <section key={brandName} className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  {brandName}
                </h2>
                <p className="tabular text-sm text-foreground-muted">{rows.length} penawaran</p>
              </div>

              <ul className="space-y-3">
                {rows.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function OfferCard({ offer }: { offer: OfferRow }) {
  // `otr_price` is nullable in the schema: rows written before the column existed,
  // and any future import path that omits it, have no base to divide by. No OTR
  // means no percentage — showing one against a guessed price would misstate the
  // offer.
  const otrPrice = offer.otrPrice
  const percent = otrPrice !== null && otrPrice > 0 ? (offer.maxDiscount / otrPrice) * 100 : null
  const hasSchedule = Boolean(offer.campaignName || offer.startsAt || offer.endsAt)

  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-foreground/20 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold leading-snug text-foreground">
            {offer.modelName}
            {offer.variant && (
              <span className="ml-1.5 text-sm font-normal text-foreground-muted">
                {offer.variant}
              </span>
            )}
          </h3>
          <p className="tabular mt-0.5 text-xs text-foreground-muted">
            {otrPrice !== null ? `OTR ${formatRupiah(otrPrice)}` : 'Harga OTR belum dicantumkan'}
          </p>
        </div>

        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${STATUS_CLASS[offer.status]}`}
        >
          {STATUS_LABEL[offer.status]}
        </span>
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-3.5 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
            Diskon maksimal
          </dt>
          <dd className="tabular mt-0.5 font-heading text-xl font-bold leading-tight text-primary">
            {formatRupiah(offer.maxDiscount)}
            {percent !== null && (
              <span className="ml-1.5 text-sm font-normal text-foreground-muted">
                {percent.toFixed(1)}%
              </span>
            )}
          </dd>
        </div>

        {offer.minDiscount !== null && (
          <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
              Batas bawah · internal
            </dt>
            <dd className="tabular mt-0.5 font-heading text-base font-semibold leading-tight text-foreground">
              {formatRupiah(offer.minDiscount)}
            </dd>
          </div>
        )}
      </dl>

      {hasSchedule && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
          <CalendarRange
            width={13}
            height={13}
            className="shrink-0 text-foreground-muted"
            aria-hidden="true"
          />
          {offer.campaignName && (
            <span className="font-semibold text-foreground">{offer.campaignName}</span>
          )}
          {(offer.startsAt || offer.endsAt) && (
            <span className="tabular">
              {offer.startsAt ? dateFormat.format(offer.startsAt) : 'Mulai sekarang'}
              {' – '}
              {offer.endsAt ? dateFormat.format(offer.endsAt) : 'tanpa batas'}
            </span>
          )}
        </p>
      )}

      {offer.benefits.length > 0 && (
        <ul className="mt-3 divide-y divide-border border-t border-border text-xs">
          {offer.benefits.map((b) => (
            <li key={b.benefit} className="py-2 text-foreground">
              {b.note ?? benefitLabel(b.benefit)}
            </li>
          ))}
        </ul>
      )}

      {offer.note && (
        <p className="mt-3 border-l-2 border-border pl-3 text-xs leading-relaxed text-foreground-muted">
          <span className="font-semibold text-foreground">Catatan internal: </span>
          {offer.note}
        </p>
      )}

      <div className="mt-4 border-t border-border pt-3.5">
        <OfferControls offerId={offer.id} status={offer.status} />
      </div>
    </li>
  )
}

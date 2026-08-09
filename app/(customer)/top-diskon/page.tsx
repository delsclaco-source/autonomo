import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, Info, TrendingDown } from 'lucide-react'
import { ALL_MODELS, BRANDS, formatRupiah, type CatalogEntry } from '@/lib/data/catalog'
import { marketFor } from '@/lib/data/demo-market'

export const metadata: Metadata = {
  title: 'Top diskon mobil baru',
  description:
    'Peringkat diskon terbesar yang sedang ditawarkan sales dealer resmi, diperbarui mengikuti penawaran yang masuk.',
}

/**
 * Top discount ranking.
 *
 * PLACEHOLDER DATA. Ranks are derived from `lib/data/demo-market`, not from the
 * `top_discount` table, which is empty until sales users start submitting offers.
 * The shape below is what the real query has to return.
 *
 * When this is wired up: rank is computed in the query (`ORDER BY
 * discount_percent DESC`) and the result cached in Redis for 30–60s. Rank is
 * never stored — a stored rank goes stale the moment any offer changes, and the
 * whole point of this page is that it is current. See CLAUDE.md § 6.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const TOP_N = 10

function rankedModels(brandSlug?: string): CatalogEntry[] {
  const pool = brandSlug ? ALL_MODELS.filter((m) => m.brand.slug === brandSlug) : ALL_MODELS
  return [...pool]
    .sort((a, b) => marketFor(b).bestDiscountPercent - marketFor(a).bestDiscountPercent)
    .slice(0, TOP_N)
}

export default async function TopDiscountPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const brandSlug = typeof params.brand === 'string' ? params.brand : undefined
  const brand = BRANDS.find((b) => b.slug === brandSlug)
  const ranked = rankedModels(brand?.slug)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
      <header className="border-b border-border pb-6">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          <TrendingDown width={14} height={14} aria-hidden="true" />
          Peringkat diskon
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Top {TOP_N} diskon{brand ? ` ${brand.name}` : ''}.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
          Diurutkan dari potongan terbesar terhadap harga OTR. Angka bergerak mengikuti penawaran
          yang sedang dipasang sales — request Anda ikut mendorongnya turun.
        </p>
      </header>

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <BrandChip href="/top-diskon" active={!brand}>
          Semua brand
        </BrandChip>
        {BRANDS.map((b) => (
          <BrandChip key={b.slug} href={`/top-diskon?brand=${b.slug}`} active={brand?.slug === b.slug}>
            {b.name}
          </BrandChip>
        ))}
      </div>

      <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {ranked.map((model, index) => {
          const market = marketFor(model)
          const rank = index + 1

          return (
            <li key={`${model.brand.slug}-${model.slug}`}>
              <Link
                href={`/request/baru?brand=${model.brand.slug}&model=${model.slug}`}
                className="flex items-center gap-3 bg-surface px-3 py-4 transition-colors duration-200 hover:bg-muted sm:gap-4 sm:px-5"
              >
                {/* Top three carry the brand colour; the rest stay ink, so the
                    podium reads at a glance without eleven red numbers. */}
                <span
                  className={`tabular flex size-9 shrink-0 items-center justify-center rounded-md font-heading text-base font-bold ${
                    rank <= 3 ? 'bg-primary text-on-primary' : 'bg-muted text-foreground-muted'
                  }`}
                  aria-label={`Peringkat ${rank}`}
                >
                  {rank}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                    {model.brand.name}
                    {model.electric && <span className="ml-1.5 text-primary">Listrik</span>}
                  </p>
                  <p className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground">
                    {model.name}
                  </p>
                  <p className="tabular mt-1 truncate text-[11px] text-foreground-muted">
                    <span className="line-through">{formatRupiah(market.listPrice)}</span>
                    <span className="mx-1.5 text-border">→</span>
                    <span className="font-semibold text-foreground">
                      {formatRupiah(market.bestPrice)}
                    </span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tabular font-heading text-xl font-bold leading-none text-primary">
                    −{market.bestDiscountPercent}%
                  </p>
                  <p className="tabular mt-1 text-[11px] text-foreground-muted">
                    hemat {formatRupiah(market.bestDiscountAmount)}
                  </p>
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                    {market.sales.verified && (
                      <BadgeCheck width={11} height={11} className="text-primary" aria-hidden="true" />
                    )}
                    {market.competingSales} sales
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>

      <p className="mt-5 flex items-start gap-2 rounded-md border border-border bg-muted px-4 py-3 text-xs leading-relaxed text-foreground-muted">
        <Info width={14} height={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Angka di halaman ini masih data contoh sampai penawaran sales pertama masuk. Diskon final
        tetap ditentukan dealer dan bisa berbeda per unit, warna, dan waktu pengambilan.
      </p>

      <div className="mt-8 rounded-lg bg-foreground px-6 py-8 text-center">
        <h2 className="font-heading text-xl font-bold text-white">
          Model incaran Anda belum ada di daftar?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
          Pasang harga yang Anda mau. Sales yang sanggup memenuhinya yang akan menghubungi.
        </p>
        <Link
          href="/request/baru"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-7 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
        >
          Buat request
        </Link>
      </div>
    </div>
  )
}

function BrandChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-200 ${
        active
          ? 'border-foreground bg-foreground text-on-accent'
          : 'border-border text-foreground-muted hover:border-foreground/30 hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}

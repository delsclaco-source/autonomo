import type { Metadata } from 'next'
import Link from 'next/link'
import { CarCard } from '@/components/car-card'
import { ALL_MODELS, BRANDS, spreadByBrand, type CatalogEntry } from '@/lib/data/catalog'
import { marketFor } from '@/lib/data/demo-market'

export const metadata: Metadata = {
  title: 'Katalog mobil baru',
  description:
    'Bandingkan harga OTR, harga pasar, dan penawaran terbaik dari sales dealer resmi untuk setiap model mobil baru di Indonesia.',
}

/**
 * Catalogue.
 *
 * Filters are links, not client state. Every combination is therefore a real URL
 * a buyer can bookmark, share, or land on from search — and the page keeps working
 * before any JavaScript has loaded, which on a mid-range Android over 4G is a
 * meaningful part of the visit.
 *
 * Unknown or malformed values fall back to the unfiltered view rather than
 * erroring: these come from the address bar, so they are input like any other.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const SORTS = {
  murah: { label: 'Harga terendah', apply: (a: CatalogEntry, b: CatalogEntry) => a.priceFrom - b.priceFrom },
  mahal: { label: 'Harga tertinggi', apply: (a: CatalogEntry, b: CatalogEntry) => b.priceFrom - a.priceFrom },
  diskon: {
    label: 'Diskon terbesar',
    apply: (a: CatalogEntry, b: CatalogEntry) =>
      marketFor(b).bestDiscountPercent - marketFor(a).bestDiscountPercent,
  },
} as const

type SortKey = keyof typeof SORTS

const JENIS = {
  listrik: { label: 'Listrik', match: (m: CatalogEntry) => m.electric },
  bensin: { label: 'Bensin & hybrid', match: (m: CatalogEntry) => !m.electric },
} as const

type JenisKey = keyof typeof JENIS

const TIERS = {
  low: 'Di bawah Rp300 jt',
  mid: 'Rp300–600 jt',
  high: 'Di atas Rp600 jt',
} as const

type TierKey = keyof typeof TIERS

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const brandSlug = one(params.brand)
  const brand = BRANDS.find((b) => b.slug === brandSlug)
  const jenis = (one(params.jenis) ?? '') as JenisKey
  const tier = (one(params.tier) ?? '') as TierKey
  // Resolve the sort against the known keys explicitly. An absent or unknown
  // `urut` has to land on the default, not on `undefined` — everything below
  // indexes `SORTS` with this value.
  const urut = one(params.urut)
  const sort: SortKey = urut && urut in SORTS ? (urut as SortKey) : 'diskon'

  let models = ALL_MODELS
  if (brand) models = models.filter((m) => m.brand.slug === brand.slug)
  if (jenis in JENIS) models = models.filter(JENIS[jenis].match)
  if (tier in TIERS) models = models.filter((m) => m.tier === tier)

  // Brand spread only helps the unfiltered view; once a brand is chosen it would
  // just shuffle that brand's own models away from the requested order.
  const sorted = [...models].sort(SORTS[sort].apply)
  const results = brand ? sorted : spreadByBrand(sorted)

  /** Build a URL with one facet changed, keeping the rest. Empty value clears it. */
  const withParam = (key: string, value: string) => {
    const next = new URLSearchParams()
    if (brandSlug) next.set('brand', brandSlug)
    if (jenis in JENIS) next.set('jenis', jenis)
    if (tier in TIERS) next.set('tier', tier)
    if (sort !== 'diskon') next.set('urut', sort)

    if (value) next.set(key, value)
    else next.delete(key)

    const qs = next.toString()
    return `/katalog${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Katalog</p>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Semua mobil baru, dengan harga yang bisa dibandingkan.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
          Setiap kartu menampilkan harga OTR, harga pasar saat ini, dan penawaran terbaik yang
          sedang dipasang sales dealer resmi.
        </p>
      </header>

      {/* Filter rows scroll horizontally on mobile rather than wrapping into a
          wall of chips that pushes the results below the fold. */}
      <div className="space-y-3 border-b border-border py-5">
        <FilterRow label="Jenis">
          <Chip href={withParam('jenis', '')} active={!(jenis in JENIS)}>
            Semua
          </Chip>
          {(Object.keys(JENIS) as JenisKey[]).map((key) => (
            <Chip key={key} href={withParam('jenis', key)} active={jenis === key}>
              {JENIS[key].label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Harga">
          <Chip href={withParam('tier', '')} active={!(tier in TIERS)}>
            Semua
          </Chip>
          {(Object.keys(TIERS) as TierKey[]).map((key) => (
            <Chip key={key} href={withParam('tier', key)} active={tier === key}>
              {TIERS[key]}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Brand">
          <Chip href={withParam('brand', '')} active={!brand}>
            Semua
          </Chip>
          {BRANDS.map((b) => (
            <Chip key={b.slug} href={withParam('brand', b.slug)} active={brand?.slug === b.slug}>
              {b.name}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <p className="tabular text-sm text-foreground-muted">
          <span className="font-semibold text-foreground">{results.length}</span> model
          {brand ? ` dari ${brand.name}` : ''}
        </p>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <Chip key={key} href={withParam('urut', key)} active={sort === key}>
              {SORTS[key].label}
            </Chip>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="font-heading text-lg font-semibold text-foreground">
            Tidak ada model yang cocok.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-foreground-muted">
            Longgarkan filternya, atau kirim request langsung — sales akan menawar meski modelnya
            belum ada di katalog.
          </p>
          <Link
            href="/katalog"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
          >
            Hapus semua filter
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((model) => (
            <CarCard key={`${model.brand.slug}-${model.slug}`} model={model} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
        {label}
      </span>
      {/* `-mx-1 px-1` so focus rings on the first and last chip are not clipped
          by the scroll container. */}
      <div className="-mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  )
}

function Chip({
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

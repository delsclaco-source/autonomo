import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, EyeOff, Info, UserCheck } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { BRANDS } from '@/lib/data/catalog'
import { marketplaceLeads, salesOverview } from '@/lib/sales/queries'
import {
  TIER_LABEL,
  formatRupiah,
  isFresh,
  leadPricing,
  timeAgo,
  timeframeLabel,
} from '@/lib/sales/present'
import type { CarTier } from '@/lib/db/schema'
import { UnlockButton } from './unlock-button'

export const metadata: Metadata = { title: 'Hot leads' }
export const dynamic = 'force-dynamic'

/**
 * Lead marketplace.
 *
 * Hallmark - genre: editorial-catalogue - macrostructure: section-index
 * - design-system: design.md - designed-as-app
 *
 * What a sales user is deciding here is one thing: is this request worth the
 * tokens. So every card leads with the two numbers that answer it — the target
 * price in rupiah and the gap the dealer would have to cover. The buyer's name
 * and number are not in the query at all; they are what the tokens buy.
 *
 * This screen is the *pool* lane only. A request lands here when its price was
 * implausible enough to be flagged at submission, or when its auction closed
 * without a valid bid — everything still being competed for is on the Lelang
 * screen and costs margin, not tokens. Whoever unlocks first owns the request
 * outright, so there is no competitor count to show: the number would only ever
 * be zero, and by the time it was one the card would be gone.
 *
 * The card is one of the four things design.md § 4.4 lets be a card: a discrete
 * object the user acts on. Red survives on exactly two things per card — the
 * target price (the number the user came for) and the unlock button (the one
 * next action) — so the "Baru" marker and the tier tag are ink, not red.
 *
 * Filters are links so a sales user who works one brand can bookmark that view
 * and the back button behaves. Tier doubles as a price filter, since tier is what
 * unlock cost is derived from.
 */

const TIERS: CarTier[] = ['low', 'mid', 'high']

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function SalesLeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser('sales')
  const params = await searchParams

  const brand = one(params.brand)
  const tierParam = one(params.tier)
  const tier = TIERS.includes(tierParam as CarTier) ? (tierParam as CarTier) : undefined

  const [overview, rows] = await Promise.all([
    salesOverview(user.id),
    marketplaceLeads(user.id, { brand, tier }),
  ])

  const quotaReached =
    overview.dailyLimit !== null && overview.unlocksToday >= overview.dailyLimit

  const withParam = (key: string, value: string) => {
    const next = new URLSearchParams()
    if (brand) next.set('brand', brand)
    if (tier) next.set('tier', tier)
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    return `/leads${qs ? `?${qs}` : ''}`
  }

  const freshCount = rows.filter((row) => isFresh(row.createdAt)).length

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Hot leads
          </h1>
          <p className="mt-1 max-w-xl text-sm text-foreground-muted">
            Request yang bisa dibuka dengan token. Satu request untuk satu sales — nama dan nomor
            terbuka setelah unlock.
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">Terbuka</p>
          <p className="tabular mt-0.5 font-heading text-base font-semibold text-foreground">
            {rows.length}
            {freshCount > 0 && (
              <span className="font-normal text-foreground-muted"> · {freshCount} baru</span>
            )}
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {/* Quota is stated before the list, not after a failed unlock. Finding out
            the daily cap is spent only when the button rejects you is the worst
            possible moment to learn it. Colour is not the signal here — the icon
            and the wording are (design.md § 2, § 7). */}
        {overview.dailyLimit !== null && (
          <div
            className={`flex items-start gap-2 rounded-md border px-4 py-3 text-xs leading-relaxed ${
              quotaReached
                ? 'border-foreground/35 bg-muted text-foreground'
                : 'border-border text-foreground-muted'
            }`}
          >
            <Info
              width={14}
              height={14}
              className="mt-0.5 shrink-0 text-foreground-muted"
              aria-hidden="true"
            />
            <span>
              <span className="tabular font-semibold text-foreground">
                {overview.unlocksToday}/{overview.dailyLimit}
              </span>{' '}
              unlock terpakai hari ini{quotaReached ? ' — kuota habis' : ''} (akun gratis, reset
              00:00 WIB).{' '}
              <Link
                href="/topup"
                className="font-semibold text-foreground underline decoration-border underline-offset-2 transition-colors duration-200 hover:decoration-foreground"
              >
                Premium menghapus batas ini
              </Link>
              .
            </span>
          </div>
        )}

        <FilterRow label="Tier">
          <Chip href={withParam('tier', '')} active={!tier}>
            Semua
          </Chip>
          {TIERS.map((t) => (
            <Chip key={t} href={withParam('tier', t)} active={tier === t}>
              {TIER_LABEL[t]}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Brand">
          <Chip href={withParam('brand', '')} active={!brand}>
            Semua
          </Chip>
          {BRANDS.map((b) => (
            <Chip key={b.slug} href={withParam('brand', b.slug)} active={brand === b.slug}>
              {b.name}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-base font-semibold text-foreground">
            Tidak ada lead di filter ini.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-muted">
            Lead baru masuk setiap kali ada customer mengirim request. Longgarkan filter, atau
            bagikan kode referral Anda supaya lebih banyak pembeli masuk lewat Anda.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/leads"
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
            >
              Hapus filter
            </Link>
            <Link
              href="/referral"
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-hover"
            >
              Kode referral
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const price = leadPricing(row.brand, row.model, row.discountWanted)
            const fresh = isFresh(row.createdAt)

            return (
              <li
                key={row.requestId}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-foreground/20 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                      {price.brandName}
                      <span className="rounded border border-border px-1.5 py-0.5 tracking-normal">
                        {TIER_LABEL[row.tier]}
                      </span>
                      {fresh && (
                        <span className="rounded bg-accent px-1.5 py-0.5 tracking-normal text-on-accent">
                          Baru
                        </span>
                      )}
                    </p>
                    <h2 className="mt-1.5 font-heading text-base font-semibold leading-snug text-foreground">
                      {price.modelName}
                      {row.variant && (
                        <span className="ml-1.5 text-sm font-normal text-foreground-muted">
                          {row.variant}
                        </span>
                      )}
                    </h2>
                  </div>

                  <p className="tabular shrink-0 text-right">
                    <span className="block font-heading text-xl font-bold leading-none text-primary">
                      {price.targetPrice > 0
                        ? formatRupiah(price.targetPrice)
                        : `−${row.discountWanted.toFixed(1)}%`}
                    </span>
                    <span className="mt-1 block text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                      target customer
                    </span>
                  </p>
                </div>

                <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-3.5 text-sm sm:grid-cols-[repeat(4,minmax(0,1fr))]">
                  <Fact label="Harga OTR">
                    {price.listPrice > 0 ? formatRupiah(price.listPrice) : '—'}
                  </Fact>
                  <Fact label="Selisih">
                    {price.gap > 0 ? `−${formatRupiah(price.gap)}` : '—'}
                  </Fact>
                  <Fact label="Diskon diminta">−{row.discountWanted.toFixed(1)}%</Fact>
                  <Fact label="Rencana ambil">{timeframeLabel(row.purchaseTimeframe) ?? '—'}</Fact>
                </dl>

                {row.notes && (
                  <p className="mt-3.5 border-l-2 border-border pl-3 text-sm leading-relaxed text-foreground">
                    &ldquo;{row.notes}&rdquo;
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
                    <span className="tabular inline-flex items-center gap-1">
                      <Clock width={12} height={12} aria-hidden="true" />
                      {timeAgo(row.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserCheck width={12} height={12} aria-hidden="true" />
                      Eksklusif — 1 sales saja
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <EyeOff width={12} height={12} aria-hidden="true" />
                      Nama &amp; nomor tersembunyi
                    </span>
                  </div>

                  <UnlockButton
                    requestId={row.requestId}
                    tokenCost={row.tokenCost}
                    balance={overview.tokenBalance}
                    quotaReached={quotaReached}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-medium text-foreground">{children}</dd>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
        {label}
      </span>
      <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border px-3.5 text-[13px] font-medium transition-colors duration-200 ${
        active
          ? 'border-foreground bg-foreground text-on-accent'
          : 'border-border text-foreground-muted hover:border-foreground/30 hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, EyeOff, Flame, Info, Users } from 'lucide-react'
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
 * What a sales user is deciding here is one thing: is this request worth the
 * tokens. So every card leads with the two numbers that answer it — the target
 * price in rupiah and the gap the dealer would have to cover — and follows with
 * how contested the lead already is. The buyer's name and number are not in the
 * query at all; they are what the tokens buy.
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
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Hot leads
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {rows.length === 0
            ? 'Belum ada request yang cocok dengan filter ini.'
            : `${rows.length} request terbuka${freshCount > 0 ? `, ${freshCount} masuk < 6 jam terakhir` : ''}.`}
        </p>
      </header>

      {/* Quota is stated before the list, not after a failed unlock. Finding out
          the daily cap is spent only when the button rejects you is the worst
          possible moment to learn it. */}
      {overview.dailyLimit !== null && (
        <div
          className={`flex items-start gap-2 rounded-md border px-4 py-3 text-xs leading-relaxed ${
            quotaReached
              ? 'border-primary/30 bg-primary/5 text-foreground'
              : 'border-border bg-muted text-foreground-muted'
          }`}
        >
          <Info width={14} height={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="tabular font-semibold text-foreground">
              {overview.unlocksToday}/{overview.dailyLimit}
            </span>{' '}
            unlock terpakai hari ini (akun gratis, reset 00:00 WIB).{' '}
            <Link href="/topup" className="font-semibold text-primary underline">
              Premium menghapus batas ini
            </Link>
            .
          </span>
        </div>
      )}

      <div className="space-y-2.5">
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
              className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
            >
              Hapus filter
            </Link>
            <Link
              href="/referral"
              className="inline-flex min-h-11 items-center rounded-md bg-foreground px-5 text-sm font-semibold text-on-accent transition-colors duration-200 hover:opacity-90"
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
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                      {price.brandName}
                      <span className="rounded bg-muted px-1.5 py-0.5 tracking-normal">
                        {TIER_LABEL[row.tier]}
                      </span>
                      {fresh && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 tracking-normal text-primary">
                          <Flame width={11} height={11} aria-hidden="true" />
                          Baru
                        </span>
                      )}
                    </p>
                    <h2 className="mt-1 font-heading text-lg font-semibold leading-tight text-foreground">
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
                    <span className="mt-1 block text-[11px] text-foreground-muted">
                      target customer
                    </span>
                  </p>
                </div>

                <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-3.5 text-sm sm:grid-cols-4">
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
                  <p className="mt-3 rounded-md bg-muted px-3 py-2.5 text-sm italic leading-relaxed text-foreground">
                    &ldquo;{row.notes}&rdquo;
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock width={12} height={12} aria-hidden="true" />
                      {timeAgo(row.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users width={12} height={12} aria-hidden="true" />
                      {row.competitors === 0
                        ? 'Belum ada sales membuka'
                        : `${row.competitors} sales sudah membuka`}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <EyeOff width={12} height={12} aria-hidden="true" />
                      Nama & nomor tersembunyi
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
    <div>
      <dt className="text-[11px] uppercase tracking-[0.08em] text-foreground-muted">{label}</dt>
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

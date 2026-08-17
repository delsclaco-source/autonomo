import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Check, Coins, Info } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { formatRupiah } from '@/lib/data/catalog'
import { salesOverview, tokenHistory } from '@/lib/sales/queries'
import {
  TOKEN_PACKAGES,
  pricePerToken,
  savingsPercent,
  totalTokens,
  type TokenPackage,
} from '@/lib/sales/packages'
import { timeAgo } from '@/lib/sales/present'

export const metadata: Metadata = { title: 'Top up token' }
export const dynamic = 'force-dynamic'

/**
 * Token top-up.
 *
 * Hallmark - genre: editorial-catalogue - macrostructure: section-index
 * - design-system: design.md - designed-as-app
 *
 * Checkout is not live: no payment provider has been selected yet (CLAUDE.md
 * § Tech Stack lists Midtrans/Xendit as the candidates). The buttons say so
 * rather than opening a dead modal — a sales user who taps "Bayar" and lands
 * nowhere assumes the account is broken, not that the feature is unbuilt.
 *
 * The balance slab is the only ink band on the screen: it holds the number the
 * user came for (design.md § 4.5). Package prices are plain ink — with checkout
 * disabled there is no primary action to spend red on, and a red price with a
 * dead button underneath it is the worst of both.
 *
 * Below the packages is the ledger. It is not decoration: `token_ledger` is the
 * source of truth for the balance in the slab, so showing it is what lets a
 * sales user check the arithmetic themselves instead of filing a support ticket.
 * Debits are marked by the arrow and the sign, never by colour alone (§ 7).
 */

const REASON_LABEL: Record<string, string> = {
  freemium_grant: 'Bonus pendaftaran',
  topup: 'Top up',
  unlock: 'Buka kontak lead',
  referral: 'Bonus referral',
  admin_adjustment: 'Penyesuaian admin',
  refund: 'Pengembalian',
}

export default async function SalesTopupPage() {
  const user = await requirePageUser('sales')
  const [overview, ledger] = await Promise.all([
    salesOverview(user.id),
    tokenHistory(user.id, 30),
  ])

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Token</h1>
        <p className="mt-1 max-w-xl text-sm text-foreground-muted">
          1 token = 1 poin. Biaya buka kontak tergantung tier mobil: 5–10 city car, 20–30 SUV/MPV,
          50–100 premium.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-accent px-5 py-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-accent/60">
            Saldo Anda
          </p>
          <p className="tabular mt-1 font-heading text-4xl font-bold leading-none text-on-accent">
            {overview.tokenBalance.toLocaleString('id-ID')}
            <span className="ml-2 text-base font-normal text-on-accent/60">token</span>
          </p>
        </div>
        <p className="tabular max-w-56 text-xs leading-relaxed text-on-accent/60">
          {overview.dailyLimit === null ? (
            'Akun premium — tanpa batas unlock harian.'
          ) : (
            <>
              Akun gratis · {overview.unlocksToday}/{overview.dailyLimit} unlock hari ini
              <span className="mt-0.5 block">Reset pukul 00:00 WIB.</span>
            </>
          )}
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Paket top up
          </h2>
          <p className="mt-1 max-w-xl text-sm text-foreground-muted">
            Semakin besar paket, semakin murah per tokennya. Bonus dihitung di dalam harga per token
            di bawah.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          {TOKEN_PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </ul>

        <p className="flex items-start gap-2 rounded-md border border-border px-4 py-3 text-xs leading-relaxed text-foreground-muted">
          <Info
            width={14}
            height={14}
            className="mt-0.5 shrink-0 text-foreground-muted"
            aria-hidden="true"
          />
          Pembayaran belum aktif — payment gateway masih dalam proses integrasi. Token yang sudah
          ada di saldo Anda tetap bisa dipakai seperti biasa.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Riwayat token
          </h2>
          {ledger.length > 0 && (
            <p className="tabular text-sm text-foreground-muted">
              {ledger.length} transaksi terakhir
            </p>
          )}
        </div>

        {ledger.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm leading-relaxed text-foreground-muted">
            Belum ada pergerakan token. Bonus pendaftaran dan setiap unlock akan tercatat di sini.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {ledger.map((entry) => {
              const positive = entry.delta > 0
              return (
                <li key={entry.id} className="flex items-center gap-3 bg-surface px-4 py-3 text-sm">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-md border border-border ${
                      positive ? 'text-foreground' : 'bg-muted text-foreground-muted'
                    }`}
                    aria-hidden="true"
                  >
                    {positive ? (
                      <ArrowDownLeft width={15} height={15} />
                    ) : (
                      <ArrowUpRight width={15} height={15} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {REASON_LABEL[entry.reason] ?? entry.reason}
                    </p>
                    <p className="truncate text-[11px] text-foreground-muted">
                      {timeAgo(entry.createdAt)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </p>
                  </div>

                  <p className="tabular shrink-0 text-right">
                    <span className="block font-heading font-bold text-foreground">
                      {positive ? '+' : ''}
                      {entry.delta}
                    </span>
                    <span className="block text-[11px] text-foreground-muted">
                      sisa {entry.balanceAfter}
                    </span>
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs leading-relaxed text-foreground-muted">
        Butuh token gratis?{' '}
        <Link
          href="/referral"
          className="font-semibold text-foreground underline decoration-border underline-offset-2 transition-colors duration-200 hover:decoration-foreground"
        >
          Ajak sales lain lewat kode referral
        </Link>{' '}
        — 30 token per pendaftaran, maksimal 300 token per bulan.
      </p>
    </div>
  )
}

function PackageCard({ pkg }: { pkg: TokenPackage }) {
  const total = totalTokens(pkg)
  const perToken = pricePerToken(pkg)
  const savings = savingsPercent(pkg)

  return (
    <li className="relative flex flex-col rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      {pkg.recommended && (
        <span className="absolute -top-2.5 left-4 rounded border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
          Paling banyak dipilih
        </span>
      )}

      <h3 className="font-heading text-base font-semibold leading-snug text-foreground">
        {pkg.name}
      </h3>

      <p className="tabular mt-2 font-heading text-2xl font-bold leading-none text-foreground">
        {total.toLocaleString('id-ID')}
        <span className="ml-1.5 text-sm font-normal text-foreground-muted">token</span>
      </p>

      {pkg.bonus > 0 && (
        <p className="tabular mt-1.5 inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-foreground-muted">
          <Check width={11} height={11} aria-hidden="true" />
          {pkg.tokens.toLocaleString('id-ID')} + {pkg.bonus} bonus
        </p>
      )}

      <p className="tabular mt-3 font-heading text-lg font-bold leading-tight text-foreground">
        {formatRupiah(pkg.price)}
      </p>
      <p className="tabular text-[11px] text-foreground-muted">
        {formatRupiah(perToken)} / token
        {savings > 0 && <span className="ml-1 font-semibold text-foreground">hemat {savings}%</span>}
      </p>

      {pkg.note && <p className="mt-2 text-xs leading-relaxed text-foreground-muted">{pkg.note}</p>}

      <button
        type="button"
        disabled
        title="Payment gateway belum terpasang"
        className="mt-4 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-border bg-muted px-4 text-sm font-semibold text-foreground-muted"
      >
        <Coins width={15} height={15} aria-hidden="true" />
        Segera hadir
      </button>
    </li>
  )
}

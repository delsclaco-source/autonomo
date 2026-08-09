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
 * Checkout is not live: no payment provider has been selected yet (CLAUDE.md
 * § Tech Stack lists Midtrans/Xendit as the candidates). The buttons say so
 * rather than opening a dead modal — a sales user who taps "Bayar" and lands
 * nowhere assumes the account is broken, not that the feature is unbuilt.
 *
 * Below the packages is the ledger. It is not decoration: `token_ledger` is the
 * source of truth for the balance in the header, so showing it is what lets a
 * sales user check the arithmetic themselves instead of filing a support ticket.
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
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Token
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          1 token = 1 poin. Biaya buka kontak tergantung tier mobil: 5–10 city car, 20–30 SUV/MPV,
          50–100 premium.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-foreground px-5 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
            Saldo Anda
          </p>
          <p className="tabular mt-1 font-heading text-4xl font-bold leading-none text-white">
            {overview.tokenBalance.toLocaleString('id-ID')}
            <span className="ml-2 text-base font-normal text-white/60">token</span>
          </p>
        </div>
        <p className="text-xs leading-relaxed text-white/70">
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

      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">Paket top up</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Semakin besar paket, semakin murah per tokennya. Bonus dihitung di dalam harga per token
          di bawah.
        </p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOKEN_PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </ul>

        <p className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted px-4 py-3 text-xs leading-relaxed text-foreground-muted">
          <Info width={14} height={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Pembayaran belum aktif — payment gateway masih dalam proses integrasi. Token yang sudah
          ada di saldo Anda tetap bisa dipakai seperti biasa.
        </p>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">Riwayat token</h2>
          {ledger.length > 0 && (
            <p className="text-xs text-foreground-muted">{ledger.length} transaksi terakhir</p>
          )}
        </div>

        {ledger.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-foreground-muted">
            Belum ada pergerakan token. Bonus pendaftaran dan setiap unlock akan tercatat di sini.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {ledger.map((entry) => {
              const positive = entry.delta > 0
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 bg-surface px-4 py-3 text-sm"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                      positive ? 'bg-muted text-foreground' : 'bg-primary/10 text-primary'
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
                    <span
                      className={`block font-heading font-bold ${
                        positive ? 'text-foreground' : 'text-primary'
                      }`}
                    >
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

      <p className="text-center text-xs text-foreground-muted">
        Butuh token gratis?{' '}
        <Link href="/referral" className="font-semibold text-primary underline">
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
    <li
      className={`relative flex flex-col rounded-lg border bg-surface p-4 ${
        pkg.recommended ? 'border-primary shadow-md' : 'border-border shadow-sm'
      }`}
    >
      {pkg.recommended && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary">
          Paling banyak dipilih
        </span>
      )}

      <p className="font-heading text-base font-semibold text-foreground">{pkg.name}</p>

      <p className="tabular mt-2 font-heading text-2xl font-bold leading-none text-foreground">
        {total.toLocaleString('id-ID')}
        <span className="ml-1.5 text-sm font-normal text-foreground-muted">token</span>
      </p>

      {pkg.bonus > 0 && (
        <p className="tabular mt-1 inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          <Check width={11} height={11} aria-hidden="true" />
          {pkg.tokens.toLocaleString('id-ID')} + {pkg.bonus} bonus
        </p>
      )}

      <p className="tabular mt-3 font-heading text-lg font-bold text-primary">
        {formatRupiah(pkg.price)}
      </p>
      <p className="tabular text-[11px] text-foreground-muted">
        {formatRupiah(perToken)} / token
        {savings > 0 && <span className="ml-1 font-semibold text-foreground">hemat {savings}%</span>}
      </p>

      {pkg.note && (
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">{pkg.note}</p>
      )}

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

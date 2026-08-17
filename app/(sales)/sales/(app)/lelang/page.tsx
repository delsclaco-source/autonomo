import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Gavel, Trophy, Users } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { activeAuctionsForSales } from '@/lib/auction/queries'
import { TIER_LABEL, formatRupiah } from '@/lib/sales/present'
import { BidForm } from './bid-form'

export const metadata: Metadata = { title: 'Lelang aktif' }
export const dynamic = 'force-dynamic'

/**
 * Reverse auction floor.
 *
 * Hallmark - genre: editorial-catalogue - macrostructure: section-index
 * - design-system: design.md - designed-as-app
 *
 * This is the margin lane. Nothing here spends a token: the winner pays in
 * discount, and the contact opens for free when the auction settles. The token
 * lane is the Hot leads screen, and the copy says so on every card — a sales user
 * who assumes bidding costs tokens will simply not bid.
 *
 * Each card shows four numbers and withholds one. Shown: the customer's target,
 * this user's own standing price, their rank, and how many rivals are in.
 * Withheld: the leading price. A visible best price turns the auction into a
 * contest over who shaves one rupiah last; rank plus the gap to the target
 * creates the same pressure and points it at the number the buyer actually asked
 * for. `activeAuctionsForSales` never selects a rival's price, so there is
 * nothing on this page that could leak one by accident.
 *
 * Red is spent on exactly two things per card: the customer's target price and
 * the bid button inside `BidForm`. A leading position is stated in words
 * ("Memimpin") rather than colour, so it survives a red-green deficiency.
 *
 * `closesAt` renders as an absolute local time, not a live countdown. This is a
 * Server Component, a countdown would need a client timer per card, and soft
 * close moves the deadline anyway — a ticking number that jumps backwards reads
 * as a bug.
 */

export default async function SalesAuctionsPage() {
  const user = await requirePageUser('sales')
  const rows = await activeAuctionsForSales(user.id)

  const leading = rows.filter((row) => row.myRank === 1).length
  const untouched = rows.filter((row) => row.myPrice === null).length

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Lelang aktif
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-foreground-muted">
            Customer menyebut harga, sales bersaing memberi diskon. Penawaran terendah menang dan
            mendapat kontak — tanpa token.
          </p>
        </div>

        {rows.length > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">Memimpin</p>
            <p className="tabular mt-0.5 font-heading text-lg font-semibold leading-none text-foreground">
              {leading}
              <span className="font-normal text-foreground-muted"> / {rows.length}</span>
            </p>
          </div>
        )}
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-base font-semibold text-foreground">
            Belum ada lelang untuk mobil Anda.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground-muted">
            Lelang hanya muncul untuk brand dan model yang penawarannya sedang aktif. Publikasikan
            penawaran dulu — itu tiket masuk ke lelang, dan tidak memakai token.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/offers"
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-hover"
            >
              Kelola penawaran
            </Link>
            <Link
              href="/leads"
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
            >
              Lihat hot leads
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {untouched > 0 && (
            <p className="text-xs leading-relaxed text-foreground-muted">
              <span className="tabular font-semibold text-foreground">{untouched}</span> lelang belum
              Anda tawar. Menawar gratis — token hanya dipakai di{' '}
              <Link
                href="/leads"
                className="font-semibold text-foreground underline decoration-border underline-offset-2 transition-colors duration-200 hover:decoration-foreground"
              >
                Hot leads
              </Link>
              .
            </p>
          )}

          <ul className="space-y-3">
            {rows.map((row) => {
              // The advertised floor, mirrored from `placeBid`: a bid may not be
              // shallower than the discount this user already promises publicly.
              // Re-checked under the row lock server-side; here it only saves a
              // round trip.
              const maxPrice = row.listPrice === null ? null : row.listPrice - row.maxDiscount

              return (
                <li
                  key={row.auctionId}
                  className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-foreground/20 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                        {row.brand}
                        <span className="rounded border border-border px-1.5 py-0.5 tracking-normal">
                          {TIER_LABEL[row.tier]}
                        </span>
                        {row.myRank === 1 && (
                          <span className="inline-flex items-center gap-1 rounded bg-foreground px-1.5 py-0.5 tracking-normal text-on-accent">
                            <Trophy width={10} height={10} aria-hidden="true" />
                            Memimpin
                          </span>
                        )}
                      </p>
                      <h2 className="mt-1.5 font-heading text-base font-semibold leading-snug text-foreground">
                        {row.model}
                        {row.variant && (
                          <span className="ml-1.5 text-sm font-normal text-foreground-muted">
                            {row.variant}
                          </span>
                        )}
                      </h2>
                    </div>

                    <p className="shrink-0 text-right">
                      <span className="tabular block font-heading text-xl font-bold leading-none text-primary">
                        {formatRupiah(row.targetPrice)}
                      </span>
                      <span className="mt-1 block text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                        target customer
                      </span>
                    </p>
                  </div>

                  <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-3.5 text-sm sm:grid-cols-4">
                    <Fact label="Penawaran Anda">
                      {row.myPrice !== null ? formatRupiah(row.myPrice) : 'Belum menawar'}
                    </Fact>
                    <Fact label="Peringkat">
                      {row.myRank !== null ? `${row.myRank} dari ${row.bidderCount}` : '—'}
                    </Fact>
                    <Fact label="Selisih ke target">
                      {row.gapToTarget === null
                        ? '—'
                        : row.gapToTarget <= 0
                          ? 'Target tercapai'
                          : `+${formatRupiah(row.gapToTarget)}`}
                    </Fact>
                    <Fact label="Harga OTR">
                      {row.listPrice !== null ? formatRupiah(row.listPrice) : '—'}
                    </Fact>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-foreground-muted">
                      <span className="tabular inline-flex items-center gap-1">
                        <Clock width={12} height={12} aria-hidden="true" />
                        Tutup{' '}
                        {row.closesAt.toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="tabular inline-flex items-center gap-1">
                        <Users width={12} height={12} aria-hidden="true" />
                        {row.bidderCount} sales menawar
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Gavel width={12} height={12} aria-hidden="true" />
                        Tanpa token
                      </span>
                    </div>

                    <BidForm auctionId={row.auctionId} myPrice={row.myPrice} maxPrice={maxPrice} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
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

import type { Metadata } from 'next'
import Link from 'next/link'
import { count, desc, eq, inArray } from 'drizzle-orm'
import { AlertTriangle, ArrowRight, Clock, Plus } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { getDb } from '@/lib/db'
import { leads, requests } from '@/lib/db/schema'
import { findBrand, findModel, formatRupiah } from '@/lib/data/catalog'
import { timeframeLabel } from '@/lib/validation/request'

export const metadata: Metadata = { title: 'Request saya' }

// Reads the signed-in customer's own rows; nothing here is cacheable.
export const dynamic = 'force-dynamic'

/**
 * Customer dashboard — the requests this buyer has submitted and what has
 * happened to each.
 *
 * The only thing a buyer wants here is "has anyone taken this yet", so the count
 * of sales users who unlocked the request is the headline of every row. Their
 * identities are not shown: a sales user chooses when to make contact, and
 * listing them here would turn the page into a directory that bypasses the
 * unlock the sales user paid for.
 *
 * Rows are scoped by `customerId` in the query itself rather than filtered after
 * the fact — the database is the boundary, not the render.
 */
export default async function MyRequestsPage() {
  const user = await requirePageUser('customer')

  const db = getDb()

  // Unlock counts come from a second grouped query rather than a correlated
  // subquery per row: one extra round trip, but it stays a plain indexed
  // aggregate and does not depend on how the ORM inlines subqueries.
  const rows = await db
    .select({
      id: requests.id,
      brand: requests.brand,
      model: requests.model,
      variant: requests.variant,
      discountWanted: requests.discountWanted,
      tier: requests.tier,
      status: requests.status,
      purchaseTimeframe: requests.purchaseTimeframe,
      flaggedReason: requests.flaggedReason,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(eq(requests.customerId, user.id))
    .orderBy(desc(requests.createdAt))
    .limit(50)

  const unlockCounts = new Map<string, number>()

  if (rows.length > 0) {
    const counted = await db
      .select({ requestId: leads.requestId, total: count() })
      .from(leads)
      .where(
        inArray(
          leads.requestId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(leads.requestId)

    for (const row of counted) unlockCounts.set(row.requestId, Number(row.total))
  }

  // The list shows every request, closed ones included, but the heading counts
  // only those still in play. `rows.length` called a page of finished requests
  // "N request aktif", which reads as N sales users still working the lead.
  const activeCount = rows.filter(
    (row) => row.status !== 'closed' && row.status !== 'expired',
  ).length

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Request saya
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground">
            {activeCount > 0
              ? `${activeCount} request aktif`
              : rows.length > 0
                ? 'Tidak ada request aktif'
                : 'Belum ada request'}
          </h1>
        </div>

        <Link
          href="/request/baru"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
        >
          <Plus width={16} height={16} aria-hidden="true" />
          Request baru
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="font-heading text-lg font-semibold text-foreground">
            Sebutkan mobil dan harga yang Anda mau.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-muted">
            Request Anda tampil di marketplace sales dealer resmi. Yang sanggup memenuhi target
            harga akan menghubungi lewat WhatsApp.
          </p>
          <Link
            href="/request/baru"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-7 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
          >
            Buat request pertama
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => {
            const brand = findBrand(row.brand)
            const model = findModel(row.brand, row.model)
            const listPrice = model?.priceFrom ?? 0
            const discount = Number(row.discountWanted)
            const targetPrice = listPrice > 0 ? Math.round(listPrice * (1 - discount / 100)) : 0
            const unlockCount = unlockCounts.get(row.id) ?? 0

            return (
              <li
                key={row.id}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                      {brand?.name ?? row.brand}
                    </p>
                    <h2 className="truncate font-heading text-lg font-semibold leading-tight text-foreground">
                      {model?.name ?? row.model}
                      {row.variant && (
                        <span className="ml-1.5 text-sm font-normal text-foreground-muted">
                          {row.variant}
                        </span>
                      )}
                    </h2>
                  </div>
                  <StatusBadge status={row.status} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.08em] text-foreground-muted">
                      Target harga
                    </dt>
                    <dd className="tabular mt-0.5 font-heading font-bold text-primary">
                      {targetPrice > 0 ? formatRupiah(targetPrice) : `−${discount.toFixed(1)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.08em] text-foreground-muted">
                      Setara diskon
                    </dt>
                    <dd className="tabular mt-0.5 font-medium text-foreground">
                      −{discount.toFixed(1)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.08em] text-foreground-muted">
                      Sales menawar
                    </dt>
                    <dd className="tabular mt-0.5 font-medium text-foreground">
                      {unlockCount > 0 ? `${unlockCount} sales` : 'Belum ada'}
                    </dd>
                  </div>
                </dl>

                {row.flaggedReason && (
                  <p className="mt-3 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-foreground">
                    <AlertTriangle
                      width={14}
                      height={14}
                      className="mt-px shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    Request ini sedang ditinjau tim kami karena diskon yang diminta jauh di atas
                    rata-rata pasar. Anda tetap bisa membuat request lain.
                  </p>
                )}

                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-foreground-muted">
                  <Clock width={12} height={12} aria-hidden="true" />
                  Dikirim{' '}
                  {row.createdAt.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {row.purchaseTimeframe && (
                    <>
                      <span className="text-border">·</span>
                      Rencana ambil: {timeframeLabel(row.purchaseTimeframe)}
                    </>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        href="/katalog"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary"
      >
        Lihat katalog & harga pasar
        <ArrowRight width={14} height={14} aria-hidden="true" />
      </Link>
    </div>
  )
}

/**
 * Status carries a word as well as a colour. In a red-branded UI, colour cannot
 * be the only signal — and `flagged` in particular must never read as decoration.
 */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: 'Menunggu sales', className: 'border-border bg-muted text-foreground-muted' },
    claimed: { label: 'Sedang ditawar', className: 'border-primary/30 bg-primary/5 text-primary' },
    closed: { label: 'Selesai', className: 'border-border bg-foreground text-on-accent' },
    expired: { label: 'Kedaluwarsa', className: 'border-border bg-muted text-foreground-muted' },
    flagged: { label: 'Ditinjau', className: 'border-primary/30 bg-primary/5 text-primary' },
  }
  const badge = map[status] ?? map.open

  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  )
}

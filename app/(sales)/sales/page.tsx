import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Coins, Flame, Gift, MessageCircle, Target } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { marketplaceLeads, salesOverview, unlockedLeads } from '@/lib/sales/queries'
import {
  TIER_LABEL,
  formatRupiah,
  leadPricing,
  openingMessage,
  timeAgo,
  whatsappLink,
} from '@/lib/sales/present'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

/**
 * Sales dashboard.
 *
 * Built around the two questions a sales user opens the app to answer: who am I
 * supposed to call right now, and what is new. So the top of the page is the
 * follow-up queue — leads already paid for and not yet contacted, which is the
 * most expensive thing to leave sitting — and the newest unclaimed leads sit
 * below it.
 *
 * Counters come after both, not before. A dashboard that opens with four metric
 * tiles and buries the actionable list under them is a report, not a tool.
 */
export default async function SalesDashboardPage() {
  const user = await requirePageUser('sales')

  const [overview, pending, fresh] = await Promise.all([
    salesOverview(user.id),
    unlockedLeads(user.id, 'pending'),
    marketplaceLeads(user.id, { limit: 3 }),
  ])

  const followUps = pending.slice(0, 3)
  const greeting = user.fullName?.trim().split(' ')[0] ?? 'Halo'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {followUps.length > 0
              ? `${overview.leadsPending} lead menunggu Anda hubungi.`
              : 'Tidak ada follow-up tertunda.'}
          </p>
        </div>

        {overview.dailyLimit !== null && (
          <p className="tabular rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground-muted">
            {overview.unlocksToday}/{overview.dailyLimit} unlock hari ini
          </p>
        )}
      </header>

      {/* Follow-up queue */}
      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">Perlu dihubungi</h2>
          {overview.leadsPending > followUps.length && (
            <Link
              href="/crm?status=pending"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-opacity duration-200 hover:opacity-70"
            >
              Semua {overview.leadsPending}
              <ArrowRight width={14} height={14} aria-hidden="true" />
            </Link>
          )}
        </div>

        {followUps.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm leading-relaxed text-foreground-muted">
            Semua kontak yang Anda buka sudah ditindaklanjuti. Buka lead baru untuk mengisi
            pipeline.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {followUps.map((row) => {
              const price = leadPricing(row.brand, row.model, row.discountWanted)
              return (
                <li
                  key={row.leadId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-semibold leading-tight text-foreground">
                      {row.customerName?.trim() || 'Customer'}
                    </p>
                    <p className="tabular mt-0.5 truncate text-sm text-foreground-muted">
                      {price.brandName} {price.modelName}
                      {price.targetPrice > 0 && (
                        <>
                          <span className="mx-1.5 text-border">·</span>
                          <span className="font-semibold text-primary">
                            {formatRupiah(price.targetPrice)}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-foreground-muted">
                      dibuka {timeAgo(row.unlockedAt)} · {row.tokenCost} token
                    </p>
                  </div>

                  <a
                    href={whatsappLink(
                      row.customerPhone,
                      openingMessage(
                        user.fullName,
                        price.brandName,
                        price.modelName,
                        price.targetPrice,
                      ),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover sm:w-auto"
                  >
                    <MessageCircle width={15} height={15} aria-hidden="true" />
                    Chat
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Newest unclaimed leads */}
      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="flex items-center gap-1.5 font-heading text-lg font-semibold text-foreground">
            <Flame width={17} height={17} className="text-primary" aria-hidden="true" />
            Lead terbaru
          </h2>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-opacity duration-200 hover:opacity-70"
          >
            Marketplace
            <ArrowRight width={14} height={14} aria-hidden="true" />
          </Link>
        </div>

        {fresh.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm leading-relaxed text-foreground-muted">
            Belum ada request terbuka yang belum Anda buka. Bagikan kode referral Anda supaya lebih
            banyak pembeli masuk.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {fresh.map((row) => {
              const price = leadPricing(row.brand, row.model, row.discountWanted)
              return (
                <li key={row.requestId}>
                  <Link
                    href="/leads"
                    className="flex items-center gap-3 bg-surface px-4 py-3.5 transition-colors duration-200 hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                        {price.brandName} · {TIER_LABEL[row.tier]}
                      </p>
                      <p className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground">
                        {price.modelName}
                      </p>
                      <p className="tabular mt-0.5 text-[11px] text-foreground-muted">
                        {timeAgo(row.createdAt)} ·{' '}
                        {row.competitors === 0
                          ? 'belum ada yang buka'
                          : `${row.competitors} sales sudah buka`}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tabular font-heading text-base font-bold leading-none text-primary">
                        {price.targetPrice > 0
                          ? formatRupiah(price.targetPrice)
                          : `−${row.discountWanted.toFixed(1)}%`}
                      </p>
                      <p className="tabular mt-1 text-[11px] text-foreground-muted">
                        {row.tokenCost} token
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Pipeline + balance */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Saldo token"
          value={overview.tokenBalance.toLocaleString('id-ID')}
          href="/topup"
          icon={<Coins width={15} height={15} aria-hidden="true" />}
          hint={overview.premium ? 'Akun premium' : 'Akun gratis'}
        />
        <Stat
          label="Negosiasi"
          value={String(overview.leadsNegotiation)}
          href="/crm?status=negotiation"
          icon={<Target width={15} height={15} aria-hidden="true" />}
          hint="Sedang berjalan"
        />
        <Stat
          label="Deal"
          value={String(overview.leadsWon)}
          href="/crm?status=won"
          icon={<Target width={15} height={15} aria-hidden="true" />}
          hint={
            overview.leadsWon + overview.leadsLost > 0
              ? `${Math.round((overview.leadsWon / (overview.leadsWon + overview.leadsLost)) * 100)}% closing rate`
              : 'Belum ada yang ditutup'
          }
        />
        <Stat
          label="Referral"
          value={overview.referralCode || '—'}
          href="/referral"
          icon={<Gift width={15} height={15} aria-hidden="true" />}
          hint="30 token / pendaftaran"
        />
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  href,
  icon,
}: {
  label: string
  value: string
  hint: string
  href: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-foreground/20"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <p className="tabular mt-1.5 truncate font-heading text-2xl font-bold leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1.5 truncate text-[11px] text-foreground-muted">{hint}</p>
    </Link>
  )
}

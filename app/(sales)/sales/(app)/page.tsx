import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Coins, MessageCircle } from 'lucide-react'
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
 * Hallmark - genre: editorial-catalogue - macrostructure: section-index
 * - design-system: design.md - designed-as-app
 *
 * Built around the two questions a sales user opens the app to answer: who am I
 * supposed to call right now, and what is new. So the top of the page is the
 * follow-up queue — leads already paid for and not yet contacted, which is the
 * most expensive thing to leave sitting — and the newest unclaimed leads sit
 * below it.
 *
 * The account block comes last, not first. A dashboard that opens with four
 * metric tiles and buries the actionable list under them is a report, not a
 * tool. Inside that block the token balance takes the ink slab (design.md § 4.5)
 * because it is the one number that decides whether the next unlock is possible
 * at all; the pipeline counts are rule-separated cells beneath it.
 *
 * The daily unlock quota is stated in the page head rather than left for the
 * unlock button to reject (design.md § 9).
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
  const closed = overview.leadsWon + overview.leadsLost

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-foreground-muted">
            {followUps.length > 0
              ? `${overview.leadsPending} lead menunggu Anda hubungi.`
              : 'Tidak ada follow-up tertunda.'}
          </p>
        </div>

        {overview.dailyLimit !== null && (
          <div className="shrink-0 text-right">
            <p className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
              Unlock hari ini
            </p>
            <p className="tabular mt-0.5 font-heading text-base font-semibold text-foreground">
              {overview.unlocksToday}
              <span className="font-normal text-foreground-muted">/{overview.dailyLimit}</span>
            </p>
          </div>
        )}
      </header>

      {/* Follow-up queue */}
      <section className="space-y-3">
        <SectionHead
          title="Perlu dihubungi"
          href={overview.leadsPending > followUps.length ? '/crm?status=pending' : undefined}
          linkLabel={`Semua ${overview.leadsPending}`}
        />

        {followUps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm leading-relaxed text-foreground-muted">
            Semua kontak yang Anda buka sudah ditindaklanjuti. Buka lead baru untuk mengisi
            pipeline.
          </p>
        ) : (
          <ul className="space-y-3">
            {followUps.map((row) => {
              const price = leadPricing(row.brand, row.model, row.discountWanted)
              return (
                <li
                  key={row.leadId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-foreground/20 sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-semibold leading-snug text-foreground">
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
                    <p className="tabular mt-0.5 text-[11px] text-foreground-muted">
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
      <section className="space-y-3">
        <SectionHead title="Lead terbaru" href="/leads" linkLabel="Marketplace" />

        {fresh.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm leading-relaxed text-foreground-muted">
            Belum ada permintaan di pool token. Yang masih dilelang ada di halaman Lelang — ikut
            menawar di sana tanpa token.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {fresh.map((row) => {
              const price = leadPricing(row.brand, row.model, row.discountWanted)
              return (
                <li key={row.requestId}>
                  <Link
                    href="/leads"
                    className="flex min-h-11 items-center gap-3 bg-surface px-4 py-3.5 transition-colors duration-200 hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                        {price.brandName} · {TIER_LABEL[row.tier]}
                      </p>
                      <p className="truncate font-heading text-[15px] font-semibold leading-snug text-foreground">
                        {price.modelName}
                      </p>
                      <p className="tabular mt-0.5 text-[11px] text-foreground-muted">
                        {timeAgo(row.createdAt)}
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

      {/* Account. The balance decides the next unlock, so it takes the slab. */}
      <section className="space-y-3">
        <SectionHead title="Akun" />

        <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg bg-accent px-5 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-accent/60">
              Saldo token
            </p>
            <p className="tabular mt-1.5 font-heading text-4xl font-bold leading-none text-on-accent">
              {overview.tokenBalance.toLocaleString('id-ID')}
              <span className="ml-2 text-base font-normal text-on-accent/60">token</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-on-accent/60">
              {overview.dailyLimit === null
                ? 'Akun premium — tanpa batas unlock harian.'
                : `Akun gratis — ${overview.dailyLimit} unlock per hari, reset 00:00 WIB.`}
            </p>
          </div>

          <Link
            href="/topup"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-on-accent/25 px-4 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-on-accent/10"
          >
            <Coins width={15} height={15} aria-hidden="true" />
            Top up token
          </Link>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:divide-x sm:divide-y-0">
          <Cell
            label="Negosiasi"
            value={String(overview.leadsNegotiation)}
            hint="Sedang berjalan"
            href="/crm?status=negotiation"
          />
          <Cell
            label="Deal"
            value={String(overview.leadsWon)}
            hint={
              closed > 0
                ? `${Math.round((overview.leadsWon / closed) * 100)}% dari ${closed} lead tertutup`
                : 'Belum ada yang ditutup'
            }
            href="/crm?status=won"
          />
          <Cell
            label="Kode referral"
            value={overview.referralCode || '—'}
            hint="30 token per pendaftaran"
            href="/referral"
          />
        </div>
      </section>
    </div>
  )
}

function SectionHead({
  title,
  href,
  linkLabel,
}: {
  title: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        {title}
      </h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-semibold text-foreground-muted transition-colors duration-200 hover:text-foreground"
        >
          {linkLabel}
          <ArrowRight width={14} height={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

function Cell({
  label,
  value,
  hint,
  href,
}: {
  label: string
  value: string
  hint: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="min-w-0 px-1 py-3.5 transition-colors duration-200 hover:bg-muted sm:px-4"
    >
      <p className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">{label}</p>
      <p className="tabular mt-1 truncate font-heading text-2xl font-bold leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1.5 truncate text-[11px] text-foreground-muted">{hint}</p>
    </Link>
  )
}

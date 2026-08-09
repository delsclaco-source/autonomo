import type { Metadata } from 'next'
import Link from 'next/link'
import { Coins, MessageCircle, Phone } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { salesOverview, unlockedLeads } from '@/lib/sales/queries'
import {
  formatRupiah,
  leadPricing,
  openingMessage,
  timeAgo,
  timeframeLabel,
  whatsappLink,
} from '@/lib/sales/present'
import type { LeadStatus } from '@/lib/db/schema'
import { LeadNote, LeadStatusControl } from './lead-controls'

export const metadata: Metadata = { title: 'CRM' }
export const dynamic = 'force-dynamic'

/**
 * CRM — the leads this sales user has paid for.
 *
 * This is the only screen in the app that shows a customer's name and phone
 * number, and it does so because every row here corresponds to a recorded unlock
 * (CLAUDE.md § 7). The query enforces that with a join, not a filter.
 *
 * The primary action is the WhatsApp button with the opening message already
 * written, because the tokens are only worth anything if the conversation starts.
 * The pipeline buttons sit next to it: a status that has to be updated on a
 * different screen is a status nobody updates.
 */

const TABS: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Belum dihubungi' },
  { value: 'negotiation', label: 'Negosiasi' },
  { value: 'won', label: 'Deal' },
  { value: 'lost', label: 'Batal' },
]

const VALID = new Set(TABS.map((t) => t.value))

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SalesCrmPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser('sales')
  const params = await searchParams

  const raw = typeof params.status === 'string' ? params.status : 'all'
  const active = (VALID.has(raw as LeadStatus | 'all') ? raw : 'all') as LeadStatus | 'all'

  const [overview, rows] = await Promise.all([
    salesOverview(user.id),
    unlockedLeads(user.id, active === 'all' ? undefined : active),
  ])

  const counts: Record<LeadStatus | 'all', number> = {
    all:
      overview.leadsPending + overview.leadsNegotiation + overview.leadsWon + overview.leadsLost,
    pending: overview.leadsPending,
    negotiation: overview.leadsNegotiation,
    won: overview.leadsWon,
    lost: overview.leadsLost,
  }

  // Tokens spent on leads that closed lost is the number that tells a sales user
  // whether their filtering is working. Nothing else on this screen shows it.
  const spent = rows.reduce((sum, row) => sum + row.tokenCost, 0)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">CRM</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {counts.all === 0
              ? 'Belum ada kontak yang Anda buka.'
              : `${counts.all} lead terbuka · ${counts.won} deal · ${counts.lost} batal`}
          </p>
        </div>

        {rows.length > 0 && (
          <p className="tabular inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground-muted">
            <Coins width={13} height={13} className="text-primary" aria-hidden="true" />
            {spent} token di tampilan ini
          </p>
        )}
      </header>

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === 'all' ? '/crm' : `/crm?status=${tab.value}`}
            aria-current={active === tab.value ? 'true' : undefined}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-200 ${
              active === tab.value
                ? 'border-foreground bg-foreground text-on-accent'
                : 'border-border text-foreground-muted hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className="tabular text-[11px] opacity-70">{counts[tab.value]}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-base font-semibold text-foreground">
            {active === 'all' ? 'CRM Anda masih kosong.' : 'Tidak ada lead di status ini.'}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-muted">
            {active === 'all'
              ? 'Buka kontak sebuah hot lead untuk melihat nama dan nomor WhatsApp customer di sini.'
              : 'Pindahkan lead ke status ini dari kartu lead lain.'}
          </p>
          <Link
            href="/leads"
            className="mt-5 inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
          >
            Lihat hot leads
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const price = leadPricing(row.brand, row.model, row.discountWanted)
            const opening = openingMessage(
              user.fullName,
              price.brandName,
              price.modelName,
              price.targetPrice,
            )

            return (
              <li
                key={row.leadId}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-lg font-semibold leading-tight text-foreground">
                      {row.customerName?.trim() || 'Customer'}
                    </h2>
                    <p className="tabular mt-0.5 flex items-center gap-1.5 text-sm text-foreground-muted">
                      <Phone width={13} height={13} aria-hidden="true" />
                      +{row.customerPhone}
                    </p>
                  </div>

                  <p className="tabular shrink-0 text-right text-[11px] text-foreground-muted">
                    dibuka {timeAgo(row.unlockedAt)}
                    <span className="mt-0.5 block font-semibold text-foreground">
                      {row.tokenCost} token
                    </span>
                  </p>
                </div>

                <div className="mt-3.5 rounded-md border border-dashed border-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
                    {price.brandName}
                  </p>
                  <p className="font-heading text-base font-semibold leading-tight text-foreground">
                    {price.modelName}
                    {row.variant && (
                      <span className="ml-1.5 text-sm font-normal text-foreground-muted">
                        {row.variant}
                      </span>
                    )}
                  </p>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <Fact label="Target customer">
                      <span className="font-bold text-primary">
                        {price.targetPrice > 0
                          ? formatRupiah(price.targetPrice)
                          : `−${row.discountWanted.toFixed(1)}%`}
                      </span>
                    </Fact>
                    <Fact label="Harga OTR">
                      {price.listPrice > 0 ? formatRupiah(price.listPrice) : '—'}
                    </Fact>
                    <Fact label="Selisih">
                      {price.gap > 0 ? `−${formatRupiah(price.gap)}` : '—'}
                    </Fact>
                    <Fact label="Rencana ambil">
                      {timeframeLabel(row.purchaseTimeframe) ?? '—'}
                    </Fact>
                  </dl>

                  {row.notes && (
                    <p className="mt-2.5 text-sm italic leading-relaxed text-foreground">
                      &ldquo;{row.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="mt-3.5 space-y-3 border-t border-border pt-3.5">
                  <a
                    href={whatsappLink(row.customerPhone, opening)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover sm:w-auto"
                  >
                    <MessageCircle width={16} height={16} aria-hidden="true" />
                    Chat WhatsApp
                  </a>

                  <LeadStatusControl leadId={row.leadId} current={row.status as LeadStatus} />
                  <LeadNote leadId={row.leadId} note={row.internalNotes} />
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

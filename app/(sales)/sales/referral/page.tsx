import type { Metadata } from 'next'
import Link from 'next/link'
import { Info, UserPlus } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { REFERRAL_BONUS, referralSummary } from '@/lib/sales/queries'
import { ReferralShare } from './referral-share'

export const metadata: Metadata = { title: 'Referral' }
export const dynamic = 'force-dynamic'

/**
 * Referral.
 *
 * The cap is the part that has to be unambiguous: 30 tokens per successful
 * referral, at most 300 tokens in a calendar month (CLAUDE.md § 2). Someone who
 * invites fifteen people in one week and is paid for ten of them will assume the
 * system is broken unless the ceiling was stated before they started — so the
 * progress bar shows the remaining headroom, not just the earned total.
 *
 * "Successful" means the invited sales user verified their phone. That is stated
 * plainly here because the gap between signing up and verifying is where the
 * disputes come from.
 */

const STEPS = [
  {
    title: 'Bagikan kode Anda',
    body: 'Kirim ke sales lain lewat WhatsApp atau grup dealer.',
  },
  {
    title: 'Mereka daftar & verifikasi WhatsApp',
    body: 'Bonus dihitung setelah nomor terverifikasi, bukan saat form dikirim.',
  },
  {
    title: `+${REFERRAL_BONUS} token masuk saldo Anda`,
    body: 'Tercatat di riwayat token sebagai "Bonus referral".',
  },
]

export default async function SalesReferralPage() {
  const user = await requirePageUser('sales')
  const summary = await referralSummary(user.id)

  const remaining = Math.max(0, summary.monthlyCap - summary.tokensThisMonth)
  const pct = Math.min(100, Math.round((summary.tokensThisMonth / summary.monthlyCap) * 100))
  const capReached = remaining === 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Referral
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
          Ajak sales lain bergabung, dapat {REFERRAL_BONUS} token untuk setiap pendaftaran yang
          terverifikasi. Maksimal {summary.monthlyCap} token per bulan.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          Kode referral Anda
        </p>
        <p className="tabular mt-2 select-all font-heading text-3xl font-bold tracking-[0.2em] text-foreground">
          {summary.code || '—'}
        </p>

        {summary.code && (
          <div className="mt-4">
            <ReferralShare code={summary.code} />
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Total sales diajak
          </p>
          <p className="tabular mt-1.5 font-heading text-3xl font-bold leading-none text-foreground">
            {summary.totalReferred}
          </p>
          <p className="mt-1.5 text-xs text-foreground-muted">Sejak akun Anda dibuat.</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Bonus bulan ini
          </p>
          <p className="tabular mt-1.5 font-heading text-3xl font-bold leading-none text-primary">
            {summary.tokensThisMonth}
            <span className="ml-1.5 text-base font-normal text-foreground-muted">
              / {summary.monthlyCap}
            </span>
          </p>

          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={summary.tokensThisMonth}
            aria-valuemin={0}
            aria-valuemax={summary.monthlyCap}
            aria-label="Bonus referral bulan ini"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>

          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            {capReached
              ? 'Batas bulan ini tercapai. Referral tetap tercatat dan bonusnya dilanjutkan bulan depan.'
              : `Sisa ${remaining} token bisa didapat bulan ini (${Math.floor(remaining / REFERRAL_BONUS)} referral lagi).`}
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">Cara kerjanya</h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground font-heading text-sm font-bold text-on-accent">
                {index + 1}
              </span>
              <div>
                <p className="font-heading text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-foreground-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="flex items-start gap-2 rounded-md border border-border bg-muted px-4 py-3 text-xs leading-relaxed text-foreground-muted">
        <Info width={14} height={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Akun ganda dari satu orang tidak dihitung dan dapat menyebabkan bonus ditarik kembali lewat
        penyesuaian admin. Satu nomor WhatsApp = satu akun.
      </p>

      <Link
        href="/topup"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary"
      >
        <UserPlus width={15} height={15} aria-hidden="true" />
        Lihat riwayat token
      </Link>
    </div>
  )
}

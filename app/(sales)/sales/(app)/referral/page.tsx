import type { Metadata } from 'next'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { REFERRAL_BONUS, referralSummary } from '@/lib/sales/queries'
import { ReferralShare } from './referral-share'

export const metadata: Metadata = { title: 'Referral' }
export const dynamic = 'force-dynamic'

/**
 * Referral.
 *
 * Hallmark - genre: editorial-catalogue - macrostructure: section-index
 * - design-system: design.md - designed-as-app
 *
 * The cap is the part that has to be unambiguous: 30 tokens per successful
 * referral, at most 300 tokens in a calendar month (CLAUDE.md § 2). Someone who
 * invites fifteen people in one week and is paid for ten of them will assume the
 * system is broken unless the ceiling was stated before they started — so the
 * month's earnings take the ink slab with the cap written into the same figure,
 * and the bar shows remaining headroom rather than a decorative percentage.
 *
 * "Successful" means the invited sales user verified their phone. That is stated
 * plainly here because the gap between signing up and verifying is where the
 * disputes come from.
 *
 * The code is the top of the page and the share button is the only red on it
 * (design.md § 2): everything else here is a figure to read.
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
  const referralsLeft = Math.floor(remaining / REFERRAL_BONUS)

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Referral</h1>
        <p className="mt-1 max-w-xl text-sm text-foreground-muted">
          Ajak sales lain bergabung, dapat {REFERRAL_BONUS} token untuk setiap pendaftaran yang
          terverifikasi. Maksimal {summary.monthlyCap} token per bulan.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          Kode referral Anda
        </h2>

        <p className="tabular select-all font-heading text-3xl font-bold tracking-[0.2em] text-foreground sm:text-4xl">
          {summary.code || '—'}
        </p>

        {summary.code && <ReferralShare code={summary.code} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          Bonus bulan ini
        </h2>

        <div className="rounded-lg bg-accent px-5 py-5">
          <p className="tabular font-heading text-4xl font-bold leading-none text-on-accent">
            {summary.tokensThisMonth}
            <span className="ml-2 text-base font-normal text-on-accent/60">
              / {summary.monthlyCap} token
            </span>
          </p>

          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-on-accent/15"
            role="progressbar"
            aria-valuenow={summary.tokensThisMonth}
            aria-valuemin={0}
            aria-valuemax={summary.monthlyCap}
            aria-label="Bonus referral bulan ini"
          >
            <div className="h-full rounded-full bg-on-accent" style={{ width: `${pct}%` }} />
          </div>

          <p className="mt-3 max-w-md text-xs leading-relaxed text-on-accent/60">
            {capReached
              ? 'Batas bulan ini tercapai. Referral tetap tercatat dan bonusnya dilanjutkan bulan depan.'
              : `Sisa ${remaining} token bisa didapat bulan ini (${referralsLeft} referral lagi).`}
          </p>
        </div>

        <dl className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:divide-x sm:divide-y-0">
          <Cell
            label="Total sales diajak"
            value={String(summary.totalReferred)}
            hint="Sejak akun Anda dibuat"
          />
          <Cell
            label="Sisa bulan ini"
            value={String(remaining)}
            hint={capReached ? 'Reset awal bulan depan' : `${referralsLeft} referral lagi`}
          />
          <Cell
            label="Per referral"
            value={String(REFERRAL_BONUS)}
            hint="Setelah nomor terverifikasi"
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          Cara kerjanya
        </h2>

        <ol className="divide-y divide-border border-y border-border">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3 py-3.5">
              <span className="tabular font-heading text-sm font-bold text-foreground-muted">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-heading text-base font-semibold leading-snug text-foreground">
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-foreground-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="flex items-start gap-2 rounded-md border border-border px-4 py-3 text-xs leading-relaxed text-foreground-muted">
        <Info
          width={14}
          height={14}
          className="mt-0.5 shrink-0 text-foreground-muted"
          aria-hidden="true"
        />
        Akun ganda dari satu orang tidak dihitung dan dapat menyebabkan bonus ditarik kembali lewat
        penyesuaian admin. Satu nomor WhatsApp = satu akun.
      </p>

      <p className="text-sm text-foreground-muted">
        Bonus referral tercatat di{' '}
        <Link
          href="/topup"
          className="font-semibold text-foreground underline decoration-border underline-offset-2 transition-colors duration-200 hover:decoration-foreground"
        >
          riwayat token
        </Link>
        .
      </p>
    </div>
  )
}

function Cell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 px-1 py-3.5 sm:px-4 sm:first:pl-1">
      <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">{label}</dt>
      <dd className="tabular mt-1 truncate font-heading text-2xl font-bold leading-none text-foreground">
        {value}
      </dd>
      <dd className="mt-1.5 truncate text-[11px] text-foreground-muted">{hint}</dd>
    </div>
  )
}

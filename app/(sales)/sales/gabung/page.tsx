import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  EyeOff,
  Gavel,
  Plus,
  Trophy,
  Users,
} from 'lucide-react'
import { RatingStars } from '@/components/rating-stars'
import { formatRupiah } from '@/lib/data/catalog'
import { TOKEN_PACKAGES, pricePerToken, savingsPercent, totalTokens } from '@/lib/sales/packages'
import {
  AUCTION_FACTS,
  FAQS,
  MATCH_DIMENSIONS,
  PREMIUM_FEATURES,
  PREVIEW_AUCTIONS,
  PREVIEW_LEADS,
  PREVIEW_PIPELINE,
  PREVIEW_SALES,
  PROFILE_TASKS,
  STEPS,
  VALUE_PROPS,
  type PreviewAuction,
  type PreviewLead,
} from './content'
import { ComingSoon, Fact, ICONS, SIGNUP_HREF, SectionIndex } from './section-index'

export const metadata: Metadata = {
  title: 'Daftar sebagai sales — lelang tanpa token',
  description:
    'Customer menyebut harga, sales bersaing memberi diskon. Menawar di lelang 48 jam tidak memakai token, dan pemenangnya mendapat kontak customer. Daftar gratis.',
}

/**
 * Sales recruitment page — the front door of sales.autonomo.id.
 *
 * Hallmark · genre: editorial-catalogue · macrostructure: section-index
 * · design-system: design.md
 *
 * Reachable without a session: `PUBLIC_PATHS` in proxy.ts lets `/gabung` through
 * the auth redirect, and the rewrite still points it here because this is
 * sales-area content. It sits outside the `(app)` route group deliberately —
 * that group's layout calls `requirePageUser('sales')`, which is exactly what a
 * visitor without an account cannot satisfy.
 *
 * Structure follows design.md § 4.1: every section opens with a numbered rail
 * rather than a centred stack, and the ordinals come from `SECTION_ORDER` in
 * `./section-index` so they cannot drift out of sequence when a section moves.
 * Two ink bands carry the whole page's tonal contrast (token, final CTA); grey
 * section washes are banned because they read as generic striping.
 *
 * THE PAGE LEADS WITH THE AUCTION. That is not a marketing order, it is what the
 * code does: `app/(customer)/request/baru/actions.ts` opens an auction for every
 * request whose target price is plausible, and `lib/auction/settle.ts` writes the
 * winning lead with `token_cost: 0`. Only a flagged request — or an auction that
 * closed without one valid bid — falls through to the pool that tokens buy. An
 * earlier version of this page sold "pay tokens for every lead" as the product
 * and was describing the fallback.
 *
 * Static: nothing here reads the database or the session. The lead cards, the
 * sales profile, and the pipeline are labelled illustrations (see content.ts) —
 * showing a fabricated lead as if it were live would be the first lie the
 * product tells, on the page whose whole job is establishing that the token
 * system is honest.
 *
 * Token numbers come from `lib/sales/packages.ts` rather than being restated, so
 * a price change lands here and on the top-up screen together.
 */
export const dynamic = 'force-static'

export default function SalesLandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ValueProps />
        <HowItWorks />
        <AuctionSection />
        <MatchSection />
        <ProfileSection />
        <PoolSection />
        <TokenSection />
        <PremiumSection />
        <ReputationSection />
        <CrmPreview />
        <ReferralSection />
        <FaqSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/gabung" className="font-heading text-lg font-extrabold tracking-tight">
          Autonomo<span className="text-primary">.id</span>
        </Link>

        <nav aria-label="Bagian halaman" className="hidden items-center gap-6 text-sm md:flex">
          <NavLink href="#cara-kerja">Cara kerja</NavLink>
          <NavLink href="#lelang">Lelang</NavLink>
          <NavLink href="#token">Token</NavLink>
          <NavLink href="#faq">FAQ</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={SIGNUP_HREF}
            className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-foreground-muted transition-colors duration-200 hover:text-foreground"
          >
            Masuk
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
          >
            Daftar gratis
          </Link>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
    >
      {children}
    </a>
  )
}

/**
 * The hero states the auction, not the token balance. A sales user who reads
 * "100 token gratis" first concludes the product charges per lead and prices the
 * bid accordingly; the bid is free, and mispricing it is a lost deal.
 *
 * design.md § 1 offers a two-tone display heading here and this page declines it.
 * Primary is already spent twice in this viewport — the signup button and the
 * "0 token" figure — and a third blue thing fights § 2's one-primary-action rule.
 */
function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-24">
        <div className="grid gap-4 lg:grid-cols-[6rem_minmax(0,1fr)] lg:gap-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Untuk sales
          </p>

          <div className="min-w-0">
            <h1 className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-5xl">
              Berhenti berlomba menelepon. Customer sudah menyebut harga, Anda cukup menawar.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground-muted">
              Setiap request dengan target harga wajar dibuka sebagai lelang 48 jam. Menawar tidak
              memakai token, dan sales dengan diskon terdalam mendapat nama serta nomor WhatsApp
              customer.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={SIGNUP_HREF}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover active:scale-[0.98]"
              >
                Daftar gratis
                <ArrowRight width={16} height={16} aria-hidden="true" />
              </Link>
              <a
                href="#lelang"
                className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
              >
                Lihat cara lelang
              </a>
            </div>

            <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 border-t border-dashed border-border pt-6 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                  Durasi lelang
                </dt>
                <dd className="tabular mt-1 font-heading text-2xl font-bold leading-none text-foreground">
                  48 jam
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                  Biaya menawar
                </dt>
                <dd className="tabular mt-1 font-heading text-2xl font-bold leading-none text-primary">
                  0 token
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                  Saldo awal
                </dt>
                <dd className="tabular mt-1 font-heading text-2xl font-bold leading-none text-foreground">
                  100 token
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}

function ValueProps() {
  return (
    <section id="kenapa" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="kenapa"
          eyebrow="Kenapa Autonomo.id"
          title="Bersaing di harga, bukan di kecepatan menelepon"
          lead="Empat hal yang membedakan lelang ini dari database kontak yang dijual per baris."
        />

        <ul className="mt-10 divide-y divide-border border-t border-border lg:ml-[7rem]">
          {VALUE_PROPS.map((prop) => {
            const Icon = ICONS[prop.icon]
            return (
              <li key={prop.title} className="flex gap-4 py-5 sm:gap-5">
                <Icon width={18} height={18} aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-semibold leading-snug text-foreground">
                    {prop.title}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                    {prop.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="cara-kerja" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="cara-kerja"
          eyebrow="Cara kerja"
          title="Enam langkah dari daftar sampai closing"
        />

        <ol className="mt-10 divide-y divide-border border-t border-border lg:ml-[7rem]">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4 py-5 sm:gap-6">
              <span className="tabular shrink-0 font-heading text-sm font-bold text-foreground-muted">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold leading-snug text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/**
 * The main lane. Cards mirror the real screen at
 * `app/(sales)/sales/(app)/lelang/page.tsx` deliberately — same box, same
 * primary-coloured target price with the same label beneath it, same "Memimpin"
 * badge stated in words, same dashed-rule spec block, same footer meta. A landing
 * preview that looks nothing like the screen it previews is a bait.
 *
 * What the preview withholds, the real screen also withholds: a rival's price.
 * `activeAuctionsForSales` projects a competitor's `bestPrice` out of its result,
 * so `PREVIEW_AUCTIONS` carries none either. Rank and bidder count are the whole
 * competitive signal in both places.
 */
function AuctionSection() {
  return (
    <section id="lelang" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="lelang"
          eyebrow="Lelang"
          title="Customer menyebut harga, sales bersaing memberi diskon"
          lead="Setiap request dengan target harga wajar dibuka sebagai lelang 48 jam. Menawar tidak memakai token, dan pemenangnya mendapat nama serta nomor WhatsApp customer."
        />

        {/*
          design.md § 4.5: secondary metrics sit in a plain grid of rule-separated
          cells, not shadowed tiles. Only "Biaya menawar" takes the primary colour —
          it is the number a sales user came to check.
        */}
        <dl className="mt-10 grid gap-x-6 gap-y-5 border-t border-dashed border-border pt-6 sm:grid-cols-[repeat(3,minmax(0,1fr))] lg:ml-[7rem]">
          {AUCTION_FACTS.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                {fact.label}
              </dt>
              <dd
                className={`tabular mt-1 font-heading text-2xl font-bold leading-none ${
                  fact.label === 'Biaya menawar' ? 'text-primary' : 'text-foreground'
                }`}
              >
                {fact.value}
              </dd>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{fact.hint}</p>
            </div>
          ))}
        </dl>

        <ul className="mt-10 max-w-3xl space-y-3 lg:ml-[7rem]">
          {PREVIEW_AUCTIONS.map((auction) => (
            <AuctionCard key={`${auction.brand}-${auction.model}`} auction={auction} />
          ))}
        </ul>

        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-foreground-muted lg:ml-[7rem]">
          Contoh tampilan kartu lelang, bukan lelang yang sedang berjalan. Harga penawar lain tidak
          pernah ditampilkan — di halaman ini maupun di layar lelang sungguhan.
        </p>
      </div>
    </section>
  )
}

/**
 * `myRank` reads three ways and each is spelled out in words: `1` leads, a higher
 * number is a position, `null` means this user has not bid. design.md § 7 forbids
 * signalling that with colour alone.
 *
 * "Diskon diminta" is arithmetic on two figures already on the card, not a new
 * claim — § 9 bans invented numbers, and this one is derived.
 */
function AuctionCard({ auction }: { auction: PreviewAuction }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-foreground/20 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
            {auction.brand}
            <span className="rounded border border-border px-1.5 py-0.5 tracking-normal">
              {auction.tierLabel}
            </span>
            {auction.myRank === 1 && (
              <span className="inline-flex items-center gap-1 rounded bg-foreground px-1.5 py-0.5 tracking-normal text-on-accent">
                <Trophy width={10} height={10} aria-hidden="true" />
                Memimpin
              </span>
            )}
          </p>
          <h3 className="mt-1.5 font-heading text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            {auction.model}
            <span className="ml-1.5 text-sm font-normal text-foreground-muted">
              {auction.variant}
            </span>
          </h3>
        </div>

        <p className="shrink-0 text-right">
          <span className="tabular block font-heading text-xl font-bold leading-none text-primary">
            {formatRupiah(auction.targetPrice)}
          </span>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
            target customer
          </span>
        </p>
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-3.5 text-sm sm:grid-cols-4">
        <Fact label="Harga OTR">{formatRupiah(auction.listPrice)}</Fact>
        <Fact label="Diskon diminta">
          {formatRupiah(auction.listPrice - auction.targetPrice)}
        </Fact>
        <Fact label="Peringkat Anda">
          {auction.myRank !== null
            ? `${auction.myRank} dari ${auction.bidderCount}`
            : 'Belum menawar'}
        </Fact>
        <Fact label="Sisa waktu">{auction.closesIn}</Fact>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3.5 text-[11px] text-foreground-muted">
        <span className="tabular inline-flex items-center gap-1">
          <Users width={12} height={12} aria-hidden="true" />
          {auction.bidderCount} sales menawar
        </span>
        <span className="inline-flex items-center gap-1">
          <Gavel width={12} height={12} aria-hidden="true" />
          Tanpa token
        </span>
      </div>
    </li>
  )
}

/**
 * What decides whether a given auction reaches a given sales user. Two dimensions
 * are enforced by a query today; the third has columns in the schema and no
 * reader, so it carries "Segera hadir" and claims nothing.
 */
function MatchSection() {
  return (
    <section id="pencocokan" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="pencocokan"
          eyebrow="Pencocokan"
          title="Lelang dicocokkan ke penawaran Anda, bukan disebar ke semua sales"
          lead="Dua dimensi menentukan lelang yang muncul di layar Anda hari ini. Dimensi ketiga sudah disiapkan tapi belum memengaruhi apa pun."
        />

        <ul className="mt-10 divide-y divide-border border-t border-border lg:ml-[7rem]">
          {MATCH_DIMENSIONS.map((dimension) => {
            const Icon = ICONS[dimension.icon]
            return (
              <li key={dimension.title} className="flex gap-4 py-5 sm:gap-5">
                <Icon width={18} height={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-base font-semibold leading-snug text-foreground">
                      {dimension.title}
                    </h3>
                    {dimension.status === 'soon' && <ComingSoon />}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                    {dimension.body}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                    {dimension.detail}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/**
 * Profile completeness as consequences, not a percentage. There is no completeness
 * column in `lib/db/schema.ts`, so a score here would be an invented number
 * (design.md § 9). "Wajib" carries a fill plus the word, so it never signals by
 * colour alone.
 */
function ProfileSection() {
  return (
    <section id="penawaran" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="penawaran"
          eyebrow="Kelengkapan profil"
          title="Empat isian yang menentukan lelang mana yang Anda lihat"
          lead="Tidak ada skor kelengkapan di sini. Setiap baris menyebut akibat mekanisnya kalau dibiarkan kosong."
        />

        <ul className="mt-10 max-w-3xl divide-y divide-border border-t border-border lg:ml-[7rem]">
          {PROFILE_TASKS.map((task) => (
            <li
              key={task.label}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-5"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-semibold leading-snug text-foreground">
                  {task.label}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                  {task.effect}
                </p>
              </div>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                  task.required
                    ? 'border-foreground bg-foreground text-on-accent'
                    : 'border-border text-foreground-muted'
                }`}
              >
                {task.required ? 'Wajib' : 'Opsional'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * The residual lane, and the second place enrichment is allowed (design.md § 10) —
 * real product surface, not decoration. These cards mirror the pool card a
 * signed-in sales user sees, masked exactly as `MarketplaceLead` masks it: that
 * query selects no customer identity column at all.
 *
 * `reason` is the honest answer to "why is this lead still here". The pool holds
 * only flagged requests and auctions that closed with no valid bid, so a visitor
 * reading this section does not conclude the auction is optional.
 */
function PoolSection() {
  return (
    <section id="pool" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="pool"
          eyebrow="Token pool"
          title="Sisa yang tidak masuk lelang"
          lead="Request bertarget di luar batas wajar dan lelang yang tutup tanpa satu bid valid jatuh ke sini. Di jalur ini token dipotong, dan biayanya tertulis sebelum tombol ditekan."
        />

        <ul className="mt-10 grid gap-4 lg:ml-[7rem] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          {PREVIEW_LEADS.map((lead) => (
            <PoolLeadCard key={`${lead.brand}-${lead.model}`} lead={lead} />
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-foreground-muted lg:ml-[7rem]">
          Contoh tampilan kartu pool, bukan request customer sungguhan. Lead asli muncul setelah Anda
          masuk.
        </p>
      </div>
    </section>
  )
}

function PoolLeadCard({ lead }: { lead: PreviewLead }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-foreground/20 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
            {lead.brand}
          </p>
          <h3 className="font-heading text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            {lead.model}
          </h3>
        </div>
        <span className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground-muted">
          {lead.tierLabel}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-3.5 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
            Target harga
          </dt>
          <dd className="tabular mt-0.5 font-heading font-bold text-primary">
            {formatRupiah(lead.targetPrice)}
          </dd>
        </div>
        <Fact label="Minta diskon">{lead.discountPercent}%</Fact>
        <Fact label="Tenggat beli">{lead.timeframe}</Fact>
        <Fact label="Biaya buka">{lead.tokenCost} token</Fact>
      </dl>

      <p className="mt-3.5 border-t border-dashed border-border pt-3 text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
        Alasan di pool: <span className="normal-case tracking-normal">{lead.reason}</span>
      </p>

      <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3.5 text-xs text-foreground-muted">
        <EyeOff width={13} height={13} className="shrink-0" aria-hidden="true" />
        Nama &amp; nomor tersembunyi
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="tabular inline-flex items-center gap-1 text-xs text-foreground-muted">
          <Clock width={12} height={12} className="shrink-0" aria-hidden="true" />
          {lead.age}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground">
          Buka
          <span className="tabular text-primary">{lead.tokenCost} token</span>
        </span>
      </div>
    </li>
  )
}

/**
 * Ink band one of two (design.md § 4.2). Pricing earns the weight because it is
 * the objection the page has to answer — but the section says up front that this
 * is the residual lane, not the toll on every lead.
 */
function TokenSection() {
  return (
    <section id="token" className="border-b border-border bg-accent">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="token"
          invert
          eyebrow="Token"
          title="Token untuk jalur sisa, bukan untuk setiap lead"
          lead="1 token = 1 poin, dipakai hanya untuk membuka lead di pool. Lelang tidak memotong token sama sekali. Biaya per tier selalu tertulis di kartu sebelum tombol ditekan."
        />

        <dl className="mt-10 grid gap-px overflow-hidden rounded-lg bg-on-accent/15 lg:ml-[7rem] sm:grid-cols-[repeat(3,minmax(0,1fr))]">
          {[
            { tier: 'City car', cost: '5–10', example: 'Ayla, Brio, Calya' },
            { tier: 'SUV / MPV', cost: '20–30', example: 'Fortuner, Innova, Atto 3' },
            { tier: 'Premium', cost: '50–100', example: 'Alphard, BMW, Mercedes-Benz' },
          ].map((tier) => (
            <div key={tier.tier} className="bg-accent p-5">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-on-accent/60">
                {tier.tier}
              </dt>
              <dd className="tabular mt-1.5 font-heading text-3xl font-bold leading-none text-on-accent">
                {tier.cost}
                <span className="ml-1.5 text-sm font-medium text-on-accent/60">token</span>
              </dd>
              <p className="mt-2 text-sm text-on-accent/60">{tier.example}</p>
            </div>
          ))}
        </dl>

        <div className="mt-10 lg:ml-[7rem]">
          <h3 className="font-heading text-base font-semibold text-on-accent">Paket top-up</h3>
          <p className="mt-1 text-sm text-on-accent/60">
            Saldo tidak hangus. Integrasi pembayaran sedang dikerjakan — saldo gratis dan bonus
            referral tetap bisa dipakai penuh sampai aktif.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-on-accent/15">
                  {['Paket', 'Token', 'Harga', 'Per token'].map((head) => (
                    <th
                      key={head}
                      scope="col"
                      className="pb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-on-accent/60"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-on-accent/15">
                {TOKEN_PACKAGES.map((pkg) => {
                  const bonusPercent = savingsPercent(pkg)
                  return (
                    <tr key={pkg.id}>
                      <th
                        scope="row"
                        className="py-3 text-sm font-semibold text-on-accent [overflow-wrap:anywhere]"
                      >
                        {pkg.name}
                      </th>
                      <td className="tabular py-3 text-sm text-on-accent">
                        {totalTokens(pkg)}
                        {pkg.bonus > 0 && (
                          <span className="ml-1.5 text-xs text-on-accent/60">
                            +{pkg.bonus} bonus
                          </span>
                        )}
                      </td>
                      <td className="tabular py-3 text-sm text-on-accent">
                        {formatRupiah(pkg.price)}
                      </td>
                      <td className="tabular py-3 text-sm text-on-accent/60">
                        {formatRupiah(pricePerToken(pkg))}
                        {bonusPercent > 0 && (
                          <span className="ml-1.5 text-xs text-on-accent">
                            hemat {bonusPercent}%
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

function PremiumSection() {
  return (
    <section id="membership" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="membership"
          eyebrow="Membership"
          title="Gratis dulu, premium kalau volumenya sudah tidak cukup"
          lead="Tidak ada paywall di depan. Akun gratis sudah bisa menawar di semua lelang yang cocok, membuka lead pool, menghubungi customer, dan memakai CRM dasar."
        />

        <div className="mt-10 grid gap-8 lg:ml-[7rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">Akun gratis</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              Aktif selamanya, tanpa kartu kredit.
            </p>
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {[
                'Menawar di semua lelang yang cocok, tanpa token',
                '100 token saat pendaftaran',
                '3 unlock pool per hari',
                'CRM dasar: status dan catatan per lead',
                'Bonus 30 token per referral, maksimal 300/bulan',
              ].map((item) => (
                <li key={item} className="flex gap-3 py-3 text-sm text-foreground-muted">
                  <Check width={15} height={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-semibold text-foreground">Premium</h3>
              <ComingSoon />
            </div>
            <p className="mt-1 text-sm text-foreground-muted">
              Harga belum ditetapkan. Akan diumumkan di dashboard sebelum aktif.
            </p>
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {PREMIUM_FEATURES.map((item) => (
                <li key={item} className="flex gap-3 py-3 text-sm text-foreground-muted">
                  <BadgeCheck width={15} height={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function ReputationSection() {
  return (
    <section id="reputasi" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="reputasi"
          eyebrow="Reputasi"
          title="Rekam jejak yang ikut Anda, bukan milik dealer"
          lead="Rating dan jumlah transaksi menempel pada akun Anda. Pindah dealer, reputasinya tetap terbawa."
        />

        <div className="mt-10 max-w-xl rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5 lg:ml-[7rem]">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="tabular flex size-12 shrink-0 items-center justify-center rounded-md bg-foreground font-heading text-base font-bold text-on-accent"
            >
              {PREVIEW_SALES.initials}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 font-heading text-base font-semibold text-foreground">
                {PREVIEW_SALES.name}
                <BadgeCheck width={15} height={15} className="text-primary" aria-hidden="true" />
                <span className="sr-only">Terverifikasi</span>
              </p>
              <p className="mt-0.5 text-sm text-foreground-muted">
                {PREVIEW_SALES.role} · {PREVIEW_SALES.dealer}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <RatingStars value={PREVIEW_SALES.rating} />
                <span className="tabular font-semibold text-foreground">
                  {PREVIEW_SALES.rating}
                </span>
                <span className="tabular text-foreground-muted">
                  {PREVIEW_SALES.reviews} ulasan
                </span>
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border pt-3.5 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                Transaksi
              </dt>
              <dd className="tabular mt-0.5 font-heading font-bold text-foreground">
                {PREVIEW_SALES.transactions}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                Response rate
              </dt>
              <dd className="tabular mt-0.5 font-heading font-bold text-foreground">
                {PREVIEW_SALES.responseRate}%
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                Rata-rata balas
              </dt>
              <dd className="tabular mt-0.5 font-heading font-bold text-foreground">
                {PREVIEW_SALES.responseMinutes} menit
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-foreground-muted lg:ml-[7rem]">
          Contoh tampilan profil, bukan akun sungguhan.
        </p>
      </div>
    </section>
  )
}

function CrmPreview() {
  const peak = Math.max(...PREVIEW_PIPELINE.map((s) => s.count))

  return (
    <section id="crm" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="crm"
          eyebrow="CRM"
          title="Lead yang sudah dibuka tidak hilang di catatan WhatsApp"
          lead="Lelang yang Anda menangkan dan lead pool yang Anda unlock masuk ke pipeline yang sama, dengan status dan catatan internal, sampai menang atau kalah."
        />

        <div className="mt-10 max-w-xl lg:ml-[7rem]">
          <ul className="divide-y divide-border border-t border-border">
            {PREVIEW_PIPELINE.map((stage) => (
              <li key={stage.label} className="flex items-center gap-4 py-3">
                <span className="w-28 shrink-0 text-sm font-medium text-foreground">
                  {stage.label}
                </span>
                <span
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-foreground"
                  style={{ width: `${(stage.count / peak) * 100}%`, minWidth: '0.375rem' }}
                />
                <span className="tabular ml-auto text-sm font-semibold text-foreground">
                  {stage.count}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-foreground-muted">
            Contoh isi pipeline, bukan data akun.
          </p>
        </div>
      </div>
    </section>
  )
}

function ReferralSection() {
  return (
    <section id="referral" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex
          id="referral"
          eyebrow="Referral"
          title="Ajak sales lain, saldo Anda bertambah"
          lead="Setiap sales yang mendaftar dan memverifikasi nomornya lewat kode Anda menambah 30 token, maksimal 300 token per bulan."
        />

        <ol className="mt-10 max-w-xl divide-y divide-border border-t border-border lg:ml-[7rem]">
          {[
            {
              title: 'Ambil kode referral Anda',
              body: 'Tersedia di halaman Referral begitu akun aktif.',
            },
            {
              title: 'Bagikan ke sales lain',
              body: 'Satu tautan, langsung ke halaman pendaftaran.',
            },
            {
              title: 'Token masuk setelah nomornya terverifikasi',
              body: 'Bukan saat klik — supaya kode tidak bisa dipakai memancing bonus kosong.',
            },
          ].map((step, i) => (
            <li key={step.title} className="flex gap-4 py-4">
              <span className="tabular shrink-0 font-heading text-sm font-bold text-foreground-muted">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold leading-snug text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/**
 * Native `<details>` on purpose. A question a visitor cannot open because
 * hydration has not finished is a question they leave without an answer to.
 */
function FaqSection() {
  return (
    <section id="faq" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionIndex id="faq" eyebrow="FAQ" title="Pertanyaan yang paling sering masuk" />

        <div className="mt-10 max-w-3xl divide-y divide-border border-t border-border lg:ml-[7rem]">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-heading text-base font-semibold text-foreground transition-colors duration-200 hover:text-primary">
                {faq.q}
                <Plus
                  width={16}
                  height={16}
                  aria-hidden="true"
                  className="shrink-0 transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <p className="max-w-2xl pb-4 text-sm leading-relaxed text-foreground-muted">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Ink band two of two. */
function FinalCta() {
  return (
    <section className="bg-accent">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid gap-4 lg:grid-cols-[6rem_minmax(0,1fr)] lg:gap-8">
          <span aria-hidden="true" className="block h-px w-10 bg-on-accent/25 lg:mt-4" />

          <div className="min-w-0">
            <h2 className="max-w-2xl font-heading text-3xl font-bold leading-tight tracking-tight text-on-accent [overflow-wrap:anywhere] sm:text-4xl">
              Lelang berjalan 48 jam. Menawar tidak memakai token.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-on-accent/60">
              Verifikasi nomor WhatsApp Anda, publikasikan penawaran per model, dan lelang brand yang
              Anda pegang langsung terbuka. Saldo 100 token ikut masuk untuk jalur pool.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={SIGNUP_HREF}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover active:scale-[0.98]"
              >
                Daftar gratis
                <ArrowRight width={16} height={16} aria-hidden="true" />
              </Link>
              <a
                href="#lelang"
                className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border border-on-accent/25 px-5 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-on-accent/10"
              >
                Lihat cara lelang
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
        <p className="font-heading text-sm font-bold tracking-tight text-foreground">
          Autonomo<span className="text-primary">.id</span>
        </p>
        <nav aria-label="Tautan kaki" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href="https://autonomo.id"
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm text-foreground-muted transition-colors duration-200 hover:text-foreground"
          >
            Untuk pembeli
          </a>
          <Link
            href={SIGNUP_HREF}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm text-foreground-muted transition-colors duration-200 hover:text-foreground"
          >
            Masuk
          </Link>
        </nav>
      </div>
    </footer>
  )
}

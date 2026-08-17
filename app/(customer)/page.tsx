import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Car, ShieldCheck, Wallet, Zap } from 'lucide-react'
import { PromoCard } from '@/components/promo-card'
import { RequestCard } from './request-card'
import {
  ALL_MODELS,
  BRANDS,
  type CatalogEntry,
  EV_BRANDS,
  findModel,
  spreadByBrand,
} from '@/lib/data/catalog'
import { bestOffersByModel, type PublicBrandOffer } from '@/lib/offers/public'

/**
 * Customer landing page.
 *
 * Hallmark · genre: editorial-catalogue · macrostructure: section-index
 * · design-system: design.md
 *
 * Rebuilt 2026-08-17 to the `mobile-user.md` direction: mobile-first, reading
 * headline → request card → coverage → live offers, inside an app shell with a
 * fixed bottom bar. The mockup supplied the order and the emphasis; design.md
 * supplied everything visual, and where they disagree design.md wins.
 *
 * **This is a landing page in an area that has other pages.** `/katalog`,
 * `/top-diskon`, `/request` and `/request/baru` are real routes and `/request`
 * requires a session, so the section heads below link out and the bottom bar in
 * the layout has somewhere to go. An earlier version of this file claimed the
 * customer area was one page with no login; that claim was stale.
 *
 * What the mockup asked for and did not get, each for a stated reason:
 *
 * - **Its three trust badges** ("500+ Dealer Resmi", "Hemat s/d Rp 50 Juta",
 *   "Proses Instan"). design.md §9 bans invented numbers, and no table backs any
 *   of them. Section 01 counts the catalogue instead, because an array length
 *   cannot drift from what the site lists.
 * - **A submit button with no verification step.** The card's one-time code is
 *   what authorises the write; a "Cari Penawaran Terbaik" button that files a
 *   request against an unproven number is the whole fraud surface of the product.
 * - **A free-text model field.** `requests.tier` is derived server-side from the
 *   catalogue slug, and tier decides what a sales user pays to unlock the lead. A
 *   typed model name has no tier, so the select stays a select.
 * - **Its three coarse discount options and its "Kota Domisili" field.** The card
 *   ships six bands that the server converts to a target price, and `requests` has
 *   no city column. Neither is a layout decision.
 * - **Its photography.** The hero background and the three card images are
 *   generated placeholder URLs on someone else's CDN. `car-image.tsx` states the
 *   standing position: no licensed photos in the repo, and hotlinked press images
 *   break the moment a URL rotates. Cards keep the drawn silhouettes.
 * - **`user-scalable=no`.** Pinch-zoom is not ours to disable.
 *
 * The 3.5 MB banner PNG that used to open this page went with the redesign. The
 * mockup leads with type over a photographic scrim, and the banner carries its own
 * palette and its own baked-in English headline — behind an Indonesian `h1` it
 * would have been two competing headlines in the first viewport.
 *
 * Four ornaments, the closed list in design.md §1 and nothing past it: two
 * off-canvas washes, the two-tone `h1`, the blurred pane behind the request card,
 * one gradient hairline. One ink band, the final call to action.
 *
 * The promo grid aggregates per brand and model across every sales user and never
 * names who is offering the discount. `PublicBrandOffer` carries no `salesId`, so
 * there is nothing here to leak by accident.
 */

export const metadata: Metadata = {
  /**
   * `absolute` rather than a plain string: the root layout sets a
   * `'%s · Autonomo.id'` template, and a plain string would render
   * "Autonomo.id — … · Autonomo.id" with the brand twice. Every other page wants
   * the template; the homepage is the one page that is the brand.
   */
  title: { absolute: 'Autonomo.id — cari mobil baru dengan diskon terbaik' },
  description:
    'Sebutkan mobil incaran dan harga yang Anda mau. Sales resmi dealer yang sanggup memenuhinya akan menghubungi Anda lewat WhatsApp. Gratis untuk pembeli, tanpa perlu daftar akun.',
}

/** Cards in the promo grid: one column on a phone, two rows of three on desktop. */
const PROMO_SLOTS = 6

/**
 * The page's sections, in order. The ordinal on each section head is read from
 * this list rather than typed per section, so inserting a section renumbers the
 * rest instead of silently producing two `02`s (design.md §4.1).
 */
const SECTIONS = ['coverage', 'promo'] as const
type SectionKey = (typeof SECTIONS)[number]

function ordinalOf(key: SectionKey): string {
  return String(SECTIONS.indexOf(key) + 1).padStart(2, '0')
}

/**
 * Products used for slots no live offer has claimed. Brand-diverse rather than
 * price-sorted, for the reason `spreadByBrand` exists: a price sort would fill the
 * grid with three Wulings.
 */
const CATALOGUE_FILLER = spreadByBrand(ALL_MODELS)

type PromoSlot = { model: CatalogEntry; offer: PublicBrandOffer | null }

/**
 * Live offers first, real catalogue products after.
 *
 * The grid stays six cards whether or not any sales user has posted an offer. A
 * homepage whose main section collapses to an empty box reads as broken rather
 * than as new, and the cars are real either way — filler cards carry `offer: null`
 * and say plainly that no discount has been posted. They never show a figure.
 *
 * An offer whose model has left the catalogue is skipped rather than rendered from
 * the offer alone: `findModel` is what supplies the body type, the variant count
 * and the fallback OTR, so a card without it would be half-blank.
 */
function fillPromoSlots(offers: readonly PublicBrandOffer[]): PromoSlot[] {
  const slots: PromoSlot[] = []
  const taken = new Set<string>()

  for (const offer of offers) {
    if (slots.length === PROMO_SLOTS) break

    const model = findModel(offer.brand, offer.model)
    if (!model) continue

    const key = `${model.brand.slug}/${model.slug}`
    if (taken.has(key)) continue

    taken.add(key)
    slots.push({ model, offer })
  }

  for (const model of CATALOGUE_FILLER) {
    if (slots.length === PROMO_SLOTS) break

    const key = `${model.brand.slug}/${model.slug}`
    if (taken.has(key)) continue

    taken.add(key)
    slots.push({ model, offer: null })
  }

  return slots
}

/**
 * Section 01, standing in for the mockup's invented trust badges. Every value
 * below is the length of an array in `lib/data/catalog.ts` or a fixed product
 * term, so none of it can drift from what the site actually offers.
 *
 * A hairline-divided list, not the mockup's three tinted cards: design.md §4.4
 * reserves cards for discrete objects the user acts on, and §4.2 bans grey section
 * washes outright.
 */
const COVERAGE = [
  {
    icon: Car,
    label: 'Brand di katalog',
    value: String(BRANDS.length),
    hint: 'Merek yang bisa Anda mintakan penawaran lewat satu request.',
  },
  {
    icon: Zap,
    label: 'Brand mobil listrik',
    value: String(EV_BRANDS.length),
    hint: 'Merek dengan model listrik di katalog, termasuk pemain baru.',
  },
  {
    icon: Wallet,
    label: 'Biaya untuk pembeli',
    value: 'Gratis',
    hint: 'Tanpa langganan dan tanpa komitmen pembelian.',
  },
] as const

/** First value only — `?brand=a&brand=b` is not a thing this page offers. */
function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function CustomerHomePage({ searchParams }: PageProps<'/'>) {
  // Read on the server and passed down as props. A client `useSearchParams()`
  // would drag this subtree behind a Suspense boundary for two strings that are
  // already in hand here.
  const [params, offers] = await Promise.all([searchParams, bestOffersByModel(PROMO_SLOTS)])

  const promos = fillPromoSlots(offers)
  const hasLiveOffer = promos.some((slot) => slot.offer !== null)

  return (
    <>
      {/* Hero. `overflow-hidden` is what keeps the washes off-canvas instead of
          widening the document — design.md §8 allows no horizontal scroll. */}
      <section className="relative overflow-hidden">
        {/* Ornament — two off-canvas washes. `aria-hidden` and
            `pointer-events-none`: they carry no meaning and must never intercept
            a tap. Neither sits under text. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-56 size-[36rem] rounded-full bg-primary/5 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-52 top-24 size-[32rem] rounded-full bg-success-fill/5 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-8 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:pb-20 lg:pt-14">
          <div className="min-w-0 lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              {/* The one shape `success-fill` is allowed to take: a fill with a
                  label beside it, never the label itself. */}
              <span
                className="size-2 animate-pulse rounded-full bg-success-fill"
                aria-hidden="true"
              />
              Platform diskon otomotif
            </p>

            {/* Ornament — the two-tone display heading, once per page. Both
                gradient stops are token colours that clear WCAG AA on white on
                their own (blue 5.75:1, red 6.7:1), so the line stays readable
                even if the clip does not render. */}
            <h1 className="mt-5 font-heading text-[2rem] font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
              Temukan mobil impian,{' '}
              <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                harga terbaik
              </span>
            </h1>

            <p className="mt-4 max-w-md text-base leading-relaxed text-foreground-muted lg:mt-6 lg:max-w-xl lg:text-lg">
              Sebutkan mobil incaran dan harga yang Anda mau. Sales resmi dari dealer yang sanggup
              memenuhinya menghubungi Anda lewat WhatsApp — tanpa keliling showroom.
            </p>

            {/* Desktop only. On a phone this paragraph would sit between the lead
                and the card, pushing the one control that matters below the fold;
                nothing in it is load-bearing, because the card states the same
                terms at the point they apply. */}
            <p className="mt-7 hidden max-w-xl items-start gap-1.5 text-sm text-foreground-muted lg:flex">
              <ShieldCheck width={15} height={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              Gratis untuk pembeli, tanpa daftar akun dan tanpa komitmen pembelian. Cukup verifikasi
              nomor WhatsApp sekali, dan nomor itu hanya terbuka ke sales yang serius menawar.
            </p>
          </div>

          {/* Ornament — the request card sits on a blurred pane, the mockup's one
              piece of glass. The pane is a sibling rather than a wrapper, so
              nothing between a finger and a control is blurred; the card itself is
              opaque, so the pane reads as a halo.

              `id="request"` is the anchor every promo card links back to
              (`/?brand=…&model=…#request`), so it is load-bearing beyond this
              page. `scroll-mt` clears the sticky header. */}
          <div id="request" className="relative mt-8 min-w-0 scroll-mt-24 lg:col-span-5 lg:mt-0">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-2 rounded-xl border border-border bg-surface/60 shadow-lg backdrop-blur-2xl sm:-inset-3"
            />
            <div className="relative">
              <RequestCard initialBrand={one(params.brand)} initialModel={one(params.model)} />
            </div>
          </div>
        </div>
      </section>

      {/* Ornament — one gradient hairline, standing in for the border between hero
          and the sections below so the seam reads as a transition, not a table
          rule. This is why the hero carries no `border-b`. */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-linear-to-r from-transparent via-primary/30 to-transparent"
      />

      {/* 01 — coverage */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
          <SectionHead
            index={ordinalOf('coverage')}
            eyebrow="Jangkauan"
            title="Satu request, semua merek"
            body="Angka di bawah dihitung dari katalog yang halaman ini pakai, bukan dari klaim pemasaran."
            href="/katalog"
            linkLabel="Lihat katalog"
          />

          <dl className="mt-6 divide-y divide-border">
            {COVERAGE.map(({ icon: Icon, label, value, hint }) => (
              <div key={label} className="flex items-center gap-4 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <Icon width={18} height={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">
                    {label}
                  </dt>
                  <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5">
                    <span className="tabular font-heading text-2xl font-bold leading-none tracking-tight text-foreground">
                      {value}
                    </span>
                    <span className="text-sm text-foreground-muted">{hint}</span>
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          {/* The figures above, spelled out. */}
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              Brand yang tercakup
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5">
              {BRANDS.map((brand) => (
                <li
                  key={brand.slug}
                  className="font-heading text-sm font-semibold tracking-tight text-foreground-muted"
                >
                  {brand.name}
                  {brand.electric && (
                    <span className="ml-1 align-super text-[9px] font-bold text-primary">EV</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 02 — live promos */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
          <SectionHead
            index={ordinalOf('promo')}
            eyebrow="Diskon aktif"
            title="Penawaran eksklusif"
            body="Penawaran terdalam yang sedang dipasang sales resmi, satu kartu per model. Angkanya datang langsung dari penawaran mereka."
            href="/top-diskon"
            linkLabel="Lihat semua"
          />

          {!hasLiveOffer && (
            <p className="mt-6 rounded-lg border border-dashed border-border px-6 py-14 text-center text-sm text-foreground-muted">
              Belum ada sales yang memasang diskon. Ajukan permintaan untuk model yang Anda mau —
              permintaan itulah yang membuat sales bersaing.{' '}
              <Link href="/#request" className="font-semibold text-primary hover:underline">
                Ajukan permintaan
              </Link>
            </p>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {promos.map(({ model, offer }) => (
              <PromoCard key={`${model.brand.slug}-${model.slug}`} model={model} offer={offer} />
            ))}
          </div>
        </div>
      </section>

      {/* Sales recruitment — the one ink band on the page. */}
      <section className="bg-accent">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 lg:flex-row lg:items-center lg:justify-between lg:py-16">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-accent/60">
              Untuk sales dealer
            </p>
            <h2 className="mt-3 font-heading text-2xl font-bold leading-tight text-on-accent sm:text-3xl">
              Berhenti menunggu walk-in.
            </h2>
            <p className="mt-3 text-on-accent/60">
              100 token gratis saat daftar. Buka hot lead sesuai brand Anda, hubungi lewat WhatsApp,
              bangun rating publik yang terlihat pembeli.
            </p>
          </div>
          {/* A plain `<a>`, not `<Link>`: another subdomain is a document load, and
              prefetching it would only warm a cache this app does not share. */}
          <a
            href="https://sales.autonomo.id"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-7 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
          >
            Masuk sebagai sales
            <ArrowRight width={16} height={16} aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  )
}

/**
 * Section head — the section index from design.md §4.1.
 *
 * Two columns on `lg`: a two-digit ordinal over a short rule in the left rail, the
 * eyebrow / title / lead in the right. Below `lg` the rail collapses above the
 * title, which is what keeps a 320px screen from splitting a six-rem track off the
 * copy. The ordinal comes from `ordinalOf`, never typed by hand.
 */
function SectionHead({
  index,
  eyebrow,
  title,
  body,
  href,
  linkLabel,
}: {
  index: string
  eyebrow: string
  title: string
  body: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="grid gap-4 border-b border-border pb-5 lg:grid-cols-[6rem_1fr] lg:gap-8">
      <div>
        <p className="tabular font-heading text-sm font-bold text-foreground-muted">{index}</p>
        <span aria-hidden="true" className="mt-2 block h-px w-8 bg-border lg:w-12" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">{body}</p>
        </div>

        {href && linkLabel && (
          <Link
            href={href}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary"
          >
            {linkLabel}
            <ArrowRight width={14} height={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}

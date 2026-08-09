import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { CarCard } from '@/components/car-card'
import { BRANDS, EV_BRANDS, EV_MODELS, ICE_MODELS, spreadByBrand } from '@/lib/data/catalog'
import { InlineRequestBar } from '@/components/inline-request-bar'
import banner from '@/public/assets/banner-autonomo.png'

/**
 * Customer landing page.
 *
 * The catalogue is the page. A buyer arrives wanting to see cars and what they
 * actually cost, so the hero is one screen tall, states the proposition, and
 * hands straight over to the grid.
 *
 * Colour discipline (60 white / 20 red / 20 black): the page is white, one black
 * band carries the sales pitch, and red appears only on the primary CTA, prices,
 * and the EV marker. Nothing else gets coloured — that restraint is what stops it
 * reading as a template.
 *
 * The banner is the one exception, and a knowing one: it ships with its own blue
 * and orange and its own baked-in English headline. It is therefore framed as a
 * contained image rather than a full-bleed background, and the page's real
 * headline sits below it in Indonesian — treating the banner as artwork, not as
 * the layout. Worth replacing with a red/black/white cut when there is time.
 */

const EV_FEATURED = spreadByBrand(EV_MODELS).slice(0, 6)
const ICE_FEATURED = spreadByBrand(ICE_MODELS).slice(0, 3)

export default function CustomerHomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 lg:pb-20 lg:pt-8">
          <div className="overflow-hidden rounded-lg border border-border bg-foreground">
            <Image
              src={banner}
              alt="Autonomo.id — diskon semua brand mobil di Indonesia, penawaran khusus mobil listrik"
              priority
              placeholder="blur"
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="h-auto w-full"
            />
          </div>

          <div className="mt-10 max-w-3xl">
            {/* <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Marketplace penawaran mobil baru
            </p>

            <h1 className="mt-4 font-heading text-[2.6rem] font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Cari diskon kendaraan impian.
              <br />
              <span className="text-primary">Dealer yang mewujudkan.</span>
            </h1> */}

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground-muted">
              Sebutkan mobil incaran dan harga yang Anda mau. Sales resmi dari dealer yang
              sanggup memenuhinya menghubungi Anda lewat WhatsApp — tanpa keliling showroom.
            </p>
          </div>

          <InlineRequestBar />

          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted">
            <ShieldCheck width={15} height={15} aria-hidden="true" />
            Gratis untuk pembeli. Nomor Anda hanya dibuka ke sales yang serius menawar.
          </p>

          {/* Brand strip — coverage, stated plainly. */}
          <div className="mt-14 border-t border-border pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              {BRANDS.length} brand · {EV_BRANDS.length} brand listrik
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-2.5">
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

      {/* EV catalogue */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <SectionHead
          eyebrow="Diutamakan"
          title="Mobil listrik"
          body="Diskon EV bergerak paling cepat — sales bersaing langsung di model yang sama."
          href="/katalog?listrik=1"
          linkLabel="Semua model listrik"
        />

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EV_FEATURED.map((model) => (
            <CarCard key={`${model.brand.slug}-${model.slug}`} model={model} />
          ))}
        </div>
      </section>

      {/* Non-EV catalogue */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <SectionHead
            title="Bensin & hybrid"
            body="MPV, SUV, dan city car yang paling banyak dicari di Indonesia."
            href="/katalog"
            linkLabel="Semua model"
          />

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ICE_FEATURED.map((model) => (
              <CarCard key={`${model.brand.slug}-${model.slug}`} model={model} />
            ))}
          </div>
        </div>
      </section>

      {/* Sales recruitment — the one black band on the page. */}
      <section className="bg-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Untuk sales dealer
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-white">
              Berhenti menunggu walk-in.
            </h2>
            <p className="mt-3 text-white/70">
              100 token gratis saat daftar. Buka hot lead sesuai brand Anda, hubungi lewat
              WhatsApp, bangun rating publik yang terlihat pembeli.
            </p>
          </div>
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

function SectionHead({
  eyebrow,
  title,
  body,
  href,
  linkLabel,
}: {
  eyebrow?: string
  title: string
  body: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1.5 font-heading text-[1.75rem] font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1.5 max-w-lg text-sm text-foreground-muted">{body}</p>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary"
      >
        {linkLabel}
        <ArrowRight width={14} height={14} aria-hidden="true" />
      </Link>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Timer, Wallet } from 'lucide-react'
import { findBrand, findModel } from '@/lib/data/catalog'
import { RequestForm } from './request-form'

export const metadata: Metadata = {
  title: 'Buat request mobil',
  description:
    'Sebutkan mobil incaran dan harga yang Anda mau. Sales resmi dealer yang sanggup memenuhinya akan menghubungi lewat WhatsApp.',
}

/**
 * The form is public: a buyer can fill it in before signing in, and the
 * submission bounces to login only at the point a phone number is needed. Asking
 * for a number before showing what it is for is the fastest way to lose them.
 *
 * `searchParams` prefills brand/model when the buyer arrived from a catalogue
 * card. Both values are looked up against the catalogue rather than trusted —
 * they land in a Select whose options are fixed, and the server re-resolves them
 * anyway, so a crafted URL cannot inject anything.
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const brandParam = typeof params.brand === 'string' ? params.brand : undefined
  const modelParam = typeof params.model === 'string' ? params.model : undefined
  // Digits only: the value came from a URL, so it is a suggestion for the input,
  // never a number anything is computed from.
  const priceParam =
    typeof params.harga === 'string' ? params.harga.replace(/\D/g, '').slice(0, 12) : undefined

  const brand = brandParam ? findBrand(brandParam) : undefined
  const model = brand && modelParam ? findModel(brand.slug, modelParam) : undefined

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
      >
        <ArrowLeft width={15} height={15} aria-hidden="true" />
        Kembali ke katalog
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_300px] lg:gap-14">
        <div>
          <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Sebutkan mobil dan harga yang Anda mau.
          </h1>
          <p className="mt-3 max-w-xl text-foreground-muted">
            {model
              ? `${brand?.name} ${model.name} — tentukan target harga Anda, sales dealer yang sanggup memenuhinya akan menghubungi.`
              : 'Sales dari dealer resmi akan bersaing memenuhi target harga Anda. Gratis, tanpa datang ke showroom.'}
          </p>

          <div className="mt-9 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
            <RequestForm
              defaultBrand={brand?.slug}
              defaultModel={model?.slug}
              defaultPrice={priceParam}
            />
          </div>
        </div>

        <aside className="space-y-6 lg:pt-2">
          <Step
            icon={<Wallet width={17} height={17} aria-hidden="true" />}
            title="Anda yang pasang harga"
            body="Bukan menunggu penawaran dealer. Sales melihat target Anda dan memutuskan sanggup atau tidak."
          />
          <Step
            icon={<Timer width={17} height={17} aria-hidden="true" />}
            title="Balasan dalam hitungan jam"
            body="Request langsung tampil di marketplace sales begitu nomor Anda terverifikasi."
          />
          <Step
            icon={<ShieldCheck width={17} height={17} aria-hidden="true" />}
            title="Nomor Anda tidak dipajang"
            body="Sales membayar token untuk membuka kontak Anda — itu yang menyaring penawar iseng."
          />
        </aside>
      </div>
    </div>
  )
}

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="border-l-2 border-border pl-4">
      <p className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{body}</p>
    </div>
  )
}

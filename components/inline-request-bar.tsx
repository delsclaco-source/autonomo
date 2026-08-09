'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { BRANDS, formatRupiah } from '@/lib/data/catalog'

/** Group digits the Indonesian way: 350000000 -> 350.000.000 */
function groupDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Hero request bar.
 *
 * A short version of the full form, on the landing page, because the whole
 * proposition is "name a car and a price" — making the buyer click through to
 * discover that adds a step to a two-field idea.
 *
 * It does not submit. It sends the buyer to login carrying the values in
 * `?next=`, because a request cannot exist without a verified WhatsApp number:
 * that number is the entire product. Login doubles as signup (an unknown number
 * is registered on first OTP), and a visitor who is already signed in is bounced
 * straight through to the prefilled form by the login page itself.
 *
 * The real Server Action and validation live on /request/baru, so there stays
 * exactly one write path and one place where tier and discount get resolved.
 */
export function InlineRequestBar() {
  const router = useRouter()
  const [brandSlug, setBrandSlug] = useState('')
  const [modelSlug, setModelSlug] = useState('')
  const [priceText, setPriceText] = useState('')

  const brand = useMemo(() => BRANDS.find((b) => b.slug === brandSlug), [brandSlug])
  const model = useMemo(() => brand?.models.find((m) => m.slug === modelSlug), [brand, modelSlug])

  function go() {
    const params = new URLSearchParams()
    if (brandSlug) params.set('brand', brandSlug)
    if (modelSlug) params.set('model', modelSlug)
    const digits = priceText.replace(/\D/g, '')
    if (digits) params.set('harga', digits)

    const target = `/request/baru${params.size ? `?${params}` : ''}`
    router.push(`/login?next=${encodeURIComponent(target)}`)
  }

  return (
    <div className="mt-9 max-w-3xl">
      <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-foreground/15 bg-border shadow-sm sm:flex-row">
        <div className="flex-1 bg-surface">
          <label
            htmlFor="hero-brand"
            className="block px-4 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted"
          >
            Brand
          </label>
          <Select
            value={brandSlug}
            onValueChange={(v) => {
              setBrandSlug(v ?? '')
              setModelSlug('')
            }}
          >
            <SelectTrigger
              id="hero-brand"
              className="h-10 w-full border-0 bg-transparent px-4 pb-2.5 pt-0 text-sm font-medium shadow-none focus-visible:ring-0"
            >
              <SelectValue placeholder="Semua brand" />
            </SelectTrigger>
            <SelectContent>
              {BRANDS.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>
                  {b.name}
                  {b.electric && (
                    <span className="ml-1.5 text-[11px] font-semibold text-primary">EV</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 bg-surface">
          <label
            htmlFor="hero-model"
            className="block px-4 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted"
          >
            Model
          </label>
          <Select value={modelSlug} onValueChange={(v) => setModelSlug(v ?? '')} disabled={!brand}>
            <SelectTrigger
              id="hero-model"
              className="h-10 w-full border-0 bg-transparent px-4 pb-2.5 pt-0 text-sm font-medium shadow-none focus-visible:ring-0"
            >
              <SelectValue placeholder={brand ? 'Pilih model' : 'Pilih brand dulu'} />
            </SelectTrigger>
            <SelectContent>
              {brand?.models.map((m) => (
                <SelectItem key={m.slug} value={m.slug}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 bg-surface">
          <label
            htmlFor="hero-price"
            className="block px-4 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted"
          >
            Harga yang Anda mau
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">
              Rp
            </span>
            <Input
              id="hero-price"
              inputMode="numeric"
              autoComplete="off"
              placeholder={model ? groupDigits(String(model.priceFrom)) : '350.000.000'}
              value={priceText}
              onChange={(e) => setPriceText(groupDigits(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && go()}
              className="tabular h-10 rounded-none border-0 bg-transparent pb-2.5 pl-9 pr-4 pt-0 text-sm font-semibold shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={go}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-primary px-7 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover sm:min-h-0"
        >
          Cari penawaran
          <ArrowRight width={16} height={16} aria-hidden="true" />
        </button>
      </div>

      {model ? (
        <p className="mt-2.5 text-xs text-foreground-muted">
          Harga OTR {brand?.name} {model.name}: {formatRupiah(model.priceFrom)}
          <span className="mx-1.5 text-border">·</span>
          Lanjut dengan verifikasi WhatsApp
        </p>
      ) : (
        <p className="mt-2.5 text-xs text-foreground-muted">
          Butuh verifikasi nomor WhatsApp — sekaligus jadi akun Anda. Belum punya akun? Nomor baru
          otomatis terdaftar.
        </p>
      )}
    </div>
  )
}

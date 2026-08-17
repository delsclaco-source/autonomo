'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { BODY_TYPES, BRANDS, type BodyType, formatRupiah } from '@/lib/data/catalog'

/** Group digits the Indonesian way: 350000000 -> 350.000.000 */
function groupDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const TRIGGER = 'h-12 w-full text-sm font-medium'

/**
 * Hero request card.
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
 *
 * **Jenis is a narrowing control, not a request field.** It shortens the model
 * list and is then dropped: `requests` has no body-type column, and the
 * catalogue already knows the body type of whichever model gets picked. Sending
 * it in the query string would imply the request stores it.
 *
 * The card is opaque on purpose. The landing page puts its one `backdrop-blur`
 * pane behind this element as a sibling, so the glass reads as a halo around the
 * card rather than as a layer between a finger and a control.
 */
export function InlineRequestBar() {
  const router = useRouter()
  const [brandSlug, setBrandSlug] = useState('')
  const [bodyType, setBodyType] = useState<BodyType | ''>('')
  const [modelSlug, setModelSlug] = useState('')
  const [priceText, setPriceText] = useState('')

  const brand = useMemo(() => BRANDS.find((b) => b.slug === brandSlug), [brandSlug])

  const models = useMemo(() => {
    if (!brand) return []
    return bodyType ? brand.models.filter((m) => m.bodyType === bodyType) : brand.models
  }, [brand, bodyType])

  const model = useMemo(() => models.find((m) => m.slug === modelSlug), [models, modelSlug])

  const bodyLabel = BODY_TYPES.find((b) => b.value === bodyType)?.label

  /** Nothing matches, so the model select has nothing to offer. */
  const noMatch = Boolean(brand && bodyType && models.length === 0)

  const modelPlaceholder = !brand
    ? 'Pilih brand dulu'
    : noMatch
      ? `Tidak ada ${bodyLabel} di ${brand.name}`
      : 'Pilih model'

  function go() {
    const params = new URLSearchParams()
    if (brandSlug) params.set('brand', brandSlug)
    if (model) params.set('model', model.slug)
    const digits = priceText.replace(/\D/g, '')
    if (digits) params.set('harga', digits)

    const target = `/request/baru${params.size ? `?${params}` : ''}`
    router.push(`/login?next=${encodeURIComponent(target)}`)
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
          Mulai pencarian
        </h2>
        <Search width={17} height={17} className="shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-4 space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field id="hero-brand" label="Merk mobil">
            <Select
              value={brandSlug}
              onValueChange={(v) => {
                setBrandSlug(v ?? '')
                setModelSlug('')
              }}
            >
              <SelectTrigger id="hero-brand" className={TRIGGER}>
                <SelectValue placeholder="Pilih merk" />
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
          </Field>

          <Field id="hero-jenis" label="Jenis mobil">
            <Select
              value={bodyType}
              onValueChange={(v) => {
                const next = (v ?? '') as BodyType | ''
                setBodyType(next)
                // A model that no longer fits the new body type must not stay
                // selected — it would submit a car the buyer just filtered out.
                if (next && model && model.bodyType !== next) setModelSlug('')
              }}
            >
              <SelectTrigger id="hero-jenis" className={TRIGGER}>
                <SelectValue placeholder="Semua jenis" />
              </SelectTrigger>
              <SelectContent>
                {BODY_TYPES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field id="hero-model" label="Model">
          <Select
            value={modelSlug}
            onValueChange={(v) => setModelSlug(v ?? '')}
            disabled={!brand || noMatch}
          >
            <SelectTrigger id="hero-model" className={TRIGGER}>
              <SelectValue placeholder={modelPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.slug} value={m.slug}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="hero-price" label="Harga yang Anda mau">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">
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
              className="tabular h-12 pl-9 text-sm font-semibold"
            />
          </div>
        </Field>

        <button
          type="button"
          onClick={go}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
        >
          Cari penawaran
          <ArrowRight width={16} height={16} aria-hidden="true" />
        </button>
      </div>

      {model ? (
        <p className="mt-3.5 text-xs text-foreground-muted">
          Harga OTR {brand?.name} {model.name}: {formatRupiah(model.priceFrom)}
          <span className="mx-1.5 text-border">·</span>
          Lanjut dengan verifikasi WhatsApp
        </p>
      ) : (
        <p className="mt-3.5 text-xs text-foreground-muted">
          Butuh verifikasi nomor WhatsApp — sekaligus jadi akun Anda. Belum punya akun? Nomor baru
          otomatis terdaftar.
        </p>
      )}
    </div>
  )
}

/**
 * Label above control, per design.md §5.4. Separate component rather than four
 * copies of the same wrapper: the label class stack is the thing that has to
 * stay identical across the four fields.
 */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

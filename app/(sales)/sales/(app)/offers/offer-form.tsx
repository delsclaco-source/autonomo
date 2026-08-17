'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BRANDS, formatRupiah, type CarBrand } from '@/lib/data/catalog'
import { BENEFITS, DISCOUNT_TYPES, OFFER_MAX_DISCOUNT_PERCENT } from '@/lib/validation/offer'
import { createOfferAction, type OfferFormState } from './actions'

/**
 * New offer form.
 *
 * The sales user declares what they can actually give on a car: the best discount
 * they will advertise, and privately the floor they will not go below. Both are
 * entered in whichever unit they think in — rupiah or percent off OTR — and the
 * server normalises to rupiah on write.
 *
 * Two things are deliberate here:
 *
 *   - the resulting discount is shown live, in both units, before submit. A promo
 *     typed in the wrong unit ("15.000.000" into a percent field) is the mistake
 *     this form exists to catch, and the server rejects it — but seeing the number
 *     while typing prevents the round trip.
 *   - `minDiscount` is labelled internal on the field itself. It is the number that
 *     decides whether the sales user trusts this screen at all, and a floor the
 *     buyer could see would be the end of that trust.
 *
 * Model options come from the catalogue rather than free text, which is what makes
 * the offer joinable against customer requests at all.
 */

const initialState: OfferFormState = { status: 'idle' }

/** Group digits the Indonesian way while the user types: 15.000.000 */
function groupDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Percent input: digits plus at most one comma, so "7,5" survives typing. */
function cleanPercent(raw: string): string {
  return raw
    .replace(/[^\d,.]/g, '')
    .replace(/\./g, ',')
    .replace(/,(?=[^,]*,)/g, '')
}

function toNumber(text: string, isPercent: boolean): number {
  if (isPercent) return Number(text.replace(',', '.')) || 0
  return Number(text.replace(/\D/g, '') || 0)
}

export function OfferForm() {
  const [state, formAction, pending] = useActionState(createOfferAction, initialState)

  const [brandSlug, setBrandSlug] = useState(() => state.values?.brand ?? '')
  const [modelSlug, setModelSlug] = useState(() => state.values?.model ?? '')
  const [variant, setVariant] = useState(() => state.values?.variant ?? '')
  const [discountType, setDiscountType] = useState(
    () => state.values?.discountType ?? 'fixed_amount',
  )
  const [otrText, setOtrText] = useState(() => groupDigits(state.values?.otrPrice ?? ''))
  const [maxText, setMaxText] = useState(() => state.values?.maxDiscount ?? '')
  const [minText, setMinText] = useState(() => state.values?.minDiscount ?? '')
  const [benefits, setBenefits] = useState<string[]>([])

  const isPercent = discountType === 'percentage'

  const brand: CarBrand | undefined = useMemo(
    () => BRANDS.find((b) => b.slug === brandSlug),
    [brandSlug],
  )
  const model = useMemo(() => brand?.models.find((m) => m.slug === modelSlug), [brand, modelSlug])

  // The OTR override wins when present; otherwise the catalogue list price is what
  // the server will use, so the preview has to use the same number.
  const otrPrice = Number(otrText.replace(/\D/g, '') || 0) || model?.priceFrom || 0

  const maxValue = toNumber(maxText, isPercent)
  const maxRupiah = isPercent ? Math.round((otrPrice * maxValue) / 100) : maxValue
  const maxPercent = otrPrice > 0 && maxRupiah > 0 ? (maxRupiah / otrPrice) * 100 : null
  const overCap = maxPercent !== null && maxPercent > OFFER_MAX_DISCOUNT_PERCENT

  const err = state.fieldErrors ?? {}

  function toggleBenefit(value: string) {
    setBenefits((prev) =>
      prev.includes(value) ? prev.filter((b) => b !== value) : [...prev, value],
    )
  }

  if (state.status === 'success') {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <CheckCircle2 width={40} height={40} className="mx-auto text-primary" aria-hidden="true" />
        <h2 className="mt-4 font-heading text-xl font-semibold text-foreground">
          Penawaran tersimpan
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">{state.message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/offers"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
          >
            Lihat penawaran saya
          </Link>
          <Link
            href="/offers/baru"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-6 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
          >
            Tambah lagi
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {/* Hidden mirrors of the Select values: Base UI's Select is a listbox, not a
          native <select>, so it does not post anything on its own. The benefit
          checkboxes post their own names and need no mirror. */}
      <input type="hidden" name="brand" value={brandSlug} />
      <input type="hidden" name="model" value={modelSlug} />
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="discountType" value={discountType} />

      {state.status === 'error' && state.message && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3.5 py-3 text-sm text-foreground"
        >
          <AlertCircle
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          {state.message}
        </p>
      )}

      <section className="space-y-5">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-foreground-muted">
          Mobil
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand" htmlFor="brand-trigger" error={err.brand}>
            <Select
              value={brandSlug}
              onValueChange={(v) => {
                setBrandSlug(v ?? '')
                setModelSlug('')
                setVariant('')
              }}
            >
              <SelectTrigger id="brand-trigger" className="h-11 w-full">
                <SelectValue placeholder="Pilih brand" />
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

          <Field label="Model" htmlFor="model-trigger" error={err.model}>
            <Select
              value={modelSlug}
              onValueChange={(v) => {
                setModelSlug(v ?? '')
                setVariant('')
              }}
              disabled={!brand}
            >
              <SelectTrigger id="model-trigger" className="h-11 w-full">
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
          </Field>

          <Field
            label="Varian"
            htmlFor="variant-trigger"
            error={err.variant}
            hint="Opsional — kosongkan kalau penawaran berlaku untuk semua varian"
          >
            <Select value={variant} onValueChange={(v) => setVariant(v ?? '')} disabled={!model}>
              <SelectTrigger id="variant-trigger" className="h-11 w-full">
                <SelectValue placeholder={model ? 'Semua varian' : 'Pilih model dulu'} />
              </SelectTrigger>
              <SelectContent>
                {model?.variants.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Harga OTR"
            htmlFor="otrPrice"
            error={err.otrPrice}
            hint={
              model
                ? `Kosongkan untuk pakai harga katalog: ${formatRupiah(model.priceFrom)}`
                : 'Opsional — isi kalau OTR kota Anda berbeda'
            }
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground-muted">
                Rp
              </span>
              <Input
                id="otrPrice"
                name="otrPrice"
                inputMode="numeric"
                autoComplete="off"
                placeholder={model ? groupDigits(String(model.priceFrom)) : '350.000.000'}
                value={otrText}
                onChange={(e) => setOtrText(groupDigits(e.target.value))}
                className="tabular h-11 pl-10"
                aria-describedby="otrPrice-hint"
              />
            </div>
          </Field>
        </div>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-foreground-muted">
          Diskon
        </h2>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Satuan" htmlFor="discountType-trigger" error={err.discountType}>
            <Select
              value={discountType}
              onValueChange={(v) => {
                setDiscountType(v ?? 'fixed_amount')
                // The two units share one input each; keeping the old text would
                // silently reinterpret "15.000.000" as 15 million percent.
                setMaxText('')
                setMinText('')
              }}
            >
              <SelectTrigger id="discountType-trigger" className="h-11 w-full">
                <SelectValue placeholder="Pilih satuan" />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Diskon maksimal"
            htmlFor="maxDiscount"
            error={err.maxDiscount}
            hint="Angka ini yang dilihat customer"
          >
            <div className="relative">
              {!isPercent && (
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground-muted">
                  Rp
                </span>
              )}
              <Input
                id="maxDiscount"
                name="maxDiscount"
                inputMode="decimal"
                autoComplete="off"
                placeholder={isPercent ? '7,5' : '15.000.000'}
                value={maxText}
                onChange={(e) =>
                  setMaxText(isPercent ? cleanPercent(e.target.value) : groupDigits(e.target.value))
                }
                className={`tabular h-11 font-semibold ${isPercent ? 'pr-8' : 'pl-10'}`}
                aria-describedby="maxDiscount-hint"
              />
              {isPercent && (
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground-muted">
                  %
                </span>
              )}
            </div>
          </Field>

          <Field
            label="Diskon minimal"
            htmlFor="minDiscount"
            error={err.minDiscount}
            hint="Internal — tidak pernah ditampilkan ke customer"
          >
            <div className="relative">
              {!isPercent && (
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground-muted">
                  Rp
                </span>
              )}
              <Input
                id="minDiscount"
                name="minDiscount"
                inputMode="decimal"
                autoComplete="off"
                placeholder={isPercent ? '5' : '10.000.000'}
                value={minText}
                onChange={(e) =>
                  setMinText(isPercent ? cleanPercent(e.target.value) : groupDigits(e.target.value))
                }
                className={`tabular h-11 ${isPercent ? 'pr-8' : 'pl-10'}`}
                aria-describedby="minDiscount-hint"
              />
              {isPercent && (
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground-muted">
                  %
                </span>
              )}
            </div>
          </Field>
        </div>

        {/* Live consequence of the numbers above, in the unit the user did not type. */}
        {maxPercent !== null && otrPrice > 0 && (
          <div
            className={`rounded-md border px-4 py-3 ${
              overCap ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm text-foreground-muted">Diskon yang dipublikasikan</span>
              <span className="tabular font-heading text-lg font-bold text-primary">
                {formatRupiah(maxRupiah)} · {maxPercent.toFixed(1)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-foreground-muted">
              Dihitung dari OTR {formatRupiah(otrPrice)}.
              {overCap && (
                <span className="mt-1 block font-medium text-foreground">
                  Di atas {OFFER_MAX_DISCOUNT_PERCENT}% akan ditolak — periksa satuan yang Anda
                  pilih.
                </span>
              )}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-foreground-muted">
          Benefit & periode
        </h2>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Benefit tambahan</legend>
          <p className="text-xs text-foreground-muted">
            Opsional. Ini yang membedakan penawaran Anda saat diskonnya sama.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {BENEFITS.map((b) => {
              const checked = benefits.includes(b.value)
              return (
                <label
                  key={b.value}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors duration-200 ${
                    checked
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-foreground-muted hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="benefits"
                    value={b.value}
                    checked={checked}
                    onChange={() => toggleBenefit(b.value)}
                    className="size-4 accent-primary"
                  />
                  {b.label}
                </label>
              )
            })}
          </div>
        </fieldset>

        {benefits.includes('other') && (
          <Field
            label="Keterangan benefit lainnya"
            htmlFor="benefitNote"
            error={err.benefitNote}
            hint='Contoh: "servis gratis 4× / 50.000 km"'
          >
            <Input
              id="benefitNote"
              name="benefitNote"
              maxLength={160}
              defaultValue={state.values?.benefitNote ?? ''}
              placeholder="Jelaskan singkat"
              className="h-11"
              aria-describedby="benefitNote-hint"
            />
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Nama promo"
            htmlFor="campaignName"
            error={err.campaignName}
            hint="Opsional"
          >
            <Input
              id="campaignName"
              name="campaignName"
              maxLength={80}
              defaultValue={state.values?.campaignName ?? ''}
              placeholder="Promo Akhir Tahun"
              className="h-11"
              aria-describedby="campaignName-hint"
            />
          </Field>

          <Field label="Mulai" htmlFor="startsAt" error={err.startsAt} hint="Opsional">
            <Input
              id="startsAt"
              name="startsAt"
              type="date"
              defaultValue={state.values?.startsAt ?? ''}
              className="tabular h-11"
              aria-describedby="startsAt-hint"
            />
          </Field>

          <Field
            label="Berakhir"
            htmlFor="endsAt"
            error={err.endsAt}
            hint="Otomatis expired setelah tanggal ini"
          >
            <Input
              id="endsAt"
              name="endsAt"
              type="date"
              defaultValue={state.values?.endsAt ?? ''}
              className="tabular h-11"
              aria-describedby="endsAt-hint"
            />
          </Field>
        </div>

        <Field
          label="Catatan internal"
          htmlFor="note"
          error={err.note}
          hint="Hanya Anda yang melihat ini"
        >
          <Textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            defaultValue={state.values?.note ?? ''}
            placeholder="Contoh: stok unit 3, alokasi Jakarta, butuh approval kalau di bawah floor."
          />
        </Field>
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs text-foreground-muted">
          Diskon minimal dan catatan internal tidak pernah ditampilkan ke customer.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-border px-6 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted disabled:opacity-60"
          >
            Simpan draft
          </button>
          <button
            type="submit"
            name="intent"
            value="active"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-7 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
          >
            {pending && (
              <Loader2 width={16} height={16} className="animate-spin" aria-hidden="true" />
            )}
            {pending ? 'Menyimpan…' : 'Publikasikan'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {/* Error replaces the hint rather than stacking below it, so the field's
          height does not jump when validation fires. */}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-primary" role="alert">
          <AlertCircle width={12} height={12} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-foreground-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

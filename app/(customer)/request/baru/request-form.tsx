'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
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
import { FRAUD_DISCOUNT_THRESHOLD, TIMEFRAMES } from '@/lib/validation/request'
import { submitCarRequest, type RequestFormState } from './actions'

/**
 * Car request form.
 *
 * The buyer names a target price in rupiah, not a discount percentage: nobody
 * shops by percentage, and the derived percentage is what the platform needs
 * anyway. The percentage is computed live from the catalogue list price so the
 * consequence of the number they typed is visible before they submit — and the
 * same computation is redone server-side, because this one is only a preview.
 *
 * Model options are driven by the selected brand rather than by a free text
 * field, which is also what makes the server-side tier lookup possible.
 */

const initialState: RequestFormState = { status: 'idle' }

/** Group digits the Indonesian way while the user types: 350.000.000 */
function groupDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function RequestForm({
  defaultBrand,
  defaultModel,
  defaultPrice,
}: {
  defaultBrand?: string
  defaultModel?: string
  /** Digits only, prefilled from the hero bar via `?harga=`. */
  defaultPrice?: string
}) {
  const [state, formAction, pending] = useActionState(submitCarRequest, initialState)

  const [brandSlug, setBrandSlug] = useState(
    () => state.values?.brand ?? defaultBrand ?? '',
  )
  const [modelSlug, setModelSlug] = useState(() => state.values?.model ?? defaultModel ?? '')
  const [variant, setVariant] = useState(() => state.values?.variant ?? '')
  const [timeframe, setTimeframe] = useState(() => state.values?.timeframe ?? '')
  const [priceText, setPriceText] = useState(() =>
    groupDigits(state.values?.targetPrice ?? defaultPrice ?? ''),
  )

  const brand: CarBrand | undefined = useMemo(
    () => BRANDS.find((b) => b.slug === brandSlug),
    [brandSlug],
  )
  const model = useMemo(
    () => brand?.models.find((m) => m.slug === modelSlug),
    [brand, modelSlug],
  )

  const targetPrice = Number(priceText.replace(/\D/g, '') || 0)
  const listPrice = model?.priceFrom ?? 0
  const discount =
    listPrice > 0 && targetPrice > 0 && targetPrice <= listPrice
      ? ((listPrice - targetPrice) / listPrice) * 100
      : null

  const err = state.fieldErrors ?? {}

  // Coming back from login, the buyer should land on the form they had filled in,
  // not on an empty one.
  const nextAfterLogin = (() => {
    const params = new URLSearchParams()
    if (brandSlug) params.set('brand', brandSlug)
    if (modelSlug) params.set('model', modelSlug)
    const digits = priceText.replace(/\D/g, '')
    if (digits) params.set('harga', digits)
    return `/request/baru${params.size ? `?${params}` : ''}`
  })()

  if (state.status === 'success') {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <CheckCircle2 width={40} height={40} className="mx-auto text-primary" aria-hidden="true" />
        <h2 className="mt-4 font-heading text-xl font-semibold text-foreground">
          Request terkirim
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">{state.message}</p>
        <Link
          href="/request"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
        >
          Lihat request saya
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {/* Hidden mirrors of the Select values: shadcn's Select is a listbox, not a
          native <select>, so it does not post anything on its own. */}
      <input type="hidden" name="brand" value={brandSlug} />
      <input type="hidden" name="model" value={modelSlug} />
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="timeframe" value={timeframe} />

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

      {state.status === 'needs_login' && (
        <div
          role="alert"
          className="rounded-md border border-border bg-muted px-3.5 py-3 text-sm text-foreground"
        >
          <p className="font-medium">{state.message}</p>
          <Link
            href={`/login?next=${encodeURIComponent(nextAfterLogin)}`}
            className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Verifikasi nomor WhatsApp
            <ArrowRight width={14} height={14} aria-hidden="true" />
          </Link>
        </div>
      )}

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
          hint="Opsional — kosongkan kalau belum tahu"
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

        <Field label="Rencana pembelian" htmlFor="timeframe-trigger" error={err.timeframe}>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v ?? '')}>
            <SelectTrigger id="timeframe-trigger" className="h-11 w-full">
              <SelectValue placeholder="Kapan mau ambil?" />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field
        label="Harga yang Anda inginkan"
        htmlFor="targetPrice"
        error={err.targetPrice}
        hint={
          model
            ? `Harga OTR ${model.name}: ${formatRupiah(listPrice)}`
            : 'Pilih model untuk melihat harga OTR-nya'
        }
      >
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground-muted">
            Rp
          </span>
          <Input
            id="targetPrice"
            name="targetPrice"
            inputMode="numeric"
            autoComplete="off"
            placeholder="350.000.000"
            value={priceText}
            onChange={(e) => setPriceText(groupDigits(e.target.value))}
            className="tabular h-12 pl-10 text-base font-semibold"
            aria-describedby="targetPrice-hint"
          />
        </div>
      </Field>

      {/* Live consequence of the number typed above. */}
      {discount !== null && (
        <div className="rounded-md border border-border bg-muted px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-sm text-foreground-muted">Setara diskon</span>
            <span className="tabular font-heading text-lg font-bold text-primary">
              {discount.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            Hemat {formatRupiah(listPrice - targetPrice)} dari harga OTR.
            {discount > FRAUD_DISCOUNT_THRESHOLD && (
              <span className="mt-1 block font-medium text-foreground">
                Di atas {FRAUD_DISCOUNT_THRESHOLD}% jarang disetujui dealer — request akan
                ditinjau tim kami dulu.
              </span>
            )}
          </p>
        </div>
      )}

      <Field
        label="Catatan untuk sales"
        htmlFor="notes"
        error={err.notes}
        hint="Opsional — warna, kredit/tunai, kota pengambilan"
      >
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={state.values?.notes ?? ''}
          placeholder="Contoh: warna putih, tukar tambah, ambil di Jakarta Selatan."
        />
      </Field>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs text-foreground-muted">
          Nomor WhatsApp Anda hanya dibuka ke sales yang membayar untuk menawar — tidak
          ditampilkan publik.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-7 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
        >
          {pending && (
            <Loader2 width={16} height={16} className="animate-spin" aria-hidden="true" />
          )}
          {pending ? 'Mengirim…' : 'Kirim request'}
        </button>
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

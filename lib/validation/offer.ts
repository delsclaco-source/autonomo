import { z } from 'zod'
import { findModel } from '@/lib/data/catalog'
import type { DiscountType, OfferBenefitKind } from '@/lib/db/schema'

/**
 * Sales offer validation.
 *
 * An offer is the sales side of the marketplace: "on this brand/model I can go
 * down to X". It is the counterpart of a customer request, and the matching
 * engine compares the two in rupiah — so everything is normalised to rupiah on
 * write, whichever way the sales user typed it.
 *
 * Three rules are enforced here and nowhere else:
 *
 *  - Brand and model must exist in the catalogue. A free-text model would break
 *    matching (`sales_offers.model` is joined against `requests.model`) and would
 *    let a sales user publish inventory for a car nobody can request.
 *  - `minDiscount` may never exceed `maxDiscount`. The pair is a range; inverted,
 *    every match calculation reads backwards.
 *  - A discount above `OFFER_MAX_DISCOUNT_PERCENT` off OTR is rejected. No new car
 *    in this market moves at half price; the number is a typo (rupiah typed into
 *    a percent field, usually) or bait to win the ranking.
 *
 * Unlike the customer request path, an implausible number here is rejected rather
 * than flagged for review. The asymmetry is deliberate: a customer's unrealistic
 * ask is still a real lead someone may want, while a sales user's unrealistic
 * offer is published to buyers as a promise and would be shown at the top of the
 * discount ranking.
 */

/** Above this share of OTR an offer is a mistake, not a deal. */
export const OFFER_MAX_DISCOUNT_PERCENT = 50

/** Below this the "discount" is not worth publishing as one. */
const MIN_DISCOUNT_RUPIAH = 100_000

/** Same floor the request form uses — below it, the number is not a car price. */
const MIN_OTR_PRICE = 20_000_000

/** Longest promo window we let a sales user schedule, in days. */
const MAX_CAMPAIGN_DAYS = 365

export const BENEFITS: readonly { value: OfferBenefitKind; label: string }[] = [
  { value: 'free_service', label: 'Gratis servis berkala' },
  { value: 'free_insurance', label: 'Gratis asuransi' },
  { value: 'free_accessories', label: 'Gratis aksesoris' },
  { value: 'free_coating', label: 'Gratis coating' },
  { value: 'free_tint', label: 'Gratis kaca film' },
  { value: 'other', label: 'Lainnya' },
]

const benefitValues = BENEFITS.map((b) => b.value) as [OfferBenefitKind, ...OfferBenefitKind[]]

export const DISCOUNT_TYPES: readonly { value: DiscountType; label: string }[] = [
  { value: 'fixed_amount', label: 'Rupiah' },
  { value: 'percentage', label: 'Persen dari OTR' },
]

export function benefitLabel(value: OfferBenefitKind): string {
  return BENEFITS.find((b) => b.value === value)?.label ?? value
}

export const offerInputSchema = z.object({
  brand: z.string().trim().min(1, 'Pilih brand mobil'),
  model: z.string().trim().min(1, 'Pilih model mobil'),
  variant: z.string().trim().max(80).optional().or(z.literal('')),
  /**
   * Rupiah. Optional — the catalogue list price is used when the sales user does
   * not override it. Dealers quote different OTR per region, so the override has
   * to exist; the percentage shown to buyers is always computed against whichever
   * figure is stored on the row.
   */
  otrPrice: z
    .number()
    .int('Harga OTR harus berupa angka bulat')
    .min(MIN_OTR_PRICE, 'Harga OTR terlalu rendah untuk mobil baru')
    .optional(),
  discountType: z.enum(['fixed_amount', 'percentage'], {
    message: 'Pilih satuan diskon',
  }),
  /** Rupiah when `discountType` is `fixed_amount`, percent when `percentage`. */
  maxDiscount: z
    .number({ message: 'Masukkan diskon maksimal yang Anda sanggupi' })
    .positive('Diskon harus lebih dari nol'),
  /** Same unit as `maxDiscount`. Internal — never leaves the server. */
  minDiscount: z.number().positive('Diskon minimal harus lebih dari nol').optional(),
  campaignName: z
    .string()
    .trim()
    .max(80, 'Nama promo maksimal 80 karakter')
    .optional()
    .or(z.literal('')),
  /** `YYYY-MM-DD` from a native date input. */
  startsAt: z.string().trim().optional().or(z.literal('')),
  endsAt: z.string().trim().optional().or(z.literal('')),
  benefits: z.array(z.enum(benefitValues)).max(BENEFITS.length),
  benefitNote: z
    .string()
    .trim()
    .max(160, 'Keterangan maksimal 160 karakter')
    .optional()
    .or(z.literal('')),
  note: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().or(z.literal('')),
})

export type OfferInput = z.infer<typeof offerInputSchema>

export type ResolvedOffer = {
  brand: string
  model: string
  variant: string | null
  otrPrice: number
  /** Rupiah, whatever unit was typed. Public. */
  maxDiscount: number
  /** Rupiah. Internal floor — must never reach a customer response. */
  minDiscount: number | null
  discountType: DiscountType
  campaignName: string | null
  startsAt: Date | null
  endsAt: Date | null
  note: string | null
  benefits: { benefit: OfferBenefitKind; note: string | null }[]
}

export type ResolveOfferResult =
  | { ok: true; value: ResolvedOffer }
  | { ok: false; fieldErrors: Record<string, string> }

/**
 * Jakarta-local start of a `YYYY-MM-DD` day.
 *
 * The offer window is what a sales user promises a buyer, and they mean local
 * days. Parsing the bare string would land on UTC midnight — a promo ending
 * "31 Agustus" would stop being valid at 07:00 WIB that morning.
 */
function jakartaDayStart(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const parsed = new Date(`${day}T00:00:00+07:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** End of the given Jakarta day, so an end date is inclusive. */
function jakartaDayEnd(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const parsed = new Date(`${day}T23:59:59+07:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Turn validated input into the row that gets stored.
 *
 * Returns field errors rather than throwing so the form can put each message
 * beside the input that caused it.
 */
export function resolveOffer(input: OfferInput, now = new Date()): ResolveOfferResult {
  const entry = findModel(input.brand, input.model)
  if (!entry) {
    return { ok: false, fieldErrors: { model: 'Model tidak ada di katalog' } }
  }

  const otrPrice = input.otrPrice ?? entry.priceFrom

  // Percent is converted against the OTR on this row, not the catalogue price, so
  // the stored rupiah figure always agrees with the percentage the sales user saw.
  const toRupiah = (value: number) =>
    input.discountType === 'percentage' ? Math.round((otrPrice * value) / 100) : Math.round(value)

  const maxDiscount = toRupiah(input.maxDiscount)

  if (maxDiscount < MIN_DISCOUNT_RUPIAH) {
    return {
      ok: false,
      fieldErrors: { maxDiscount: 'Diskon terlalu kecil untuk dipublikasikan' },
    }
  }

  const percent = (maxDiscount / otrPrice) * 100
  if (percent > OFFER_MAX_DISCOUNT_PERCENT) {
    return {
      ok: false,
      fieldErrors: {
        maxDiscount: `Diskon ${percent.toFixed(1)}% dari OTR tidak wajar — maksimal ${OFFER_MAX_DISCOUNT_PERCENT}%. Periksa satuan yang Anda pilih.`,
      },
    }
  }

  const minDiscount = input.minDiscount === undefined ? null : toRupiah(input.minDiscount)

  if (minDiscount !== null && minDiscount > maxDiscount) {
    return {
      ok: false,
      fieldErrors: { minDiscount: 'Diskon minimal tidak boleh lebih besar dari maksimal' },
    }
  }

  // Variant is only accepted when the catalogue lists it for this model, matching
  // the rule on the request side — otherwise the two sides never compare equal.
  const variant = input.variant && entry.variants.includes(input.variant) ? input.variant : null

  const startsAt = input.startsAt ? jakartaDayStart(input.startsAt) : null
  if (input.startsAt && !startsAt) {
    return { ok: false, fieldErrors: { startsAt: 'Tanggal mulai tidak valid' } }
  }

  const endsAt = input.endsAt ? jakartaDayEnd(input.endsAt) : null
  if (input.endsAt && !endsAt) {
    return { ok: false, fieldErrors: { endsAt: 'Tanggal berakhir tidak valid' } }
  }

  if (endsAt && endsAt.getTime() < now.getTime()) {
    return { ok: false, fieldErrors: { endsAt: 'Tanggal berakhir sudah lewat' } }
  }

  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return {
      ok: false,
      fieldErrors: { endsAt: 'Tanggal berakhir harus setelah tanggal mulai' },
    }
  }

  if (startsAt && endsAt) {
    const days = (endsAt.getTime() - startsAt.getTime()) / 86_400_000
    if (days > MAX_CAMPAIGN_DAYS) {
      return {
        ok: false,
        fieldErrors: { endsAt: `Periode promo maksimal ${MAX_CAMPAIGN_DAYS} hari` },
      }
    }
  }

  // Deduplicated because `offer_benefits` has a unique index on (offer_id,
  // benefit); a repeated checkbox value would abort the whole insert.
  const benefits = [...new Set(input.benefits)]

  if (benefits.includes('other') && !input.benefitNote) {
    return {
      ok: false,
      fieldErrors: { benefitNote: 'Jelaskan benefit lainnya' },
    }
  }

  return {
    ok: true,
    value: {
      brand: entry.brand.slug,
      model: entry.slug,
      variant,
      otrPrice,
      maxDiscount,
      minDiscount,
      discountType: input.discountType,
      campaignName: input.campaignName ? input.campaignName : null,
      startsAt,
      endsAt,
      note: input.note ? input.note : null,
      benefits: benefits.map((benefit) => ({
        benefit,
        note: benefit === 'other' ? input.benefitNote || null : null,
      })),
    },
  }
}

/** Digits with an optional decimal, so "7,5" and "7.5" both parse as 7.5. */
export function parseDecimal(raw: FormDataEntryValue | null): number | undefined {
  if (typeof raw !== 'string') return undefined
  const cleaned = raw.replace(/[^\d,.]/g, '').replace(',', '.')
  if (!cleaned) return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

import { z } from 'zod'
import { findModel, resolveTier } from '@/lib/data/catalog'
import type { CarTier } from '@/lib/db/schema'

/**
 * Car request validation.
 *
 * Everything a client sends is treated as a claim to be checked, not as data to
 * be stored. Two rules from CLAUDE.md are enforced here and nowhere else:
 *
 *  - `tier` is resolved server-side from brand/model. A customer who could pick
 *    their own tier would label a Model Y as low-tier and make their lead cheap
 *    for sales to unlock.
 *  - An implausible discount is flagged rather than rejected. Rejecting teaches a
 *    fraudster the threshold; flagging keeps the row and lets admin review it.
 *
 * Two ways in, one row out. The public card asks for a discount *band* in rupiah
 * (`resolveRequestFromBand`); the older form asks for a target *price*
 * (`resolveRequest`). Both land on the same `ResolvedRequest`, and the band path
 * delegates to the price path rather than duplicating it, so tier resolution and
 * the fraud flag have exactly one implementation.
 *
 * Neither path accepts a percentage from the client. It is derived from the
 * catalogue's list price, so nobody can inflate their discount by lying about
 * what the car costs.
 */

/** Above this discount off list, a request is held for admin review. */
export const FRAUD_DISCOUNT_THRESHOLD = 30

/** Hard floor: below this, the number is a typo or an attack, not an offer. */
const MIN_TARGET_PRICE = 20_000_000

export const TIMEFRAMES = [
  { value: 'asap', label: 'Secepatnya (< 1 minggu)' },
  { value: '1m', label: 'Dalam 1 bulan' },
  { value: '3m', label: '1 – 3 bulan' },
  { value: 'survey', label: 'Masih survei harga' },
] as const

const timeframeValues = TIMEFRAMES.map((t) => t.value) as [string, ...string[]]

/**
 * Discount bands the buyer picks from, in rupiah off the list price.
 *
 * Rupiah rather than percent because that is the unit the other side of the
 * market already speaks: `sales_offers.max_discount` is rupiah, and the matching
 * engine compares the two directly (see the note on `sales_offers` in
 * lib/db/schema.ts). A percentage cannot be compared across models without
 * carrying the OTR alongside it.
 *
 * A band rather than an exact figure because nobody knows what an exact figure
 * should be. "Somewhere between 25 and 40 million off" is a real answer; "exactly
 * Rp 312.500.000" is a number people invent to get past a form.
 *
 * `max` exists for the label only. Everything stored is derived from `min` — the
 * smallest discount the buyer says they would still take — because that is the bar
 * a sales user has to clear to be worth showing. The top of the band is an
 * aspiration, and an aspiration is not a requirement.
 *
 * The last band is open-ended (`max: null`): a ceiling there would either cap what
 * a luxury buyer can ask for or need revising every time the catalogue gains a
 * more expensive car.
 *
 * Nothing extra is stored to remember which band was picked. `requests.list_price`
 * and `requests.target_price` are both frozen at submission, so their difference
 * *is* the band's lower bound, and this list is fixed — recovering the label is a
 * lookup on `min`, not a second copy of the data. Editing a `min` below breaks
 * that read-back for rows already written; add a band instead of moving one.
 */
export const DISCOUNT_BANDS = [
  { value: '0-25', label: 'Sampai Rp25 jt', min: 0, max: 25_000_000 },
  { value: '25-40', label: 'Rp25 – 40 jt', min: 25_000_000, max: 40_000_000 },
  { value: '40-60', label: 'Rp40 – 60 jt', min: 40_000_000, max: 60_000_000 },
  { value: '60-100', label: 'Rp60 – 100 jt', min: 60_000_000, max: 100_000_000 },
  { value: '100-150', label: 'Rp100 – 150 jt', min: 100_000_000, max: 150_000_000 },
  { value: '150-plus', label: 'Di atas Rp150 jt', min: 150_000_000, max: null },
] as const

export type DiscountBand = (typeof DISCOUNT_BANDS)[number]

const discountBandValues = DISCOUNT_BANDS.map((b) => b.value) as [string, ...string[]]

/**
 * Optional purchase preferences.
 *
 * Optional in the strong sense: a buyer who answers neither still submits a
 * complete, auctionable request. They are here because a dealer treats these two
 * answers as different kinds of work — a corporate purchase runs through a fleet
 * process, and a credit purchase earns the dealer leasing commission a cash one
 * does not — so a sales user reads them to decide whether a lead is worth tokens.
 *
 * They never move a price. `tier`, the unlock cost and the fraud flag come from
 * brand/model and the discount alone, so nobody can make their own lead cheaper
 * to unlock by claiming to be a company or by paying cash.
 *
 * An unanswered select posts `''`, not a missing key. Both schemas below accept
 * the empty string and `resolveRequest` turns it into NULL, so the column holds
 * "not answered" rather than a zero-length string a later query has to remember
 * to treat as absent.
 */
export const BUYER_TYPES = [
  { value: 'personal', label: 'Pribadi' },
  { value: 'corporate', label: 'Perusahaan / corporate' },
] as const

export const PAYMENT_SCHEMES = [
  { value: 'cash', label: 'Cash / tunai' },
  { value: 'credit', label: 'Kredit / leasing' },
] as const

const buyerTypeValues = BUYER_TYPES.map((b) => b.value) as [string, ...string[]]
const paymentSchemeValues = PAYMENT_SCHEMES.map((p) => p.value) as [string, ...string[]]

/**
 * Human label for a stored timeframe slug.
 *
 * The slugs (`asap`, `1m`, `3m`, `survey`) are storage keys, not copy. Rendering
 * one raw shows the customer "Rencana ambil: 1m". Unknown values fall back to
 * the slug so a value added to the enum without a label still renders something.
 */
export function timeframeLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return TIMEFRAMES.find((t) => t.value === value)?.label ?? value
}

export const requestInputSchema = z.object({
  brand: z.string().trim().min(1, 'Pilih brand mobil'),
  model: z.string().trim().min(1, 'Pilih model mobil'),
  variant: z.string().trim().max(80).optional().or(z.literal('')),
  /** Rupiah, absolute. Parsed from a digit-grouped text input. */
  targetPrice: z
    .number({ message: 'Masukkan harga yang Anda inginkan' })
    .int('Harga harus berupa angka bulat')
    .min(MIN_TARGET_PRICE, 'Harga terlalu rendah untuk mobil baru'),
  timeframe: z.enum(timeframeValues, { message: 'Pilih rencana pembelian' }),
  buyerType: z.enum(buyerTypeValues).optional().or(z.literal('')),
  paymentScheme: z.enum(paymentSchemeValues).optional().or(z.literal('')),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().or(z.literal('')),
})

export type RequestInput = z.infer<typeof requestInputSchema>

export type ResolvedRequest = {
  brand: string
  model: string
  variant: string | null
  /** Server-resolved, never from the client. */
  tier: CarTier
  listPrice: number
  targetPrice: number
  /** Discount off list implied by the target price, 2 decimal places. */
  discountWanted: number
  timeframe: string
  /** Optional preferences, null when skipped. Never affect tier or unlock cost. */
  buyerType: string | null
  paymentScheme: string | null
  notes: string | null
  /** Non-null when the request needs admin review before going to the market. */
  flaggedReason: string | null
}

export type ResolveResult =
  | { ok: true; value: ResolvedRequest }
  | { ok: false; fieldErrors: Record<string, string> }

/**
 * Turn validated input into the row that gets stored.
 *
 * Server-only in practice — it reads the catalogue for the authoritative list
 * price and tier. Returns field errors rather than throwing so the form can show
 * them next to the offending input.
 */
export function resolveRequest(input: RequestInput): ResolveResult {
  const entry = findModel(input.brand, input.model)
  if (!entry) {
    return { ok: false, fieldErrors: { model: 'Model tidak ada di katalog' } }
  }

  const listPrice = entry.priceFrom

  if (input.targetPrice > listPrice) {
    return {
      ok: false,
      fieldErrors: {
        targetPrice: 'Harga yang diinginkan lebih tinggi dari harga OTR — turunkan angkanya',
      },
    }
  }

  // Variant is only accepted if the catalogue lists it for this model; a free
  // text variant would be a stored-value field a sales user later reads.
  const variant =
    input.variant && entry.variants.includes(input.variant) ? input.variant : null

  const discountWanted = Math.round(((listPrice - input.targetPrice) / listPrice) * 10000) / 100

  return {
    ok: true,
    value: {
      brand: entry.brand.slug,
      model: entry.slug,
      variant,
      tier: resolveTier(input.brand, input.model),
      listPrice,
      targetPrice: input.targetPrice,
      discountWanted,
      timeframe: input.timeframe,
      buyerType: input.buyerType ? input.buyerType : null,
      paymentScheme: input.paymentScheme ? input.paymentScheme : null,
      notes: input.notes ? input.notes : null,
      flaggedReason:
        discountWanted > FRAUD_DISCOUNT_THRESHOLD
          ? `discount_wanted ${discountWanted}% exceeds ${FRAUD_DISCOUNT_THRESHOLD}% threshold`
          : null,
    },
  }
}

/** Digits only, so "Rp 350.000.000" and "350000000" both parse. */
export function parseRupiah(raw: FormDataEntryValue | null): number | undefined {
  if (typeof raw !== 'string') return undefined
  const digits = raw.replace(/\D/g, '')
  if (!digits) return undefined
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : undefined
}

/**
 * What the public request card posts: a discount band instead of a price.
 *
 * Same shape as `requestInputSchema` otherwise, and deliberately a sibling rather
 * than a variant of it — the two differ in exactly one field, and a shared schema
 * with both fields optional would accept a post carrying neither.
 */
export const requestBandInputSchema = z.object({
  brand: z.string().trim().min(1, 'Pilih brand mobil'),
  model: z.string().trim().min(1, 'Pilih model mobil'),
  variant: z.string().trim().max(80).optional().or(z.literal('')),
  discountBand: z.enum(discountBandValues, { message: 'Pilih rentang diskon' }),
  timeframe: z.enum(timeframeValues, { message: 'Pilih rencana pembelian' }),
  buyerType: z.enum(buyerTypeValues).optional().or(z.literal('')),
  paymentScheme: z.enum(paymentSchemeValues).optional().or(z.literal('')),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().or(z.literal('')),
})

export type RequestBandInput = z.infer<typeof requestBandInputSchema>

/**
 * Band input into the same stored row a price input produces.
 *
 * The band's lower bound becomes the target price: `list_price − band.min`. That
 * is the whole conversion, and it is why no migration was needed — `min` is the
 * smallest discount the buyer says they would still accept, so the price it
 * implies is the highest price they would still pay, which is exactly what
 * `target_price` has always meant.
 *
 * Delegates to `resolveRequest` for tier, `discount_wanted` and the fraud flag.
 * Those three are the rules CLAUDE.md pins down, and a second copy of them here
 * is a second place for them to drift.
 */
export function resolveRequestFromBand(input: RequestBandInput): ResolveResult {
  const band = DISCOUNT_BANDS.find((b) => b.value === input.discountBand)
  if (!band) {
    return { ok: false, fieldErrors: { discountBand: 'Rentang diskon tidak dikenal' } }
  }

  const entry = findModel(input.brand, input.model)
  if (!entry) {
    return { ok: false, fieldErrors: { model: 'Model tidak ada di katalog' } }
  }

  // Clamped at zero, never rejected. The bands are one fixed list shown for
  // every car, so the deepest ones exceed the cheapest cars outright — Rp150 jt
  // off a Rp139 jt Ayla is a negative price, and `target_price` feeds both the
  // auction and the matching engine, which read it as money.
  //
  // Any band is accepted on any car on purpose: a buyer asking for more than a
  // car can give is still a real buyer, and deciding whether that ask is worth
  // answering is the sales side's job, not this form's. The fraud threshold
  // below already routes an implausible ask away from the auction and into the
  // token pool, where a sales user sees it and chooses. What they asked for
  // stays legible in `discount_wanted` even after the clamp.
  const targetPrice = Math.max(entry.priceFrom - band.min, 0)

  const resolved = resolveRequest({
    brand: input.brand,
    model: input.model,
    variant: input.variant,
    targetPrice,
    timeframe: input.timeframe,
    buyerType: input.buyerType,
    paymentScheme: input.paymentScheme,
    notes: input.notes,
  })

  // `resolveRequest` reports a too-high price on `targetPrice`, a field this form
  // does not have — an error keyed to a missing input renders nowhere and the
  // buyer sees a form that refuses without saying why. Unreachable today (every
  // `band.min` is >= 0, so the derived price never exceeds list) but re-keyed
  // rather than trusted to stay unreachable.
  if (!resolved.ok && resolved.fieldErrors.targetPrice) {
    const { targetPrice: message, ...rest } = resolved.fieldErrors
    return { ok: false, fieldErrors: { ...rest, discountBand: message } }
  }

  return resolved
}


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
 * The buyer enters a target *price*, not a percentage — that is how people
 * actually shop. The percentage is derived from the catalogue's list price, so a
 * client cannot inflate its discount by lying about what the car costs.
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

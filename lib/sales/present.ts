import { findBrand, findModel, formatRupiah } from '@/lib/data/catalog'
import { TIMEFRAMES } from '@/lib/validation/request'
import type { CarTier } from '@/lib/db/schema'

/**
 * Presentation helpers shared by the sales screens.
 *
 * `requests.brand` and `requests.model` are catalogue slugs, not display names —
 * the customer form resolves them before insert. Turning them back into names is
 * a lookup every sales screen needs, so it lives here rather than being repeated
 * with slightly different fallbacks in four files.
 *
 * The target price is derived, not stored: the row holds the discount percent,
 * and the catalogue holds the list price. A sales user thinks in rupiah, so both
 * are shown — the percentage alone is the classic way to make an ask look
 * reasonable when the absolute number is not.
 */

export const TIER_LABEL: Record<CarTier, string> = {
  low: 'City car',
  mid: 'SUV / MPV',
  high: 'Premium',
}

export function timeframeLabel(value: string | null): string | null {
  if (!value) return null
  return TIMEFRAMES.find((t) => t.value === value)?.label ?? value
}

export type LeadPricing = {
  brandName: string
  modelName: string
  listPrice: number
  targetPrice: number
  /** Rupiah the customer is asking the dealer to give up. */
  gap: number
}

export function leadPricing(
  brandSlug: string,
  modelSlug: string,
  discountWanted: number,
): LeadPricing {
  const entry = findModel(brandSlug, modelSlug)
  const listPrice = entry?.priceFrom ?? 0
  const targetPrice = listPrice > 0 ? Math.round(listPrice * (1 - discountWanted / 100)) : 0

  return {
    brandName: entry?.brand.name ?? findBrand(brandSlug)?.name ?? brandSlug,
    modelName: entry?.name ?? modelSlug,
    listPrice,
    targetPrice,
    gap: listPrice > 0 ? listPrice - targetPrice : 0,
  }
}

export { formatRupiah }

/**
 * Age of a lead, in the words a sales user uses.
 *
 * Freshness is the whole signal on this screen — a request posted four days ago
 * has almost certainly already been answered by someone, and a timestamp makes
 * the reader do that subtraction themselves.
 */
export function timeAgo(date: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000))
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Under six hours a lead is worth dropping what you are doing for. */
export function isFresh(date: Date, now = new Date()): boolean {
  return now.getTime() - date.getTime() < 6 * 60 * 60 * 1000
}

/**
 * WhatsApp deep link with the opening message pre-written.
 *
 * The first message is where most of these conversations die. Pre-filling it with
 * the model and the customer's own target price means the sales user opens with
 * the one thing the buyer asked about, rather than "halo kak".
 */
export function whatsappLink(phone: string, opening: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(opening)}`
}

export function openingMessage(
  salesName: string | null,
  brandName: string,
  modelName: string,
  targetPrice: number,
): string {
  const who = salesName?.trim() ? `${salesName}` : 'sales resmi'
  const price = targetPrice > 0 ? ` di angka ${formatRupiah(targetPrice)}` : ''
  return (
    `Halo, saya ${who} dari dealer resmi. Saya lihat permintaan Anda untuk ` +
    `${brandName} ${modelName}${price} lewat Autonomo.id. ` +
    `Boleh saya bantu hitungkan penawarannya?`
  )
}

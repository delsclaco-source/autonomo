/**
 * Demo market data.
 *
 * PLACEHOLDER. None of these numbers come from the database — `leads`,
 * `sales_profile`, and `token_ledger` are all empty until the unlock flow ships.
 * They exist so the catalogue can be designed and reviewed against realistic
 * content instead of lorem ipsum.
 *
 * Values are derived deterministically from the model slug so a given card looks
 * the same on every render and between server and client. Replace this whole
 * module with real queries — the exported shapes are what those queries should
 * return.
 */

import type { CatalogEntry } from './catalog'

export type SalesSnapshot = {
  name: string
  initials: string
  dealer: string
  city: string
  verified: boolean
  /** Average rating out of 5. */
  rating: number
  reviewCount: number
  /** How many times this sales user has been contacted through the platform. */
  contactCount: number
}

/**
 * What a buyer needs in order to judge an offer: the list price, the going rate,
 * and the best any sales user has put on the table.
 *
 * All rupiah figures are absolute, not percentages — a percentage alone is the
 * classic way to make a discount look bigger than it is, and on a Rp1,2 M car a
 * point of discount is a different conversation from the same point on a Rp185 jt
 * car.
 */
export type ModelMarket = {
  sales: SalesSnapshot
  /** Manufacturer OTR list price, before any dealer discount. */
  listPrice: number
  /** What the model typically transacts at right now — the median of live offers. */
  marketPrice: number
  /** Best live offer, in rupiah. Always <= marketPrice. */
  bestPrice: number
  /** bestPrice expressed as a discount off listPrice, in percent (rounded). */
  bestDiscountPercent: number
  /** listPrice - bestPrice. The number the buyer actually saves. */
  bestDiscountAmount: number
  /** Typical discount off list, in percent — the baseline the best offer beats. */
  marketDiscountPercent: number
  /** Number of sales users competing on this model. */
  competingSales: number
}

const FIRST = [
  'Rizky',
  'Dewi',
  'Bagas',
  'Nadia',
  'Fajar',
  'Intan',
  'Yoga',
  'Sinta',
  'Arif',
  'Putri',
  'Hendra',
  'Maya',
]
const LAST = [
  'Pratama',
  'Anggraini',
  'Nugroho',
  'Safitri',
  'Wijaya',
  'Kusuma',
  'Santoso',
  'Halim',
  'Ramadhan',
  'Lestari',
]
const CITIES = [
  'Jakarta Selatan',
  'Bekasi',
  'Tangerang',
  'Bandung',
  'Surabaya',
  'Semarang',
  'Depok',
  'Bogor',
]

/** Small stable hash so the same slug always yields the same demo figures. */
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length]
}

/** Rupiah figures are only ever shown to the nearest juta, so round there too. */
const toJuta = (value: number) => Math.round(value / 1_000_000) * 1_000_000

export function marketFor(model: CatalogEntry): ModelMarket {
  const seed = hash(`${model.brand.slug}/${model.slug}`)

  const first = pick(FIRST, seed)
  const last = pick(LAST, seed >> 3)
  const rating = 4.1 + ((seed >> 5) % 9) / 10 // 4.1 – 4.9

  const listPrice = model.priceFrom
  // Typical street discount 2–8%, best offer another 2–9% on top of that. Two
  // separate draws so "best" is always strictly better than "market", which is
  // what makes the comparison on the card mean anything.
  const marketDiscountPercent = 2 + ((seed >> 13) % 7)
  const bestDiscountPercent = marketDiscountPercent + 2 + ((seed >> 19) % 8)

  const marketPrice = toJuta(listPrice * (1 - marketDiscountPercent / 100))
  const bestPrice = toJuta(listPrice * (1 - bestDiscountPercent / 100))

  return {
    sales: {
      name: `${first} ${last}`,
      initials: `${first[0]}${last[0]}`,
      dealer: `${model.brand.name} ${pick(CITIES, seed >> 7)}`,
      city: pick(CITIES, seed >> 7),
      verified: seed % 3 !== 0,
      rating: Math.round(rating * 10) / 10,
      reviewCount: 8 + ((seed >> 9) % 120),
      contactCount: 12 + ((seed >> 11) % 240),
    },
    listPrice,
    marketPrice,
    bestPrice,
    bestDiscountPercent,
    bestDiscountAmount: listPrice - bestPrice,
    marketDiscountPercent,
    competingSales: 2 + ((seed >> 17) % 14),
  }
}

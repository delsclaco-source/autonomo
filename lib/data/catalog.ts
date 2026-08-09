import type { CarTier } from '@/lib/db/schema'

/**
 * Car catalogue.
 *
 * Seed data for the customer-facing request form and the landing page. Brands
 * and models are the ones actually sold in Indonesia; EV brands lead the list
 * because that is the segment Autonomo.id is positioned around.
 *
 * This is a static file for now. It moves into the database once admins need to
 * add models without a deploy — the shape here is already what those tables will
 * hold, so the migration is a data move rather than a rewrite.
 *
 * `tier` here is the DEFAULT for the model. The authoritative tier for a request
 * is still resolved server-side (see `resolveTier`), never taken from the client:
 * a customer who could pick their own tier would mark a luxury car as low-tier
 * and make their lead cheap for sales to unlock.
 */

export type BodyType = 'citycar' | 'hatchback' | 'sedan' | 'suv' | 'mpv'

export type CarModel = {
  slug: string
  name: string
  bodyType: BodyType
  tier: CarTier
  /**
   * Battery-electric. Omit to inherit the brand's default — most brands are
   * all-EV or all-combustion, and only the mixed ranges need to say so. Hyundai
   * is the reason this is per-model at all: the IONIQ 5 and the petrol Creta sit
   * under one badge.
   */
  electric?: boolean
  /** Indicative on-the-road price in rupiah, used to sort and to show a range. */
  priceFrom: number
  variants: string[]
}

export type CarBrand = {
  slug: string
  name: string
  /** Brand colour, used for the illustration tint. */
  color: string
  /** True when the brand sells at least one BEV in Indonesia. */
  electric: boolean
  origin: string
  models: CarModel[]
}

const jt = (n: number) => n * 1_000_000

/** EV brands first — the segment this marketplace leads with. */
export const BRANDS: CarBrand[] = [
  {
    slug: 'byd',
    name: 'BYD',
    color: '#0a5c9e',
    electric: true,
    origin: 'Tiongkok',
    models: [
      {
        slug: 'dolphin',
        name: 'Dolphin',
        bodyType: 'hatchback',
        tier: 'mid',
        priceFrom: jt(369),
        variants: ['Dynamic', 'Premium'],
      },
      {
        slug: 'atto-3',
        name: 'Atto 3',
        bodyType: 'suv',
        tier: 'mid',
        priceFrom: jt(455),
        variants: ['Advanced', 'Superior'],
      },
      {
        slug: 'seal',
        name: 'Seal',
        bodyType: 'sedan',
        tier: 'high',
        priceFrom: jt(629),
        variants: ['Premium', 'Performance AWD'],
      },
      {
        slug: 'm6',
        name: 'M6',
        bodyType: 'mpv',
        tier: 'mid',
        priceFrom: jt(379),
        variants: ['Standard', 'Superior', 'Captain'],
      },
    ],
  },
  {
    slug: 'wuling',
    name: 'Wuling',
    color: '#c8102e',
    electric: true,
    origin: 'Tiongkok',
    models: [
      {
        slug: 'air-ev',
        name: 'Air ev',
        bodyType: 'citycar',
        tier: 'low',
        priceFrom: jt(185),
        variants: ['Lite', 'Standard Range', 'Long Range'],
      },
      {
        slug: 'binguo-ev',
        name: 'BinguoEV',
        bodyType: 'hatchback',
        tier: 'low',
        priceFrom: jt(317),
        variants: ['333 km', '410 km'],
      },
      {
        slug: 'cloud-ev',
        name: 'Cloud EV',
        bodyType: 'hatchback',
        tier: 'mid',
        priceFrom: jt(398),
        variants: ['Standard', 'Premium'],
      },
    ],
  },
  {
    slug: 'chery',
    name: 'Chery',
    color: '#e2001a',
    electric: true,
    origin: 'Tiongkok',
    models: [
      {
        slug: 'omoda-e5',
        name: 'Omoda E5',
        bodyType: 'suv',
        tier: 'mid',
        priceFrom: jt(498),
        variants: ['Virtue', 'Vitality'],
      },
      {
        slug: 'j6',
        name: 'J6',
        bodyType: 'suv',
        tier: 'mid',
        priceFrom: jt(488),
        variants: ['2WD', '4WD'],
      },
      {
        slug: 'tiggo-8',
        name: 'Tiggo 8 Pro',
        bodyType: 'suv',
        tier: 'mid',
        electric: false,
        priceFrom: jt(499),
        variants: ['Premium', 'Ultimate'],
      },
    ],
  },
  {
    slug: 'hyundai',
    name: 'Hyundai',
    color: '#002c5f',
    electric: true,
    origin: 'Korea Selatan',
    models: [
      {
        slug: 'ioniq-5',
        name: 'IONIQ 5',
        bodyType: 'suv',
        tier: 'high',
        priceFrom: jt(748),
        variants: ['Prime Standard', 'Prime Long Range', 'Signature Long Range'],
      },
      {
        slug: 'kona-electric',
        name: 'Kona Electric',
        bodyType: 'suv',
        tier: 'mid',
        priceFrom: jt(499),
        variants: ['Style', 'Prime'],
      },
      {
        slug: 'creta',
        name: 'Creta',
        bodyType: 'suv',
        tier: 'mid',
        electric: false,
        priceFrom: jt(299),
        variants: ['Active', 'Style', 'Prime'],
      },
      {
        slug: 'stargazer',
        name: 'Stargazer',
        bodyType: 'mpv',
        tier: 'mid',
        electric: false,
        priceFrom: jt(255),
        variants: ['Active', 'Style', 'Prime'],
      },
    ],
  },
  {
    slug: 'neta',
    name: 'Neta',
    color: '#00a0e9',
    electric: true,
    origin: 'Tiongkok',
    models: [
      {
        slug: 'neta-v',
        name: 'Neta V-II',
        bodyType: 'suv',
        tier: 'low',
        priceFrom: jt(299),
        variants: ['Standard'],
      },
      {
        slug: 'neta-x',
        name: 'Neta X',
        bodyType: 'suv',
        tier: 'mid',
        priceFrom: jt(408),
        variants: ['Premium'],
      },
    ],
  },
  {
    slug: 'tesla',
    name: 'Tesla',
    color: '#cc0000',
    electric: true,
    origin: 'Amerika Serikat',
    models: [
      {
        slug: 'model-3',
        name: 'Model 3',
        bodyType: 'sedan',
        tier: 'high',
        priceFrom: jt(1_050),
        variants: ['RWD', 'Long Range AWD'],
      },
      {
        slug: 'model-y',
        name: 'Model Y',
        bodyType: 'suv',
        tier: 'high',
        priceFrom: jt(1_195),
        variants: ['RWD', 'Long Range AWD'],
      },
    ],
  },
  // --- Combustion / hybrid brands -----------------------------------------
  {
    slug: 'toyota',
    name: 'Toyota',
    color: '#eb0a1e',
    electric: false,
    origin: 'Jepang',
    models: [
      {
        slug: 'avanza',
        name: 'Avanza',
        bodyType: 'mpv',
        tier: 'low',
        priceFrom: jt(240),
        variants: ['E MT', 'G CVT', 'Veloz Q'],
      },
      {
        slug: 'innova-zenix',
        name: 'Kijang Innova Zenix',
        bodyType: 'mpv',
        tier: 'mid',
        priceFrom: jt(445),
        variants: ['G', 'V', 'Q Hybrid'],
      },
      {
        slug: 'rush',
        name: 'Rush',
        bodyType: 'suv',
        tier: 'low',
        priceFrom: jt(285),
        variants: ['G MT', 'G AT', 'GR Sport'],
      },
      {
        slug: 'fortuner',
        name: 'Fortuner',
        bodyType: 'suv',
        tier: 'high',
        priceFrom: jt(586),
        variants: ['4x2 SRZ', '4x4 VRZ', 'GR Sport'],
      },
    ],
  },
  {
    slug: 'honda',
    name: 'Honda',
    color: '#cc0000',
    electric: false,
    origin: 'Jepang',
    models: [
      {
        slug: 'brio',
        name: 'Brio',
        bodyType: 'citycar',
        tier: 'low',
        priceFrom: jt(167),
        variants: ['Satya S', 'Satya E', 'RS'],
      },
      {
        slug: 'hr-v',
        name: 'HR-V',
        bodyType: 'suv',
        tier: 'mid',
        priceFrom: jt(399),
        variants: ['S', 'E', 'SE', 'RS'],
      },
      {
        slug: 'wr-v',
        name: 'WR-V',
        bodyType: 'suv',
        tier: 'low',
        priceFrom: jt(280),
        variants: ['E', 'RS'],
      },
      {
        slug: 'cr-v',
        name: 'CR-V',
        bodyType: 'suv',
        tier: 'high',
        priceFrom: jt(759),
        variants: ['Turbo Prestige', 'RS e:HEV'],
      },
    ],
  },
  {
    slug: 'mitsubishi',
    name: 'Mitsubishi',
    color: '#e60012',
    electric: false,
    origin: 'Jepang',
    models: [
      {
        slug: 'xpander',
        name: 'Xpander',
        bodyType: 'mpv',
        tier: 'low',
        priceFrom: jt(283),
        variants: ['GLS', 'Exceed', 'Ultimate', 'Cross'],
      },
      {
        slug: 'pajero-sport',
        name: 'Pajero Sport',
        bodyType: 'suv',
        tier: 'high',
        priceFrom: jt(626),
        variants: ['Exceed', 'Dakar', 'Dakar Ultimate'],
      },
    ],
  },
  {
    slug: 'daihatsu',
    name: 'Daihatsu',
    color: '#e50012',
    electric: false,
    origin: 'Jepang',
    models: [
      {
        slug: 'ayla',
        name: 'Ayla',
        bodyType: 'citycar',
        tier: 'low',
        priceFrom: jt(139),
        variants: ['M MT', 'X CVT', 'R ADS'],
      },
      {
        slug: 'terios',
        name: 'Terios',
        bodyType: 'suv',
        tier: 'low',
        priceFrom: jt(275),
        variants: ['X', 'R', 'R ADS'],
      },
    ],
  },
  {
    slug: 'suzuki',
    name: 'Suzuki',
    color: '#003399',
    electric: false,
    origin: 'Jepang',
    models: [
      {
        slug: 'ertiga',
        name: 'Ertiga',
        bodyType: 'mpv',
        tier: 'low',
        priceFrom: jt(258),
        variants: ['GL MT', 'GX AT', 'Cross Hybrid'],
      },
      {
        slug: 'jimny',
        name: 'Jimny 5-Door',
        bodyType: 'suv',
        tier: 'mid',
        priceFrom: jt(474),
        variants: ['MT', 'AT'],
      },
    ],
  },
  {
    slug: 'bmw',
    name: 'BMW',
    color: '#0066b1',
    electric: false,
    origin: 'Jerman',
    models: [
      {
        slug: 'seri-3',
        name: 'Seri 3',
        bodyType: 'sedan',
        tier: 'high',
        priceFrom: jt(1_099),
        variants: ['320i Sport', 'M340i xDrive'],
      },
      {
        slug: 'x3',
        name: 'X3',
        bodyType: 'suv',
        tier: 'high',
        priceFrom: jt(1_449),
        variants: ['sDrive20i', 'xDrive30i M Sport'],
      },
    ],
  },
]

export const EV_BRANDS = BRANDS.filter((b) => b.electric)

/**
 * Flattened model list, each carrying its brand and a resolved `electric` flag —
 * convenient for card grids, and the only place the brand-default inheritance is
 * applied so callers never have to remember it.
 */
export type CatalogEntry = Omit<CarModel, 'electric'> & {
  electric: boolean
  brand: CarBrand
}

export const ALL_MODELS: CatalogEntry[] = BRANDS.flatMap((brand) =>
  brand.models.map((model) => ({
    ...model,
    electric: model.electric ?? brand.electric,
    brand,
  })),
)

/** Electric models, cheapest first. The segment the marketplace leads with. */
export const EV_MODELS = ALL_MODELS.filter((m) => m.electric).sort(
  (a, b) => a.priceFrom - b.priceFrom,
)

export const ICE_MODELS = ALL_MODELS.filter((m) => !m.electric).sort(
  (a, b) => a.priceFrom - b.priceFrom,
)

/**
 * One model per brand, cheapest first, then everything else.
 *
 * A plain price sort buries brand variety: the six cheapest EVs are three Wulings
 * and two BYDs, which makes the catalogue look thinner than it is. Leading with a
 * distinct brand per card shows actual coverage.
 */
export function spreadByBrand(models: CatalogEntry[]): CatalogEntry[] {
  const seen = new Set<string>()
  const first: CatalogEntry[] = []
  const rest: CatalogEntry[] = []

  for (const model of models) {
    if (seen.has(model.brand.slug)) {
      rest.push(model)
    } else {
      seen.add(model.brand.slug)
      first.push(model)
    }
  }

  return [...first, ...rest]
}

export function findBrand(slug: string): CarBrand | undefined {
  return BRANDS.find((b) => b.slug === slug)
}

export function findModel(brandSlug: string, modelSlug: string): CatalogEntry | undefined {
  return ALL_MODELS.find((m) => m.brand.slug === brandSlug && m.slug === modelSlug)
}

/**
 * Authoritative tier for a request.
 *
 * Server-side only. Falls back to the price band when the model is not in the
 * catalogue, so an unknown model can never default to the cheapest tier.
 */
export function resolveTier(brandSlug: string, modelSlug: string): CarTier {
  return findModel(brandSlug, modelSlug)?.tier ?? 'high'
}

export function formatRupiah(value: number): string {
  if (value >= 1_000_000_000) {
    const miliar = value / 1_000_000_000
    return `Rp${miliar.toFixed(miliar % 1 === 0 ? 0 : 2).replace('.', ',')} M`
  }
  return `Rp${Math.round(value / 1_000_000)} jt`
}

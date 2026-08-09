/**
 * Top-up packages.
 *
 * The numbers come from the PRD via CLAUDE.md § 2 and are the single source for
 * both this screen and, later, the payment webhook that credits the ledger. A
 * package the checkout knows about but the UI does not (or the reverse) is how a
 * user ends up paying for tokens nobody grants.
 *
 * `bonus` is kept separate from `tokens` rather than pre-summed: the bonus is the
 * reason to buy the larger package, so it has to stay visible, and the ledger
 * writes one row for the purchase and one for the bonus.
 */

export type TokenPackage = {
  id: 'starter' | 'basic' | 'pro' | 'premium' | 'ultimate'
  name: string
  /** Tokens paid for. */
  tokens: number
  /** Extra tokens granted on top. */
  bonus: number
  /** Price in rupiah. */
  price: number
  /** Marked as the package most sales users should take. At most one. */
  recommended?: boolean
  note?: string
}

export const TOKEN_PACKAGES: readonly TokenPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    tokens: 100,
    bonus: 0,
    price: 100_000,
    note: 'Cukup untuk ±10 lead city car',
  },
  {
    id: 'basic',
    name: 'Basic',
    tokens: 250,
    bonus: 10,
    price: 240_000,
  },
  {
    id: 'pro',
    name: 'Pro',
    tokens: 500,
    bonus: 30,
    price: 450_000,
    recommended: true,
    note: 'Rata-rata pemakaian sales aktif per bulan',
  },
  {
    id: 'premium',
    name: 'Premium',
    tokens: 1_000,
    bonus: 100,
    price: 850_000,
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    tokens: 2_000,
    bonus: 300,
    price: 1_600_000,
    note: 'Untuk tim atau sales dengan volume tinggi',
  },
]

export function totalTokens(pkg: TokenPackage): number {
  return pkg.tokens + pkg.bonus
}

/**
 * Rupiah per token, including the bonus.
 *
 * Shown on every card so the comparison is arithmetic instead of vibes — a bonus
 * expressed only as "+300 gratis" is easy to read as a better deal than it is.
 */
export function pricePerToken(pkg: TokenPackage): number {
  return Math.round(pkg.price / totalTokens(pkg))
}

/** Discount against the Starter rate, in percent. 0 for Starter itself. */
export function savingsPercent(pkg: TokenPackage): number {
  const base = pricePerToken(TOKEN_PACKAGES[0])
  return Math.round(((base - pricePerToken(pkg)) / base) * 100)
}

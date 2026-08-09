// Seeds the unlock pricing rule engine with one generic rule per car tier.
//
// Until this runs, `unlock_pricing_rules` is empty and both price readers fall
// back to constants compiled into the code (`lib/sales/unlock.ts:186`,
// `lib/sales/queries.ts:159`). That works, but it leaves the
// admin-configurable requirement in CLAUDE.md § 2 unmet in practice: with no
// row to edit, the only way to change a price is a deploy.
//
// The seeded values are the FLOOR of each published band, so running this
// changes no price anyone is charged — it moves the numbers from code into
// data. Bands, from the design doc (MASTER WEB DEVELOPMENT PROMPT.md:171-173)
// and CLAUDE.md § 2:
//
//   low  / city car          5-10  token  -> seed 5
//   mid  / SUV, MPV         20-30  token  -> seed 20
//   high / luxury, sport    50-100 token  -> seed 50
//
// Idempotent. `unlock_pricing_rules_lookup_idx` is a plain index, not unique, so
// a second run would otherwise duplicate every row and leave `priceFor()`
// picking whichever one the planner happened to return first. Existing rows are
// never touched: an admin who has already raised a price must not have it reset
// by a re-run.
//
// `.mts` for the same reason as db-probe.mts — the package is CommonJS, so tsx
// would reject the top-level await below. Run via `npm run db:seed:pricing`.
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, isNull } from 'drizzle-orm'
import { unlockPricingRules } from '../lib/db/schema'
import { dbSsl } from '../lib/db/ssl'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.log('FAILED: DATABASE_URL is not set')
  process.exit(1)
}

/** Floor of each published band. See the header for why the floor, not the midpoint. */
const TIER_FLOOR = [
  { tier: 'low' as const, tokenCost: 5, band: '5-10, city car' },
  { tier: 'mid' as const, tokenCost: 20, band: '20-30, SUV / MPV' },
  { tier: 'high' as const, tokenCost: 50, band: '50-100, luxury / sport' },
]

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const pool = new Pool({
  connectionString,
  // Same pinned chain the app verifies. A seed script that trusted any
  // certificate could write through a connection the app would refuse to open.
  ssl: dbSsl(connectionString),
  connectionTimeoutMillis: 15_000,
  max: 1,
})

const db = drizzle(pool)

try {
  for (const { tier, tokenCost, band } of TIER_FLOOR) {
    // A generic rule is one with no brand: the tier default that a
    // brand-specific rule overrides. Only generic rules are seeded — brand
    // overrides are an admin decision, not a default.
    const existing = await db
      .select({ id: unlockPricingRules.id, tokenCost: unlockPricingRules.tokenCost })
      .from(unlockPricingRules)
      .where(and(eq(unlockPricingRules.tier, tier), isNull(unlockPricingRules.brand)))
      .limit(1)

    if (existing.length > 0) {
      console.log(`SKIP  ${tier.padEnd(4)} already configured at ${existing[0].tokenCost} token`)
      continue
    }

    // `updatedBy` stays null: this row was written by the seed, not by an admin,
    // and the audit trail should not claim otherwise.
    await db.insert(unlockPricingRules).values({ tier, tokenCost, active: true })
    console.log(`SEED  ${tier.padEnd(4)} ${tokenCost} token   (band ${band})`)
  }

  const all = await db
    .select({
      tier: unlockPricingRules.tier,
      tokenCost: unlockPricingRules.tokenCost,
      brand: unlockPricingRules.brand,
      active: unlockPricingRules.active,
    })
    .from(unlockPricingRules)

  console.log(`\nRULES NOW (${all.length}):`)
  for (const r of all) {
    const scope = r.brand ?? 'all brands'
    const flag = r.active ? '' : '  [inactive]'
    console.log(`  ${r.tier.padEnd(4)} ${String(r.tokenCost).padStart(3)} token  ${scope}${flag}`)
  }
} catch (err) {
  console.log('FAILED:', messageOf(err))
  process.exitCode = 1
} finally {
  await pool.end()
}

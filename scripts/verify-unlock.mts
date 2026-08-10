// Exercises the real `unlockLead()` against the real database, then deletes its
// own rows. Run via `npm run verify:unlock`.
//
// Why this exists: `lib/sales/unlock.ts` holds the invariants that money depends
// on — the `FOR UPDATE` lock taken before any read acted upon, the ledger row and
// the balance cache written in one transaction, the `unlock:<lead_id>` idempotency
// key. None of that is provable by reading the file. It is only provable by
// running it and inspecting what landed in the database.
//
// The test imports the shipping function rather than replaying its logic. A copy
// would pass while the real path was broken, which is the one outcome that makes
// this script worse than useless.
//
// `--conditions react-server` in the npm script is load-bearing: unlock.ts opens
// with `import 'server-only'`, whose exports map resolves to a throwing module
// unless that condition is set. Next.js sets it; plain tsx does not.
//
// `.mts` because the package is CommonJS and this file uses top-level await.
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, sql } from 'drizzle-orm'
import {
  dailyUnlockQuota,
  leads,
  requests,
  salesProfile,
  tokenLedger,
  users,
} from '../lib/db/schema'
import { dbSsl } from '../lib/db/ssl'
import { unlockLead } from '../lib/sales/unlock'
import { jakartaDay } from '../lib/sales/queries'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.log('FAILED: DATABASE_URL is not set')
  process.exit(1)
}

// Numbers reserved for this script. Real Indonesian mobile numbers start 628 1-9;
// `628999` is outside every assigned prefix, so these can never collide with a
// live user.
const CUSTOMER_PHONE = '628999000001'
const SALES_PHONE = '628999000002'
const START_BALANCE = 100

/** Tier `mid` at the seeded floor. Asserted, not assumed — that is the point. */
const EXPECTED_COST = 20

const pool = new Pool({
  connectionString,
  ssl: dbSsl(connectionString),
  connectionTimeoutMillis: 15_000,
  max: 2,
})

const db = drizzle(pool)

let failures = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}: ${String(actual)}${ok ? '' : ` (want ${String(expected)})`}`,
  )
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Removes every row this script can create. Runs before as well as after, so a
 * crashed previous run cannot poison the next one. Order follows the foreign
 * keys inward: quota and ledger reference users, leads reference requests.
 */
async function cleanup(): Promise<void> {
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.phone} IN (${CUSTOMER_PHONE}, ${SALES_PHONE})`)

  for (const { id } of testUsers) {
    await db.delete(dailyUnlockQuota).where(eq(dailyUnlockQuota.salesId, id))
    await db.delete(tokenLedger).where(eq(tokenLedger.salesId, id))
    await db.delete(leads).where(eq(leads.salesId, id))
    await db.delete(requests).where(eq(requests.customerId, id))
    await db.delete(salesProfile).where(eq(salesProfile.userId, id))
    await db.delete(users).where(eq(users.id, id))
  }
}

try {
  await cleanup()

  const [customer] = await db
    .insert(users)
    .values({
      role: 'customer',
      phone: CUSTOMER_PHONE,
      fullName: 'Uji Customer',
      phoneVerifiedAt: new Date(),
    })
    .returning({ id: users.id })

  const [sales] = await db
    .insert(users)
    .values({
      role: 'sales',
      phone: SALES_PHONE,
      fullName: 'Uji Sales',
      phoneVerifiedAt: new Date(),
    })
    .returning({ id: users.id })

  await db.insert(salesProfile).values({
    userId: sales.id,
    dealerName: 'Uji Dealer',
    brands: ['chery'],
    tokenBalance: START_BALANCE,
    referralCode: 'UJITEST01',
  })

  // discountWanted stays under FRAUD_DISCOUNT_THRESHOLD (30) so the request is
  // `open` rather than `flagged` — unlock.ts rejects anything not `open`.
  const [request] = await db
    .insert(requests)
    .values({
      customerId: customer.id,
      brand: 'chery',
      model: 'tiggo-8',
      variant: 'Premium',
      listPrice: 400_000_000,
      targetPrice: 360_000_000,
      discountWanted: '10.00',
      tier: 'mid',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      purchaseTimeframe: '1-3-bulan',
      status: 'open',
    })
    .returning({ id: requests.id })

  console.log('SETUP ok — customer, sales (100 token), open mid-tier request\n')

  const first = await unlockLead(sales.id, request.id)

  check('unlock ok', first.ok, true)
  if (!first.ok) throw new Error(`unlock refused: ${first.reason}`)

  check('token cost from seeded rule', first.tokenCost, EXPECTED_COST)
  check('balance after', first.balanceAfter, START_BALANCE - EXPECTED_COST)

  // Idempotency: the same sales user unlocking the same request must not be
  // charged twice. UNIQUE(request_id, sales_id) is the backstop; this asserts the
  // function reports it cleanly instead of surfacing a constraint violation.
  const second = await unlockLead(sales.id, request.id)
  check('second unlock refused', second.ok === false && second.reason, 'already_unlocked')

  const [profile] = await db
    .select({ balance: salesProfile.tokenBalance })
    .from(salesProfile)
    .where(eq(salesProfile.userId, sales.id))

  const [ledger] = await db
    .select({ total: sql<number>`COALESCE(SUM(${tokenLedger.delta}), 0)::int` })
    .from(tokenLedger)
    .where(eq(tokenLedger.salesId, sales.id))

  check('balance cache in database', profile.balance, START_BALANCE - EXPECTED_COST)
  // The cache is only trustworthy if it equals the ledger. CLAUDE.md § 6: when
  // they disagree, the ledger is right — so a mismatch here is a real defect.
  check('ledger SUM(delta)', ledger.total, -EXPECTED_COST)

  const ledgerRows = await db
    .select({
      delta: tokenLedger.delta,
      balanceAfter: tokenLedger.balanceAfter,
      reason: tokenLedger.reason,
      idempotencyKey: tokenLedger.idempotencyKey,
    })
    .from(tokenLedger)
    .where(eq(tokenLedger.salesId, sales.id))

  check('ledger row count', ledgerRows.length, 1)
  check('ledger reason', ledgerRows[0]?.reason, 'unlock')
  check('ledger balance_after', ledgerRows[0]?.balanceAfter, START_BALANCE - EXPECTED_COST)

  const [lead] = await db
    .select({ id: leads.id, tokenCost: leads.tokenCost, tier: leads.tier })
    .from(leads)
    .where(and(eq(leads.salesId, sales.id), eq(leads.requestId, request.id)))

  // Cost and tier are frozen onto the lead so a later price change cannot rewrite
  // history (CLAUDE.md § 6).
  check('lead token_cost frozen', lead.tokenCost, EXPECTED_COST)
  check('lead tier frozen', lead.tier, 'mid')
  check('idempotency key', ledgerRows[0]?.idempotencyKey, `unlock:${lead.id}`)

  const [quota] = await db
    .select({ count: dailyUnlockQuota.count })
    .from(dailyUnlockQuota)
    .where(and(eq(dailyUnlockQuota.salesId, sales.id), eq(dailyUnlockQuota.day, jakartaDay())))

  check('daily quota counted', quota?.count, 1)

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
  if (failures > 0) process.exitCode = 1
} catch (err) {
  console.log('FAILED:', messageOf(err))
  process.exitCode = 1
} finally {
  await cleanup()
  console.log('CLEANUP done — test rows removed')
  await pool.end()
}

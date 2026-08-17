// Read-only gate for the migration that turns `leads` UNIQUE(request_id, sales_id)
// into UNIQUE(request_id) — one request, one sales user, forever.
//
// That migration cannot be applied while any request is held by two sales users:
// Postgres refuses to build the index and the migration aborts. This script asks
// the question first, so the answer arrives before a deploy rather than during one.
//
// It deliberately does not offer to fix anything. Choosing which sales user keeps
// a contested request is a business decision, and unwinding the others means
// writing `refund` rows into `token_ledger` — the ledger is append-only, so a
// DELETE here would destroy real purchase history with no way back. If this script
// prints rows, stop and decide with the numbers in hand.
//
// Same shape as `scripts/db-probe.mts`: reads DATABASE_URL directly rather than
// through `lib/env.ts` (no Redis or session config is needed to ask one question),
// and imports the single TLS policy so it verifies the same chain the app does.
// `.mts` because the package is CommonJS and tsx would reject the top-level await.
// Run via `npm run db:check:leads`.
import { Pool } from 'pg'
import { dbSsl } from '../lib/db/ssl'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.log('FAILED: DATABASE_URL is not set')
  process.exit(1)
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const pool = new Pool({
  connectionString,
  ssl: dbSsl(connectionString),
  connectionTimeoutMillis: 15_000,
  max: 1,
})

try {
  const total = await pool.query<{ n: string }>('select count(*) as n from leads')
  console.log('LEADS:', total.rows[0].n)

  const dupes = await pool.query<{ request_id: string; n: string }>(
    'select request_id, count(*) as n from leads group by request_id having count(*) > 1 order by n desc',
  )

  if (dupes.rows.length === 0) {
    console.log('DUPLICATES: none — UNIQUE(request_id) can be applied safely')
  } else {
    console.log(`DUPLICATES: ${dupes.rows.length} request(s) held by more than one sales user`)

    // Every sales user on every contested request, so the decision can be made
    // from this output without a second query. Token cost is included because the
    // refund owed to whoever loses a request is exactly what they paid for it.
    const detail = await pool.query<{
      request_id: string
      sales_id: string
      token_cost: number
      unlocked_at: Date
    }>(
      `select l.request_id, l.sales_id, l.token_cost, l.unlocked_at
         from leads l
         join (
           select request_id from leads group by request_id having count(*) > 1
         ) d on d.request_id = l.request_id
        order by l.request_id, l.unlocked_at`,
    )

    for (const row of detail.rows) {
      console.log(
        `  ${row.request_id}  sales=${row.sales_id}  cost=${row.token_cost}  at=${row.unlocked_at.toISOString()}`,
      )
    }

    console.log('')
    console.log('STOP: resolve these before migrating. Refund via new token_ledger rows, never DELETE.')
    process.exitCode = 1
  }
} catch (err) {
  console.log('FAILED:', messageOf(err))
  process.exitCode = 1
} finally {
  await pool.end()
}

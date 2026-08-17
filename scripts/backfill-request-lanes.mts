// One-off backfill for requests stranded in a lane that no longer exists.
//
// `requestStatusEnum` gained `auction` and `pool` in M2, and from commit step 4
// onward `insertRequest` writes only those two. Rows created before that carry
// `open` or `flagged`, and both are now dead ends in every direction:
//
//   * `marketplaceLeads()` filters `status = 'pool'`, so they never appear in the
//     sales marketplace;
//   * `unlockLead` rejects anything other than `pool` with `not_found`, so they
//     cannot be bought with tokens either;
//   * they have no `auctions` row, so they cannot be bid on.
//
// The result is a request the customer submitted in good faith that no sales user
// can reach through any of the three lanes. This script moves each one into the
// lane it would have landed in had it been submitted today:
//
//   * `open`, not flagged, with a `target_price` → an `auctions` row plus
//     `status = 'auction'`. This is the lane the customer asked for by naming a
//     price.
//   * `open` with no `target_price` → `pool`. There is nothing to bid against
//     without a target, and a reverse auction with no reserve is not an auction.
//   * `flagged` → `pool`. The discount is above the fraud threshold, so it never
//     belonged in the auction lane; the token lane is exactly what it is for.
//     `flagged_reason` is left in place — the customer's dashboard still shows the
//     "under review" notice, which is still true.
//
// It writes no `token_ledger` row, no `leads` row, and takes no `sales_profile`
// lock: no balance moves, no contact opens. It also sends no notification — these
// requests are days old, and a notification about a state change the customer
// never saw would read as noise rather than news.
//
// Idempotent by construction: every statement carries the guard that made the row
// eligible in the first place, so a second run matches nothing. Nothing is
// deleted. Dry-run is the default; pass `--apply` to write.
//
// Same shape as `scripts/check-lead-dupes.mts`: DATABASE_URL read directly, the
// shared TLS policy imported so it verifies the same chain the app does, `.mts`
// because the package is CommonJS and tsx would reject the top-level await.
// Run via `npm run db:backfill:lanes` (add `-- --apply` to commit).
import { Pool } from 'pg'
import { dbSsl } from '../lib/db/ssl'
import { AUCTION_DURATION_MS } from '../lib/auction/queries'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.log('FAILED: DATABASE_URL is not set')
  process.exit(1)
}

const apply = process.argv.includes('--apply')

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

type Candidate = {
  id: string
  brand: string
  model: string
  status: string
  discount_wanted: string
  list_price: string | null
  target_price: string | null
  tier: string
  flagged_reason: string | null
  created_at: Date
}

const pool = new Pool({
  connectionString,
  ssl: dbSsl(connectionString),
  connectionTimeoutMillis: 15_000,
  max: 1,
})

/** Which lane this row should have landed in, by the rules in the header. */
function laneFor(row: Candidate): 'auction' | 'pool' {
  if (row.status === 'flagged' || row.flagged_reason) return 'pool'
  return row.target_price === null ? 'pool' : 'auction'
}

try {
  // Only rows with no auction row at all. A row that somehow has one is already
  // in the auction lane and must not be given a second — `auctions_request_key`
  // would reject it anyway, and a rejected insert would roll back the batch.
  const candidates = await pool.query<Candidate>(
    `select r.id, r.brand, r.model, r.status, r.discount_wanted,
            r.list_price, r.target_price, r.tier, r.flagged_reason, r.created_at
       from requests r
       left join auctions a on a.request_id = r.id
      where r.status in ('open', 'flagged')
        and a.id is null
      order by r.created_at desc`,
  )

  if (candidates.rows.length === 0) {
    console.log('Nothing to backfill: no request is stranded in `open` or `flagged`.')
  }

  console.log(`STRANDED REQUESTS (${candidates.rows.length}):`)
  for (const row of candidates.rows) {
    const lane = laneFor(row)
    const why =
      lane === 'auction'
        ? `-> auction (+ auctions row, closes in ${AUCTION_DURATION_MS / 3_600_000}h)`
        : row.status === 'flagged' || row.flagged_reason
          ? '-> pool (flagged: above the fraud threshold, token lane)'
          : '-> pool (no target_price: nothing to bid against)'
    console.log(`  ${row.created_at.toISOString()}  ${row.brand}/${row.model}  ${row.status} ${why}`)
  }

  if (!apply) {
    console.log('')
    console.log('DRY RUN. Nothing was written. Re-run with `-- --apply` to commit.')
  } else {
    let auctioned = 0
    let pooled = 0

    for (const row of candidates.rows) {
      const lane = laneFor(row)

      // One transaction per row, so a single failure cannot roll back the rest.
      const client = await pool.connect()
      try {
        await client.query('begin')

        // Re-read under the row lock. The guard is repeated here rather than
        // trusted from the scan above: the customer may have edited the request,
        // or a deploy may have moved it, between the two statements.
        const locked = await client.query<{ status: string }>(
          `select status from requests where id = $1 and status in ('open', 'flagged') for update`,
          [row.id],
        )

        if (locked.rows.length === 0) {
          await client.query('rollback')
          console.log(`  SKIP ${row.brand}/${row.model}: no longer open/flagged`)
          continue
        }

        if (lane === 'auction') {
          const inserted = await client.query(
            `insert into auctions (request_id, target_price, list_price, tier, closes_at)
             values ($1, $2, $3, $4, now() + ($5 || ' milliseconds')::interval)
             on conflict (request_id) do nothing`,
            [row.id, row.target_price, row.list_price, row.tier, String(AUCTION_DURATION_MS)],
          )

          if (inserted.rowCount === 0) {
            await client.query('rollback')
            console.log(`  SKIP ${row.brand}/${row.model}: auction already exists`)
            continue
          }
        }

        await client.query(`update requests set status = $2, updated_at = now() where id = $1`, [
          row.id,
          lane,
        ])

        await client.query('commit')

        if (lane === 'auction') auctioned += 1
        else pooled += 1

        console.log(`  OK   ${row.brand}/${row.model} -> ${lane}`)
      } catch (err) {
        await client.query('rollback').catch(() => {})
        console.log(`  FAIL ${row.brand}/${row.model}: ${messageOf(err)}`)
        process.exitCode = 1
      } finally {
        client.release()
      }
    }

    console.log('')
    console.log(`APPLIED: ${auctioned} moved to the auction lane, ${pooled} to the pool lane.`)
  }
} catch (err) {
  console.log('FAILED:', messageOf(err))
  process.exitCode = 1
} finally {
  await pool.end()
}

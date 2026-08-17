// Read-only diagnosis for "a submitted request is not showing up in the auction".
//
// Three separate things can produce that symptom, and they need different
// answers, so this script asks all three questions in one pass rather than
// guessing:
//
//   1. Did migration M2 land at all? If `auctions` does not exist, the insert in
//      `insertRequest` throws and the whole transaction rolls back — so neither
//      the request nor the auction is written, and the customer saw an error.
//   2. Is the request in the auction lane? A request whose `discount_wanted`
//      exceeds the fraud threshold is flagged, and a flagged request goes
//      straight to `pool` with no auction row. That is correct behaviour, not a
//      bug — the answer is an explanation, not a fix.
//   3. Does any sales user actually see it? `activeAuctionsForSales` inner-joins
//      `sales_offers` on brand+model, so an auction with no matching published
//      offer is invisible to every sales account by design (the entry ticket).
//
// Same shape as `scripts/check-lead-dupes.mts`: DATABASE_URL read directly, the
// shared TLS policy imported so it verifies the same chain the app does, `.mts`
// because the package is CommonJS and tsx would reject the top-level await.
// Run via `npm run db:check:auction`.
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
  // --- 1. Did M2 land? ---
  const tables = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('auctions', 'auction_entries', 'auction_bids')
      order by table_name`,
  )
  console.log('TABLES:', tables.rows.map((r) => r.table_name).join(', ') || 'none of the three')

  const statuses = await pool.query<{ label: string }>(
    `select e.enumlabel as label from pg_enum e
       join pg_type t on t.oid = e.enumtypid
      where t.typname = 'request_status' order by e.enumsortorder`,
  )
  console.log('request_status:', statuses.rows.map((r) => r.label).join(' | '))

  const leadCols = await pool.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'leads'
        and column_name in ('source', 'committed_price') order by column_name`,
  )
  console.log('leads extras:', leadCols.rows.map((r) => r.column_name).join(', ') || 'MISSING')

  if (tables.rows.length < 3) {
    console.log('')
    console.log('STOP: auction tables are missing. Apply M2 with `npm run db:migrate` first.')
    process.exitCode = 1
  }

  // --- 2. Which lane did the newest requests land in? ---
  const recent = await pool.query<{
    id: string
    brand: string
    model: string
    status: string
    discount_wanted: string
    flagged: string | null
    created_at: Date
    auction_status: string | null
    closes_at: Date | null
    bidders: string
  }>(
    `select r.id, r.brand, r.model, r.status, r.discount_wanted,
            r.flagged_reason as flagged, r.created_at,
            a.status as auction_status, a.closes_at,
            (select count(*) from auction_entries e where e.auction_id = a.id) as bidders
       from requests r
       left join auctions a on a.request_id = r.id
      order by r.created_at desc
      limit 10`,
  )

  console.log('')
  console.log(`RECENT REQUESTS (${recent.rows.length}):`)
  for (const row of recent.rows) {
    const lane = row.auction_status
      ? `auction=${row.auction_status} closes=${row.closes_at?.toISOString() ?? '-'} bidders=${row.bidders}`
      : row.flagged
        ? 'NO AUCTION (flagged, pool lane, by design)'
        : 'NO AUCTION ROW (unexpected: request is not flagged)'
    console.log(
      `  ${row.created_at.toISOString()}  ${row.brand}/${row.model}  status=${row.status}  disc=${row.discount_wanted}%`,
    )
    console.log(`      ${lane}`)
  }

  // --- 3. Can any sales user see the open auctions? ---
  const visible = await pool.query<{
    brand: string
    model: string
    closes_at: Date
    eligible_sales: string
  }>(
    `select r.brand, r.model, a.closes_at,
            (select count(distinct o.sales_id) from sales_offers o
              where o.brand = r.brand and o.model = r.model
                and o.status = 'active'
                and (o.starts_at is null or o.starts_at <= now())
                and (o.ends_at is null or o.ends_at > now())) as eligible_sales
       from auctions a
       join requests r on r.id = a.request_id
      where a.status = 'open' and a.closes_at > now()
      order by a.closes_at`,
  )

  console.log('')
  console.log(`OPEN AUCTIONS (${visible.rows.length}):`)
  for (const row of visible.rows) {
    const n = Number(row.eligible_sales)
    console.log(
      `  ${row.brand}/${row.model}  closes=${row.closes_at.toISOString()}  sales with an active offer for this model: ${n}${
        n === 0 ? '  <-- INVISIBLE to every sales account (no entry ticket)' : ''
      }`,
    )
  }

  const offers = await pool.query<{ status: string; n: string }>(
    `select status, count(*) as n from sales_offers group by status order by status`,
  )
  console.log('')
  console.log('SALES OFFERS:', offers.rows.map((r) => `${r.status}=${r.n}`).join(' ') || 'none')
} catch (err) {
  console.log('FAILED:', messageOf(err))
  process.exitCode = 1
} finally {
  await pool.end()
}

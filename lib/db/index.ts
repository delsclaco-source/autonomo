import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { serverEnv } from '@/lib/env'
import { dbSsl } from './ssl'
import * as schema from './schema'

/**
 * Database client.
 *
 * Uses the `node-postgres` driver over a real TCP connection, not an HTTP-based
 * serverless driver. Every token mutation in this app (unlock, top-up, referral
 * bonus) has to run inside a transaction with `SELECT ... FOR UPDATE` on the
 * sales row to prevent double-spend when a sales user unlocks the same lead from
 * two devices at once. HTTP drivers cannot hold a transaction open across
 * statements, so they are unusable here. See CLAUDE.md § Tech Stack.
 *
 * `DATABASE_URL` must point at a POOLER endpoint (Supabase port 6543, or Neon's
 * `-pooler` host). Vercel functions are short-lived and numerous; pointing them
 * at the direct Postgres port exhausts connections under any real traffic.
 *
 * `max: 1` because each serverless invocation handles one request. A larger pool
 * per instance multiplies idle connections against the shared pooler limit
 * without ever being used.
 *
 * Initialisation is lazy and plain (no `Proxy` wrapper): wrapping the client in a
 * JS Proxy breaks libraries that introspect the adapter object.
 */

type Db = ReturnType<typeof createDb>

function createDb() {
  // Validates the whole server env contract on first DB use. `serverEnv()` was
  // dead code before this call existed: a deploy missing SESSION_SECRET or the
  // Redis credentials booted fine and failed later at the first login instead.
  const { DATABASE_URL } = serverEnv()

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    // Full chain and hostname verification against Supabase's pinned root. See
    // `lib/db/ssl.ts` for why the certificate has to be supplied by hand and how
    // its authenticity was established.
    ssl: dbSsl(DATABASE_URL),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  })

  return drizzle(pool, { schema })
}

let _db: Db | null = null

export function getDb(): Db {
  if (!_db) _db = createDb()
  return _db
}

export { schema }

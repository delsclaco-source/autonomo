// Read-only connectivity check. Lists what already exists in the public schema
// so a migration never runs blind against a database that has other tables in it.
//
// TypeScript rather than plain ESM so it can import the one TLS policy in
// `lib/db/ssl.ts`. `.mts` because the package is CommonJS by default and tsx
// would otherwise reject the top-level await below. Run via `npm run db:probe`.
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
  // The probe verifies the same chain the app does. A probe that trusted any
  // certificate would report a healthy connection the app would refuse to make.
  ssl: dbSsl(connectionString),
  connectionTimeoutMillis: 15_000,
  max: 1,
})

try {
  const v = await pool.query<{ version: string }>('select version()')
  console.log('CONNECTED:', v.rows[0].version.split(',')[0])

  const t = await pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema='public' order by 1"
  )
  console.log('TABLES:', t.rows.length === 0 ? '(none)' : t.rows.map((r) => r.table_name).join(', '))

  const e = await pool.query<{ typname: string }>(
    "select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e' order by 1"
  )
  console.log('ENUMS:', e.rows.length === 0 ? '(none)' : e.rows.map((r) => r.typname).join(', '))
} catch (err) {
  console.log('FAILED:', messageOf(err))
  process.exitCode = 1
} finally {
  await pool.end()
}

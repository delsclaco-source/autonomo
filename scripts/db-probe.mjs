// Read-only connectivity check. Lists what already exists in the public schema
// so a migration never runs blind against a database that has other tables in it.
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  max: 1,
})

try {
  const v = await pool.query('select version()')
  console.log('CONNECTED:', v.rows[0].version.split(',')[0])

  const t = await pool.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1"
  )
  console.log('TABLES:', t.rows.length === 0 ? '(none)' : t.rows.map((r) => r.table_name).join(', '))

  const e = await pool.query(
    "select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e' order by 1"
  )
  console.log('ENUMS:', e.rows.length === 0 ? '(none)' : e.rows.map((r) => r.typname).join(', '))
} catch (err) {
  console.log('FAILED:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}

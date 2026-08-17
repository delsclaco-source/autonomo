// Creates an admin account out of band — the only way admins are made.
//
// `provisionUser` (lib/auth/provision.ts) deliberately refuses to auto-create
// admin: anyone who could resolve admin.autonomo.id and receive a WhatsApp
// would become an admin. So an admin is inserted here, by hand, once per
// number. The login flow then works normally for that number — OTP at
// admin.autonomo.id, `provisionUser` finds the row, role matches.
//
// Usage: `npm run db:seed:admin -- 6281234567890 [--promote]`
//
// Idempotent and non-destructive by default:
//   - number already admin -> prints the existing id, exits 0, touches nothing
//   - number exists with a DIFFERENT role -> refuses, exits 1. Changing roles is
//     an admin decision (what happens to the sales_profile? the leads? the
//     ledger?), not a seed script's call.
//   - number unknown -> creates the admin row with phoneVerifiedAt stamped, so
//     the first login skips straight to the session.
//
// `--promote` overrides the refusal for a `customer` row: role becomes admin and
// every session for that user is deleted, so the old customer cookie cannot keep
// browsing under a role the database no longer agrees with. It stays a separate,
// typed-out flag because promotion is not the same request as seeding — a caller
// who omits it gets the refusal, which is the safe default.
//
// Promotion is still refused for `sales`: that row owns a sales_profile, a token
// balance, and unlocked leads, and this script has no defensible answer for what
// happens to them. Customer rows own only their own requests, which stay valid.
//
// `.mts` for the same reason as db-probe.mts — the package is CommonJS, so tsx
// would reject the top-level await below.
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { sessions, users } from '../lib/db/schema'
import { dbSsl } from '../lib/db/ssl'
import { normalizePhone } from '../lib/auth/phone'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.log('FAILED: DATABASE_URL is not set')
  process.exit(1)
}

const args = process.argv.slice(2)
const promote = args.includes('--promote')
const raw = args.find((a) => !a.startsWith('--')) ?? ''
const phone = normalizePhone(raw)

if (!phone) {
  console.log('FAILED: nomor tidak valid. Contoh: npm run db:seed:admin -- 6281234567890')
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: dbSsl(connectionString),
  connectionTimeoutMillis: 15_000,
  max: 1,
})

const db = drizzle(pool)

try {
  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  if (existing[0]) {
    const { id, role } = existing[0]

    if (role === 'admin') {
      console.log(`SUCCESS: ${phone} sudah admin (${id}). Tidak ada perubahan.`)
    } else if (promote && role === 'customer') {
      // One transaction: a role flipped without its sessions cleared leaves a
      // live customer cookie pointing at an admin row, and `requireUser` reads
      // the role fresh — the old tab would silently gain the admin area.
      await db.transaction(async (tx) => {
        await tx.update(users).set({ role: 'admin' }).where(eq(users.id, id))
        await tx.delete(sessions).where(eq(sessions.userId, id))
      })

      console.log(
        `SUCCESS: ${phone} dipromosikan customer -> admin (${id}). Sesi lama dihapus, login ulang via OTP di admin.autonomo.id.`,
      )
    } else {
      const hint =
        role === 'customer'
          ? ' Tambahkan --promote untuk mengubahnya.'
          : ' Role sales tidak dipromosikan otomatis.'

      console.log(`FAILED: ${phone} terdaftar sebagai ${role}.${hint}`)
      process.exitCode = 1
    }
  } else {
    const inserted = await db
      .insert(users)
      .values({ role: 'admin', phone, phoneVerifiedAt: new Date() })
      .returning({ id: users.id })

    console.log(`SUCCESS: admin dibuat (${inserted[0].id}). Login via OTP di admin.autonomo.id.`)
  }
} catch (err) {
  console.log('FAILED:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
} finally {
  await pool.end()
}

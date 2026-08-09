import 'server-only'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { salesProfile, tokenLedger, users } from '@/lib/db/schema'
import type { Area, Role } from '@/lib/config/subdomains'

/**
 * Account provisioning on first successful OTP.
 *
 * There is no separate signup form: a verified WhatsApp number is the only
 * credential the product has, so the first time a number proves itself it becomes
 * an account. See the note in `app/login/page.tsx`.
 *
 * Role comes from the area the login happened in, never from anything the client
 * sends. Two consequences worth stating:
 *
 *   - `admin` is never auto-created. An admin must already exist in the database,
 *     placed there deliberately. Auto-creating one would mean anyone who can
 *     resolve admin.autonomo.id and receive a WhatsApp becomes an admin.
 *   - a number that already exists with a different role is refused rather than
 *     upgraded. A customer visiting sales.autonomo.id does not become a sales user
 *     by logging in.
 */

/** Freemium grant on sales registration — CLAUDE.md § 2. */
export const FREEMIUM_TOKEN_GRANT = 100

export type ProvisionResult =
  | { ok: true; userId: string; role: Role; isNew: boolean }
  | { ok: false; reason: 'suspended' | 'role_mismatch' | 'no_account' }

const AREA_ROLE: Record<Area, Role> = {
  customer: 'customer',
  sales: 'sales',
  admin: 'admin',
}

/** Referral codes are read aloud and retyped, so no 0/O/1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function referralCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return out
}

/**
 * Look up (or create) the account behind a freshly verified phone number.
 *
 * Call only after `verifyOtp` has returned ok — this function is what turns a
 * proven number into an identity, and it does not itself check any credential.
 */
export async function provisionUser(phone: string, area: Area): Promise<ProvisionResult> {
  const db = getDb()
  const wantedRole = AREA_ROLE[area]

  const existing = await db
    .select({
      id: users.id,
      role: users.role,
      suspendedAt: users.suspendedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  const found = existing[0]

  if (found) {
    if (found.suspendedAt) return { ok: false, reason: 'suspended' }
    if (found.role !== wantedRole) return { ok: false, reason: 'role_mismatch' }

    // A returning user's number has just been proven again; stamp it if this is
    // the first time it succeeded (a row can exist unverified if an admin seeded it).
    if (!found.phoneVerifiedAt) {
      await db
        .update(users)
        .set({ phoneVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, found.id))
    }

    return { ok: true, userId: found.id, role: found.role, isNew: false }
  }

  // Admins are provisioned out of band, never by logging in.
  if (wantedRole === 'admin') return { ok: false, reason: 'no_account' }

  const userId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({ role: wantedRole, phone, phoneVerifiedAt: new Date() })
      // A second device finishing the same OTP race would otherwise violate
      // `users_phone_key`. The conflict path returns the existing row instead.
      .onConflictDoNothing({ target: users.phone })
      .returning({ id: users.id })

    const id =
      inserted[0]?.id ??
      (
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, phone))
          .limit(1)
      )[0]?.id

    if (!id) throw new Error('provisionUser: user row missing after insert')
    if (!inserted[0]) return id // lost the race; the winner did the rest

    if (wantedRole === 'sales') {
      await tx.insert(salesProfile).values({
        userId: id,
        referralCode: referralCode(),
        tokenBalance: FREEMIUM_TOKEN_GRANT,
      })

      // The ledger is the source of truth and `token_balance` above is its cache,
      // so both are written in this one transaction. `idempotency_key` makes the
      // grant unrepeatable even if this path is somehow re-entered.
      await tx.insert(tokenLedger).values({
        salesId: id,
        delta: FREEMIUM_TOKEN_GRANT,
        balanceAfter: FREEMIUM_TOKEN_GRANT,
        reason: 'freemium_grant',
        idempotencyKey: `freemium:${id}`,
        note: 'Registrasi sales — 100 token gratis',
      })
    }

    return id
  })

  return { ok: true, userId, role: wantedRole, isNew: true }
}

/**
 * Retry wrapper for the one failure mode worth retrying: a referral code
 * collision. 31^8 codes makes it vanishingly rare, but "vanishingly rare" and
 * "cannot happen" are different, and the failure would be a dead login.
 */
export async function provisionUserWithRetry(
  phone: string,
  area: Area,
  attempts = 3,
): Promise<ProvisionResult> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await provisionUser(phone, area)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('sales_profile_referral_code_key')) throw error
    }
  }
  throw lastError
}

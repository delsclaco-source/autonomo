import 'server-only'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { getRedis, cacheKey, cacheTtl } from '@/lib/redis'
import { sendWhatsappMessage, isWhatsappConfigured } from '@/lib/whatsapp/client'
import { OTP_CODE_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from './otp-shared'

/**
 * WhatsApp OTP issue and verification.
 *
 * Codes live in Redis, never in Postgres: they expire in minutes, are written on
 * every login attempt, and must disappear on their own. A TTL key is exactly that
 * shape, and it keeps short-lived credentials out of database backups.
 *
 * What is stored is an HMAC of the code, not the code. A Redis dump — or an
 * operator with console access — therefore cannot read a live OTP and walk into
 * someone's account. The HMAC key is `SESSION_SECRET`, already required by the
 * session layer.
 *
 * Three separate limits guard the flow, because they stop different attacks:
 *
 *   - send rate limit (Upstash, 3 per 15 minutes per number) — stops using the
 *     site to spam someone else's WhatsApp, and stops burning gateway quota;
 *   - resend cooldown (60s) — the cheap check that catches a doubled-clicked
 *     button before it costs a gateway call;
 *   - verify attempt cap (5 per issued code) — a 6-digit code is 1-in-a-million
 *     only if the attacker cannot try a million times. On the cap the code is
 *     deleted, so brute force costs a fresh send and hits the send limit.
 */

const CODE_LENGTH = OTP_CODE_LENGTH
const MAX_VERIFY_ATTEMPTS = 5
const RESEND_COOLDOWN_SECONDS = OTP_RESEND_COOLDOWN_SECONDS

export type OtpSendResult =
  | { ok: true; expiresInSeconds: number; devCode?: string }
  | { ok: false; reason: 'cooldown'; retryInSeconds: number }
  | { ok: false; reason: 'rate_limited'; retryInSeconds: number }
  | { ok: false; reason: 'gateway'; detail?: string }

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'mismatch' | 'too_many_attempts'; attemptsLeft?: number }

function otpSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters')
  }
  return secret
}

/** Deterministic digest, so verification is a single Redis read plus a compare. */
function hashCode(phone: string, code: string): string {
  // The phone is mixed in so a digest captured for one number cannot be replayed
  // against another that happened to draw the same code.
  return createHmac('sha256', otpSecret()).update(`${phone}:${code}`).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Uniformly distributed 6-digit code. `randomInt` is CSPRNG-backed; `Math.random` is not. */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(CODE_LENGTH, '0')
}

const cooldownKey = (phone: string) => `otp:cooldown:${phone}`

function message(code: string): string {
  return [
    `*${code}* adalah kode verifikasi Autonomo.id Anda.`,
    '',
    `Kode berlaku ${Math.round(cacheTtl.otpCode / 60)} menit. Jangan bagikan kode ini kepada siapa pun, termasuk yang mengaku dari Autonomo.id.`,
  ].join('\n')
}

/**
 * Issue a code and deliver it over WhatsApp.
 *
 * `phone` must already be canonical (`628…`). The code is only persisted after
 * the gateway accepts the message: storing first would leave a valid code behind
 * for a message that never arrived, and the user's retry would then be measured
 * against the wrong secret.
 */
export async function sendOtp(phone: string): Promise<OtpSendResult> {
  const redis = getRedis()

  const cooling = await redis.ttl(cooldownKey(phone))
  if (cooling && cooling > 0) {
    return { ok: false, reason: 'cooldown', retryInSeconds: cooling }
  }

  const code = generateCode()

  // In development without gateway credentials the code is returned to the caller
  // instead of being sent, so the flow is testable. Guarded on NODE_ENV so a
  // missing key in production fails loudly rather than printing codes to users.
  if (!isWhatsappConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'gateway', detail: 'not_configured' }
    }
    await persist(phone, code)
    return { ok: true, expiresInSeconds: cacheTtl.otpCode, devCode: code }
  }

  const sent = await sendWhatsappMessage(phone, message(code))
  if (!sent.ok) {
    return { ok: false, reason: 'gateway', detail: sent.reason }
  }

  await persist(phone, code)
  return { ok: true, expiresInSeconds: cacheTtl.otpCode }
}

async function persist(phone: string, code: string) {
  const redis = getRedis()
  await Promise.all([
    redis.set(cacheKey.otpCode(phone), hashCode(phone, code), { ex: cacheTtl.otpCode }),
    // Attempt counter shares the code's lifetime: a new code always starts from a
    // clean slate, and a stale counter can never lock out a fresh one.
    redis.set(cacheKey.otpAttempt(phone), 0, { ex: cacheTtl.otpCode }),
    redis.set(cooldownKey(phone), 1, { ex: RESEND_COOLDOWN_SECONDS }),
  ])
}

/**
 * Check a submitted code. Consumes it on success so a code is single-use — a
 * second submission of the same digits, by anyone, finds nothing.
 */
export async function verifyOtp(phone: string, submitted: string): Promise<OtpVerifyResult> {
  const redis = getRedis()
  const digits = submitted.replace(/\D/g, '')

  const stored = await redis.get<string>(cacheKey.otpCode(phone))
  if (!stored) return { ok: false, reason: 'expired' }

  // Incremented before the comparison, so a crash or a dropped connection mid-
  // verification can only ever cost the attacker an attempt, never grant one.
  const attempts = await redis.incr(cacheKey.otpAttempt(phone))
  if (attempts > MAX_VERIFY_ATTEMPTS) {
    await redis.del(cacheKey.otpCode(phone), cacheKey.otpAttempt(phone))
    return { ok: false, reason: 'too_many_attempts' }
  }

  if (digits.length !== CODE_LENGTH || !safeEqual(hashCode(phone, digits), stored)) {
    // `attempts` is the count *including* this one, and the guard above admits
    // 1..MAX, so exactly `MAX - attempts` tries remain. Verified at both ends:
    // attempts=1 → 4 left (tries 2..5); attempts=5 → 0 left (try 6 is rejected).
    return { ok: false, reason: 'mismatch', attemptsLeft: MAX_VERIFY_ATTEMPTS - attempts }
  }

  await redis.del(cacheKey.otpCode(phone), cacheKey.otpAttempt(phone), cooldownKey(phone))
  return { ok: true }
}

export { OTP_CODE_LENGTH, OTP_RESEND_COOLDOWN_SECONDS }

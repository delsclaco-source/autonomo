/**
 * Indonesian phone number normalisation.
 *
 * Every number is stored in one canonical shape — E.164 without the leading `+`,
 * e.g. `628123456789` — because `users.phone` is UNIQUE. Without normalisation the
 * same person typing `0812…`, `+62812…` and `62 812…` would create three
 * accounts, and the OTP rate limiter (keyed by phone) would be trivially bypassed
 * by re-typing the number in a different format.
 *
 * Shared by client and server: the client uses it for instant feedback, the
 * server re-runs it because client-side validation is only a convenience.
 */

/** Longest and shortest plausible Indonesian mobile numbers, including the `62`. */
const MIN_LENGTH = 11 // 62 + 8xx + 6 digits
const MAX_LENGTH = 15 // E.164 ceiling

/**
 * Returns the canonical form, or `null` if the input cannot be an Indonesian
 * mobile number. Landlines are rejected on purpose: the product delivers OTP over
 * WhatsApp, so a number that cannot receive WhatsApp is not a usable identity.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  let n: string
  if (digits.startsWith('620')) n = `62${digits.slice(3)}` // +62 0812… — a common typo
  else if (digits.startsWith('62')) n = digits
  else if (digits.startsWith('0')) n = `62${digits.slice(1)}`
  else if (digits.startsWith('8')) n = `62${digits}`
  else return null

  if (!n.startsWith('628')) return null
  if (n.length < MIN_LENGTH || n.length > MAX_LENGTH) return null

  return n
}

/** `628123456789` -> `+62 812-3456-789`, for display only. */
export function formatPhone(canonical: string): string {
  const rest = canonical.slice(2)
  const groups = [rest.slice(0, 3), rest.slice(3, 7), rest.slice(7)].filter(Boolean)
  return `+62 ${groups.join('-')}`
}

/**
 * `+62 812-****-789` — for echoing a number back on the OTP screen.
 *
 * Confirming which number was used matters (people own several), but printing it
 * in full turns any shoulder-surf or shared screenshot into a leak.
 */
export function maskPhone(canonical: string): string {
  const rest = canonical.slice(2)
  const head = rest.slice(0, 3)
  const tail = rest.slice(-3)
  const hidden = '*'.repeat(Math.max(rest.length - head.length - tail.length, 0))
  return `+62 ${head}-${hidden}-${tail}`
}

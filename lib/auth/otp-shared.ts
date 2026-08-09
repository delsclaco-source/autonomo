/**
 * OTP constants shared between server and client.
 *
 * `lib/auth/otp.ts` is marked `server-only` (it holds the HMAC key and Redis
 * access), so the client cannot import from it. These two numbers are needed by
 * the form to size the code input and run the resend countdown, and they must not
 * drift from the server's values — hence one definition, imported by both.
 */

export const OTP_CODE_LENGTH = 6
export const OTP_RESEND_COOLDOWN_SECONDS = 60

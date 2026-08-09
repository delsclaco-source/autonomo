'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { areaFromHost } from '@/lib/config/subdomains'
import { normalizePhone, maskPhone } from '@/lib/auth/phone'
import { sendOtp, verifyOtp, OTP_CODE_LENGTH } from '@/lib/auth/otp'
import { provisionUserWithRetry } from '@/lib/auth/provision'
import { createSession } from '@/lib/auth/session'
import { safeNextPath } from '@/lib/auth/redirect'
import { otpRateLimiter, otpIpRateLimiter } from '@/lib/redis'

/**
 * Login Server Actions.
 *
 * Both actions re-derive the area from the Host header rather than accepting it
 * from the form. A Server Action is a POST the client fully controls; an `area`
 * field in the body would let anyone request a session minted for admin.
 *
 * Failure messages are deliberately uniform about whether an account exists. The
 * OTP step reports the same thing for a known and an unknown number, so the login
 * form cannot be used to test which phone numbers are registered — that list has
 * resale value on its own, independent of any account being broken into.
 */

export type SendState =
  | { status: 'idle' }
  | {
      status: 'sent'
      phone: string
      masked: string
      devCode?: string
      /**
       * Millisecond timestamp of this send. The client uses it purely as a change
       * signal: a resend returns an otherwise byte-identical `sent` object, so
       * without it there is no way to tell "a new code went out" from "the same
       * state re-rendered", and the resend cooldown never re-arms.
       */
      sentAt: number
    }
  | { status: 'error'; message: string; phone?: string }

export type VerifyState =
  | { status: 'idle' }
  | { status: 'error'; message: string }

async function currentArea() {
  return areaFromHost((await headers()).get('host'))
}

/**
 * Client IP, for the per-address send limit.
 *
 * `x-forwarded-for` is client-supplied in general, but on Vercel the platform
 * rewrites it at the edge, so the first entry is trustworthy here. Anywhere the
 * app is served without that guarantee this limit degrades to advisory — which is
 * why it is the secondary control and the per-phone limit is the primary one.
 */
async function clientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export async function requestOtpAction(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const raw = String(formData.get('phone') ?? '')
  const phone = normalizePhone(raw)

  if (!phone) {
    return {
      status: 'error',
      message: 'Nomor tidak valid. Gunakan format 08xx atau +62 8xx.',
      phone: raw,
    }
  }

  // Sequential, not `Promise.all`. Running both consumed a token from each even
  // when the first had already rejected, so an IP over its limit kept burning
  // down the per-phone budget of every number it touched.
  const byIp = await otpIpRateLimiter().limit(await clientIp())
  const byPhone = byIp.success ? await otpRateLimiter().limit(phone) : null

  if (!byIp.success || (byPhone && !byPhone.success)) {
    // Report the reset of the limiter that actually rejected. `Math.max` across
    // both overstated the wait whenever the other limiter's window ran longer.
    const reset = byIp.success ? byPhone!.reset : byIp.reset
    const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60_000))
    return {
      status: 'error',
      message: `Terlalu banyak permintaan kode. Coba lagi dalam ${minutes} menit.`,
      phone: raw,
    }
  }

  const result = await sendOtp(phone)

  if (!result.ok) {
    if (result.reason === 'cooldown') {
      return {
        status: 'error',
        message: `Kode baru bisa dikirim ulang dalam ${result.retryInSeconds} detik.`,
        phone: raw,
      }
    }
    if (result.reason === 'rate_limited') {
      return { status: 'error', message: 'Terlalu banyak permintaan kode.', phone: raw }
    }
    // Gateway failures are the user's problem to work around, not to diagnose:
    // the detail goes to the server log, the message tells them what to do.
    console.error('[otp] gateway failure', { detail: result.detail })
    return {
      status: 'error',
      message:
        'Kode gagal dikirim ke WhatsApp. Pastikan nomor aktif di WhatsApp, lalu coba lagi.',
      phone: raw,
    }
  }

  return {
    status: 'sent',
    phone,
    masked: maskPhone(phone),
    devCode: result.devCode,
    sentAt: Date.now(),
  }
}

export async function verifyOtpAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  // The phone travels through the form because the OTP step is stateless, but it
  // is re-normalised here: this value is client-supplied like any other, and the
  // Redis key it selects has to be the canonical one.
  const phone = normalizePhone(String(formData.get('phone') ?? ''))
  const code = String(formData.get('code') ?? '').replace(/\D/g, '')

  if (!phone) return { status: 'error', message: 'Sesi verifikasi kedaluwarsa. Ulangi dari awal.' }
  if (code.length !== OTP_CODE_LENGTH) {
    return { status: 'error', message: `Masukkan ${OTP_CODE_LENGTH} digit kode.` }
  }

  const check = await verifyOtp(phone, code)
  if (!check.ok) {
    if (check.reason === 'expired') {
      return { status: 'error', message: 'Kode sudah kedaluwarsa. Kirim ulang kode.' }
    }
    if (check.reason === 'too_many_attempts') {
      return {
        status: 'error',
        message: 'Terlalu banyak percobaan. Kode dibatalkan — kirim ulang kode baru.',
      }
    }
    const left = check.attemptsLeft ?? 0
    return {
      status: 'error',
      message: left > 0 ? `Kode salah. Sisa ${left} percobaan.` : 'Kode salah.',
    }
  }

  const area = await currentArea()
  const provisioned = await provisionUserWithRetry(phone, area)

  if (!provisioned.ok) {
    if (provisioned.reason === 'suspended') {
      return { status: 'error', message: 'Akun ini dinonaktifkan. Hubungi dukungan Autonomo.id.' }
    }
    if (provisioned.reason === 'role_mismatch') {
      return {
        status: 'error',
        message: 'Nomor ini terdaftar untuk area lain. Masuk lewat halaman yang sesuai.',
      }
    }
    return { status: 'error', message: 'Nomor ini belum terdaftar untuk area ini.' }
  }

  const userAgent = (await headers()).get('user-agent') ?? undefined
  await createSession(provisioned.userId, area, userAgent)

  const next = safeNextPath(String(formData.get('next') ?? '')) ?? defaultLanding()
  redirect(next)
}

/**
 * Where to send a user who logged in without a `?next=` target.
 *
 * Every area lands on `/`, so this takes no area argument. The visible root of
 * sales.autonomo.id is the sales dashboard because `proxy.ts` rewrites `/` to the
 * internal `/sales`; returning `/sales` here would make the proxy rewrite it
 * again, to `/sales/sales`, and the user would land on a 404.
 */
function defaultLanding(): string {
  return '/'
}

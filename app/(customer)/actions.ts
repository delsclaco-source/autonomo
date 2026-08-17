'use server'

import { getDb } from '@/lib/db'
import { auctions, requests } from '@/lib/db/schema'
import { AUCTION_DURATION_MS } from '@/lib/auction/queries'
import { clientIp } from '@/lib/auth/client-ip'
import { maskPhone, normalizePhone } from '@/lib/auth/phone'
import {
  OTP_CODE_LENGTH,
  consumeVerificationTicket,
  issueVerificationTicket,
  sendOtp,
  verifyOtp,
} from '@/lib/auth/otp'
import { provisionUserWithRetry } from '@/lib/auth/provision'
import { otpIpRateLimiter, otpRateLimiter, requestRateLimiter } from '@/lib/redis'
import {
  requestBandInputSchema,
  resolveRequestFromBand,
  type ResolvedRequest,
} from '@/lib/validation/request'

/**
 * Public request submission, with WhatsApp verification inline.
 *
 * The customer area has no login. A buyer never holds a session: they name a car,
 * a discount range and a number, prove the number with a one-time code, and the
 * request lands. Nothing that reaches `requests` is trusted from the client — the
 * only thing that opens a write is a code this server issued minutes ago to that
 * exact number, because a client-side "verified" flag would be a form field, and
 * form fields are typed by whoever is posting.
 *
 * That verification is not a formality. A sales user spends real tokens to unlock
 * a lead, and what they are buying is a number that answers. An unverified number
 * makes the token price a lie, so there is deliberately no path from this module
 * to `requests` that skips `provisionUserWithRetry` — the call that stamps
 * `users.phone_verified_at`.
 *
 * No session cookie is minted anywhere here. Verification proves a number for one
 * submission and nothing else; a buyer who returns tomorrow verifies again. The
 * consequence is intended: there is no customer dashboard to protect, so there is
 * no customer session to steal.
 *
 * **Three actions, because there are three decisions.** Send a code, prove the
 * number, then send the request — the buyer presses "Verifikasi" and only then
 * "Kirim". `verifyOtp` consumes the code, so the proof cannot simply be re-checked
 * at submit time; `verifyRequestOtp` resolves the number to a user id and hands back
 * an opaque single-use ticket, and `submitRequest` reads the customer id **out of
 * that ticket rather than out of the form**. Taking the number from the form would
 * let a caller verify one number and file the request under another.
 *
 * Every action re-validates everything it uses. An earlier action's approval lives
 * in the client's form markup, which the next action cannot trust.
 */

/** Echoed back so a failed round trip does not empty the card. */
export type RequestValues = {
  /** Catalogue slugs, not display names — `findModel` and `resolveTier` key on slug. */
  brand: string
  model: string
  /** A `DISCOUNT_BANDS` slug, not a number. Rupiah off list, as a range. */
  discountBand: string
  timeframe: string
  /** Optional. `''` means the buyer left the select alone. */
  buyerType: string
  paymentScheme: string
  phone: string
}

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
      values: RequestValues
    }
  | {
      status: 'error'
      message: string
      fieldErrors?: Record<string, string>
      values: RequestValues
    }

export type VerifyState =
  | { status: 'idle' }
  | {
      status: 'verified'
      /**
       * Opaque single-use handle standing in for "this number is proved". Held in a
       * hidden field until the buyer presses "Kirim", then redeemed server-side.
       * Carries no number and no role — see `issueVerificationTicket`.
       */
      ticket: string
      /**
       * The number exactly as it was typed, echoed back so the card can tell when
       * the buyer edits it afterwards and drop the verified state. Comparing raw
       * strings errs toward re-verifying, which is the safe direction: a ticket is
       * bound to the number it was issued for, so a form still showing "verified"
       * beside a changed number would be lying about which number gets the call.
       */
      phone: string
      masked: string
    }
  | { status: 'error'; message: string }

export type SubmitState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function readValues(formData: FormData): RequestValues {
  return {
    brand: String(formData.get('brand') ?? ''),
    model: String(formData.get('model') ?? ''),
    discountBand: String(formData.get('discountBand') ?? ''),
    timeframe: String(formData.get('timeframe') ?? ''),
    buyerType: String(formData.get('buyerType') ?? ''),
    paymentScheme: String(formData.get('paymentScheme') ?? ''),
    phone: String(formData.get('phone') ?? ''),
  }
}

type CarResult =
  | { ok: true; value: ResolvedRequest }
  | { ok: false; fieldErrors: Record<string, string> }

/**
 * Brand, model, discount band and timeframe into a resolved request.
 *
 * The card asks what the buyer wants *off* the list price, from a fixed set of
 * rupiah ranges — the unit `sales_offers.max_discount` already uses, so the two
 * sides of the market are comparable without carrying an OTR around. The band's
 * lower bound is what becomes `target_price`; `resolveRequestFromBand` does that
 * conversion and then hands off to the shared resolver.
 *
 * `tier` and `discountWanted` still come from the catalogue, never from the form —
 * a buyer who could pick their own tier could make their own lead cheap to unlock.
 * `buyerType` and `paymentScheme` are the two fields the buyer may leave empty;
 * they qualify the lead for a sales user and are deliberately outside every price
 * calculation, so answering "corporate" or "cash" cannot change what a lead costs.
 *
 * `variant` and `notes` are not collected by the hero card. They stay optional in
 * the schema and are simply absent here rather than being sent as empty strings,
 * so the columns hold NULL instead of ''.
 */
function resolveCar(values: RequestValues): CarResult {
  const parsed = requestBandInputSchema.safeParse({
    brand: values.brand,
    model: values.model,
    timeframe: values.timeframe,
    discountBand: values.discountBand,
    buyerType: values.buyerType,
    paymentScheme: values.paymentScheme,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message
    }
    return { ok: false, fieldErrors }
  }

  const resolved = resolveRequestFromBand(parsed.data)
  if (!resolved.ok) return { ok: false, fieldErrors: resolved.fieldErrors }

  return { ok: true, value: resolved.value }
}

/**
 * Step one: issue a code to the number on the card.
 *
 * The car fields are validated *before* the send. A send costs a gateway call and
 * burns one of the three attempts a number gets in fifteen minutes, so a typo in
 * the price must not consume one — the buyer would come back to a working form
 * and a rate limit they did not earn.
 */
export async function sendRequestOtp(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const values = readValues(formData)

  const car = resolveCar(values)
  if (!car.ok) {
    return {
      status: 'error',
      message: 'Periksa kembali isian Anda.',
      fieldErrors: car.fieldErrors,
      values,
    }
  }

  const phone = normalizePhone(values.phone)
  if (!phone) {
    return {
      status: 'error',
      message: 'Periksa kembali isian Anda.',
      fieldErrors: { phone: 'Nomor tidak valid. Gunakan format 08xx atau +62 8xx.' },
      values,
    }
  }

  // Sequential, not `Promise.all`. Running both consumed a token from each even
  // when the first had already rejected, so an IP over its limit kept burning
  // down the per-phone budget of every number it touched.
  const byIp = await otpIpRateLimiter().limit(await clientIp())
  const byPhone = byIp.success ? await otpRateLimiter().limit(phone) : null

  if (!byIp.success || (byPhone && !byPhone.success)) {
    // Report the reset of the limiter that actually rejected; the maximum across
    // both overstates the wait whenever the other window runs longer.
    const reset = byIp.success ? byPhone!.reset : byIp.reset
    const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60_000))
    return {
      status: 'error',
      message: `Terlalu banyak permintaan kode. Coba lagi dalam ${minutes} menit.`,
      values,
    }
  }

  const result = await sendOtp(phone)

  if (!result.ok) {
    if (result.reason === 'cooldown') {
      return {
        status: 'error',
        message: `Kode baru bisa dikirim ulang dalam ${result.retryInSeconds} detik.`,
        values,
      }
    }
    if (result.reason === 'rate_limited') {
      return { status: 'error', message: 'Terlalu banyak permintaan kode.', values }
    }
    // Gateway failures are the buyer's problem to work around, not to diagnose:
    // the detail goes to the server log, the message says what to do next.
    console.error('[request-otp] gateway failure', { detail: result.detail })
    return {
      status: 'error',
      message: 'Kode gagal dikirim ke WhatsApp. Pastikan nomor aktif di WhatsApp, lalu coba lagi.',
      values,
    }
  }

  return {
    status: 'sent',
    phone,
    masked: maskPhone(phone),
    devCode: result.devCode,
    sentAt: Date.now(),
    values,
  }
}

/**
 * Step two: prove the number.
 *
 * Reads the phone and the code and nothing else. The car fields are deliberately
 * out of scope — the buyer may still be picking a model when the code arrives, and
 * refusing to verify a number because a select is empty would waste a code on a
 * form that was never wrong about the number.
 *
 * Provisioning happens here rather than at submit time, so a number that already
 * belongs to a sales or admin account is refused while the buyer is still looking at
 * the field it concerns. It also means the ticket can hold a resolved user id: the
 * write path never has to take a number from the client at all.
 */
export async function verifyRequestOtp(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const typed = String(formData.get('phone') ?? '')
  const code = String(formData.get('code') ?? '').replace(/\D/g, '')

  // Re-normalised even though the send already did it: this value came back
  // through the client's form, and the Redis key it selects has to be canonical
  // or the code gets checked against the wrong number's digest.
  const phone = normalizePhone(typed)
  if (!phone) {
    return {
      status: 'error',
      message: 'Nomor tidak valid. Gunakan format 08xx atau +62 8xx.',
    }
  }
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

  // `'customer'` is a literal, never read from the form or the Host header. This
  // module is only ever reached from the customer area, and an area taken from a
  // request body would let anyone mint themselves a row in another role.
  const provisioned = await provisionUserWithRetry(phone, 'customer')

  if (!provisioned.ok) {
    if (provisioned.reason === 'suspended') {
      return { status: 'error', message: 'Akun ini dinonaktifkan. Hubungi dukungan Autonomo.id.' }
    }
    // `role_mismatch` means the number already belongs to a sales or admin
    // account. Saying so would turn this public form into a way to test which
    // numbers belong to staff, so the message stays about what to do instead.
    return {
      status: 'error',
      message: 'Nomor ini tidak bisa dipakai untuk mengirim request. Gunakan nomor lain.',
    }
  }

  const ticket = await issueVerificationTicket(provisioned.userId)

  return { status: 'verified', ticket, phone: typed, masked: maskPhone(phone) }
}

/**
 * Step three: write the request for an already-proved number.
 *
 * The customer id comes from the ticket, never from the form. That is the one thing
 * separating verification from submission costs: with the number still arriving in
 * the payload, a caller could verify a number they control and file the request
 * against somebody else's.
 *
 * Order is load-bearing. The car is validated *before* the ticket is redeemed, so a
 * half-filled form costs a re-check and not the verification. Everything after the
 * redemption cannot be replayed: a rate-limit rejection or a database failure below
 * this line leaves nothing written and the buyer verifying again, which is the
 * trade for a ticket that can never be spent twice.
 */
export async function submitRequest(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const values = readValues(formData)

  const car = resolveCar(values)
  if (!car.ok) {
    return {
      status: 'error',
      message: 'Isian request belum lengkap. Periksa pilihan mobil dan rentang diskon.',
    }
  }

  const customerId = await consumeVerificationTicket(String(formData.get('ticket') ?? ''))
  if (!customerId) {
    return {
      status: 'error',
      message: 'Verifikasi kedaluwarsa. Kirim ulang kode dan verifikasi nomor Anda lagi.',
    }
  }

  // Keyed on the user id out of the ticket — so the limit follows the person
  // rather than the browser, and survives them switching device. The OTP limits
  // already cover the cheaper attack of hammering unverified numbers; this one
  // caps how many requests one verified buyer opens.
  const { success } = await requestRateLimiter().limit(customerId)
  if (!success) {
    return { status: 'error', message: 'Terlalu banyak request dalam satu jam. Coba lagi nanti.' }
  }

  await insertRequest(customerId, car.value)

  return {
    status: 'success',
    message: car.value.flaggedReason
      ? 'Request terkirim. Diskon yang Anda minta di luar rentang yang wajar untuk model ini, jadi request ini tidak dilelang — sales yang tertarik bisa menghubungi Anda langsung.'
      : 'Request terkirim dan lelang dibuka 48 jam. Sales bersaing memberi diskon terdalam; yang menang menghubungi Anda lewat WhatsApp.',
  }
}

async function insertRequest(customerId: string, value: ResolvedRequest) {
  // The request row and its auction are written together or not at all. An
  // auction whose request never landed is unreachable; a request stuck in
  // `auction` with no auction row can never be bid on and never closes, so it
  // would sit invisible to both lanes forever.
  await getDb().transaction(async (tx) => {
    // A plausible target price opens an auction: sales users compete on margin
    // and the deepest discount wins the contact, costing them no tokens. A
    // flagged one skips straight to the token pool — nobody is going to bid
    // margin against a price that is not real, but a sales user may still judge
    // the buyer worth reaching, and there they pay tokens for the privilege.
    const auctioned = !value.flaggedReason

    const [row] = await tx
      .insert(requests)
      .values({
        customerId,
        brand: value.brand,
        model: value.model,
        variant: value.variant,
        // Both units are stored. The rupiah figures are what the matching engine
        // compares against `sales_offers`, which is also in rupiah; the percentage
        // cannot be compared across models without the OTR. Freezing `list_price`
        // also makes the buyer's chosen band recoverable — `list_price −
        // target_price` is its lower bound — so a later catalogue price change
        // rewrites neither the request nor the range it was asking for.
        listPrice: value.listPrice,
        targetPrice: value.targetPrice,
        // numeric columns take strings in drizzle-orm/pg to avoid float rounding.
        discountWanted: value.discountWanted.toFixed(2),
        tier: value.tier,
        purchaseTimeframe: value.timeframe,
        // Null when skipped, never ''. Qualifiers for the sales user reading the
        // lead; nothing above or below prices a request from them.
        buyerType: value.buyerType,
        paymentScheme: value.paymentScheme,
        notes: value.notes,
        status: auctioned ? 'auction' : 'pool',
        flaggedReason: value.flaggedReason,
      })
      .returning({ id: requests.id })

    if (!auctioned) return

    // `targetPrice` and `listPrice` are copied rather than joined at settlement
    // time, so the auction sales users bid into cannot move underneath them.
    await tx.insert(auctions).values({
      requestId: row.id,
      targetPrice: value.targetPrice,
      listPrice: value.listPrice,
      tier: value.tier,
      closesAt: new Date(Date.now() + AUCTION_DURATION_MS),
    })
  })
}

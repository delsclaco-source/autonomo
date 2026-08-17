'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { auctions, requests } from '@/lib/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { AUCTION_DURATION_MS } from '@/lib/auction/queries'
import { requestRateLimiter } from '@/lib/redis'
import {
  parseRupiah,
  requestInputSchema,
  resolveRequest,
  type ResolvedRequest,
} from '@/lib/validation/request'

/**
 * Submit a car request.
 *
 * Authorisation is re-asserted here rather than inherited from the page: a Server
 * Action is a POST to the route, reachable without ever rendering the form, so
 * the proxy's cookie check is not an access control boundary.
 *
 * Signed out is not an error state — the form is public so a buyer can see what
 * they are being asked for before committing a phone number. The submission then
 * bounces to login, which is where the number gets verified.
 */

export type RequestFormState = {
  status: 'idle' | 'error' | 'success' | 'needs_login'
  message?: string
  fieldErrors?: Record<string, string>
  /** Echoed back so the form can repopulate after a failed round trip. */
  values?: Record<string, string>
}

export async function submitCarRequest(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const raw = {
    brand: String(formData.get('brand') ?? ''),
    model: String(formData.get('model') ?? ''),
    variant: String(formData.get('variant') ?? ''),
    timeframe: String(formData.get('timeframe') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    targetPrice: String(formData.get('targetPrice') ?? ''),
  }

  const parsed = requestInputSchema.safeParse({
    ...raw,
    targetPrice: parseRupiah(formData.get('targetPrice')),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message
    }
    return { status: 'error', message: 'Periksa kembali isian Anda.', fieldErrors, values: raw }
  }

  const resolved = resolveRequest(parsed.data)
  if (!resolved.ok) {
    return {
      status: 'error',
      message: 'Periksa kembali isian Anda.',
      fieldErrors: resolved.fieldErrors,
      values: raw,
    }
  }

  const user = await getSessionUser('customer')
  if (!user) {
    return {
      status: 'needs_login',
      message: 'Verifikasi nomor WhatsApp Anda untuk mengirim request ini.',
      values: raw,
    }
  }

  const { success } = await requestRateLimiter().limit(user.id)
  if (!success) {
    return {
      status: 'error',
      message: 'Terlalu banyak request dalam satu jam. Coba lagi nanti.',
      values: raw,
    }
  }

  await insertRequest(user.id, resolved.value)
  revalidatePath('/request')

  return {
    status: 'success',
    message: resolved.value.flaggedReason
      ? 'Request terkirim. Harga yang Anda minta di luar rentang diskon yang wajar, jadi request ini tidak dilelang — sales yang tertarik bisa menghubungi Anda langsung.'
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
        // Both units are stored. The rupiah figures are what the customer actually
        // typed and what the matching engine compares against `sales_offers`, which
        // is also in rupiah; the percentage cannot be compared across models without
        // the OTR. Freezing `list_price` keeps a later catalogue price change from
        // rewriting what this request was asking for.
        listPrice: value.listPrice,
        targetPrice: value.targetPrice,
        // numeric columns take strings in drizzle-orm/pg to avoid float rounding.
        discountWanted: value.discountWanted.toFixed(2),
        tier: value.tier,
        purchaseTimeframe: value.timeframe,
        notes: value.notes,
        status: auctioned ? 'auction' : 'pool',
        flaggedReason: value.flaggedReason,
      })
      .returning({ id: requests.id })

    if (!auctioned) return

    // `targetPrice` and `listPrice` are copied, not joined at settlement time.
    // The customer can edit their request later; the auction sales users are
    // bidding into must not move underneath them.
    await tx.insert(auctions).values({
      requestId: row.id,
      targetPrice: value.targetPrice,
      listPrice: value.listPrice,
      tier: value.tier,
      closesAt: new Date(Date.now() + AUCTION_DURATION_MS),
    })
  })
}

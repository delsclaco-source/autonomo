'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { auctionForCustomer } from '@/lib/auction/queries'
import { settleAuction } from '@/lib/auction/settle'
import { formatRupiah } from '@/lib/data/catalog'

/**
 * Customer mutations on their own auction.
 *
 * Only one action lives here: closing an auction early. Everything else a
 * customer does to a request happens at creation time in `baru/actions.ts`.
 *
 * The form supplies a `requestId`, never an `auctionId`. An auction id trusted
 * straight from a form body is a bearer token — any signed-in customer could
 * settle a stranger's auction by posting someone else's id. Resolving it through
 * `auctionForCustomer(requestId, user.id)` puts ownership in the SQL predicate,
 * so an id belonging to someone else comes back as null instead of being
 * settled. The id that reaches `settleAuction` is one the database handed us.
 *
 * No token is spent here and none is refunded. The auction lane never touches
 * `token_ledger` — the winner pays in margin, and the contact opens for free.
 */

export type AwardState = {
  status: 'idle' | 'error' | 'success'
  message?: string
  requestId?: string
}

const uuid = z.string().uuid()

/**
 * Close an open auction now and award it to the standing best offer.
 *
 * `force: true` is required. `settleAuction` refuses with `not_due` while
 * `closesAt` is still in the future, which is exactly the case this action
 * exists for — without the flag the button would silently do nothing.
 *
 * The customer does not choose *which* bid wins. The comparator does, and it is
 * the same one the cron uses: lowest price, earliest bid breaks the tie. Letting
 * a customer award a higher bid would make the whole ranking advisory, and a
 * sales user who bid deepest and lost anyway has no reason to bid deep again.
 */
export async function awardAuctionAction(
  _prev: AwardState,
  formData: FormData,
): Promise<AwardState> {
  const user = await requireUser('customer')

  const parsed = uuid.safeParse(formData.get('requestId'))
  if (!parsed.success) {
    return { status: 'error', message: 'Permintaan tidak dikenali.' }
  }

  const requestId = parsed.data

  const view = await auctionForCustomer(requestId, user.id)
  if (!view) {
    return { status: 'error', message: 'Lelang tidak ditemukan.', requestId }
  }
  if (view.status !== 'open') {
    return { status: 'error', message: 'Lelang ini sudah ditutup.', requestId }
  }
  if (view.bids.length === 0) {
    return { status: 'error', message: 'Belum ada penawaran yang bisa dipilih.', requestId }
  }

  const result = await settleAuction(view.auctionId, { force: true })

  if (!result.ok) {
    return { status: 'error', message: 'Lelang tidak ditemukan.', requestId }
  }

  revalidatePath('/request')

  switch (result.outcome) {
    case 'awarded':
      return {
        status: 'success',
        message: `Lelang ditutup di ${formatRupiah(result.price)}. Sales pemenang akan menghubungi Anda lewat WhatsApp.`,
        requestId,
      }
    // Reachable despite the check above: a bid can be flagged between the read
    // and the settlement, leaving nothing valid left to award.
    case 'no_bids':
      return { status: 'error', message: 'Belum ada penawaran yang bisa dipilih.', requestId }
    default:
      return {
        status: 'error',
        message:
          result.reason === 'request_taken'
            ? 'Permintaan ini sudah dipegang seorang sales.'
            : 'Lelang ini sudah ditutup.',
        requestId,
      }
  }
}

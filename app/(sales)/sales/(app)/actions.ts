'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { leads, leadStatusEnum } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/session'
import { unlockLead } from '@/lib/sales/unlock'
import { placeBid } from '@/lib/auction/bid'
import { formatRupiah } from '@/lib/sales/present'
import { parseRupiah } from '@/lib/validation/request'
import { bidRateLimiter } from '@/lib/redis'

/**
 * Sales mutations.
 *
 * Every action re-asserts the session with `requireUser('sales')` rather than
 * trusting the layout above it. A Server Action is a POST to the route and can be
 * invoked without the page ever rendering, so the layout guard is not a boundary.
 *
 * The sales id always comes from the session, never from the form. A `salesId`
 * field in the body would let any signed-in user spend another user's tokens.
 */

export type UnlockState = {
  status: 'idle' | 'error' | 'success'
  message?: string
  requestId?: string
}

const uuid = z.string().uuid()

export async function unlockLeadAction(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const user = await requireUser('sales')

  const parsed = uuid.safeParse(formData.get('requestId'))
  if (!parsed.success) {
    return { status: 'error', message: 'Lead tidak dikenali.' }
  }

  const result = await unlockLead(user.id, parsed.data)

  if (!result.ok) {
    return { status: 'error', message: unlockMessage(result), requestId: parsed.data }
  }

  revalidatePath('/sales/leads')
  revalidatePath('/sales/crm')
  revalidatePath('/sales')

  return {
    status: 'success',
    message: `Kontak dibuka. ${result.tokenCost} token terpakai, sisa ${result.balanceAfter}.`,
    requestId: parsed.data,
  }
}

function unlockMessage(result: Extract<Awaited<ReturnType<typeof unlockLead>>, { ok: false }>) {
  switch (result.reason) {
    case 'insufficient_tokens':
      return `Token tidak cukup. Butuh ${result.tokenCost}, saldo Anda ${result.balance}.`
    case 'daily_limit':
      return 'Batas 3 unlock per hari untuk akun gratis sudah tercapai. Reset pukul 00:00 WIB.'
    // Not "you already opened this". One request belongs to exactly one sales
    // user, so whoever sees this message is almost always someone who lost the
    // race — telling them it was their own doing would send them hunting through
    // a CRM that does not contain the lead.
    case 'already_taken':
      return 'Lead ini sudah diambil sales lain. Satu permintaan hanya untuk satu sales.'
    case 'in_auction':
      return 'Permintaan ini sedang dilelang. Ikut menawar di halaman Lelang — tanpa token.'
    case 'no_profile':
      return 'Profil sales belum lengkap. Hubungi admin.'
    default:
      return 'Lead sudah tidak tersedia.'
  }
}

export type BidState = {
  status: 'idle' | 'error' | 'success'
  message?: string
  auctionId?: string
}

/**
 * Place or improve a bid in a reverse auction.
 *
 * Bids cost no tokens, which removes the natural brake every other write on this
 * dashboard has. Two things replace it, and the order is fixed by the contract in
 * `lib/auction/bid.ts`: the session first, then the Redis rate limit keyed on the
 * user id. Limiting before authenticating would let an unauthenticated caller
 * burn another user's quota.
 *
 * The success message never mentions a rival's price — only this user's own
 * standing. That is the whole mechanism: rank and gap create pressure, a visible
 * best price invites shaving it by one rupiah.
 */
export async function bidAction(_prev: BidState, formData: FormData): Promise<BidState> {
  const user = await requireUser('sales')

  const { success: allowed } = await bidRateLimiter().limit(user.id)
  if (!allowed) {
    return { status: 'error', message: 'Terlalu cepat. Tunggu 10 detik sebelum menawar lagi.' }
  }

  const parsed = uuid.safeParse(formData.get('auctionId'))
  if (!parsed.success) {
    return { status: 'error', message: 'Lelang tidak dikenali.' }
  }

  const price = parseRupiah(formData.get('price'))
  if (price === undefined) {
    return { status: 'error', message: 'Masukkan harga penawaran.', auctionId: parsed.data }
  }

  const result = await placeBid(user.id, parsed.data, price)

  if (!result.ok) {
    return { status: 'error', message: bidMessage(result), auctionId: parsed.data }
  }

  revalidatePath('/sales/lelang')

  const rank =
    result.rank === 1 ? 'Anda memimpin.' : `Peringkat Anda ${result.rank}.`
  const gap =
    result.gapToTarget <= 0
      ? 'Harga Anda sudah menyentuh target customer.'
      : `Masih ${formatRupiah(result.gapToTarget)} di atas target customer.`
  const extended = result.extended ? ' Lelang diperpanjang 5 menit.' : ''

  return {
    status: 'success',
    message: `${rank} ${gap}${extended}`,
    auctionId: parsed.data,
  }
}

function bidMessage(result: Extract<Awaited<ReturnType<typeof placeBid>>, { ok: false }>) {
  switch (result.reason) {
    case 'closed':
      return 'Lelang ini sudah ditutup.'
    // The entry ticket, not a paywall. A sales user without a live offer for this
    // brand and model has nothing public to be held to, so the committed price
    // would bind nobody.
    case 'no_offer':
      return 'Anda belum punya penawaran aktif untuk mobil ini. Publikasikan dulu di Produk.'
    case 'below_advertised':
      return 'Penawaran ini lebih dangkal dari diskon maksimal yang sudah Anda iklankan.'
    case 'not_lower':
      return 'Penawaran hanya boleh diturunkan, tidak dinaikkan.'
    case 'flagged':
      return 'Penawaran Anda di lelang ini sedang ditinjau admin.'
    case 'invalid_price':
      return 'Harga penawaran tidak valid.'
    default:
      return 'Lelang sudah tidak tersedia.'
  }
}

const statusSchema = z.enum(leadStatusEnum.enumValues)

export type LeadStatusState = { status: 'idle' | 'error' | 'success'; message?: string }

/**
 * Move a lead through the pipeline.
 *
 * Scoped by `salesId` in the WHERE clause, so a crafted `leadId` belonging to
 * another sales user matches zero rows instead of updating someone else's CRM.
 * Nothing about the token ledger is touched here — status is free to change, the
 * charge is not.
 */
export async function updateLeadStatusAction(
  _prev: LeadStatusState,
  formData: FormData,
): Promise<LeadStatusState> {
  const user = await requireUser('sales')

  const id = uuid.safeParse(formData.get('leadId'))
  const next = statusSchema.safeParse(formData.get('status'))
  if (!id.success || !next.success) {
    return { status: 'error', message: 'Perubahan tidak dikenali.' }
  }

  const closed = next.data === 'won' || next.data === 'lost'

  const updated = await getDb()
    .update(leads)
    .set({
      status: next.data,
      // `last_contacted_at` is what the Follow-Up Center and `response_rate` are
      // computed from. Written here rather than on the WhatsApp button because
      // opening a chat is not proof a message was sent; marking the status is the
      // sales user asserting they made contact.
      ...(next.data === 'contacted' ? { lastContactedAt: new Date() } : {}),
      closedAt: closed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, id.data), eq(leads.salesId, user.id)))
    .returning({ id: leads.id })

  if (updated.length === 0) {
    return { status: 'error', message: 'Lead tidak ditemukan.' }
  }

  revalidatePath('/sales/crm')
  revalidatePath('/sales')

  return { status: 'success' }
}

/** Free-text note a sales user keeps against a lead. Never shown to the customer. */
export async function saveLeadNoteAction(_prev: LeadStatusState, formData: FormData) {
  const user = await requireUser('sales')

  const id = uuid.safeParse(formData.get('leadId'))
  const note = z.string().trim().max(1000).safeParse(formData.get('note') ?? '')
  if (!id.success || !note.success) {
    return { status: 'error' as const, message: 'Catatan tidak tersimpan.' }
  }

  // Scoped to this sales user's own lead, then checked. Without the row count a
  // note posted against someone else's leadId matches nothing and still returns
  // success — the user sees "saved" over a note that was silently dropped.
  const updated = await getDb()
    .update(leads)
    .set({ internalNotes: note.data || null, updatedAt: new Date() })
    .where(and(eq(leads.id, id.data), eq(leads.salesId, user.id)))
    .returning({ id: leads.id })

  if (updated.length === 0) {
    return { status: 'error' as const, message: 'Lead tidak ditemukan.' }
  }

  revalidatePath('/sales/crm')
  return { status: 'success' as const }
}

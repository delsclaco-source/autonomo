'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { offerBenefits, salesOffers } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/session'
import { parseRupiah } from '@/lib/validation/request'
import { offerInputSchema, parseDecimal, resolveOffer } from '@/lib/validation/offer'

/**
 * Sales offer mutations.
 *
 * Same rule as the rest of the sales actions: `requireUser('sales')` runs first
 * in every one of them. A Server Action is a POST to the route and reachable
 * without the page ever rendering, so the layout guard above is not a boundary.
 * The owner is always `user.id` from the session — a `salesId` in the form body
 * would let any signed-in user publish offers under someone else's name.
 *
 * No token is spent here. Publishing an offer is free; only unlocking a lead
 * touches the ledger. Nothing in this file may write to `token_ledger`.
 */

/** Cap on live offers per sales user. Past this the list stops being browsable. */
const MAX_ACTIVE_OFFERS = 60

export type OfferFormState = {
  status: 'idle' | 'error' | 'success'
  message?: string
  fieldErrors?: Record<string, string>
  /** Echoed back so the form can repopulate after a failed round trip. */
  values?: Record<string, string>
}

const uuid = z.string().uuid()

/**
 * Publish a new offer.
 *
 * The submit button chooses `draft` or `active`; anything else in that field is
 * treated as `draft` rather than published, because silently publishing a row the
 * user meant to keep private is the worse failure of the two.
 */
export async function createOfferAction(
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  const user = await requireUser('sales')

  const intent = formData.get('intent') === 'active' ? 'active' : 'draft'

  const raw: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && key !== 'benefits') raw[key] = value
  }

  const discountType = formData.get('discountType')

  const parsed = offerInputSchema.safeParse({
    brand: formData.get('brand') ?? '',
    model: formData.get('model') ?? '',
    variant: formData.get('variant') ?? '',
    otrPrice: parseRupiah(formData.get('otrPrice')),
    discountType: discountType ?? '',
    // Percent is a decimal ("7,5"), rupiah is grouped digits ("15.000.000") —
    // which parser applies depends on the unit the user picked.
    maxDiscount:
      discountType === 'percentage'
        ? parseDecimal(formData.get('maxDiscount'))
        : parseRupiah(formData.get('maxDiscount')),
    minDiscount:
      discountType === 'percentage'
        ? parseDecimal(formData.get('minDiscount'))
        : parseRupiah(formData.get('minDiscount')),
    campaignName: formData.get('campaignName') ?? '',
    startsAt: formData.get('startsAt') ?? '',
    endsAt: formData.get('endsAt') ?? '',
    benefits: formData.getAll('benefits').filter((v): v is string => typeof v === 'string'),
    benefitNote: formData.get('benefitNote') ?? '',
    note: formData.get('note') ?? '',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message
    }
    return { status: 'error', message: 'Periksa kembali isian Anda.', fieldErrors, values: raw }
  }

  const resolved = resolveOffer(parsed.data)
  if (!resolved.ok) {
    return {
      status: 'error',
      message: 'Periksa kembali isian Anda.',
      fieldErrors: resolved.fieldErrors,
      values: raw,
    }
  }

  const offer = resolved.value

  if (intent === 'active') {
    const live = await getDb()
      .select({ id: salesOffers.id })
      .from(salesOffers)
      .where(and(eq(salesOffers.salesId, user.id), eq(salesOffers.status, 'active')))
      .limit(MAX_ACTIVE_OFFERS)

    if (live.length >= MAX_ACTIVE_OFFERS) {
      return {
        status: 'error',
        message: `Maksimal ${MAX_ACTIVE_OFFERS} penawaran aktif. Jeda atau hapus salah satu dulu.`,
        values: raw,
      }
    }
  }

  // One transaction: an offer whose benefits failed to insert would be published
  // advertising nothing, and the unique index on (offer_id, benefit) means a
  // partial insert is a real possibility rather than a theoretical one.
  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(salesOffers)
      .values({
        salesId: user.id,
        brand: offer.brand,
        model: offer.model,
        variant: offer.variant,
        otrPrice: offer.otrPrice,
        maxDiscount: offer.maxDiscount,
        minDiscount: offer.minDiscount,
        discountType: offer.discountType,
        campaignName: offer.campaignName,
        startsAt: offer.startsAt,
        endsAt: offer.endsAt,
        note: offer.note,
        status: intent,
      })
      .returning({ id: salesOffers.id })

    if (offer.benefits.length > 0) {
      await tx
        .insert(offerBenefits)
        .values(offer.benefits.map((b) => ({ offerId: row.id, benefit: b.benefit, note: b.note })))
    }
  })

  revalidatePath('/sales/offers')
  revalidatePath('/sales')

  return {
    status: 'success',
    message:
      intent === 'draft'
        ? 'Tersimpan sebagai draft. Publikasikan kapan saja dari daftar penawaran.'
        : 'Penawaran aktif. Customer yang cocok akan melihatnya.',
  }
}

export type OfferControlState = { status: 'idle' | 'error' | 'success'; message?: string }

/**
 * Pause, resume, or publish a draft.
 *
 * Only these two target states are exposed. `expired` is the cron's to set and
 * `draft` is only ever the state a row is born in — letting the form post either
 * one would let a user un-expire a promo whose end date has passed.
 */
export async function setOfferStatusAction(
  _prev: OfferControlState,
  formData: FormData,
): Promise<OfferControlState> {
  const user = await requireUser('sales')

  const id = uuid.safeParse(formData.get('offerId'))
  const next = z.enum(['active', 'paused']).safeParse(formData.get('status'))
  if (!id.success || !next.success) {
    return { status: 'error', message: 'Perubahan tidak dikenali.' }
  }

  // Scoped by salesId in the WHERE clause, then checked by row count. Without the
  // count, an offerId belonging to someone else matches nothing and still reports
  // success — the user sees "saved" over a change that never happened.
  const updated = await getDb()
    .update(salesOffers)
    .set({ status: next.data, updatedAt: new Date() })
    .where(and(eq(salesOffers.id, id.data), eq(salesOffers.salesId, user.id)))
    .returning({ id: salesOffers.id })

  if (updated.length === 0) {
    return { status: 'error', message: 'Penawaran tidak ditemukan.' }
  }

  revalidatePath('/sales/offers')
  return {
    status: 'success',
    message: next.data === 'paused' ? 'Penawaran dijeda.' : 'Penawaran aktif kembali.',
  }
}

/** Remove an offer. `offer_benefits` cascades on the foreign key. */
export async function deleteOfferAction(
  _prev: OfferControlState,
  formData: FormData,
): Promise<OfferControlState> {
  const user = await requireUser('sales')

  const id = uuid.safeParse(formData.get('offerId'))
  if (!id.success) {
    return { status: 'error', message: 'Penawaran tidak dikenali.' }
  }

  const removed = await getDb()
    .delete(salesOffers)
    .where(and(eq(salesOffers.id, id.data), eq(salesOffers.salesId, user.id)))
    .returning({ id: salesOffers.id })

  if (removed.length === 0) {
    return { status: 'error', message: 'Penawaran tidak ditemukan.' }
  }

  revalidatePath('/sales/offers')
  return { status: 'success', message: 'Penawaran dihapus.' }
}

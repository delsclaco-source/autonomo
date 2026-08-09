'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { leads, leadStatusEnum } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/session'
import { unlockLead } from '@/lib/sales/unlock'

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
    case 'already_unlocked':
      return 'Lead ini sudah Anda buka. Cek di CRM.'
    case 'no_profile':
      return 'Profil sales belum lengkap. Hubungi admin.'
    default:
      return 'Lead sudah tidak tersedia.'
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

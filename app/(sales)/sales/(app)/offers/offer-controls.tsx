'use client'

import { useActionState, useState } from 'react'
import { Loader2, Pause, Play, Trash2 } from 'lucide-react'
import type { OfferStatus } from '@/lib/db/schema'
import { deleteOfferAction, setOfferStatusAction, type OfferControlState } from './actions'

const INITIAL: OfferControlState = { status: 'idle' }

/**
 * Row controls for one offer.
 *
 * Each button is its own form posting to a Server Action, so the row needs no
 * client state that could drift from the database. The server re-checks
 * ownership on every one of them; nothing here is an authorisation boundary.
 *
 * Which controls appear depends on the *displayed* status, which already has the
 * clock applied (`effectiveStatus`). An expired offer gets no resume button —
 * setting it active again would produce a row that reads live and expires on the
 * next cron run. The user extends the end date instead.
 */
export function OfferControls({ offerId, status }: { offerId: string; status: OfferStatus }) {
  const [statusState, statusAction, statusPending] = useActionState(setOfferStatusAction, INITIAL)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteOfferAction, INITIAL)
  const [confirming, setConfirming] = useState(false)

  const pending = statusPending || deletePending
  const error =
    statusState.status === 'error'
      ? statusState.message
      : deleteState.status === 'error'
        ? deleteState.message
        : null

  const canPause = status === 'active'
  const canResume = status === 'paused' || status === 'draft'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(canPause || canResume) && (
        <form action={statusAction}>
          <input type="hidden" name="offerId" value={offerId} />
          <button
            type="submit"
            name="status"
            value={canPause ? 'paused' : 'active'}
            disabled={pending}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-foreground-muted transition-colors duration-200 hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
          >
            {statusPending ? (
              <Loader2 width={13} height={13} className="animate-spin" aria-hidden="true" />
            ) : canPause ? (
              <Pause width={13} height={13} aria-hidden="true" />
            ) : (
              <Play width={13} height={13} aria-hidden="true" />
            )}
            {canPause ? 'Jeda' : status === 'draft' ? 'Publikasikan' : 'Aktifkan'}
          </button>
        </form>
      )}

      {confirming ? (
        <form action={deleteAction} className="flex items-center gap-2">
          <input type="hidden" name="offerId" value={offerId} />
          <span className="text-xs font-medium text-foreground-muted">Hapus penawaran ini?</span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
          >
            {deletePending && (
              <Loader2 width={13} height={13} className="animate-spin" aria-hidden="true" />
            )}
            Ya, hapus
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-9 cursor-pointer px-2 text-xs font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
          >
            Batal
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-foreground-muted transition-colors duration-200 hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <Trash2 width={13} height={13} aria-hidden="true" />
          Hapus
        </button>
      )}

      {error && (
        <span role="alert" className="text-xs font-medium text-primary">
          {error}
        </span>
      )}
    </div>
  )
}

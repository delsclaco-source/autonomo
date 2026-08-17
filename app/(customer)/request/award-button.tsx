'use client'

import { useActionState, useState } from 'react'
import { AlertCircle, CheckCircle2, Gavel, Loader2 } from 'lucide-react'
import { awardAuctionAction, type AwardState } from './actions'

/**
 * Close an auction early and take the leading offer.
 *
 * This is the one destructive control on the customer dashboard, so it arms
 * before it fires. The unlock button on the sales side deliberately has no
 * confirm step — a sales user opens twenty leads in a morning and would click
 * through any dialog — but a customer closes an auction once per request, and
 * what they give up is the rest of the bidding. Two taps is the right price for
 * an action that cannot be undone and that stops other sales users from bidding
 * lower.
 *
 * The armed state is inline rather than a modal: a dialog floating over a list of
 * cards loses track of which card it belongs to, and this button always sits
 * directly under the bids it would accept.
 *
 * `bestPriceLabel` arrives pre-formatted from the server. Importing the rupiah
 * formatter here would pull the whole car catalogue into the client bundle for
 * one string.
 */

const INITIAL: AwardState = { status: 'idle' }

export function AwardButton({
  requestId,
  bestPriceLabel,
  bidCount,
}: {
  requestId: string
  /** The standing best offer — the price this button accepts. */
  bestPriceLabel: string
  bidCount: number
}) {
  const [state, action, pending] = useActionState(awardAuctionAction, INITIAL)
  const [armed, setArmed] = useState(false)

  const done = state.status === 'success'

  return (
    <form action={action} className="mt-3.5 border-t border-dashed border-border pt-3.5">
      <input type="hidden" name="requestId" value={requestId} />

      {!armed && !done && (
        <>
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted sm:w-auto"
          >
            <Gavel width={15} height={15} aria-hidden="true" />
            Tutup lelang sekarang
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
            Menutup lebih awal berarti menerima penawaran terendah saat ini,{' '}
            <span className="tabular font-semibold text-foreground">{bestPriceLabel}</span>. Sales
            lain tidak bisa menawar lebih rendah setelah ini.
          </p>
        </>
      )}

      {armed && !done && (
        <>
          <p className="text-xs font-medium leading-relaxed text-foreground">
            Terima <span className="tabular font-semibold">{bestPriceLabel}</span> dan tutup lelang?
            {bidCount > 1 && ` ${bidCount - 1} penawaran lain akan gugur.`} Tindakan ini tidak bisa
            dibatalkan.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-accent px-5 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <Loader2 width={15} height={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Gavel width={15} height={15} aria-hidden="true" />
              )}
              Ya, tutup lelang
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              disabled={pending}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </>
      )}

      {state.status === 'error' && state.message && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-relaxed text-primary"
        >
          <AlertCircle width={13} height={13} className="mt-px shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      {done && state.message && (
        <p
          role="status"
          className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-foreground"
        >
          <CheckCircle2 width={13} height={13} className="mt-px shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
    </form>
  )
}

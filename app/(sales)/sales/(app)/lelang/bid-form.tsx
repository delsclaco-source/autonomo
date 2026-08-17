'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2, Gavel, Loader2 } from 'lucide-react'
import { bidAction, type BidState } from '../actions'

/**
 * Bid entry for one auction.
 *
 * There is no confirm dialog and no token cost on the button face, because there
 * is no token cost: a bid is paid for in margin, and the only irreversible thing
 * about it is that the price can never go back up. That rule is what the helper
 * text under the field states, in words, before the user commits — a monotonic
 * bid refused after the fact is a worse way to learn it.
 *
 * The field is `inputMode="numeric"` rather than `type="number"`: sales users
 * type prices as "350.000.000", and a number input silently rejects the dots.
 * `parseRupiah` on the server strips every non-digit, so both forms parse.
 *
 * `max` is the advertised floor — this user's own public `max_discount` for the
 * model. Enforced again in `placeBid` under the row lock; the attribute here only
 * saves a round trip.
 */

const INITIAL: BidState = { status: 'idle' }

export function BidForm({
  auctionId,
  myPrice,
  maxPrice,
}: {
  auctionId: string
  /** This user's standing price, or null when they have not bid yet. */
  myPrice: number | null
  /** Highest price still consistent with the discount already advertised. */
  maxPrice: number | null
}) {
  const [state, action, pending] = useActionState(bidAction, INITIAL)

  // A price this user has already beaten cannot be re-offered, so the field's
  // ceiling is their own last bid once one exists.
  const ceiling =
    myPrice !== null && maxPrice !== null ? Math.min(myPrice - 1, maxPrice) : (myPrice ?? maxPrice)

  return (
    <form action={action} className="w-full sm:w-auto">
      <input type="hidden" name="auctionId" value={auctionId} />

      <div className="flex flex-wrap items-stretch gap-2">
        <label className="min-w-0 flex-1 sm:w-52 sm:flex-none">
          <span className="sr-only">Harga penawaran Anda</span>
          <input
            name="price"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder={myPrice !== null ? 'Turunkan harga' : 'Harga penawaran'}
            {...(ceiling !== null && ceiling > 0 ? { max: ceiling } : {})}
            className="tabular h-11 w-full rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors duration-200 placeholder:font-normal placeholder:text-foreground-muted focus:border-foreground focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2 width={15} height={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Gavel width={15} height={15} aria-hidden="true" />
          )}
          {myPrice !== null ? 'Turunkan' : 'Tawar'}
        </button>
      </div>

      {state.status === 'idle' && (
        <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
          Gratis, tanpa token. Penawaran hanya bisa diturunkan.
        </p>
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

      {state.status === 'success' && state.message && (
        <p
          role="status"
          className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-relaxed text-foreground"
        >
          <CheckCircle2 width={13} height={13} className="mt-px shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
    </form>
  )
}

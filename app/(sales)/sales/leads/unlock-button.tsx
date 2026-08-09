'use client'

import { useActionState } from 'react'
import { AlertCircle, Loader2, LockOpen } from 'lucide-react'
import { unlockLeadAction, type UnlockState } from '../actions'

const INITIAL: UnlockState = { status: 'idle' }

/**
 * Unlock button.
 *
 * Spending tokens is irreversible, so the cost is on the button face rather than
 * behind a confirmation dialog — a sales user unlocking twenty leads in a morning
 * will click through a dialog without reading it, but a price they can see before
 * tapping is a price they actually weigh.
 *
 * When the balance is short the button becomes a link to top-up instead of a
 * disabled control. A dead button with no next step is where this screen would
 * otherwise strand people.
 */
export function UnlockButton({
  requestId,
  tokenCost,
  balance,
  quotaReached,
}: {
  requestId: string
  tokenCost: number
  balance: number
  quotaReached: boolean
}) {
  const [state, action, pending] = useActionState(unlockLeadAction, INITIAL)

  const short = balance < tokenCost

  if (short) {
    return (
      <a
        href="/topup"
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 px-4 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/5 sm:w-auto"
      >
        Kurang {tokenCost - balance} token — top up
      </a>
    )
  }

  return (
    <form action={action} className="w-full sm:w-auto">
      <input type="hidden" name="requestId" value={requestId} />

      <button
        type="submit"
        disabled={pending || quotaReached || state.status === 'success'}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? (
          <Loader2 width={15} height={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <LockOpen width={15} height={15} aria-hidden="true" />
        )}
        {state.status === 'success' ? 'Terbuka' : `Buka kontak · ${tokenCost} token`}
      </button>

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
        <p className="mt-2 text-xs font-medium leading-relaxed text-foreground-muted">
          {state.message}{' '}
          <a href="/crm" className="font-semibold text-primary underline">
            Buka CRM
          </a>
        </p>
      )}
    </form>
  )
}

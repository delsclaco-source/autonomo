'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Loader2, MessageCircle } from 'lucide-react'
import {
  requestOtpAction,
  verifyOtpAction,
  type SendState,
  type VerifyState,
} from './actions'
import { OTP_RESEND_COOLDOWN_SECONDS } from '@/lib/auth/otp-shared'

/**
 * Two-step WhatsApp OTP form.
 *
 * The step is latched, not derived. Deriving it straight from
 * `sendState.status === 'sent'` looked cleaner but broke resend: a resend that
 * fails returns `status: 'error'`, which flipped the whole subtree back to the
 * phone screen, unmounting the code field and discarding the digits the user had
 * already typed from a message that had in fact arrived. Once a code has been
 * sent, this form stays on the verify step and shows resend failures inline.
 *
 * Both steps remain plain `<form action={…}>` submissions, so the flow works
 * while JavaScript is still loading.
 */

const sendInitial: SendState = { status: 'idle' }
const verifyInitial: VerifyState = { status: 'idle' }

type SentPayload = { phone: string; masked: string; devCode?: string; sentAt: number }

export function LoginForm({ next }: { next: string | null }) {
  const [sendState, sendAction, sending] = useActionState(requestOtpAction, sendInitial)

  // Last successful send. Survives a subsequent failed resend, which is the
  // entire point — that state is what keeps the user on the verify step.
  const [sent, setSent] = useState<SentPayload | null>(null)

  // Adjusted during render, not in an effect. React re-runs this component
  // immediately with the new state and never commits the intermediate output, so
  // there is no extra paint and no cascading-render lint warning — the
  // documented way to derive state from changed input.
  if (sendState.status === 'sent' && sendState.sentAt !== sent?.sentAt) {
    setSent({
      phone: sendState.phone,
      masked: sendState.masked,
      devCode: sendState.devCode,
      sentAt: sendState.sentAt,
    })
  }

  if (sent) {
    return (
      <VerifyStep
        // Remount per send. A fresh code makes the previously typed digits stale,
        // so clearing the field is correct, and the remount re-arms the resend
        // cooldown and re-focuses the input without a single effect.
        key={sent.sentAt}
        phone={sent.phone}
        masked={sent.masked}
        devCode={sent.devCode}
        next={next}
        sendAction={sendAction}
        sending={sending}
        resendError={sendState.status === 'error' ? sendState.message : null}
      />
    )
  }

  return (
    <form action={sendAction} className="mt-8 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-foreground">
          Nomor WhatsApp
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="08123456789"
          required
          defaultValue={sendState.status === 'error' ? sendState.phone : ''}
          aria-invalid={sendState.status === 'error'}
          aria-describedby="phone-hint"
          className="tabular mt-2 block min-h-12 w-full rounded-md border border-border bg-background px-4 py-3 text-base text-foreground transition-colors duration-200 placeholder:text-foreground-muted focus:border-primary focus:outline-none"
        />
        {sendState.status === 'error' ? (
          <FieldError>{sendState.message}</FieldError>
        ) : (
          <p id="phone-hint" className="mt-2 flex items-center gap-1.5 text-xs text-foreground-muted">
            <MessageCircle width={12} height={12} aria-hidden="true" />
            Kode verifikasi dikirim ke WhatsApp, bukan SMS.
          </p>
        )}
      </div>

      <SubmitButton pending={sending} label="Kirim kode" pendingLabel="Mengirim kode…" />

      <p className="text-center text-xs text-foreground-muted">
        Belum punya akun? Nomor baru otomatis terdaftar saat verifikasi.
      </p>
    </form>
  )
}

/**
 * Verify step. Mounted per send — the parent keys it on the send timestamp.
 *
 * That remount is what re-arms the cooldown below. Before, the initial value was
 * the only thing that ever set it, so after one resend the button stayed enabled
 * and every further press hit the server-side cooldown and came back as an error
 * the user could not act on.
 */
function VerifyStep({
  phone,
  masked,
  devCode,
  next,
  sendAction,
  sending,
  resendError,
}: {
  phone: string
  masked: string
  devCode?: string
  next: string | null
  sendAction: (formData: FormData) => void
  sending: boolean
  resendError: string | null
}) {
  const [verifyState, verifyAction, verifying] = useActionState(verifyOtpAction, verifyInitial)
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS)
  const codeRef = useRef<HTMLInputElement>(null)

  // Focus the code field on arrival: the user has just switched to WhatsApp and
  // back, and the only thing left to do here is type six digits.
  useEffect(() => {
    codeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  return (
    <div className="mt-8 space-y-5">
      <p className="text-sm text-foreground-muted">
        Kode 6 digit dikirim ke{' '}
        <span className="tabular font-semibold text-foreground">{masked}</span>. Cek WhatsApp Anda.
      </p>

      {devCode && (
        <p className="rounded-md border border-border bg-muted px-3.5 py-2.5 text-xs text-foreground">
          Mode pengembangan — gateway WhatsApp belum diisi. Kode:{' '}
          <span className="tabular font-bold">{devCode}</span>
        </p>
      )}

      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="phone" value={phone} />
        {next && <input type="hidden" name="next" value={next} />}

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-foreground">
            Kode verifikasi
          </label>
          <input
            ref={codeRef}
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="000000"
            required
            aria-invalid={verifyState.status === 'error'}
            className="tabular mt-2 block min-h-14 w-full rounded-md border border-border bg-background px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-foreground transition-colors duration-200 placeholder:font-normal placeholder:tracking-[0.4em] placeholder:text-border focus:border-primary focus:outline-none"
          />
          {verifyState.status === 'error' && <FieldError>{verifyState.message}</FieldError>}
        </div>

        <SubmitButton pending={verifying} label="Verifikasi & masuk" pendingLabel="Memverifikasi…" />
      </form>

      <div className="space-y-3 border-t border-border pt-4">
        {resendError && <FieldError>{resendError}</FieldError>}

        <div className="flex items-center justify-between gap-3">
          {/* Resend re-runs the send action. On success the parent updates
              `sentAt` and the cooldown re-arms; on failure the message lands
              above and the typed code stays exactly where it is. */}
          <form action={sendAction}>
            <input type="hidden" name="phone" value={phone} />
            {next && <input type="hidden" name="next" value={next} />}
            <button
              type="submit"
              disabled={cooldown > 0 || sending}
              className="text-sm font-semibold text-primary transition-opacity duration-200 hover:opacity-70 disabled:cursor-not-allowed disabled:text-foreground-muted disabled:opacity-100"
            >
              {sending
                ? 'Mengirim…'
                : cooldown > 0
                  ? `Kirim ulang (${cooldown}s)`
                  : 'Kirim ulang kode'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
          >
            <ArrowLeft width={14} height={14} aria-hidden="true" />
            Ganti nomor
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean
  label: string
  pendingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-6 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 width={16} height={16} className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  )
}

/** Errors carry an icon as well as the colour — the brand colour is also red. */
function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-primary">
      <AlertCircle width={13} height={13} className="mt-px shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

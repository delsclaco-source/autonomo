'use client'

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, Search, Send } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { BODY_TYPES, BRANDS, type BodyType, formatRupiah } from '@/lib/data/catalog'
import {
  BUYER_TYPES,
  DISCOUNT_BANDS,
  PAYMENT_SCHEMES,
  TIMEFRAMES,
} from '@/lib/validation/request'
import { OTP_CODE_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from '@/lib/auth/otp-shared'
import {
  sendRequestOtp,
  submitRequest,
  verifyRequestOtp,
  type RequestValues,
  type SendState,
  type SubmitState,
  type VerifyState,
} from './actions'

/**
 * Hero request card — the only interactive surface the customer area has.
 *
 * One form, one screen, start to finish: name a car, say how much discount you
 * want off it, press the button in the phone field, type the code into the field
 * right under it, press "Verifikasi", then press "Kirim request". There is no
 * customer login, no second page, and no step swap — the car controls stay on
 * screen and stay editable throughout, so nothing already answered leaves view.
 *
 * **Three actions, one `<form>`.** Sending the code is the form's default submit;
 * "Verifikasi" and "Kirim request" carry `formAction`, so all three receive the same
 * FormData without nesting forms, which HTML forbids. None of them inherits another's
 * approval: each re-reads and re-checks what it uses.
 *
 * **Verification is its own step, and its result lives on the server.** Pressing
 * "Verifikasi" checks the code and hands back an opaque ticket; pressing "Kirim"
 * redeems it. The ticket is the only thing that authorises the write, and the server
 * reads *whose* request it is out of the ticket rather than out of the phone field —
 * so a tampered payload cannot file a request under a number it never proved. Nothing
 * on this side marks itself verified in a way the server believes.
 *
 * **The two fields are the same field twice.** Same 56px height, same 144px of right
 * padding, same 44px button pinned inside the right edge — the number and its code
 * are one decision made twice, so they read as one control repeated rather than as
 * two unrelated widgets. The second button says "Verifikasi", and once it succeeds it
 * becomes a static badge on the number it proved.
 *
 * **Verified state is derived from the number, not latched.** A ticket belongs to the
 * number it was issued for, so the badge and the enabled "Kirim" button show only
 * while the typed number still matches the verified one. Editing the number drops
 * both and puts "Dapatkan OTP" back — the cost of a stray keystroke is one more
 * gateway call, and the alternative failure is a form claiming a number is verified
 * while the request goes to a different one.
 *
 * **The discount is a picked range, not a typed number.** Six fixed bands in
 * rupiah, because a buyer knows they want "twenty-five to forty million off" and
 * does not know what Rp 312.500.000 means. A free-text price field asked them to
 * invent precision they do not have, and every invented figure lands in
 * `requests` as if it were a real intention. The server converts the band's lower
 * bound into `target_price`; see `resolveRequestFromBand`.
 *
 * **Jenis is a narrowing control, not a request field.** It shortens the model
 * list and is then dropped — `requests` has no body-type column, and the
 * catalogue already knows the body type of whichever model gets picked.
 *
 * **Two preferences are optional in the strong sense.** Purpose and payment
 * scheme can both be left alone and the request still submits, auctions and gets
 * unlocked. They are here because a dealer treats a fleet purchase and a leasing
 * deal as different work, so a sales user reads them to price their own effort —
 * and they are deliberately outside every price path this app computes, so
 * answering "corporate" cannot make a lead cheaper to unlock. An untouched select
 * posts `''`, which the server stores as NULL rather than as an empty string.
 *
 * Brand and model travel as catalogue **slugs**, never display names: `findModel`
 * and `resolveTier` key on slug, and so do the stored columns.
 *
 * Every control is a plain form submission, and the selects write their value into
 * hidden inputs rather than relying on the Radix hidden-select bridge, so the
 * payload is exactly the fields the actions read.
 *
 * The card is opaque on purpose. The landing page puts its one `backdrop-blur`
 * pane behind this element as a sibling, so the glass reads as a halo around the
 * card rather than as a layer between a finger and a control.
 */

const sendInitial: SendState = { status: 'idle' }
const verifyInitial: VerifyState = { status: 'idle' }
const submitInitial: SubmitState = { status: 'idle' }

const TRIGGER = 'h-12 w-full text-sm font-medium'

/** Both text fields, so the number and its code are visibly the same control. */
const FIELD = 'tabular h-14 pr-36 text-sm font-semibold'
/** Button pinned inside a `FIELD`. 44px tall, the tap floor from design.md §5.1. */
const INSET_BUTTON =
  'absolute right-1.5 top-1.5 inline-flex h-11 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-semibold transition-colors duration-200'

type SentPayload = {
  masked: string
  devCode?: string
  sentAt: number
  values: RequestValues
}

/** The one `VerifyState` member that carries a ticket. */
type Verified = Extract<VerifyState, { status: 'verified' }>

export function RequestCard({
  initialBrand = '',
  initialModel = '',
}: {
  initialBrand?: string
  initialModel?: string
}) {
  const [sendState, sendAction, sending] = useActionState(sendRequestOtp, sendInitial)
  const [verifyState, verifyAction, verifying] = useActionState(verifyRequestOtp, verifyInitial)
  const [submitState, submitAction, submitting] = useActionState(submitRequest, submitInitial)

  // Last successful send. Survives a subsequent failed resend, which is the
  // entire point — a failed resend must not take the code field off screen while
  // the buyer holds a code that did arrive.
  const [sent, setSent] = useState<SentPayload | null>(null)

  // Adjusted during render, not in an effect. React re-runs this component
  // immediately with the new state and never commits the intermediate output, so
  // there is no extra paint and no cascading-render warning.
  if (sendState.status === 'sent' && sendState.sentAt !== sent?.sentAt) {
    setSent({
      masked: sendState.masked,
      devCode: sendState.devCode,
      sentAt: sendState.sentAt,
      values: sendState.values,
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      {submitState.status === 'success' && sent ? (
        <Submitted masked={sent.masked} message={submitState.message} />
      ) : (
        <RequestForm
          sendState={sendState}
          sendAction={sendAction}
          sending={sending}
          verifyState={verifyState}
          verifyAction={verifyAction}
          verifying={verifying}
          submitState={submitState}
          submitAction={submitAction}
          submitting={submitting}
          sent={sent}
          initialBrand={initialBrand}
          initialModel={initialModel}
        />
      )}
    </div>
  )
}

function RequestForm({
  sendState,
  sendAction,
  sending,
  verifyState,
  verifyAction,
  verifying,
  submitState,
  submitAction,
  submitting,
  sent,
  initialBrand,
  initialModel,
}: {
  sendState: SendState
  sendAction: (formData: FormData) => void
  sending: boolean
  verifyState: VerifyState
  verifyAction: (formData: FormData) => void
  verifying: boolean
  submitState: SubmitState
  submitAction: (formData: FormData) => void
  submitting: boolean
  sent: SentPayload | null
  initialBrand: string
  initialModel: string
}) {
  const echoed = sendState.status === 'error' ? sendState.values : null
  const fieldErrors = sendState.status === 'error' ? sendState.fieldErrors : undefined

  // Seeded from the promo cards, which link back here with `?brand=&model=`.
  // Slugs throughout — the selects, the seed and the payload all speak slug, so
  // there is no name/slug conversion anywhere on the way to the action.
  const [brandSlug, setBrandSlug] = useState(initialBrand)
  const [bodyType, setBodyType] = useState<BodyType | ''>('')
  const [modelSlug, setModelSlug] = useState(initialModel)
  const [discountBand, setDiscountBand] = useState(echoed?.discountBand ?? '')
  const [timeframe, setTimeframe] = useState(echoed?.timeframe ?? '')
  // Optional, so `''` is a valid final answer and not an unfilled field.
  const [buyerType, setBuyerType] = useState(echoed?.buyerType ?? '')
  const [paymentScheme, setPaymentScheme] = useState(echoed?.paymentScheme ?? '')
  const [phone, setPhone] = useState(echoed?.phone ?? '')

  // A ticket proves one number. Comparing against the number the server echoed
  // back means an edit drops the verified state instead of leaving a badge next to
  // a number that never received the call.
  const verified: Verified | null =
    verifyState.status === 'verified' && phone.trim() === verifyState.phone.trim()
      ? verifyState
      : null

  const brand = useMemo(() => BRANDS.find((b) => b.slug === brandSlug), [brandSlug])

  const models = useMemo(() => {
    if (!brand) return []
    return bodyType ? brand.models.filter((m) => m.bodyType === bodyType) : brand.models
  }, [brand, bodyType])

  const model = useMemo(() => models.find((m) => m.slug === modelSlug), [models, modelSlug])

  const bodyLabel = BODY_TYPES.find((b) => b.value === bodyType)?.label

  /** Nothing matches, so the model select has nothing to offer. */
  const noMatch = Boolean(brand && bodyType && models.length === 0)

  const modelPlaceholder = !brand
    ? 'Pilih brand dulu'
    : noMatch
      ? `Tidak ada ${bodyLabel} di ${brand.name}`
      : 'Pilih model'

  return (
    <form action={sendAction}>
      {/* The payload. Written from state rather than from the Radix selects, so
          what the action receives is exactly these names. Brand and model are read
          off the resolved catalogue objects, so a bogus `?brand=` in the URL posts
          nothing and gets "Pilih brand mobil" rather than "Model tidak ada di
          katalog". `phone` and `code` are real inputs and carry their own names. */}
      <input type="hidden" name="brand" value={brand?.slug ?? ''} />
      <input type="hidden" name="model" value={model?.slug ?? ''} />
      <input type="hidden" name="discountBand" value={discountBand} />
      <input type="hidden" name="timeframe" value={timeframe} />
      <input type="hidden" name="buyerType" value={buyerType} />
      <input type="hidden" name="paymentScheme" value={paymentScheme} />
      {/* Empty until a code checks out. Holds no number and no role: the server
          resolves the customer id from this handle, which is what stops a doctored
          payload filing a request under a number it never proved. */}
      <input type="hidden" name="ticket" value={verified?.ticket ?? ''} />

      <div className="flex items-center justify-between gap-3 border-b border-border pb-3.5">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
          Mulai pencarian
        </h2>
        <Search width={17} height={17} className="shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-4 space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field id="hero-brand" label="Merk mobil" error={fieldErrors?.brand}>
            <Select
              value={brandSlug}
              onValueChange={(v) => {
                setBrandSlug(v ?? '')
                setModelSlug('')
              }}
            >
              <SelectTrigger id="hero-brand" className={TRIGGER}>
                <SelectValue placeholder="Pilih merk" />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {b.name}
                    {b.electric && (
                      <span className="ml-1.5 text-[11px] font-semibold text-primary">EV</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="hero-jenis" label="Jenis mobil">
            <Select
              value={bodyType}
              onValueChange={(v) => {
                const next = (v ?? '') as BodyType | ''
                setBodyType(next)
                // A model that no longer fits the new body type must not stay
                // selected — it would submit a car the buyer just filtered out.
                if (next && model && model.bodyType !== next) setModelSlug('')
              }}
            >
              <SelectTrigger id="hero-jenis" className={TRIGGER}>
                <SelectValue placeholder="Semua jenis" />
              </SelectTrigger>
              <SelectContent>
                {BODY_TYPES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field id="hero-model" label="Model" error={fieldErrors?.model}>
          <Select
            value={modelSlug}
            onValueChange={(v) => setModelSlug(v ?? '')}
            disabled={!brand || noMatch}
          >
            <SelectTrigger id="hero-model" className={TRIGGER}>
              <SelectValue placeholder={modelPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.slug} value={m.slug}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {/* A range, not a figure. Every band is offered on every car and none
              is ever refused — a buyer asking Rp150 jt off a Rp139 jt car is
              still a buyer, and whether that ask is worth answering is the sales
              side's call. The server clamps the derived target price at zero and
              routes an implausible ask into the token pool instead of the
              auction; see `resolveRequestFromBand`. */}
          <Field
            id="hero-discount"
            label="Diskon yang Anda mau"
            error={fieldErrors?.discountBand}
          >
            <Select value={discountBand} onValueChange={(v) => setDiscountBand(v ?? '')}>
              <SelectTrigger id="hero-discount" className={TRIGGER}>
                <SelectValue placeholder="Pilih rentang diskon" />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_BANDS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Real product data, not a default. Purchase urgency is what a sales
              user reads to decide whether a lead is worth tokens, so guessing it
              would either devalue every request or inflate every request. */}
          <Field id="hero-timeframe" label="Rencana beli" error={fieldErrors?.timeframe}>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v ?? '')}>
              <SelectTrigger id="hero-timeframe" className={TRIGGER}>
                <SelectValue placeholder="Pilih rencana" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Optional, and labelled as such. Both narrow what kind of deal this is
            for the sales user who reads the lead; neither reaches `tier`, the
            unlock cost or the fraud flag, so nothing here is worth lying about. */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field id="hero-buyer-type" label="Tujuan pembelian (opsional)">
            <Select value={buyerType} onValueChange={(v) => setBuyerType(v ?? '')}>
              <SelectTrigger id="hero-buyer-type" className={TRIGGER}>
                <SelectValue placeholder="Pilih tujuan" />
              </SelectTrigger>
              <SelectContent>
                {BUYER_TYPES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="hero-payment" label="Skema pembayaran (opsional)">
            <Select value={paymentScheme} onValueChange={(v) => setPaymentScheme(v ?? '')}>
              <SelectTrigger id="hero-payment" className={TRIGGER}>
                <SelectValue placeholder="Pilih skema" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_SCHEMES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Phone field, code field and both of their inline buttons live in one
            keyed child. The key is the send timestamp, so a new code remounts the
            section — that is what re-arms the resend countdown and clears stale
            digits, without an effect that resets state on a changed prop. `phone`
            stays up here, so the remount does not blank what the buyer typed. */}
        <VerifySection
          key={sent?.sentAt ?? 0}
          phone={phone}
          onPhoneChange={setPhone}
          phoneError={fieldErrors?.phone}
          sent={sent}
          sending={sending}
          verifyState={verifyState}
          verifyAction={verifyAction}
          verifying={verifying}
          verified={verified}
        />

        {sendState.status === 'error' && !sendState.fieldErrors && (
          <FieldError>{sendState.message}</FieldError>
        )}
      </div>

      {submitState.status === 'error' && <FieldError>{submitState.message}</FieldError>}

      {/* The last press. Disabled rather than hidden before verification, so the
          shape of the flow is visible from the start: the request goes out here,
          after the number is proved, and not as a side effect of proving it. */}
      <button
        type="submit"
        formAction={submitAction}
        disabled={!verified || submitting}
        className="mt-4 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-6 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 width={16} height={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Send width={16} height={16} aria-hidden="true" />
        )}
        {submitting ? 'Mengirim request…' : 'Kirim request'}
      </button>

      <p className="mt-3.5 flex items-start gap-1.5 text-xs text-foreground-muted">
        <MessageCircle width={12} height={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        {!verified
          ? 'Verifikasi nomor WhatsApp dulu, lalu tombol Kirim request aktif. Kode dikirim ke WhatsApp, bukan SMS.'
          : model
            ? `Harga OTR ${brand?.name} ${model.name}: ${formatRupiah(model.priceFrom)}. Nomor Anda hanya terbuka ke sales yang menang lelang.`
            : 'Nomor Anda hanya terbuka ke sales yang menang lelang.'}
      </p>
    </form>
  )
}

/**
 * The number, the code, and the two buttons that act on them.
 *
 * Remounted per send (see the `key` at the call site), which is where the resend
 * countdown gets its starting value — mount-time initial state rather than an
 * effect that watches a timestamp. The only effects here are a timer and a focus
 * call, both of which are what effects are actually for.
 */
function VerifySection({
  phone,
  onPhoneChange,
  phoneError,
  sent,
  sending,
  verifyState,
  verifyAction,
  verifying,
  verified,
}: {
  phone: string
  onPhoneChange: (value: string) => void
  phoneError?: string
  sent: SentPayload | null
  sending: boolean
  verifyState: VerifyState
  verifyAction: (formData: FormData) => void
  verifying: boolean
  verified: Verified | null
}) {
  // Counts from the mount that a fresh code caused. `sentAt` is a *server* clock
  // reading and is deliberately never subtracted from the client clock — that
  // difference measures skew, not seconds.
  const [cooldown, setCooldown] = useState(sent ? OTP_RESEND_COOLDOWN_SECONDS : 0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  // Null on the first mount, when there is no code field to focus yet.
  useEffect(() => {
    codeRef.current?.focus()
  }, [])

  // A code is only good for the number it went to. Comparing the raw strings
  // means any edit at all re-arms the send button, which is the safe direction:
  // showing a code field for a number that never received one is the failure
  // worth avoiding, and a needless resend costs one gateway call.
  const armed = sent !== null && phone.trim() === sent.values.phone.trim()

  /** Verifying is done; there is nothing left to type or resend. */
  const done = verified !== null

  return (
    <>
      {/* The form's default submit, sitting in the field it acts on. `pr-36`
          keeps 144px clear so a typed number never runs under the button. The
          cooldown only disables it while the code belongs to the number on
          screen — a different number is a different Redis key and can be asked at
          once. Once verified the button becomes a badge: resending a code for a
          number already proved would only throw away the proof. */}
      <Field id="hero-phone" label="Nomor WhatsApp" error={phoneError}>
        <div className="relative">
          <Input
            id="hero-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="08123456789"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className={FIELD}
          />
          {done ? (
            <span
              className={`${INSET_BUTTON} bg-success/10 text-success`}
              // Announced as status rather than as a control: there is nothing to
              // press, and the badge appears after an action the buyer took.
              role="status"
            >
              <CheckCircle2 width={14} height={14} aria-hidden="true" />
              Terverifikasi
            </span>
          ) : (
            <button
              type="submit"
              disabled={sending || (armed && cooldown > 0)}
              className={`${INSET_BUTTON} cursor-pointer bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {sending && (
                <Loader2 width={14} height={14} className="animate-spin" aria-hidden="true" />
              )}
              {sending ? 'Mengirim…' : armed ? 'Kirim ulang' : 'Dapatkan OTP'}
            </button>
          )}
        </div>
      </Field>

      {armed && sent && !done && (
        <>
          {/* Same geometry as the number above, deliberately: one control shape
              used twice, with the second button doing the checking. No `required`
              and no `pattern` — this input shares a form with the send action, so
              a browser validation rule here would block "Kirim ulang" while the
              field is still empty. Length is checked server-side, where it has to
              be checked anyway. */}
          <Field
            id="hero-code"
            label={`Kode verifikasi (${OTP_CODE_LENGTH} digit)`}
            error={verifyState.status === 'error' ? verifyState.message : undefined}
          >
            <div className="relative">
              <Input
                ref={codeRef}
                id="hero-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_CODE_LENGTH}
                placeholder="000000"
                aria-invalid={verifyState.status === 'error'}
                onKeyDown={(e) => {
                  // Implicit submission picks the first submit button in the
                  // form, which is the send button inside the phone field. Enter
                  // here has to verify instead of quietly firing off another code.
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const form = e.currentTarget.form
                  if (form) verifyAction(new FormData(form))
                }}
                className={`${FIELD} tracking-[0.3em]`}
              />
              <button
                type="submit"
                formAction={verifyAction}
                disabled={verifying}
                className={`${INSET_BUTTON} cursor-pointer bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {verifying && (
                  <Loader2 width={14} height={14} className="animate-spin" aria-hidden="true" />
                )}
                {verifying ? 'Memeriksa…' : 'Verifikasi'}
              </button>
            </div>
          </Field>

          <p className="text-xs text-foreground-muted">
            Kode dikirim ke{' '}
            <span className="tabular font-semibold text-foreground">{sent.masked}</span>.{' '}
            {cooldown > 0
              ? `Belum sampai? Kirim ulang bisa dalam ${cooldown} detik.`
              : 'Belum sampai? Tekan “Kirim ulang” di kolom nomor, atau perbaiki nomornya.'}
          </p>

          {sent.devCode && (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
              Mode prototipe — pengiriman WhatsApp belum aktif, kode ditampilkan di sini. Kode:{' '}
              <span className="tabular font-bold">{sent.devCode}</span>
            </p>
          )}
        </>
      )}

      {done && (
        <p className="flex items-start gap-1.5 text-xs text-success">
          <CheckCircle2 width={13} height={13} className="mt-px shrink-0" aria-hidden="true" />
          Nomor <span className="tabular font-semibold">{verified.masked}</span> terverifikasi.
          Tekan “Kirim request” untuk mengirim.
        </p>
      )}
    </>
  )
}

/** Terminal state. The form is gone because there is nothing left to edit. */
function Submitted({ masked, message }: { masked: string; message: string }) {
  return (
    <div className="py-2 text-center">
      <CheckCircle2 width={36} height={36} className="mx-auto text-success" aria-hidden="true" />
      <h2 className="mt-3.5 font-heading text-lg font-semibold tracking-tight text-foreground">
        Request terkirim
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{message}</p>
      <p className="mt-4 border-t border-border pt-4 text-xs text-foreground-muted">
        Tidak perlu menunggu di halaman ini — sales menghubungi Anda lewat WhatsApp di{' '}
        <span className="tabular font-semibold text-foreground">{masked}</span>.
      </p>
    </div>
  )
}

/**
 * Label above control, per design.md §5.4. A component rather than eight copies of
 * the same wrapper: the label class stack is the thing that has to stay identical
 * across the fields.
 */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

/** Errors carry an icon as well as the colour — the brand colour is also red. */
function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-secondary">
      <AlertCircle width={13} height={13} className="mt-px shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

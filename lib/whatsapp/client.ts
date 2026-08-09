import 'server-only'

/**
 * WhatsApp message gateway.
 *
 * The provider is a self-hosted WhatsApp gateway that accepts a multipart POST
 * with `appkey`, `authkey`, `to`, and `message`. Both keys are secrets and live
 * only in the environment — a gateway key in the repo is a key someone else can
 * use to send messages from the brand's own WhatsApp number.
 *
 * Timeout policy is the point of this module. A gateway like this sits in front
 * of a real WhatsApp session and can stall for a minute or more when that session
 * is reconnecting. A login Server Action that inherits that stall burns the whole
 * serverless function budget and returns nothing, so:
 *
 *   - every attempt carries its own AbortSignal deadline (`REQUEST_TIMEOUT_MS`);
 *   - a timeout or 5xx is retried once, because these gateways drop the first
 *     request after an idle period far more often than they are truly down;
 *   - the total worst case (two attempts plus the gap) stays inside the
 *     `maxDuration` declared on the login route, so the caller always gets a
 *     usable answer instead of a platform-level 504.
 *
 * A 4xx is never retried: bad credentials or a malformed number will fail again
 * identically, and retrying only doubles the latency the user waits through.
 */

const DEFAULT_ENDPOINT = 'https://nagariku.fun/api/create-message'

/** Per-attempt deadline. Two attempts plus the gap must fit the route's maxDuration. */
const REQUEST_TIMEOUT_MS = 7_000
const RETRY_DELAY_MS = 500
const MAX_ATTEMPTS = 2

export type SendFailure = 'not_configured' | 'timeout' | 'rejected' | 'network'

export type SendResult = { ok: true } | { ok: false; reason: SendFailure; detail?: string }

type GatewayConfig = { url: string; appKey: string; authKey: string }

function config(): GatewayConfig | null {
  const appKey = process.env.WHATSAPP_APP_KEY
  const authKey = process.env.WHATSAPP_AUTH_KEY
  if (!appKey || !authKey) return null
  return {
    url: process.env.WHATSAPP_API_URL || DEFAULT_ENDPOINT,
    appKey,
    authKey,
  }
}

/** True when the gateway credentials are present. */
export function isWhatsappConfigured(): boolean {
  return config() !== null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Send one WhatsApp message. Never throws — the caller decides what a failure
 * means for the user-facing flow.
 *
 * `to` must already be canonical (`628…`); normalisation belongs to the caller so
 * that the number stored, rate-limited, and messaged is provably the same string.
 */
export async function sendWhatsappMessage(to: string, message: string): Promise<SendResult> {
  const cfg = config()
  if (!cfg) return { ok: false, reason: 'not_configured' }

  let last: SendResult = { ok: false, reason: 'network' }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const body = new FormData()
    body.set('appkey', cfg.appKey)
    body.set('authkey', cfg.authKey)
    body.set('to', to)
    body.set('message', message)

    try {
      const response = await fetch(cfg.url, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      })

      if (response.ok) {
        // The gateway answers 200 even for some application-level rejections, so
        // the body is inspected too. It is read with a cap because an HTML error
        // page from a misconfigured proxy can be arbitrarily large.
        const text = (await response.text()).slice(0, 2_000)
        if (isRejection(text)) {
          return { ok: false, reason: 'rejected', detail: text.slice(0, 200) }
        }
        return { ok: true }
      }

      if (response.status >= 500) {
        last = { ok: false, reason: 'network', detail: `HTTP ${response.status}` }
      } else {
        // 4xx: credentials or payload are wrong. Retrying cannot help.
        return { ok: false, reason: 'rejected', detail: `HTTP ${response.status}` }
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      last =
        name === 'TimeoutError' || name === 'AbortError'
          ? { ok: false, reason: 'timeout' }
          : { ok: false, reason: 'network', detail: error instanceof Error ? error.message : '' }
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS)
  }

  return last
}

/** Field names this gateway family uses to report an application-level verdict. */
const STATUS_FIELDS = ['status', 'success', 'sent', 'message_status'] as const
const ERROR_FIELDS = ['error', 'errors', 'error_message', 'message_error'] as const

/**
 * Whether a 2xx body reports an application-level rejection.
 *
 * Requires a *positive* signal of failure. The previous version asked the
 * opposite question — does this body contain the word "error", "failed", or
 * "invalid" anywhere — which matched `{"error":null}` and `{"status":"sent",
 * "error":""}`, both of which are successes. The consequence was the worst kind
 * of auth bug: the gateway delivered the message, this function called it a
 * rejection, `sendOtp` returned before persisting, and the code sitting in the
 * user's WhatsApp could never be verified. Nobody could log in.
 *
 * Unrecognised shapes resolve to "not rejected". A delivered message we fail to
 * classify costs one confusing log line; an undelivered one we call successful
 * costs the user a resend they were going to do anyway. Silently discarding a
 * code that *was* delivered is the only outcome with no recovery path.
 */
function isRejection(body: string): boolean {
  const trimmed = body.trim()
  if (!trimmed) return false

  const parsed = parseJson(trimmed)
  if (parsed) return jsonRejects(parsed)

  // Non-JSON (HTML error page, plain text). Only unambiguous phrases count —
  // a bare "error" can appear in markup unrelated to this send.
  const lower = trimmed.toLowerCase()
  return (
    lower.includes('not authorized') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid appkey') ||
    lower.includes('invalid authkey') ||
    lower.includes('invalid number') ||
    lower.includes('failed to send')
  )
}

function parseJson(text: string): Record<string, unknown> | null {
  if (!text.startsWith('{') && !text.startsWith('[')) return null
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function jsonRejects(body: Record<string, unknown>): boolean {
  for (const field of STATUS_FIELDS) {
    if (!(field in body)) continue
    const value = body[field]
    if (value === false) return true
    if (typeof value === 'string') {
      const v = value.toLowerCase()
      // Only an explicit negative word rejects. Anything else — including
      // "success", "sent", "queued", or a message id — is accepted.
      if (v === 'false' || v === 'error' || v === 'failed' || v === 'failure') return true
    }
  }

  for (const field of ERROR_FIELDS) {
    if (!(field in body)) continue
    const value = body[field]
    // `null`, `""`, `[]`, and `0` are all "no error" — the exact values the old
    // substring match misread as failures.
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    if (value === false || value === 0) continue
    return true
  }

  return false
}

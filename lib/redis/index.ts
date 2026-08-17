import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { serverEnv } from '@/lib/env'

/**
 * Redis client and shared rate limiters.
 *
 * Used for OTP send throttling, Top 5/10 discount ranking cache, and payment
 * webhook idempotency keys. Lazy so `next build` does not require credentials.
 */

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    // Validate before constructing. `Redis.fromEnv()` throws its own error on a
    // missing variable, but only names the one it happened to read first;
    // `serverEnv()` reports every missing key at once, which is the difference
    // between one redeploy and four.
    const env = serverEnv()
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _redis
}

/** Cache key namespaces. Keep every key construction in one place. */
export const cacheKey = {
  otpAttempt: (phone: string) => `otp:attempt:${phone}`,
  otpCode: (phone: string) => `otp:code:${phone}`,
  topDiscount: (brand: string) => `top-discount:${brand.toLowerCase()}`,
  topDiscountAll: () => 'top-discount:all',
  /**
   * Deduped promo list for the customer homepage. Deliberately not one of the
   * `topDiscount*` keys: this holds `sales_offers` rows (brand, model, rupiah
   * discount), while those hold brand rankings out of `top_discount`. One key
   * serving two shapes fails silently the day the second consumer ships.
   */
  homeOffers: () => 'offers:home',
  /**
   * Proof that a number passed OTP verification, held under an opaque random id.
   *
   * Separate from `otpCode` because it has to outlive it: verification consumes
   * the code, so a form that verifies in one submission and writes in the next
   * needs something else to carry the result. Keyed by the ticket id, not by
   * phone — the value is what identifies the number, so nothing a client posts
   * can be used to look up somebody else's verification.
   */
  otpTicket: (id: string) => `otp:ticket:${id}`,
  webhookSeen: (provider: string, eventId: string) => `webhook:${provider}:${eventId}`,
} as const

/** TTLs in seconds. */
export const cacheTtl = {
  otpCode: 5 * 60,
  /**
   * Longer than the code, because it starts where the code ends: the buyer has
   * proved the number and still has to finish choosing a car. Short enough that a
   * ticket left behind in a closed tab is worthless within the quarter hour.
   */
  otpTicket: 15 * 60,
  topDiscount: 45,
  homeOffers: 45,
  webhookSeen: 7 * 24 * 60 * 60,
} as const

let _otpLimiter: Ratelimit | null = null

/** 3 OTP sends per phone number per 15 minutes. */
export function otpRateLimiter(): Ratelimit {
  if (!_otpLimiter) {
    _otpLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '15 m'),
      prefix: 'rl:otp',
      analytics: false,
    })
  }
  return _otpLimiter
}

let _otpIpLimiter: Ratelimit | null = null

/**
 * 12 OTP sends per IP per hour.
 *
 * The per-phone limiter alone does not stop one script walking a list of numbers:
 * each number is under its own limit while the gateway quota drains and a lot of
 * strangers get an unexplained WhatsApp from us. Deliberately loose, because a
 * whole office or a mobile carrier NAT can share one address.
 */
export function otpIpRateLimiter(): Ratelimit {
  if (!_otpIpLimiter) {
    _otpIpLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(12, '1 h'),
      prefix: 'rl:otp-ip',
      analytics: false,
    })
  }
  return _otpIpLimiter
}

let _requestLimiter: Ratelimit | null = null

/**
 * 5 car requests per customer per hour.
 *
 * Each request becomes a lead sales users pay tokens to unlock, so a customer
 * spamming near-identical requests costs the market real money. Keyed by user id
 * rather than by IP: the submitter is always authenticated, and IP keying would
 * throttle everyone behind one mobile carrier NAT together.
 */
export function requestRateLimiter(): Ratelimit {
  if (!_requestLimiter) {
    _requestLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'rl:request',
      analytics: false,
    })
  }
  return _requestLimiter
}

let _bidLimiter: Ratelimit | null = null

/**
 * 1 auction bid per sales user per 10 seconds.
 *
 * Bids cost no tokens, so nothing else makes them expensive. Without a floor on
 * how fast they can arrive, a script can shave the leader by one rupiah in a loop
 * and turn an auction into a latency contest. Ten seconds is short enough that a
 * person typing a real number never notices it, and long enough that shaving
 * stops being free.
 *
 * Keyed by sales user id, not IP: bidders are always authenticated, and several
 * sales users at the same dealership share one office address.
 */
export function bidRateLimiter(): Ratelimit {
  if (!_bidLimiter) {
    _bidLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(1, '10 s'),
      prefix: 'rl:bid',
      analytics: false,
    })
  }
  return _bidLimiter
}

import { z } from 'zod'

/**
 * Server-side environment contract.
 *
 * Validated lazily rather than at module load: Next.js evaluates top-level module
 * code during `next build`, and a strict parse there would fail the first deploy
 * before Marketplace provisioning has injected the real values.
 */
/**
 * A declared-but-empty variable counts as unset.
 *
 * `.optional()` accepts `undefined`, never `''`. `.env.example` ships every
 * optional key with an empty value under the instruction "Copy to .env.local and
 * fill in", so following that instruction handed Zod `WHATSAPP_API_URL: ''`,
 * which failed `.url()` and threw out of the first `getDb()` or `getRedis()` call
 * in the request — taking down the public homepage, which has nothing to do with
 * WhatsApp. `lib/whatsapp/client.ts` already reads these keys straight off
 * `process.env` and treats blank as absent (`if (!appKey …) return null`), so
 * this is that same rule stated once more rather than a new one.
 *
 * Only applied to the optional keys. A blank *required* variable must still fail,
 * and it does. Non-strings pass through untouched so Zod still reports them.
 */
const blankAsUnset = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  /**
   * WhatsApp gateway. Optional so `next build` and local work without it; when
   * absent, `sendOtp` refuses in production and returns the code to the dev UI
   * outside it. Two keys because the gateway wants both an app key and an auth key.
   *
   * Validated but never read back through `serverEnv()` — `lib/whatsapp/client.ts`
   * owns the reads. The entries stay because they still enforce "if you set it, it
   * must be well-formed", which is the one thing that file's `||` fallback cannot.
   */
  WHATSAPP_API_URL: z.preprocess(blankAsUnset, z.string().url().optional()),
  WHATSAPP_APP_KEY: z.preprocess(blankAsUnset, z.string().min(1).optional()),
  WHATSAPP_AUTH_KEY: z.preprocess(blankAsUnset, z.string().min(1).optional()),
  /**
   * Shared secret for the Vercel Cron endpoint. Required, not optional: the cron
   * route settles auctions and awards leads, so an absent secret would deploy a
   * URL anyone on the internet could fire. Required means a missing value breaks
   * loudly at the first `serverEnv()` call instead of quietly leaving the route
   * open — and because `getDb()` and `getRedis()` both call `serverEnv()`, that
   * failure is impossible to miss.
   */
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cached) return cached

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')
    throw new Error(`Invalid environment variables:\n  ${missing}`)
  }

  cached = parsed.data
  return cached
}

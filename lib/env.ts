import { z } from 'zod'

/**
 * Server-side environment contract.
 *
 * Validated lazily rather than at module load: Next.js evaluates top-level module
 * code during `next build`, and a strict parse there would fail the first deploy
 * before Marketplace provisioning has injected the real values.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  /**
   * WhatsApp gateway. Optional so `next build` and local work without it; when
   * absent, `sendOtp` refuses in production and returns the code to the dev UI
   * outside it. Two keys because the gateway wants both an app key and an auth key.
   */
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_APP_KEY: z.string().min(1).optional(),
  WHATSAPP_AUTH_KEY: z.string().min(1).optional(),
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

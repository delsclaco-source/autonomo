/**
 * Session cookie name, isolated from `lib/auth/session.ts`.
 *
 * `proxy.ts` needs the name but must not pull in the database client or
 * `server-only` modules that come with the full session module.
 */
export const SESSION_COOKIE = 'autonomo_session'

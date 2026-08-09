import 'server-only'
import { redirect } from 'next/navigation'
import type { Area } from '@/lib/config/subdomains'
import { getSessionUser, type SessionUser } from './session'

/**
 * Page-level auth guard.
 *
 * `requireUser` throws, which is right for Server Actions — a thrown error
 * aborts the mutation. Pages want a redirect to the login screen instead, and
 * `redirect()` must be called outside a try/catch to work, so it lives here
 * rather than being folded into `requireUser`.
 */
export async function requirePageUser(area: Area): Promise<SessionUser> {
  const user = await getSessionUser(area)
  if (!user) redirect('/login')
  return user
}

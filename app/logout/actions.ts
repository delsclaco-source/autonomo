'use server'

import { redirect } from 'next/navigation'
import { destroySession } from '@/lib/auth/session'

/**
 * Sign out.
 *
 * Deletes the `sessions` row as well as the cookie. Clearing the cookie alone
 * would leave a valid server-side session behind, so anyone who had already
 * captured the token would keep access after the user believed they were out —
 * which is exactly the case logging out on a shared showroom device is for.
 *
 * `redirect` is called outside any try/catch: it works by throwing, and swallowing
 * that would silently leave the user on the page they just signed out of.
 */
export async function logoutAction() {
  await destroySession()
  redirect('/login')
}

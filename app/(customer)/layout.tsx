import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { AccountMenu } from '@/components/account-menu'
import { BottomNav, TopNav } from '@/components/bottom-nav'
import { CUSTOMER_NAV } from '@/lib/config/nav'
import { getSessionUser } from '@/lib/auth/session'

/**
 * Customer shell — the public face at autonomo.id, shaped as an app.
 *
 * Adopted from `mobile-user.md` on 2026-08-17: a blurred header with the mark on
 * the left and the account control on the right, and a fixed bottom bar. The
 * mockup is mobile-first, and so is this shell — the bar is the primary
 * navigation below `md`, and `TopNav` takes over above it.
 *
 * **The area is not a single page and it does have a login.** `/katalog`,
 * `/top-diskon`, `/request` and `/request/baru` are all real routes, and
 * `/request` reads a customer session. An earlier version of this file claimed
 * the opposite and removed the bottom bar on that basis; the claim was stale.
 *
 * The session is read with `getSessionUser`, not `requirePageUser`: the landing
 * and the catalogue are public, so a missing session is a normal state, not a
 * redirect.
 *
 * **A signed-out buyer gets no account control at all.** `AccountMenu` still
 * renders a "Masuk" link for a null session — the sales shell relies on it — but
 * this header only mounts the component once `user` exists. Two reasons:
 *
 *   - The landing's request card is the one primary action in the first viewport,
 *     and its submit button is blue. A blue "Masuk" beside it in the header is the
 *     second blue button design.md §2 calls a bug.
 *   - Nothing here needs an account. The card takes a request from a visitor who
 *     has never signed in; the one-time code on the phone number is the identity.
 *
 * Login is not orphaned by this: the "Saya" tab goes to `/request`, which calls
 * `requirePageUser('customer')` and redirects to `/login` when there is no
 * session. A returning buyer reaches the login screen by asking for the screen
 * that needs it, not by hunting for a button in the chrome.
 *
 * Reading a cookie makes every route under this layout dynamic. That is already
 * true of the pages themselves — the landing awaits `searchParams` and Redis, and
 * `/request` reads a session — and the sales shell declares the same flag for the
 * same reason.
 *
 * The footer is desktop-only. On a phone the bottom bar owns that edge, and two
 * stacked strips of chrome at the bottom of a 375px screen is one too many; the
 * mockup has no footer at all. The `pb-24 md:pb-8` on `main` reserves the bar's
 * height (design.md §8) and doubles as the gap above the desktop footer.
 *
 * The one door out of the customer area is the ink band at the foot of the
 * landing page, not a header link: at 320px the header has room for the mark and
 * the account control, and nothing else.
 */
export const dynamic = 'force-dynamic'

export default async function CustomerLayout({ children }: LayoutProps<'/'>) {
  const user = await getSessionUser('customer')

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-heading text-lg font-bold tracking-tight text-foreground transition-opacity duration-200 hover:opacity-70"
          >
            {/* The mockup's ink square mark. Ink rather than blue: design.md §2
                spends the brand colour on the next action, on the number the
                buyer came for, and on the wordmark's `.id` — a coloured logo tile
                would be a fourth claim on it. */}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-on-accent">
              <ShieldCheck width={17} height={17} aria-hidden="true" />
            </span>
            autonomo<span className="-ml-2 text-primary">.id</span>
          </Link>

          <TopNav items={CUSTOMER_NAV} />

          {user && <AccountMenu user={user} />}
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8">{children}</main>

      <footer className="hidden border-t border-border bg-surface md:block">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Autonomo.id</p>
          <p>Marketplace lead generation otomotif Indonesia</p>
        </div>
      </footer>

      <BottomNav items={CUSTOMER_NAV} />
    </>
  )
}

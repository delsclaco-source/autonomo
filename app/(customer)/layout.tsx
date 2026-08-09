import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'
import { CUSTOMER_NAV } from '@/lib/config/nav'
import { AccountMenu } from '@/components/account-menu'
import { BottomNav, TopNav } from '@/components/bottom-nav'

/**
 * Customer shell — the public face at autonomo.id.
 *
 * No auth guard here: browsing and submitting a request are open. Only the
 * tracking pages under /request check for a session. The header does read the
 * session, though, so a signed-in buyer is not shown a "Masuk" button for an
 * account they already have.
 *
 * Navigation is one set of items rendered two ways: a horizontal bar in the
 * header from `md:` up, a fixed bottom bar below it. Most buyers arrive on a
 * phone, and the sections they move between (catalogue, top discounts, their own
 * requests) are peers rather than a hierarchy — which is exactly the shape a
 * bottom bar fits and a hamburger menu hides.
 */
export default async function CustomerLayout({ children }: LayoutProps<'/'>) {
  const user = await getSessionUser('customer')

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="font-heading text-lg font-bold tracking-tight text-foreground transition-opacity duration-200 hover:opacity-70"
          >
            autonomo<span className="text-primary">.id</span>
          </Link>

          <TopNav items={CUSTOMER_NAV} />

          <AccountMenu user={user} />
        </nav>
      </header>

      {/* Bottom padding reserves the fixed bar's height on mobile. Without it the
          last element of every page sits under the bar. */}
      <main className="flex-1 pb-24 md:pb-0">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Autonomo.id</p>
          <p>Marketplace lead generation otomotif Indonesia</p>
        </div>
      </footer>

      <BottomNav items={CUSTOMER_NAV} />
    </>
  )
}

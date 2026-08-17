import Link from 'next/link'
import { Coins } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { SALES_MENU_NAV, SALES_NAV } from '@/lib/config/nav'
import { salesOverview } from '@/lib/sales/queries'
import { AccountMenu } from '@/components/account-menu'
import { BottomNav, TopNav } from '@/components/bottom-nav'

/**
 * Sales shell at sales.autonomo.id.
 *
 * The proxy already bounced sessionless visitors, but that check only saw
 * whether a cookie existed. This is the real gate: it resolves the session
 * against the database and confirms the role matches the area. Every page
 * beneath this layout still re-checks in its own data access — a layout guard
 * does not cover Server Actions.
 *
 * This shell is used standing up, one-handed, often in a showroom — so the five
 * working sections sit in a fixed bottom bar on mobile and the header keeps only
 * identity and the token balance. The balance stays in the chrome because it is
 * the number that decides whether the next tap is even possible.
 */
// Nothing under /sales is ever the same for two users, and prerendering it at
// build time would mean hitting the database before it exists.
export const dynamic = 'force-dynamic'

export default async function SalesLayout({ children }: LayoutProps<'/sales'>) {
  const user = await requirePageUser('sales')
  const overview = await salesOverview(user.id)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-heading text-lg font-bold tracking-tight text-foreground"
          >
            autonomo<span className="-ml-2 text-primary">.id</span>
            <span className="hidden rounded bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted sm:inline">
              Sales
            </span>
          </Link>

          <TopNav items={SALES_NAV} />

          <div className="flex shrink-0 items-center gap-2">
            {/* The balance is a link, not a readout: seeing a number too low to
                unlock the next lead and having nowhere to tap is the single most
                common dead end in this shell. */}
            <Link
              href="/topup"
              className="tabular inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/40 hover:text-primary"
            >
              <Coins width={15} height={15} className="text-primary" aria-hidden="true" />
              {overview.tokenBalance.toLocaleString('id-ID')}
              <span className="hidden text-xs font-normal text-foreground-muted sm:inline">
                token
              </span>
            </Link>

            <AccountMenu
              user={user}
              dealer={overview.brands.join(' · ') || null}
              links={SALES_MENU_NAV}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:pb-8">{children}</main>

      <BottomNav items={SALES_NAV} />
    </>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BadgePercent,
  Coins,
  Gift,
  Home,
  LayoutGrid,
  ListChecks,
  Plus,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { isActive, type NavIcon, type NavItem } from '@/lib/config/nav'

/**
 * Mobile bottom navigation.
 *
 * Phones are the majority of traffic for both roles — buyers browse on the sofa,
 * sales users work from the showroom floor — so the primary sections live in the
 * thumb zone rather than behind a hamburger. Hidden from `md:` up, where the
 * horizontal bar in the header takes over.
 *
 * Three things here are load-bearing and easy to lose in a redesign:
 *
 *   - `pb-[env(safe-area-inset-bottom)]` keeps the row clear of the iOS home
 *     indicator. Without it the bottom ~34px of every tab is unreachable.
 *   - each tab is `min-h-14` (56px) against the 44px minimum, because a bar
 *     pinned to the screen edge is the hardest thing on a page to hit precisely.
 *   - the active tab carries a colour *and* a filled indicator bar. Colour alone
 *     fails for the ~8% of men with red-green deficiency, and this palette's
 *     accent is red.
 *
 * The layout must reserve the space this occupies (`pb-24 md:pb-0` on `main`) —
 * a fixed bar over unpadded content hides the last rows of every page.
 */

const ICONS: Record<NavIcon, React.ComponentType<{ width?: number; height?: number; className?: string }>> = {
  home: Home,
  catalog: LayoutGrid,
  plus: Plus,
  discount: BadgePercent,
  account: User,
  dashboard: Sparkles,
  leads: Users,
  crm: ListChecks,
  token: Coins,
  referral: Gift,
}

export function BottomNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(item, pathname)
          const Icon = ICONS[item.icon]

          if (item.emphasis) {
            return (
              <li key={item.href} className="flex flex-1 justify-center">
                {/* Raised centre action. Lifted out of the row so it reads as the
                    one thing to do here, not as a fifth peer tab. */}
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="group -mt-4 flex w-full flex-col items-center gap-1 pb-1.5"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/25 ring-4 ring-surface transition-transform duration-200 group-active:scale-95">
                    <Icon width={22} height={22} />
                  </span>
                  <span className="text-[10px] font-semibold text-foreground">{item.label}</span>
                </Link>
              </li>
            )
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 transition-colors duration-200 ${
                  active ? 'text-primary' : 'text-foreground-muted active:text-foreground'
                }`}
              >
                {/* Second, non-colour signal for the active tab. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 top-0 h-0.5 rounded-full transition-opacity duration-200 ${
                    active ? 'bg-primary opacity-100' : 'opacity-0'
                  }`}
                />
                <Icon width={20} height={20} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * Desktop counterpart. Same items, same active rule — declared beside the bottom
 * bar so the two cannot drift apart.
 */
export function TopNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = isActive(item, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
              active
                ? 'bg-muted text-foreground'
                : 'text-foreground-muted hover:bg-muted hover:text-foreground'
            }`}
          >
            {item.longLabel ?? item.label}
          </Link>
        )
      })}
    </nav>
  )
}

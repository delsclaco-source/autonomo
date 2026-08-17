'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Car,
  ClipboardList,
  Coins,
  Gavel,
  Gift,
  Home,
  ListChecks,
  Sparkles,
  Tag,
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
 * Rebuilt 2026-08-17 to the bar in `mobile-user.md`: a 64px row of 48px tabs laid
 * out `justify-around`, a 24px icon over a 12px/14px label, a translucent surface
 * under a heavy blur, and an upward shadow in place of a top border. Active state
 * is colour only, as in the mockup.
 *
 * Two of the mockup's choices are safe here that would not have been earlier:
 *
 *   - **No second, non-colour active signal.** The previous bar carried an
 *     indicator rail because the accent was red and hue alone fails red-green
 *     deficiency. The accent is now `#0052FF` against `#6b6b72` — that pair
 *     differs in hue *and* lightness, so it survives greyscale. `aria-current`
 *     carries the state for assistive tech either way.
 *   - **48px tabs where the old bar reserved 56px.** The row is 64px and each tab
 *     centres in it, so the touch surface is 48px tall with 8px of quiet edge
 *     above and below — still clear of the 44px floor.
 *
 * Two things remain load-bearing and are easy to lose in a redesign:
 *
 *   - `pb-[env(safe-area-inset-bottom)]` (the mockup's `pb-safe`) keeps the row
 *     off the iOS home indicator. Without it the bottom ~34px of every tab is
 *     unreachable.
 *   - the layout must reserve the height this occupies (`pb-24` on `main`) — a
 *     fixed bar over unpadded content hides the last rows of every page.
 *
 * Tabs are `flex-1`, not the mockup's fixed `w-16`. Identical geometry for the
 * four-item customer bar — `justify-around` places equal-width items exactly
 * where equal columns do — and it keeps the five-item sales bar from overflowing
 * a 320px screen, which no amount of fidelity is worth (design.md §8).
 */

const ICONS: Record<NavIcon, React.ComponentType<{ width?: number; height?: number; className?: string }>> = {
  home: Home,
  catalog: Car,
  requests: ClipboardList,
  discount: Tag,
  dashboard: Sparkles,
  leads: Users,
  auction: Gavel,
  offers: Car,
  crm: ListChecks,
  token: Coins,
  referral: Gift,
}

export function BottomNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-50 bg-surface/80 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgb(0_0_0/0.04)] backdrop-blur-xl md:hidden"
    >
      <ul className="flex h-16 items-center justify-around px-4">
        {items.map((item) => {
          const active = isActive(item, pathname)
          const Icon = ICONS[item.icon]

          return (
            <li key={item.href} className="flex flex-1 justify-center">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-12 w-full flex-col items-center justify-center gap-1 transition-all duration-200 ${
                  active ? 'text-primary' : 'text-foreground-muted active:text-foreground'
                }`}
              >
                <Icon width={24} height={24} />
                <span className="text-xs font-medium leading-[14px]">{item.label}</span>
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

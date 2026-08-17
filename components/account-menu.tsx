import Link from 'next/link'
import { ChevronRight, LogOut, User } from 'lucide-react'
import { logoutAction } from '@/app/logout/actions'
import { maskPhone } from '@/lib/auth/phone'
import type { SessionUser } from '@/lib/auth/session'
import type { NavItem } from '@/lib/config/nav'

/**
 * Header account control.
 *
 * Built on `<details>` rather than a JS popover so it opens on the first tap of a
 * cold page load, before hydration. Sales users open this on a phone in a
 * showroom with poor signal; a menu that needs a bundle to work is a menu that
 * appears broken.
 *
 * The signed-in identity is shown as the masked phone number, not the full one.
 * The point of the panel is "am I logged in as the right account" — the last
 * three digits answer that, and the full number on screen in a public place does
 * not need to be readable over a shoulder.
 *
 * `links` holds the sections that did not fit the five-item bottom bar
 * (`SALES_MENU_NAV`). They are ordinary links rather than nav items: no active
 * state, because the menu is closed whenever the user is looking at the page.
 */
export function AccountMenu({
  user,
  dealer,
  links = [],
}: {
  user: SessionUser | null
  dealer?: string | null
  links?: readonly NavItem[]
}) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
      >
        Masuk
      </Link>
    )
  }

  const name = user.fullName?.trim() || 'Akun saya'

  return (
    <details className="relative shrink-0 [&_summary::-webkit-details-marker]:hidden">
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-border px-2.5 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted"
        aria-label="Menu akun"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-on-accent">
          <User width={15} height={15} aria-hidden="true" />
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
        <div className="border-b border-border px-4 py-3">
          <p className="truncate font-heading text-sm font-semibold text-foreground">{name}</p>
          <p className="tabular mt-0.5 text-xs text-foreground-muted">{maskPhone(user.phone)}</p>
          {dealer && <p className="mt-1 truncate text-xs text-foreground-muted">{dealer}</p>}
        </div>

        {links.length > 0 && (
          <ul className="border-b border-border py-1">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center justify-between gap-2 px-4 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted"
                >
                  {item.longLabel ?? item.label}
                  <ChevronRight
                    width={14}
                    height={14}
                    className="text-foreground-muted"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-4 text-left text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/5"
          >
            <LogOut width={15} height={15} aria-hidden="true" />
            Keluar
          </button>
        </form>
      </div>
    </details>
  )
}

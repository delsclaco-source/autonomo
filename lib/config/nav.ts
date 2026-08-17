import type { Area } from './subdomains'

/**
 * Navigation model for the customer and sales shells.
 *
 * Items are declared here rather than inline in each layout so the mobile bottom
 * bar and the desktop bar are provably the same set — a mobile-only item is a
 * feature the desktop user cannot find, and the reverse is worse.
 *
 * Icons are named, not imported, because this module is read by Server
 * Components and a React component cannot be serialised across that boundary.
 * `components/bottom-nav.tsx` resolves the names.
 *
 * Five is the hard ceiling for the bottom bar: past that the targets fall under
 * the 44px minimum on a small phone, and the labels start truncating.
 */

export type NavIcon =
  | 'home'
  | 'catalog'
  | 'requests'
  | 'discount'
  | 'dashboard'
  | 'leads'
  | 'auction'
  | 'offers'
  | 'crm'
  | 'token'
  | 'referral'

export type NavItem = {
  href: string
  /** Bottom-bar label. Keep to one short word — two lines never fit. */
  label: string
  /** Desktop label, when the short one would read as terse out of context. */
  longLabel?: string
  icon: NavIcon
  /**
   * Match this href exactly. Needed for section index routes: without it `/sales`
   * would highlight on every page in the section.
   */
  exact?: boolean
}

/**
 * Customer bar — the four tabs of `mobile-user.md`, in its order.
 *
 * The mockup's bar has no raised centre action, so neither does this. The item
 * that used to occupy that slot was `/request/baru`, and dropping it from the
 * chrome costs nothing: the form is linked from the landing card, from every
 * catalogue and promo card, from `/top-diskon`, and from `/request` itself. A
 * request starts from a car the buyer is looking at, not from a plus button that
 * opens an empty form.
 *
 * Labels stay Indonesian. The mockup's own body copy is Indonesian and its nav
 * labels are not ("Home", "Catalog", "Requests", "Deals") — leftover template
 * text from the generator, not a language decision to copy.
 */
export const CUSTOMER_NAV: readonly NavItem[] = [
  { href: '/', label: 'Beranda', icon: 'home', exact: true },
  { href: '/katalog', label: 'Katalog', icon: 'catalog' },
  { href: '/request', label: 'Request', longLabel: 'Request saya', icon: 'requests', exact: true },
  { href: '/top-diskon', label: 'Diskon', longLabel: 'Top diskon', icon: 'discount' },
]

/**
 * Sales bar.
 *
 * No raised action: a sales user's primary move is unlocking a lead, which
 * happens inside the leads list, not from the chrome. Ordered by how often the
 * screen is opened during a working day, left to right.
 *
 * At the five-item ceiling. Referral is not here — it is a one-time setup task,
 * not a daily screen, so it lives in the account menu; anything added later has
 * to displace an item rather than extend the row.
 *
 * Token top-up was the item displaced when Lelang arrived. Top-up is occasional
 * — a sales user does it when the balance runs low, a few times a month — while
 * an open auction is time-boxed and has to be checked daily or it closes without
 * them. The balance itself is still on the dashboard header, so nothing about
 * the token economy became harder to see; only the purchase screen moved one tap
 * further away.
 *
 * Hrefs carry no `/sales` prefix. The user is already on sales.autonomo.id, so
 * the visible URL is `/leads`; `proxy.ts` rewrites it to the internal
 * `/sales/leads` route. Putting the prefix here too would produce
 * `/sales/sales/leads` after the rewrite.
 */
export const SALES_NAV: readonly NavItem[] = [
  { href: '/', label: 'Home', longLabel: 'Dashboard', icon: 'dashboard', exact: true },
  { href: '/lelang', label: 'Lelang', longLabel: 'Lelang aktif', icon: 'auction' },
  { href: '/leads', label: 'Leads', longLabel: 'Hot leads', icon: 'leads' },
  { href: '/offers', label: 'Produk', longLabel: 'Penawaran saya', icon: 'offers' },
  { href: '/crm', label: 'CRM', icon: 'crm' },
]

/**
 * Sales items that did not fit the bar, shown in the account menu instead.
 *
 * Same shape as `SALES_NAV` so the menu can render them with the same icon
 * lookup; kept separate so nothing accidentally pushes the bar past five.
 */
export const SALES_MENU_NAV: readonly NavItem[] = [
  { href: '/topup', label: 'Token', longLabel: 'Top-up token', icon: 'token' },
  { href: '/referral', label: 'Referral', longLabel: 'Kode referral', icon: 'referral' },
]

export function navFor(area: Area): readonly NavItem[] {
  return area === 'sales' ? SALES_NAV : CUSTOMER_NAV
}

/**
 * Whether `item` is the active one for `pathname`.
 *
 * Exported so the desktop bar and the bottom bar cannot disagree about which tab
 * is lit. Longest-prefix is not needed here because no nav href is a prefix of
 * another except `/sales` and `/request`, both of which are marked `exact`.
 */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

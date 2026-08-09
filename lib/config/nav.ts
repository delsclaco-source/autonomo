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
  | 'plus'
  | 'discount'
  | 'account'
  | 'dashboard'
  | 'leads'
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
  /** Render as the raised centre action. At most one per bar. */
  emphasis?: boolean
}

/**
 * Customer bar.
 *
 * The centre slot is "Request" because that is the one thing the product needs a
 * buyer to do; everything else on this bar is a way of deciding what to request.
 */
export const CUSTOMER_NAV: readonly NavItem[] = [
  { href: '/', label: 'Beranda', icon: 'home', exact: true },
  { href: '/katalog', label: 'Katalog', icon: 'catalog' },
  { href: '/request/baru', label: 'Request', longLabel: 'Buat request', icon: 'plus', emphasis: true },
  { href: '/top-diskon', label: 'Diskon', longLabel: 'Top diskon', icon: 'discount' },
  { href: '/request', label: 'Saya', longLabel: 'Request saya', icon: 'account', exact: true },
]

/**
 * Sales bar.
 *
 * No raised action: a sales user's primary move is unlocking a lead, which
 * happens inside the leads list, not from the chrome. Ordered by how often the
 * screen is opened during a working day, left to right.
 *
 * Hrefs carry no `/sales` prefix. The user is already on sales.autonomo.id, so
 * the visible URL is `/leads`; `proxy.ts` rewrites it to the internal
 * `/sales/leads` route. Putting the prefix here too would produce
 * `/sales/sales/leads` after the rewrite.
 */
export const SALES_NAV: readonly NavItem[] = [
  { href: '/', label: 'Home', longLabel: 'Dashboard', icon: 'dashboard', exact: true },
  { href: '/leads', label: 'Leads', longLabel: 'Hot leads', icon: 'leads' },
  { href: '/crm', label: 'CRM', icon: 'crm' },
  { href: '/topup', label: 'Token', icon: 'token' },
  { href: '/referral', label: 'Referral', icon: 'referral' },
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

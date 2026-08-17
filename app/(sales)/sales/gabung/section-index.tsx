import {
  Car,
  Clock,
  Coins,
  Gavel,
  Map as MapIcon,
  MessageCircle,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { SectionIcon } from './content'

/**
 * Shared scaffolding for the sales recruitment landing page.
 *
 * Hallmark · genre: editorial-catalogue · macrostructure: section-index
 * · design-system: design.md
 *
 * Split out of `page.tsx` when the auction, matching, and profile sections pushed
 * that file past the 800-line ceiling. Nothing here is a route — `page.tsx` and
 * the two `sections-*.tsx` modules compose it.
 *
 * `ICONS` is a total `Record<SectionIcon, LucideIcon>` on purpose. The previous
 * version typed the value loosely and drifted out of sync with `content.ts`: that
 * file renamed `flame` to `gavel` and added `car`, `wallet`, and `map`, so
 * `ICONS[prop.icon]` evaluated to `undefined` and React threw "Element type is
 * invalid" at render. A total record turns the same drift into a compile error
 * instead of a blank page.
 *
 * lucide-react's `Map` export shadows the global `Map` constructor, so it is
 * aliased rather than imported bare.
 */

export const ICONS: Record<SectionIcon, LucideIcon> = {
  gavel: Gavel,
  target: Target,
  coins: Coins,
  whatsapp: MessageCircle,
  car: Car,
  wallet: Wallet,
  map: MapIcon,
}

/** Signup and login share one route; `/login` branches on whether the number exists. */
export const SIGNUP_HREF = '/login'

/**
 * Section order, declared once. design.md § 4.1 requires the ordinal to be
 * counted from this list rather than hand-typed per section, so inserting a
 * section cannot leave two of them numbered the same.
 *
 * The auction precedes the token because that is the order the code runs in:
 * `app/(customer)/request/baru/actions.ts` opens an auction for every request
 * whose target price is plausible, and only the residue reaches the pool that
 * tokens buy.
 */
export const SECTION_ORDER = [
  'kenapa',
  'cara-kerja',
  'lelang',
  'pencocokan',
  'penawaran',
  'pool',
  'token',
  'membership',
  'reputasi',
  'crm',
  'referral',
  'faq',
] as const

export type SectionId = (typeof SECTION_ORDER)[number]

export function ordinal(id: SectionId): string {
  return String(SECTION_ORDER.indexOf(id) + 1).padStart(2, '0')
}

/**
 * The section head from design.md § 4.1. Left rail carries the ordinal and a
 * hairline; the right column carries eyebrow, title, and lead. `invert` switches
 * it for the two ink bands.
 */
export function SectionIndex({
  id,
  eyebrow,
  title,
  lead,
  invert = false,
}: {
  id: SectionId
  eyebrow: string
  title: string
  lead?: string
  invert?: boolean
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[6rem_minmax(0,1fr)] lg:gap-8">
      <div className="flex items-center gap-3 lg:block">
        <span
          className={`tabular font-heading text-sm font-bold ${
            invert ? 'text-on-accent/60' : 'text-foreground-muted'
          }`}
        >
          {ordinal(id)}
        </span>
        <span
          aria-hidden="true"
          className={`block h-px w-10 lg:mt-3 ${invert ? 'bg-on-accent/25' : 'bg-border'}`}
        />
      </div>

      <div className="min-w-0">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
            invert ? 'text-on-accent/60' : 'text-foreground-muted'
          }`}
        >
          {eyebrow}
        </p>
        <h2
          className={`mt-2 font-heading text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl ${
            invert ? 'text-on-accent' : 'text-foreground'
          }`}
        >
          {title}
        </h2>
        {lead && (
          <p
            className={`mt-3 max-w-2xl text-base leading-relaxed ${
              invert ? 'text-on-accent/60' : 'text-foreground-muted'
            }`}
          >
            {lead}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * A spec pair from design.md § 5.4 — label above value, tabular figure. Same
 * shape as the local helper on the real auction screen
 * (`app/(sales)/sales/(app)/lelang/page.tsx`), so the landing preview and the
 * screen it previews read identically.
 */
export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-medium text-foreground">{children}</dd>
    </div>
  )
}

/**
 * design.md § 9: an unbuilt feature says so on the surface rather than implying
 * it works. Carries both an icon and a word, so it does not depend on colour.
 */
export function ComingSoon() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">
      <Clock width={11} height={11} aria-hidden="true" />
      Segera hadir
    </span>
  )
}

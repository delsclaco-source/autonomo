# design.md — Autonomo.id

The locked design system for this project. Written by a Hallmark multi-page
`redesign` run over the sales area. Every page must share this system; the goal
is consistency across pages, not variety between them.

Read this before building or changing any page. It overrides ad-hoc judgement,
and it defers to exactly one file: `app/globals.css`, which owns the colour,
spacing, radius, shadow, and motion tokens. Nothing here re-states a token
value — if you need a colour, reference the token by name.

**Rollout status.** Applied to the sales area (`app/(sales)/**`) and to the
customer homepage (`app/(customer)/page.tsx`). The rest of the customer area and
all of the admin area still predate it; bring them across when they are next
touched rather than in a separate sweep.

---

## 1. Genre

**Editorial catalogue.** The reference is an automotive spec sheet and a
broadsheet classifieds page, not a SaaS marketing site. That means:

- Hairline rules and numbered indices carry structure, not drop shadows.
- Data is set like a spec table: label above value, tabular figures, aligned.
- Whitespace is generous vertically and tight horizontally. Sections breathe;
  rows do not.
- Nothing is "delightful". The product's promise is that the numbers are honest,
  so the surface should read as a document, not a pitch.

What this genre forbids: gradient meshes, rounded-pill everything, emoji,
illustration-as-filler, and the hero → three-feature-cards → testimonial → CTA
rhythm every generated landing page shares.

**Four ornaments are open to landing pages, and only to landing pages.** Added
2026-08-16, when the customer homepage adopted the `beranda-user.md` direction.
This list is closed — nothing joins it — and app pages take none of it:

1. **A two-tone display heading.** One phrase in ink, the next in
   `--color-primary`, or a `bg-linear-to-r` clip between two token colours. Both
   stops must clear 4.5:1 on white on their own, so the text is still readable
   if the clip does not render. One per page, on the `h1`.
2. **One `backdrop-blur` pane** behind the hero's primary input. It is a sibling
   of the controls, never a wrapper: nothing between a finger and a control gets
   blurred. One per page.
3. **Off-canvas blurred washes** — a token colour at 5% or less, `blur-3xl`,
   `aria-hidden="true"` and `pointer-events-none`. Two per page, and never under
   text.
4. **One gradient hairline**
   (`bg-linear-to-r from-transparent via-<token>/30 to-transparent`) standing in
   for a section border, at most once per page.

Note the Tailwind v4 spelling: `bg-linear-to-r`. `bg-gradient-to-r` is the v3
name and does nothing in this repo.

## 2. Colour

Locked by `app/globals.css`. Do not introduce a hex, `rgb()`, or `oklch()` value
anywhere in a component — reference the token.

The palette is a 60/20/20 budget: 60% white, 20% electric blue
(`--color-primary`), 20% black (ink). The budget is the design. Spending the
brand colour on borders, icon backgrounds, and headings is what makes a
two-colour brand look generic.

**Repalette, 2026-08-16.** This system was red (Rosso Corsa `#d40000`) until the
customer homepage mockup set a new direction. Token *values* changed; every token
*name* and role stayed put, so 582 class usages changed meaning without being
edited. A comment anywhere in the repo that calls `--color-primary` red is stale,
not authoritative.

**`--color-primary` is allowed on exactly three things:**

1. The one action the user should take next on this screen.
2. The number the user came for — a discount, a saving, a target price, a
   token cost that is the subject of the sentence.
3. The wordmark's `.id`.

Everything else is ink (`--color-foreground`), muted ink
(`--color-foreground-muted`), or hairline (`--color-border`). An icon is ink
unless it sits inside the primary action. A heading is never blue, with one
exception: the two-tone landing display heading in §1.

Two more colours carry one narrow meaning each and nothing else:

- **`--color-secondary` is heat.** A campaign badge, a limited-time label. It is
  red, and `--color-destructive` is the same red. Because one hue serves both, an
  error state must always carry an icon **and** a text label — colour alone
  cannot distinguish "danger" from "hot deal".
- **Green is a saving.** `--color-success` is the dark green and the only green
  that may carry text: money saved, a won transaction. **`--color-success-fill`
  never carries text.** It measures 2.4:1 on white and exists purely as a fill —
  a live dot, an icon body, a chart series. `text-success-fill` is a bug, not a
  style choice.

**One primary action per screen.** Secondary actions are an outlined button
(`border-border`, ink text) or a plain link. Two blue buttons in one viewport is
a bug.

## 3. Typography

Locked. `--font-heading` (Plus Jakarta Sans) for headings, stat values, and the
wordmark. `--font-sans` (Inter) for everything else. No third family.

| Role | Class stack |
| --- | --- |
| Page title (`h1`) | `font-heading text-2xl font-bold tracking-tight` |
| Landing display (`h1`) | `font-heading text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl` |
| Section title (`h2`) | `font-heading text-2xl font-bold tracking-tight sm:text-3xl` |
| Card / group title (`h3`) | `font-heading text-base font-semibold leading-snug` |
| Eyebrow | `text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted` |
| Body | `text-sm leading-relaxed text-foreground-muted` |
| Lead paragraph | `text-base leading-relaxed text-foreground-muted` (landing: `text-lg`) |
| Stat value | `tabular font-heading font-bold leading-none` |
| Data label | `text-[11px] uppercase tracking-[0.1em] text-foreground-muted` |

**Headings are always roman.** No italic headings, no `<em>` inside a heading.
Emphasis comes from weight, from the accent colour on a money number, or from a
rule beneath the line. Italic survives only inside running body copy.

**Every figure that can change length is `tabular`** — balances, prices,
percentages, counts, dates, timers. A column of prices that jitters as it
re-renders is the most visible sloppiness in a money product.

## 4. Structure

### 4.1 The section index (landing pages)

Landing sections do not each open with a centred stack. They open with a
two-column head:

```
+---------+------------------------------------------+
|  01     |  KENAPA AUTONOMO.ID                      |
|         |  Lead yang sudah matang, bukan daftar    |
|  ----   |  nomor                                   |
|         |  Lead paragraph, max ~65ch.              |
+---------+------------------------------------------+
```

- Left rail: a two-digit ordinal in `font-heading text-sm font-bold tabular
  text-foreground-muted`, plus a short hairline rule beneath it. Fixed width on
  `lg:` (a `lg:grid-cols-[6rem_1fr]` track), collapsed above the title on
  mobile.
- Right column: eyebrow, then `h2`, then optional lead. `max-w-2xl` on the lead.
- The ordinal is real — it counts the sections in order and is declared once in
  a constant, never hand-typed per section.

This is the single strongest structural signal in the system. It is what makes
the page read as a catalogue rather than a template.

### 4.2 Section separation

Sections are separated by `border-b border-border` on the section element — a
hairline, full width, no shadow, no colour wash.

**Band rhythm.** Most sections are `bg-background`. Grey (`bg-muted`) washes are
banned as a section background: they read as generic zebra striping. The only
tonal breaks are **ink bands** (`bg-accent`, which is the ink token), used at
most twice per page and only where the content earns the weight:

- the token / pricing explainer, and
- the final call to action.

Inside an ink band, surfaces are `bg-on-accent/5` with `border-on-accent/15`,
text is `text-on-accent` and `text-on-accent/60`.

### 4.3 Page head (app pages)

Every page under `app/(sales)/sales/(app)/` opens with the same head:

```tsx
<header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
  <div>
    <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">...</h1>
    <p className="mt-1 max-w-xl text-sm text-foreground-muted">...</p>
  </div>
  {/* optional single primary action */}
</header>
```

The rule beneath it is load-bearing: it anchors the title to the page instead of
letting it float above a stack of cards. The purpose sentence is one line and
says what the screen is *for*, not what it contains.

Page body spacing is `space-y-8` between sections, `space-y-3` between rows in a
list. Sections inside a page get a small head: eyebrow-weight `h2` plus, where a
count exists, the count on the right of the same baseline.

### 4.4 Lists over card grids

A bordered, shadowed card is a strong signal. Spend it only where the thing
genuinely is a discrete object the user acts on:

- a marketplace lead,
- an offer the user owns,
- a top-up package,
- a CRM record.

Everything else — ledger entries, referral steps, pipeline stages, FAQ items,
value propositions, feature lists — is a **hairline-divided list**
(`divide-y divide-border`) or a plain rule-separated block. No card, no shadow.

When cards are correct, they are: `rounded-lg border border-border bg-surface
shadow-sm`, padding `p-4 sm:p-5`. Hover raises the border
(`hover:border-foreground/20`), never the shadow, and never lifts the card.

### 4.5 The stat rail

Where a page has a single number that decides what the user does next (token
balance, tokens spent, bonus headroom), that number gets an **ink slab**:
`bg-accent` (or `bg-foreground`), white tabular value at `text-3xl`/`text-4xl`,
label above in `text-on-accent/60`, and the relevant action as an outlined
`border-on-accent/25` button inside the slab.

Secondary metrics sit in a plain grid of rule-separated cells below it — label,
value, one-line hint — not four identical shadowed tiles. Four shadowed metric
tiles at the top of a screen is the report pattern; this product is a tool.

## 5. Components

### 5.1 Buttons

| Variant | Classes |
| --- | --- |
| Primary | `inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover` |
| Secondary | same box, `border border-border bg-surface text-foreground hover:bg-muted` |
| Ghost | same box, `text-foreground-muted hover:text-foreground` |
| On ink | same box, `border border-on-accent/25 text-on-accent hover:bg-on-accent/10` |

`min-h-11` (44px) is the floor on every tappable element, everywhere, including
inline chips and filter pills. Never smaller.

Every interactive element needs a visible `:focus-visible` ring — the global ring
token follows `--color-primary`, which is fine because focus is transient.

### 5.2 Filter chips

Links, not buttons, so the view is bookmarkable and browser-back works. Active
state is `border-foreground bg-foreground text-on-accent`; inactive is
`border-border text-foreground-muted hover:border-foreground/30`. The active
chip carries a fill, not just a colour — colour alone fails against this
palette's blue.

### 5.3 Empty states

Every list has one, and it is never just "No data". It is: an outlined icon, a
one-line statement of what is missing, two lines explaining why the user might
be seeing it, and the action that fills it. Container is
`rounded-lg border border-dashed border-border px-6 py-14 text-center`.

### 5.4 Data pairs

Label above value, always:

```tsx
<div>
  <dt className="text-[11px] uppercase tracking-[0.1em] text-foreground-muted">Harga OTR</dt>
  <dd className="tabular mt-0.5 font-medium text-foreground">...</dd>
</div>
```

Grouped in a `<dl className="grid grid-cols-2 gap-x-4 gap-y-3">` (or
`sm:grid-cols-4`), separated from the block above by
`border-t border-dashed border-border pt-3.5`. The dashed rule marks "this is a
spec block", the solid rule marks "this is a new section" — the two are not
interchangeable.

## 6. Motion

This project is motion-cut: no `framer-motion`, no `gsap`, no `lenis`. Do not
add one.

Motion is CSS transitions only, on `color`, `background-color`, `border-color`,
`opacity`, and `transform`. Never on `width`, `height`, `top`, or `left`.
Duration `150ms`-`200ms` (`--duration-fast` / `--duration-base`), easing
`--ease-out`. One transition per element.

Interactive feedback that is required: hover colour shift on every clickable
element, `cursor-pointer` on anything clickable that is not a native button or
link, and a pressed state (`active:scale-[0.98]` or a border darkening) on
primary actions. Anything that loads shows a state within 100ms.

Respect `prefers-reduced-motion` by keeping the motion budget this small — there
is nothing here to disable.

## 7. Accessibility floor

Non-negotiable on every emit:

- Contrast 4.5:1 for body text, 3:1 for large text. Measured on white after the
  2026-08-16 repalette: `--color-primary` **5.75:1**, `--color-secondary` and
  `--color-destructive` **6.7:1**, `--color-success` **5.3:1**. White on
  `--color-primary` also clears it. `--color-success-fill` is **2.4:1** and is a
  fill only. `--color-foreground-muted` on `--color-muted` is the tightest pair
  in the system — check it before using it for anything smaller than 12px.
- Never signal state with colour alone. The active nav tab carries a filled
  indicator bar as well as a colour. An error carries an icon and a word.
- Icon-only controls carry `aria-label`. Decorative icons carry
  `aria-hidden="true"`.
- Headings run `h1` to `h2` to `h3` without skipping. One `h1` per page.
- `aria-current="page"` on the active nav item.
- Tables and wide data blocks live inside an `overflow-x-auto` wrapper; the page
  body never scrolls horizontally.

## 8. Responsive floor

Every page renders correctly at **320 / 375 / 414 / 768** px.

- No horizontal scroll at any width.
- No clickable text wraps to two lines — buttons, nav links, footer links, CTAs.
  Shorten the label instead.
- Image- or number-bearing grid tracks use `minmax(0, 1fr)`, never bare `1fr`.
  A long unbroken model name will otherwise blow the track out.
- Long headings wrap inside words: `overflow-wrap: anywhere` with `min-width: 0`
  on the container.
- Two-column section heads collapse to one column below `lg:`.
- The fixed bottom nav's space is reserved by the layout (`pb-24 md:pb-8` on
  `main`), and the bar itself keeps `pb-[env(safe-area-inset-bottom)]`. Both are
  load-bearing; removing either makes the last row of every page unreachable on
  iOS.

## 9. Copy

**No invented numbers.** If a metric was not supplied, it does not appear. No
"trusted by 500+ dealers", no "3x faster", no testimonials, no partner logos,
no review counts that are not read from the database.

Illustrative UI — the sample lead cards, the sample sales profile, the sample
pipeline on the recruitment page — must carry a visible label saying it is an
example, in the same viewport as the illustration. This product's entire pitch
is that its token accounting is honest; a fabricated lead shown as live would be
the first lie it tells.

Where a feature is not built yet, the surface says so plainly ("Segera hadir")
and the control is disabled. It never opens a dead modal.

Voice: Indonesian, direct, second person ("Anda"). State the constraint before
the user hits it — the daily unlock cap, the monthly referral cap, and the
unlock price are all disclosed on the screen *before* the action, not in the
rejection message.

## 10. Stamp

Every page file carries a stamp comment at the top of its doc block. App pages
use `-` separators and end with `designed-as-app`:

```
Hallmark - genre: editorial-catalogue - macrostructure: section-index
- design-system: design.md - designed-as-app
```

App pages take **no** enrichment — no hero illustration, no decorative
background, no ornament. On a working screen the function is the design.

**Landing pages omit `designed-as-app`** and use `·` separators. Live examples:
`app/(sales)/sales/gabung/page.tsx` and `app/(customer)/page.tsx`.

```
Hallmark · genre: editorial-catalogue · macrostructure: section-index
· design-system: design.md
```

The missing token is what marks a page as enrichment-eligible. Eligible means
exactly two things: the four ornaments listed in §1, and real product surface (a
masked lead card). Never abstract decoration beyond that.

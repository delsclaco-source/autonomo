# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Autonomo.id
**Generated:** 2026-08-04 16:13:33
**Palette and typography updated:** 2026-08-16
**Category:** Automotive/Car Dealership
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 4/10 (Standard) | Density 6/10 (Standard)

> **Supersede notice, 2026-08-16.** The palette and fonts below are no longer the
> generated ones. This file originally shipped a placeholder palette — trust
> purple `#7C3AED` with transaction green `#16A34A`, set in Lexend and Source
> Sans 3 — produced before any brand asset existed. Three decisions have overruled
> it since, and this file now records the outcome rather than the guess:
>
> | When | Change | Where it was decided |
> |---|---|---|
> | commit `cce59be` | Plus Jakarta Sans + Inter replace Lexend + Source Sans 3 | `app/layout.tsx` |
> | commit `5cc67f9` | Light mode only; the dark palette was deleted | `app/globals.css` |
> | 2026-08-16 | Electric blue + ink + white replace purple + green | `beranda-user.md` mockup, adopted as the visual direction |
>
> **`app/globals.css` is the only source of truth for a token value.** Two other
> documents outrank this one on questions of layout, ornament, and copy:
> `design.md` (the locked system, written after this file) and
> `design-system/pages/[page-name].md` if one exists. Where this file disagrees
> with either, they win. The spacing, shadow, radius, and anti-pattern sections
> below are still current. The Motion and Style Guidelines sections are **not** —
> each carries its own note.

---

## Global Rules

### Color Palette

Values mirror `app/globals.css`. Never copy a hex out of this table into a
component — reference the token.

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary (action) | `#0052FF` | `--color-primary` |
| Primary hover | `#0041CC` | `--color-primary-hover` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary (deal heat) | `#BC0000` | `--color-secondary` |
| Accent (ink band) | `#0B0B0C` | `--color-accent` |
| On Accent | `#FFFFFF` | `--color-on-accent` |
| Background | `#FFFFFF` | `--color-background` |
| Surface (card) | `#FFFFFF` | `--color-surface` |
| Foreground | `#0B0B0C` | `--color-foreground` |
| Foreground muted | `#6B6B72` | `--color-foreground-muted` |
| Muted (chip fill) | `#F5F5F6` | `--color-muted` |
| Border | `#E5E5E7` | `--color-border` |
| Destructive | `#BC0000` | `--color-destructive` |
| Warning | `#92400E` | `--color-warning` |
| Success (text) | `#0C7A53` | `--color-success` |
| Success fill | `#10B981` | `--color-success-fill` |
| Ring | `#0052FF` | `--color-ring` |

**Color Notes:** Electric blue + ink on white, in a 60 / 20 / 20 budget — 60%
white surface, 20% blue, 20% ink. The budget is the design; blue spent on
borders, icon backgrounds, and headings is what makes a two-colour brand look
generic.

Two colours sit outside the budget with one narrow job each:

- **Red is deal heat** — a campaign badge, an expiry label. `--color-destructive`
  is the same red, so an error must always carry an icon **and** a word; colour
  alone cannot separate "danger" from "hot deal".
- **Green is a saving.** `--color-success` (5.3:1 on white) is the only green that
  may carry text. `--color-success-fill` measures **2.4:1** and is legal only as a
  fill — a status dot, an icon body, a badge background with the label beside it.
  `text-success-fill` is a bug, not a style choice.

**Accent is ink, not a green CTA.** The generated palette used `--color-accent`
for a green call-to-action; in this product the call to action is
`--color-primary` and accent is the black used for full-bleed bands.

**Deliberate deviation from the mockup:** `--color-background` and
`--color-surface` are both pure `#FFFFFF`. `beranda-user.md` washes the page in
`#FBF8FF`; that tint fights white card surfaces and `design.md` §4.2 bans tonal
section washes outright.

### Typography

- **Heading Font:** Plus Jakarta Sans — `--font-heading`
- **Body Font:** Inter — `--font-sans`
- **Mood:** corporate, trustworthy, accessible, readable, professional, clean
- **No third family.** Headings, stat values, and the wordmark take the heading
  face; everything else takes the body face.

Plus Jakarta Sans holds up at the tight tracking headlines use here and was cut
for Indonesian text. Inter carries the tabular figures every price and token
balance depends on — see the `.tabular` helper in `app/globals.css`.

**Loading:** `next/font/google` in `app/layout.tsx`, which self-hosts the files
and emits the `--font-jakarta` / `--font-inter` variables that `globals.css`
maps onto `--font-heading` / `--font-sans`. There is **no** `@import url(...)`
and no `<link>` to `fonts.googleapis.com` — adding one would ship a third-party
request and a render-blocking stylesheet for fonts that are already local.

### Spacing Variables

*Density: 6/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

The Tailwind class stacks these correspond to live in `design.md` §5. The CSS
below exists only so the values are legible outside Tailwind; every one of them
is a token, and no component should carry a literal.

### Buttons

```css
/* Primary — exactly one per screen. */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  min-height: 44px; /* the floor on every tappable element, no exceptions */
  padding: 0 var(--space-md);
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: background-color var(--duration-base) var(--ease-out);
  cursor: pointer;
}

/* Hover shifts colour. It does not fade opacity and does not lift the element —
   a translate on hover shifts layout and reads as sloppy on a data surface. */
.btn-primary:hover {
  background: var(--color-primary-hover);
}

/* Secondary — outlined, ink text. Never a second blue in the same viewport. */
.btn-secondary {
  background: var(--color-surface);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  min-height: 44px;
  padding: 0 var(--space-md);
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: background-color var(--duration-base) var(--ease-out);
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--color-muted);
}
```

### Cards

`design.md` §4.4 governs *when* a card is correct: only for a discrete object the
user acts on (a lead, an offer, a top-up package, a CRM record). Ledger rows,
FAQ items, and feature lists are hairline-divided lists with no card and no
shadow.

```css
.card {
  background: var(--color-surface); /* white, not a tinted wash */
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--duration-base) var(--ease-out);
}

/* Hover raises the border, never the shadow, and never lifts the card. */
.card:hover {
  border-color: color-mix(in srgb, var(--color-foreground) 20%, transparent);
}
```

### Inputs

```css
.input {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 16px; /* below 16px iOS zooms the page on focus */
  transition: border-color var(--duration-base) var(--ease-out);
}

.input:focus-visible {
  border-color: var(--color-ring);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ring) 20%, transparent);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

> **Superseded, 2026-08-16.** `design.md` §1 sets the genre to **editorial
> catalogue** — an automotive spec sheet, not a soft-UI SaaS page. Structure
> comes from hairline rules and numbered section indices, not from shadow depth.
> The section order below is the pattern `design.md` §1 names and forbids by
> name, and its "Trust/Safety" band is unbuildable under §9: the trust numbers a
> band like that needs do not exist in any table, and inventing them is the one
> thing this product cannot do. One line held: the search bar **is** the call to
> action — the customer homepage hero is a live request bar, not a link to a form.
> Read the rest as history.

**Style:** Soft UI Evolution

**Keywords:** Evolved soft UI, better contrast, modern aesthetics, subtle depth, accessibility-focused, improved shadows, hybrid

**Best For:** Modern enterprise apps, SaaS platforms, health/wellness, modern business tools, professional, hybrid

**Key Effects:** Improved shadows (softer than flat, clearer than neumorphism), modern (200-300ms), focus visible, WCAG AA/AAA

### Page Pattern

**Pattern Name:** Marketplace / Directory

- **Conversion Strategy:** Search bar is the CTA. Reduce friction to search. Popular searches suggestions.
- **CTA Placement:** Hero Search Bar + Navbar 'List your item'
- **Section Order:** 1. Hero (Search focused), 2. Categories, 3. Featured Listings, 4. Trust/Safety, 5. CTA (Become a host/seller)

---

## Motion

> **Superseded, 2026-08-16.** This project is **motion-cut** (`design.md` §6):
> no `gsap`, no `framer-motion`, no `lenis`, and none of them is in
> `package.json`. The snippet below would not run. Motion is CSS transitions
> only, on `color`, `background-color`, `border-color`, `opacity`, and
> `transform` — never on `width`, `height`, `top`, or `left` — at
> `--duration-fast` to `--duration-base` with `--ease-out`, one transition per
> element. The budget is small enough that there is nothing for
> `prefers-reduced-motion` to switch off. Kept for the record only.

**Stagger List** (Standard) — Trigger: load or scroll | Duration: 300-450ms | Easing: `back.out(1.4)`

```js
gsap.from('.grid-item', { opacity: 0, scale: 0.92, y: 16, duration: 0.4, stagger: { each: 0.06, from: 'start', grid: 'auto' }, ease: 'back.out(1.4)' });
```

**Framework notes:** grid: 'auto' lets GSAP infer rows/columns from a CSS grid layout for a natural wave stagger

- ✅ Combine with from: 'center' for a bento-grid layout to draw the eye inward first
- ❌ Don't use back.out on dense data tables; the overshoot reads as sloppy on informational UI
- ⚡ Group DOM writes; avoid interleaving layout reads (getBoundingClientRect) between staggered tweens

---

## Anti-Patterns (Do NOT Use)

- ❌ Static product pages
- ❌ Poor UX

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

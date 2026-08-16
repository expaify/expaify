# UX Design Spec — Dark Homepage Prototype v2

**Ticket:** UXDES-dark-homepage-prototype-01
**Input:** `docs/pipeline/dark-homepage-prototype/02-research.md` (directives D1–D7)
**Scope:** `.theme-dark-preview` CSS block in `app/globals.css` (append/extend only) + route-local
markup in `app/preview/dark-home/page.tsx`. **No shared component files change**
(`DealCard.tsx`, `LockedDealCard.tsx`, `LandingNav.tsx`, `FaqAccordion.tsx`, `DealChip.tsx` are
untouched). No shared `.text-*`/`--radius-*`/`--shadow-*` *tokens'* meaning changes for light mode —
only their values are re-declared inside the `.theme-dark-preview` scope, exactly as the accepted
first attempt already does for `--bg`, `--ink`, etc. No change to `app/page.tsx` or any API/data
logic. **Copy: zero changes.** Every visible string in this spec is byte-identical to what's in
`page.tsx` today — this document only assigns new classes, tokens, and route-local wrapper
elements to existing strings/DOM nodes.

**Mechanism note for shared components:** `DealCard.tsx` and `LockedDealCard.tsx` cannot be edited,
but their *rendered output* can still be styled from route-scoped CSS using stable, non-fragile
selectors: `DealCard`'s root is always a semantic `<article>` (only `<article>` on this route), and
`LockedDealCard`'s root `<a>` always carries `aria-label="Locked premium deal. …"` (stable, defined
in the component itself — verified in `LockedDealCard.tsx:40`). This spec uses those two selectors,
scoped under `.theme-dark-preview`, everywhere a shared card needs a treatment. This is the same
category of technique the accepted prototype already uses for `.theme-dark-preview .btn-outline`
(a shared class, restyled only via scope, never edited at its source).

---

## 1. Hierarchy on this surface

| Tier | Elements | Why |
|---|---|---|
| **Primary** | Hero `<h1>`, hero conversion CTA ("Join for free"), hero `DealCard` (glass panel) | First-scroll moment; the one thing a first-time visitor must register in <2s. |
| **Secondary** | Section `<h2>`s, "See live deals" outline CTA, Pricing cards (Premium card gets the extra glow — it's secondary content but primary *decision*), the dark contrast band panel (D7) | Scroll-driven proof points; each earns one deliberate visual event, none competes with the hero. |
| **Tertiary** | Eyebrow/label text (pricing tier names, footer column headers, the "2 months free" badge label), decorative "01/02/03" numerals, destination tile grid, logo strip, footer link lists, captions | Metadata and navigation — must recede, never compete with H1/H2 weight or size. |

This ordering directly resolves Finding 1 (`text-display` used for hero, decorative numerals, and
price stat simultaneously — one scale doing three jobs). Under this spec, hero/H2/numeral/stat are
four distinct scales with distinct weight and opacity treatment (§3).

---

## 2. Design tokens — add to the `.theme-dark-preview` block

All of the following are **new declarations inside the existing `.theme-dark-preview { … }`
selector** in `app/globals.css` (the block currently at lines 492–512), or **new rules appended
after it**, in the same file, same scoping pattern already established. Nothing here touches
`:root`.

```css
.theme-dark-preview {
  /* ── existing declarations (bg, surface, ink, etc.) stay as-is, EXCEPT: ── */

  /* D2 — surface becomes a translucent layer, not a flat hex, so the atmosphere
     glow (D4) genuinely shows through section bands and card rest-states. */
  --surface: rgba(255, 255, 255, 0.035);

  /* D5 — dark-route corner radius, independent of the shared --radius-card token
     (24px) used by the light marketplace theme. */
  --radius-card: 16px;

  /* D2 — resting-state elevation (NEW token — nothing in a shared component
     hardcodes this name, safe to introduce). Cards get this at rest; hover
     keeps using --shadow-card-hover, which IS hardcoded inside DealCard.tsx /
     LockedDealCard.tsx as `shadow-[var(--shadow-card-hover)]` — do not rename
     that token, only its value changes below. */
  --shadow-card-rest: 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06);

  /* D2 hover tier — brighten the border-equivalent term and (D6) commit harder
     to teal as the glow color: 0.08 → 0.12 opacity on the ambient teal term. */
  --shadow-card-hover: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 40px rgba(14, 90, 84, 0.12);

  /* D3 — glass treatment values for the two "hero panel" moments. */
  --dp-glass-bg: rgba(23, 21, 18, 0.55);
  --dp-glass-blur: 20px;
  --dp-glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.05);

  /* D5 — primary CTA shape, independent of --radius-pill (which .btn-outline
     keeps, preserving a primary/secondary shape distinction that doesn't
     exist today — right now both are the same pill). */
  --dp-radius-cta: 12px;

  /* D4 — decorative numeral color, dimmer than --line-ivory (0.1) so it reads
     as pure background texture, not a competing headline (Finding 1). */
  --dp-numeral-color: rgba(255, 255, 255, 0.06);

  /* Accessibility fix found during this pass, not in the original 7 findings:
     the base :focus-visible outline is `3px solid var(--primary)` (globals.css:182)
     and the box-shadow ring uses --focus-ring built from --primary
     (#0E5A54). Computed WCAG contrast of #0E5A54 against this route's
     --bg (#0B0A0A) is ≈2.46:1 — fails the 3:1 minimum for non-text focus
     indicators (WCAG 2.4.11 / 1.4.11). --primary-soft (#9FE1CB, the
     underused mint Finding 5 calls out as never given a job) computes to
     ≈13.3:1 on --bg and ≈12.3:1 on --surface — pin it as this route's focus
     color. This also gives --primary-soft the "deliberate job" Finding 5
     says it's missing. */
  --focus-outline: var(--primary-soft);
  --focus-ring: 0 0 0 4px color-mix(in srgb, var(--primary-soft) 32%, transparent);
}

/* The base rule hardcodes var(--primary) directly (not --focus-outline), so
   it needs an explicit scoped override — --focus-outline alone won't reach it. */
.theme-dark-preview :focus-visible {
  outline-color: var(--primary-soft);
}
```

---

## 3. D1 — Dark-route-only type scale

New route-scoped classes, appended after the existing `.theme-dark-preview` rules in
`globals.css`. These are **additive** classes used only in `app/preview/dark-home/page.tsx` — they
do not replace or alias `.text-display`/`.text-h2`/etc., which remain fully intact for the light
site and for any shared component (`DealCard`'s `.text-h3` hotel name, `.text-body` copy, etc. are
explicitly untouched — Finding 1's fix applies only to hero/section headings/numerals/eyebrows,
never to shared component internals).

```css
/* Hero H1 — the one 60-64px moment on the page. Distinct from .text-display
   (44px/700/tracking:0) in size, weight, and tracking. */
.theme-dark-preview .dp-hero {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 36px;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
@media (min-width: 768px) {
  .theme-dark-preview .dp-hero { font-size: 56px; }
}
@media (min-width: 1280px) {
  .theme-dark-preview .dp-hero { font-size: 64px; }
}

/* Section H2 — six usages (live teaser, destinations, how-it-works, dark band,
   pricing, FAQ). Stepped down clearly from the hero: 36→64px hero vs 28→38px
   here, AND a full weight step differentiates them (600 vs the light site's
   uniform 700), unlike today's --text-display/--text-h2 pair which share the
   same 700 weight and only differ in size. */
.theme-dark-preview .dp-h2 {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
}
@media (min-width: 768px) {
  .theme-dark-preview .dp-h2 { font-size: 34px; }
}
@media (min-width: 1280px) {
  .theme-dark-preview .dp-h2 { font-size: 38px; }
}

/* Eyebrow/label — pricing tier names ("Free"/"Premium"), footer column
   headers ("Product"/"Account"/"Legal"), and the "2 months free" badge
   label. Real tracking (0.08em) instead of the sitewide 0, smaller and
   dimmer so it reads as metadata, not a competing headline. */
.theme-dark-preview .dp-eyebrow {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}

/* Decorative "01/02/03" numerals in How It Works — previously .text-display
   (identical to the hero). Now large but receded via opacity/color, not
   competing on weight/size perception even though the raw px is bigger. */
.theme-dark-preview .dp-numeral {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 56px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.02em;
  color: var(--dp-numeral-color);
}
@media (min-width: 768px) {
  .theme-dark-preview .dp-numeral { font-size: 80px; }
}

/* Pricing stat ($0 / $8) — previously .text-stat, identical size/weight to
   .text-display. Now its own scale, distinct from both hero and numeral. */
.theme-dark-preview .dp-stat {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}
@media (min-width: 640px) {
  .theme-dark-preview .dp-stat { font-size: 48px; }
}
```

### Exact markup mapping (`app/preview/dark-home/page.tsx`)

| Line (current) | Current class | New class |
|---|---|---|
| 153 hero `<h1>` | `text-display` | `dp-hero` |
| 222 live-teaser `<h2>` | `text-h2` | `dp-h2` |
| 258 destinations `<h2>` | `text-h2` | `dp-h2` |
| 281 how-it-works `<h2>` | `text-h2` | `dp-h2` |
| 304 numeral `<span>` | `text-display` (inline `color: var(--line-ivory)`) | `dp-numeral` (drop the inline `style`; color now comes from `.dp-numeral`) |
| 326 dark-band `<h2>` | `text-display` | `dp-h2` (see §7 — this section's distinction comes from its panel/glow treatment, not a bigger type size) |
| 345 pricing `<h2>` | `text-h2` | `dp-h2` |
| 356 "Free" label | `text-small font-medium uppercase tracking-wider` | `dp-eyebrow` (drop `text-small font-medium uppercase tracking-wider`; uppercase now baked via `text-transform` — see note below) |
| 360 `$0` | `text-stat` | `dp-stat` |
| 397 "Premium" label | `text-small font-medium uppercase tracking-wider` | `dp-eyebrow` |
| 400 "2 months free" badge text | `text-caption` | `dp-eyebrow` (keep the badge's own pill/padding classes — see §6) |
| 405 `$8` | `text-stat` | `dp-stat` |
| 456 FAQ `<h2>` | `text-h2` | `dp-h2` |
| 542, 562, 582 footer column headers | `text-caption ... uppercase tracking-wider` | `dp-eyebrow` |

Note: `.dp-eyebrow` does not itself set `text-transform: uppercase` (kept as a Tailwind utility on
the element, `uppercase`, so implementers keep that utility class alongside `dp-eyebrow` — only
`text-small`/`text-caption`/`font-medium`/`tracking-wider` are replaced by the single `dp-eyebrow`
class).

Everything **not** in this table (H3 card titles inside `DealCard`, body copy, small copy,
captions on cards) is untouched — those live inside the shared component and are correctly out of
scope per Finding 1's own framing ("does not touch the shared `.text-*` classes").

---

## 4. D2 + D3 — Elevation (3-tier) and glass

### Tier definitions

| Tier | Surface | Treatment |
|---|---|---|
| **0 — Canvas** | Page `<body>` background | `--bg: #0B0A0A`. Unchanged. |
| **1 — Resting card/panel** | `DealCard`, `LockedDealCard`, pricing cards, dark-band panel | `background: var(--surface)` (now `rgba(255,255,255,0.035)`, §2) + `box-shadow: var(--shadow-card-rest)` at rest. Visible luminance step + ambient shadow *before* any interaction — resolves Finding 2's "everything same elevation, no resting depth cue." |
| **2 — Hover/raised** | Same elements, on hover/focus-within | `box-shadow: var(--shadow-card-hover)` (already wired via the components' own `group-hover:shadow-[var(--shadow-card-hover)]` class — only the token *value* changes), border brightens `rgba(255,255,255,0.1)` → `rgba(255,255,255,0.24)` (new, see below), `translateY(-4px)` (already present via `-translate-y-1`). |

### CSS

```css
/* Tier 1 — resting elevation for both shared card components, reached via
   stable tag/attribute selectors (see mechanism note, §0) — no component
   file is edited. */
.theme-dark-preview main article {
  box-shadow: var(--shadow-card-rest);
  transition: box-shadow 200ms ease-out, border-color 200ms ease-out;
}
.theme-dark-preview main a[aria-label^="Locked premium deal"] {
  box-shadow: var(--shadow-card-rest);
  transition: box-shadow 200ms ease-out, border-color 200ms ease-out;
}

/* Tier 2 — hover border brightening. DealCard/LockedDealCard both render
   border-[color:var(--line-ivory)] at rest (0.1 alpha); on hover the
   article's *computed* border color should read closer to 0.24. Since the
   component hardcodes --line-ivory as its border source, brighten it
   locally on the interactive ancestor via a scoped custom property nudge
   rather than fighting specificity on the Tailwind arbitrary class: */
.theme-dark-preview main .group:hover article,
.theme-dark-preview main a[aria-label^="Locked premium deal"]:hover {
  --line-ivory: rgba(255, 255, 255, 0.24);
}
```

`DealCard` wraps its `<article>` in `<div className="group relative">` (`DealCard.tsx:271`) only
when `href` is passed — true for every DealCard instance on this route. `.group:hover article`
therefore fires exactly on pointer/keyboard hover of the wrapping link, and because `--line-ivory`
is a custom property, redeclaring it on the hovered ancestor cascades into the article's own
`border-[color:var(--line-ivory)]` utility without touching the component.

### D3 — Glass panels (hero deal-card stack + pricing cards)

Two glass targets, per the research brief's explicit read of the "glass/frosted panels" ask:

**1. Hero deal-card stack** (`page.tsx:177–198`, the peeking `LockedDealCard` + front `DealCard`).
Add one wrapper class to the *existing* outer wrapper div (`<div className="relative w-full">` at
line 178 — becomes `<div className="relative w-full dp-glass-scope">`), no new DOM nodes:

```css
.theme-dark-preview .dp-glass-scope article,
.theme-dark-preview .dp-glass-scope a[aria-label^="Locked premium deal"] {
  background: var(--dp-glass-bg);
  backdrop-filter: blur(var(--dp-glass-blur));
  -webkit-backdrop-filter: blur(var(--dp-glass-blur));
  box-shadow: var(--dp-glass-highlight), var(--shadow-card-rest);
}
.theme-dark-preview .dp-glass-scope .group:hover article,
.theme-dark-preview .dp-glass-scope a[aria-label^="Locked premium deal"]:hover {
  box-shadow: var(--dp-glass-highlight), var(--shadow-card-hover);
}
```

Both the front card and the peeking card behind it become genuinely translucent, so the
repositioned hero glow (§5) visibly refracts through both layers of the stack — the literal
"floating glass panel" read the brief asked for.

**2. Pricing cards** (`page.tsx:354` Free, `:391–394` Premium — plain route-local `<div>`s, no
shared component involved, so classes are edited directly, no selector trick needed):

- Free card (line 354), replace `bg-[color:var(--surface)]` with `dp-glass-panel`:
  `className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] dp-glass-panel p-7"`
- Premium card (lines 391–394), replace `bg-[color:var(--surface)]` with `dp-glass-panel dp-glass-premium`:
  `className="flex flex-col gap-6 rounded-[var(--radius-card)] border-2 dp-glass-panel dp-glass-premium p-7"` (keep the existing inline `style={{ borderColor: 'var(--primary)' }}`).

```css
.theme-dark-preview .dp-glass-panel {
  background: var(--dp-glass-bg);
  backdrop-filter: blur(var(--dp-glass-blur));
  -webkit-backdrop-filter: blur(var(--dp-glass-blur));
  box-shadow: var(--dp-glass-highlight), var(--shadow-card-rest);
}
```

Pricing section (`page.tsx:344`) has no `bg-surface` band of its own — it sits directly on the page
canvas + atmosphere layer, so `backdrop-filter` on these two cards genuinely blurs the pricing
section's dedicated glow (§5) behind them, not a flat color.

---

## 5. D4 — Anchored glow, full scroll-depth coverage

### Base atmosphere layer — revise `.dark-preview-atmosphere` in place

```css
.theme-dark-preview .dark-preview-atmosphere {
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
  background-image:
    /* D4 + D6 — moved from an arbitrary top-right corner (78% 7%) to
       originate behind the hero CTA/deal-card cluster (roughly where the
       card stack sits in the two-column layout at ≥900px). Coral gradient
       removed entirely — commit to teal as the single ambient color
       (D6: "a single confidently-used accent beats two timid ones"). */
    radial-gradient(circle at 66% 22%, rgba(14, 90, 84, 0.22), transparent 30rem),
    linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px);
  background-size: auto, 48px 48px, 48px 48px;
  /* D4 — was a hard fade to fully transparent by 88%, leaving the back half
     of the page (pricing/FAQ/footer) flat #0B0A0A. Now the grid/glow never
     fully disappears — it settles at 35% strength for the remainder of the
     scroll, so every section has *some* ambient treatment, satisfying D4
     without new per-section markup for the mid-page sections (the
     now-translucent --surface bands, §2/§4, let this layer read through
     their section backgrounds too). */
  mask-image: linear-gradient(
    to bottom,
    black 0%,
    rgba(0, 0, 0, 0.75) 30%,
    rgba(0, 0, 0, 0.45) 55%,
    rgba(0, 0, 0, 0.35) 100%
  );
}
```

At 66% 22% (roughly upper-right of the two-column hero at ≥900px, where the card stack sits) the
glow now sources from the hero's actual visual anchor rather than an unrelated corner coordinate.
Below 900px the hero stacks to a single column and the glow simply reads as "behind the top of the
hero content," which is still anchored (not floating) — acceptable since mobile hero content is
vertically stacked and the glow's origin point is still within the hero's visual bounds.

### Section-local glows — two new additions, both route-local `aria-hidden` divs

**Pricing section** — ambient section glow behind the heading, plus a tighter glow specifically
behind the Premium card reinforcing "recommended" (D6 ties this to teal, not a border alone).

In `page.tsx`, inside the `<section id="pricing" ...>` (line 344), immediately after the opening
tag, add:

```tsx
<div className="dp-glow-pricing" aria-hidden="true" />
```

And wrap the Premium card's existing container (`page.tsx:391`) — no new div needed, use a
`::before` on the card itself via `dp-glass-premium` (already added in §4):

```css
.theme-dark-preview .dp-glow-pricing {
  position: absolute;
  left: 50%;
  top: 0;
  width: 40rem;
  height: 18rem;
  transform: translateX(-50%);
  pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(14, 90, 74, 0.09), transparent 70%);
  z-index: 0;
}
/* Pricing section needs position:relative for the absolute glow to anchor
   correctly — add to the section's existing classes in page.tsx:
   className="dark-preview-reveal relative mx-auto max-w-[1140px] px-5 py-20" */

.theme-dark-preview .dp-glass-premium {
  position: relative;
}
.theme-dark-preview .dp-glass-premium::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 0%, rgba(14, 90, 84, 0.18), transparent 65%);
  pointer-events: none;
  z-index: -1;
}
```

The 40rem/18rem section-level glow at 9% opacity sits within the brief's own "16–20rem soft glow at
8–10% opacity" guidance (widened here to 40rem because it spans a 760px-max-width two-card row, not
a single heading); the Premium-card-specific glow is tighter (card-bound) and slightly stronger
(18%) precisely because its job is emphasis/recommendation, not ambient texture — those are two
different jobs and get two different treatments.

**Dark contrast band** — see §7 (D7), which specifies its own, strongest-on-the-page glow as part
of rebuilding that section as a distinct panel.

**Sections that get no new markup:** Logo strip, Live teaser, Destinations, How-it-works, FAQ,
Footer. These rely entirely on the revised base atmosphere's extended mask (above) plus the
now-translucent `--surface` bands (§2) letting that base layer read through their section
backgrounds. This satisfies D4's "give every dark section some (even minimal) ambient treatment"
without seven bespoke glow divs — mid-page sections get a faint, consistent wash; the two sections
that need to feel like *events* (Pricing/Premium, dark band) get dedicated, stronger treatment.

---

## 6. D5 — Corner radius

Already covered by `--radius-card: 16px` (§2), which cascades automatically into every
`rounded-[var(--radius-card)]` usage on the route — `DealCard`, `LockedDealCard`, both pricing
cards, and the destination tiles (`page.tsx:269`) — with **zero markup changes required**, since
all of them read the CSS custom property rather than a hardcoded value.

Primary CTA gets its own shape, independent of `--radius-pill` (which `.btn-outline` keeps, so a
primary/secondary shape distinction now exists where today both are identical pills):

```css
.theme-dark-preview .btn-conversion {
  color: #141210; /* existing override, unchanged */
  border-radius: var(--dp-radius-cta); /* 12px — NEW */
}
```

This affects all three `.btn-conversion` instances on the route ("Join for free," "Get started
free," "Start free trial") uniformly — consistent primary-action shape language throughout.
`.btn-outline` ("See live deals") is untouched by this rule and stays a full pill (`--radius-pill:
999px`, inherited, unmodified), which is now a deliberate visual distinction rather than an
accident of both buttons sharing one shape.

Badges (`DealChip`'s discount pill, the "2 months free" chip, `LockedDealCard`'s "Members"/"Save
X%" chips) keep `--radius-pill` — D5 targets cards and the primary CTA specifically; pills-for-
badges vs. rectangles-for-cards/CTAs is itself a useful shape hierarchy and should not be flattened.

---

## 7. D6 — Teal committed, coral given one job

### Teal — signature interactive/glow color

1. **Hover glow, deliberate not incidental.** The existing `.btn-outline:hover` rule
   (`globals.css:547–551`) already does the *right thing* but too timidly (0.14 opacity, and the
   comment on Finding 5 calls this out as "just a border-color swap"). Bump it:

```css
.theme-dark-preview .btn-outline:hover,
.theme-dark-preview .btn-outline:focus-visible {
  border-color: var(--primary);
  color: var(--ink);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  box-shadow: 0 0 32px rgba(14, 90, 84, 0.35);
}
```

2. **Focus ring** — handled in §2 (`--focus-outline`/`--focus-ring` repointed to `--primary-soft`
   for contrast reasons; still teal-family, now confidently visible against the near-black canvas
   rather than failing contrast).

3. **Premium pricing card ambient glow** — handled in §5 (`.dp-glass-premium::before`), ties the
   "recommended" tier to the same teal identity as the rest of the interactive system.

4. **Card hover glow** — handled in §4 (`--shadow-card-hover`'s teal term bumped 0.08 → 0.12).

Between the outline-button hover glow, the focus ring, the Premium card glow, the card hover glow,
and the base atmosphere's now-teal-only radial gradient, teal is now the *single* color doing every
glow/interactive job on the page — resolving Finding 5's "shows up dark-mode as a timid corner blob
and an inherited link color, never as a deliberate glow or elevation cue."

### Coral — exactly one job

Per Finding 5, coral currently appears in exactly two places: the atmosphere glow (5.5% opacity,
imperceptible — **removed entirely in §5**) and `.btn-conversion`'s background (inherited,
unmodified, already reasonably visible as a solid fill — not the part of coral that reads as
"invisible"). The one new, deliberate, confident job assigned here is the **"2 months free"
annual-plan savings badge** — this is route-local markup (`page.tsx:400–402`, not a shared
component), so it's directly editable:

```
Before: rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-2 py-0.5 font-display
        text-caption font-bold leading-none text-[color:var(--gold-text)]
After:  rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-2 py-0.5 font-display
        dp-eyebrow leading-none text-[#141210] dp-badge-glow
```

```css
.theme-dark-preview .dp-badge-glow {
  box-shadow: 0 0 16px rgba(255, 107, 74, 0.3);
}
```

Text color `#141210` matches the exact, already-verified-AA dark ink used on `.btn-conversion`
(6.6:1 on coral — `globals.css:285`'s documented ratio applies identically here, same fill color).
This gives coral one full-strength, full-saturation, deliberately glowing job — clearly the
"something's on sale" signal — rather than two timid, near-invisible ones. `DealChip`'s discount
badge (shared component) is *not* recolored — it's gold today (`--gold`/`--gold-text`), not coral,
was never part of Finding 5's actual complaint (which only names the atmosphere glow and
`.btn-conversion`), and recoloring it would require editing a shared component, which is out of
scope for this ticket.

---

## 8. D7 — "One deal. Four marketplaces. Zero tabs." as a distinct panel

Currently (`page.tsx:321`) this section is a full-bleed band using `bg-[color:var(--bg)]` with a
hairline top/bottom border — indistinguishable from every other section now that the light/dark
swap trick that gave it contrast on the live site no longer applies. Rebuild it as a **contained,
elevated glass panel with the strongest glow on the page**, combining both options the research
brief offered rather than picking one:

```tsx
{/* ── Dark band ───────────────────────────────── */}
<section className="dark-preview-reveal relative py-20">
  <div className="dp-glow-band" aria-hidden="true" />
  <div className="mx-auto max-w-[1140px] px-5">
    <div className="dp-hero-panel flex flex-col items-center gap-12 rounded-[var(--radius-card)] p-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:p-14">
      {/* Text — unchanged content */}
      <div className="max-w-[440px] flex-shrink-0">
        <h2 className="dp-h2 text-[color:var(--text-inverse)]">
          One deal.{' '}
          <span className="text-[color:var(--primary-soft)]">Four marketplaces.</span>{' '}
          Zero tabs.
        </h2>
        <p className="text-body mt-6 text-[color:var(--ink-faint-on-dark)]">
          You always book directly with the marketplace — we just find the moment to strike.
        </p>
      </div>
      {/* Deal card on dark — unchanged content */}
      <div className="w-full max-w-[360px] flex-shrink-0">
        <DealCard deal={heroCard} href={hasReal ? '/deals' : undefined} />
      </div>
    </div>
  </div>
</section>
```

```css
/* The panel: elevated (tier 2 baseline, brighter than a resting card since
   this is the page's single strongest proof point), inset within the
   section rather than full-bleed, with its own border. */
.theme-dark-preview .dp-hero-panel {
  position: relative;
  background: var(--dp-glass-bg);
  backdrop-filter: blur(var(--dp-glass-blur));
  -webkit-backdrop-filter: blur(var(--dp-glass-blur));
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: var(--dp-glass-highlight), 0 12px 48px rgba(0, 0, 0, 0.55);
}

/* Strongest glow on the page — unambiguous "this is the hero proof point"
   signal, per D7's own framing. Wide ellipse centered behind the panel. */
.theme-dark-preview .dp-glow-band {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 60rem;
  height: 30rem;
  transform: translate(-50%, -50%);
  pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(14, 90, 84, 0.24), transparent 70%);
  z-index: 0;
}
```

The section wrapper drops its `border-y border-[color:var(--line-ivory)] bg-[color:var(--bg)]`
(no longer needed — the panel itself now carries the border/background job) and gains `relative`
for the glow's absolute positioning. The inner `DealCard` on this panel is **not** wrapped in
`dp-glass-scope` — it should read as sitting *on* the glass panel (solid resting-tier card, §4),
not as a second nested glass layer; two stacked translucencies would muddy the "hero proof point"
read this section is specifically trying to earn.

Result: 0.24 opacity is the highest teal-glow value anywhere in the spec (hero atmosphere origin is
0.22, pricing section ambient is 0.09, Premium card is 0.18), so this section is unambiguously the
single strongest visual event on the page below the hero, and it now has a genuine reason to exist
independent of the light/dark contrast trick the live site relies on.

---

## 9. State matrix

| State | Hero CTA (`.btn-conversion`) | Secondary CTA (`.btn-outline`) | Cards (`DealCard`/`LockedDealCard`/pricing) | Destination tile | Focus ring source |
|---|---|---|---|---|---|
| **Default** | Coral fill, ink text, 12px radius | Transparent, `--line-white` border, pill | Tier-1 resting elevation (§4); glass on hero stack + pricing (§4) | `--line-ivory` border, `--surface` bg (translucent) | n/a |
| **Hover** | Existing `.btn:hover` opacity/transform behavior (unchanged — no dark-specific hover rule needed beyond the shape change) | Teal border + 8% teal bg tint + 0.35-opacity teal glow (§7) | `-translate-y-1`, `--shadow-card-hover` (0.12 teal term), border brightens to `rgba(255,255,255,.24)` (§4) | `hover:text-[color:var(--primary)]` (existing, unchanged) | n/a |
| **Focus-visible (keyboard)** | 3px `--primary-soft` outline + `--focus-ring` box-shadow (§2), both AA-contrast-verified against `--bg`/`--surface` | Same | Same (card links/DealCard's overlay `<a>` inherit the global `:focus-visible` rule) | Same | Global `:focus-visible` rule, scoped color override (§2) |
| **Active/pressed** | No dark-specific override — inherits `.btn`'s existing `transition` on `transform`; no new spec needed, not called out by any directive | Same | Same | Same | n/a |
| **Disabled** | `.btn:disabled` opacity 0.55 (existing, unchanged — no CTA on this route is ever rendered disabled, but the rule stays correct if one is added later) | Same | n/a | n/a | n/a |

---

## 10. Breakpoint notes — 375px and 1280px

**375px (mobile):**
- Hero: single column (`min-[900px]:flex-row` not yet active), `.dp-hero` at 36px/600/-0.02em —
  fits comfortably in the 343px content width (375 − 2×16px page padding).
- Hero card stack: peeking card hidden below 380px (`hidden min-[380px]:block`, unchanged), so at
  exactly 375px only the front glass `DealCard` renders — still valid, glass treatment applies
  regardless of whether the peek card is present.
- Pricing cards: single column (`min-[640px]:grid-cols-2` not active), full-width glass panels,
  `.dp-stat` at 40px.
- Destination tiles: 2-column grid (`grid-cols-2`, unchanged), 16px radius tiles — no glass (tier-1
  resting only, per §4's explicit "destination tiles keep simpler treatment" call), avoids visual
  noise across ~20 small tiles.
- Dark-band panel (§7): `p-8` (32px) padding at this width (not yet at `min-[900px]:p-14`),
  `flex-col` stack — glow ellipse (60rem/30rem) safely exceeds viewport width, no clipping risk
  since it's `position: absolute` inside `overflow: clip` on `.theme-dark-preview` (existing,
  `globals.css:510`).
- Numerals (`.dp-numeral`): 56px in a single-column How It Works layout (`min-[640px]:grid-cols-3`
  not active) — no overflow risk, plenty of column width at 343px content width.

**1280px (desktop):**
- Hero: two-column (`min-[900px]:flex-row` active), `.dp-hero` at its maximum 64px step (the
  `min-width: 1280px` breakpoint added specifically in §3 to hit this exact viewport), atmosphere
  glow at 66%/22% now visibly sits behind the right-column card stack as intended.
- Section H2s at their maximum 38px step.
- Pricing: 2-column (`min-[640px]:grid-cols-2` active well before 1280), `.dp-glow-pricing`'s
  40rem-wide ellipse now has room to read as a soft wash behind both cards rather than being
  cropped by a narrow viewport.
- Dark-band panel: `min-[900px]:flex-row min-[900px]:p-14` active, 56px padding, panel width capped
  at `max-w-[1140px]` (existing container), glow ellipse fully visible.
- Numerals at 80px, three-column grid (`min-[640px]:grid-cols-3` active).

---

## 11. Directive coverage checklist

| Directive | Resolved by |
|---|---|
| D1 — dark-route type scale | §3 (`.dp-hero`, `.dp-h2`, `.dp-eyebrow`, `.dp-numeral`, `.dp-stat`) |
| D2 — elevation system | §4 (`--shadow-card-rest`, tier-2 border brighten, translucent `--surface`) |
| D3 — glass treatment | §4 (`.dp-glass-scope`, `.dp-glass-panel` on hero stack + pricing cards) |
| D4 — anchored glow, full scroll depth | §5 (repositioned/coral-free base atmosphere, extended mask, pricing + dark-band local glows) |
| D5 — reduced corner radius | §2 (`--radius-card: 16px`) + §6 (`--dp-radius-cta: 12px` on `.btn-conversion` only) |
| D6 — teal committed / coral one job | §7 (outline hover glow, focus ring, Premium glow, card hover glow all teal; coral → "2 months free" badge only) |
| D7 — dark-band rebuilt as distinct panel | §8 (`.dp-hero-panel` contained glass panel + strongest glow on the page) |

**Bonus fix found during this pass (not one of the 7 findings):** the base `:focus-visible` outline
color fails WCAG 2.4.11's 3:1 non-text contrast minimum against this route's near-black canvas
(computed ≈2.46:1 for `--primary` on `--bg`). §2 repoints focus color to `--primary-soft` (≈13.3:1
on `--bg`), which also resolves Finding 5's separate observation that `--primary-soft` is declared
but never given a real job.

**Copy changes: none.** Every string in every code sample above is copy-pasted verbatim from the
current `page.tsx` — this spec only reassigns classes, adds wrapper/glow `<div>`s, and edits
`app/globals.css` token values inside the existing `.theme-dark-preview` scope.

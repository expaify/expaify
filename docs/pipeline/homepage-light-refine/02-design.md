# UX Design Spec — Light Homepage Refinement

**Ticket:** UXDES-homepage-light-refine-01
**Input:** `docs/pipeline/homepage-light-refine/01-research.md`. Four directives (D1–D4), all values
already resolved. This spec does not re-derive any value; it turns the four directives into exact,
file-and-line implementation instructions, state coverage, breakpoint handling, and a full cascade
audit.

**Target files for direct edits (production, not a copy):**
- `app/globals.css` — `:root` token block, `.text-*` component-layer classes, `.btn-conversion`,
  one new selector block for the hero glass scope, one new selector block for the hero atmosphere
  layer.
- `app/components/ui/DealCard.tsx` — line 141, root `<article>` className.
- `app/components/ui/LockedDealCard.tsx` — line 41, root `<a>` className.
- `app/page.tsx` — hero section wrapper, hero `<h1>`, hero card-stack wrapper, how-it-works
  numeral, both pricing card containers.

**Explicitly not edited:** `app/preview/dark-home/page.tsx`, `.theme-dark-preview` and everything
scoped under it in `globals.css` (lines ~490–821) — that route is a separate, already-shipped
artifact and is untouched by this work. No provider/API/business logic file is touched. No copy
string changes anywhere (see §6).

---

## 0 — Mechanism note: how the hero glass gets applied without a new component prop

The research brief flags (D1, "Implementation note") that glass only applies to the hero card
stack, and correctly identifies that the *shadow-rest* half of D1 belongs directly in
`DealCard.tsx` / `LockedDealCard.tsx` since it's a permanent, everywhere-on-every-page change. The
*glass* half is different: it is intentionally hero-only, and `DealCardProps` /
`LockedDealCardProps` currently expose no `className` prop for either component (confirmed by
reading both files in full — neither type has a `className` field, and adding one is unnecessary
here).

Adding a one-off `className` prop to thread through to a single call site among ~9 real call sites
of `DealCard` (`app/page.tsx` ×3, `app/deals/DealFeed.tsx` ×3, `app/components/research/
HotelEvChargingHarness.tsx` ×1, plus test call sites) and ~7 call sites of `LockedDealCard` is more
surface area than this needs. Instead, reuse the mechanism the dark prototype already validated
(`03-design.md` §"D3 — glass panels", `.dp-glass-scope article` / `.dp-glass-scope
a[aria-label^="Locked premium deal"]`), minus the `.theme-dark-preview` gate — here it's a
permanent, ungated global rule, not a route-scoped trick, so it satisfies the "this should become
the real production style" requirement:

**In `app/page.tsx`:** add a class, `hero-card-glass`, to the existing wrapper `<div>` at line 175
(`<div className="relative w-full">` → `<div className="relative w-full hero-card-glass">`). No
other JSX in `page.tsx` changes for this mechanism — the class lands on a `<div>` that already
exists and already contains both the front `DealCard` and the peeking `LockedDealCard`.

**In `app/globals.css`:** add a new rule block (placed after the `:root` block, e.g. directly below
the type-scale `@layer components` block) that targets the two components' root elements by their
existing stable selectors — `article` (DealCard's root tag) and `a[aria-label^="Locked premium
deal"]` (LockedDealCard's root tag, matched via its existing `aria-label` prefix, which is static
copy declared in the component itself, not dynamic per-call-site text — see `LockedDealCard.tsx:40`):

```css
.hero-card-glass article,
.hero-card-glass a[aria-label^="Locked premium deal"] {
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--glass-blur-light));
  -webkit-backdrop-filter: blur(var(--glass-blur-light));
  border: var(--glass-border-light);
}
```

**Specificity check (why this overrides the component's own Tailwind classes without `!important`):**
`DealCard.tsx:141`'s `bg-[color:var(--surface)]` and `border-[0.5px] border-[color:var(--line-ivory)]`
are each single-class selectors (specificity 0-1-0). `.hero-card-glass article` is a class +
type selector (0-1-1) — higher specificity, wins regardless of stylesheet order.
`LockedDealCard.tsx:41`'s equivalent classes are also 0-1-0; `.hero-card-glass
a[aria-label^="Locked premium deal"]` is class + attribute + type (0-2-1) — also wins. Border radius
is untouched by this rule (no `border-radius` declared), so both cards keep inheriting
`rounded-[var(--radius-card)]` from their own className as normal — the glass rule only overrides
`background`, adds blur, and overrides `border` color/width via the shorthand.

This keeps `DealCard.tsx` / `LockedDealCard.tsx` prop contracts **exactly as they are today** — the
UI stage does not touch either file's props, exports, or the `DealCardProps`/`LockedDealCardProps`
types. Only their base `className` string gets the shadow addition (§1 below).

---

## 1 — D1: Elevation / glass — exact edits

### 1a. New token in `app/globals.css` `:root`

Insert directly below the existing `--shadow-card-hover` / `--shadow-header` lines (`globals.css:101–102`):

```css
--shadow-card-rest: 0 1px 2px rgba(20, 18, 16, 0.04), 0 1px 1px rgba(20, 18, 16, 0.03);
--glass-bg-light: rgba(255, 255, 255, 0.62);
--glass-blur-light: 10px;
--glass-border-light: 1px solid rgba(255, 255, 255, 0.8);
```

Do not touch `--shadow-card-hover` — its value stays `0 8px 24px rgba(20,18,16,0.08)`, unchanged.

### 1b. `app/components/ui/DealCard.tsx:141`

Current:
```
className={`overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] ${deal.expired ? 'grayscale' : deal.isMock ? '' : 'transition-[transform,box-shadow] duration-150 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-card-hover)]'}`}
```

New — add `shadow-[var(--shadow-card-rest)]` as an unconditional base class (applies regardless of
`expired`/`isMock` branch, since every card variant should have the resting depth cue):

```
className={`overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] shadow-[var(--shadow-card-rest)] ${deal.expired ? 'grayscale' : deal.isMock ? '' : 'transition-[transform,box-shadow] duration-150 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-card-hover)]'}`}
```

**Why this doesn't fight the hover shadow:** `shadow-[var(--shadow-card-rest)]` is a plain class
(specificity 0-1-0, applies always). `group-hover:shadow-[var(--shadow-card-hover)]` compiles to a
compound selector (`.group:hover .group-hover\:shadow-\[...\]`) that only matches while the
ancestor `.group` (the wrapping `<div className="group relative">` at line 271) is hovered — at
that moment its specificity (0-2-0, two class-level conditions) is higher than the rest-shadow's
plain class, so hover always wins while active, and rest shows the rest of the time. No `!important`
needed, and this is the same pattern already governing today's `border-color`/`transform` hover
transitions on this element — nothing new is being introduced mechanically, only a new resting
value.

### 1c. `app/components/ui/LockedDealCard.tsx:41`

Current:
```
className="group relative block overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[color:var(--gold-deep)] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold-deep)]"
```

New — insert `shadow-[var(--shadow-card-rest)]` immediately after `bg-[color:var(--surface)]`:

```
className="group relative block overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] shadow-[var(--shadow-card-rest)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[color:var(--gold-deep)] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold-deep)]"
```

**Focus-ring interaction (state coverage, confirmed preserved):** this component already overrides
the sitewide `:focus-visible` outline with its own `focus-visible:ring-2
focus-visible:ring-[color:var(--gold-deep)]` — a Tailwind ring utility, which composes into the
final `box-shadow` via Tailwind's `--tw-ring-shadow`/`--tw-shadow` custom-property pipeline, the
same pipeline `hover:shadow-[var(--shadow-card-hover)]` already uses today. Because ring + arbitrary
shadow utilities already coexist correctly in the *current, shipped* version of this component
(hover shadow + focus ring both work today), adding a second arbitrary shadow utility for the rest
state uses the identical composition mechanism and does not introduce a new failure mode — rest
shadow shows with no focus/hover, hover shadow replaces it on `:hover`, and the gold focus ring
composes on top of whichever shadow is active on `:focus-visible`, exactly as it does today.

### 1d. `app/page.tsx` pricing cards (both currently un-shadowed)

`page.tsx:351` (Free tier card):
```
<div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-7">
```
→
```
<div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] shadow-[var(--shadow-card-rest)] p-7">
```

`page.tsx:389` (Premium tier card — keep the existing inline `style={{ borderColor: 'var(--primary)' }}`,
untouched, it's unrelated to shadow):
```
<div
  className="flex flex-col gap-6 rounded-[var(--radius-card)] border-2 bg-[color:var(--surface)] p-7"
  style={{ borderColor: 'var(--primary)' }}
>
```
→
```
<div
  className="flex flex-col gap-6 rounded-[var(--radius-card)] border-2 bg-[color:var(--surface)] shadow-[var(--shadow-card-rest)] p-7"
  style={{ borderColor: 'var(--primary)' }}
>
```

Neither pricing card has a hover state today (they are static `<div>`s, not links) — no hover-shadow
tier applies here, rest-shadow only. That is correct and matches the research directive; do not
invent a hover shadow for these.

### 1e. Hero card-stack glass scope — `app/page.tsx:175`

```
<div className="relative w-full">
```
→
```
<div className="relative w-full hero-card-glass">
```
(Mechanism and CSS rule specified in §0 above — no other change needed in `page.tsx` for glass.)

### 1f. D1 state-coverage matrix

| Element | Default (rest) | Hover | Focus-visible |
|---|---|---|---|
| `DealCard` (any homepage/deals/destinations instance) | `--shadow-card-rest` (new, visible) | `--shadow-card-hover` (unchanged, 0.08 alpha) + `-translate-y-1` (unchanged) | Overlay `<a>` (line 273) gets sitewide `:focus-visible` outline (3px `--primary`) + `--focus-ring` box-shadow (unchanged, not touched by this spec) |
| `LockedDealCard` | `--shadow-card-rest` (new) | `--shadow-card-hover` + `-translate-y-1` + gold border (all unchanged) | `focus-visible:ring-2 ring-[--gold-deep]` (unchanged, own override, confirmed still composes per §1c) |
| Pricing cards (2×) | `--shadow-card-rest` (new) | none (no hover state exists today; not introduced) | N/A — not interactive elements |
| Hero card stack (glass) | Glass background/blur/border (new) *layered under* whichever shadow tier is active | Glass persists; shadow swaps rest→hover exactly as in row 1 | Same as row 1 — glass doesn't touch the focus mechanism, only `background`/`backdrop-filter`/`border` |
| `.btn-conversion` (all 3 homepage instances + sitewide) | New 12px radius (§4) | Existing `.btn` hover behavior — **note:** `globals.css` has no explicit `.btn-conversion:hover` rule today; hover feedback currently comes from the `.btn` base's `transition` property list applying to whatever *does* change (there is no color/bg hover rule for `.btn-conversion` in the current file) — this spec does not add one, since it is out of scope of D4 (radius only) and not flagged by the research brief. Radius change does not alter this. | Sitewide `:focus-visible` (3px outline + `--focus-ring` box-shadow) — unaffected by border-radius change; the ring/outline will simply trace the new, tighter rounded-rect shape instead of the pill, which is expected and correct. |

---

## 2 — D2: Type scale — exact edits

### 2a. `app/globals.css` — replace the three existing rules and add one new one, inside the
existing `@layer components { ... }` block (`globals.css:210–258`)

Replace `.text-display` (`globals.css:211–217`):
```css
.text-display {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
```

Replace `.text-stat` (`globals.css:220–226`) — no longer byte-identical to `.text-display`:
```css
.text-stat {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}
```

Replace `.text-h2` (`globals.css:228–234`):
```css
.text-h2 {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
}
```

Add new `.text-numeral`, inserted after `.text-h3` (`globals.css:236–242`) and before `.text-body`:
```css
.text-numeral {
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
  font-size: 56px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.02em;
  color: var(--line-white);
}
```

`.text-h3` (`globals.css:236–242`) is **not** touched — it's out of scope, the research brief's
D2 directive only names `.text-display`, `.text-h2`, `.text-stat`, and the new numeral class.

### 2b. Responsive step — `app/globals.css:465–471`

Current:
```css
@layer components {
  @media (min-width: 768px) {
    .text-display {
      font-size: 44px;
    }
  }
}
```

New — bump to 52px, and add the equivalent responsive step for `.text-h2` (the research brief
specifies `.text-h2` should also step up at ≥768px, `32px`, whereas today `.text-h2` has **no**
responsive step at all — `globals.css:182` in the research brief flags this explicitly: "no
responsive step at all"):

```css
@layer components {
  @media (min-width: 768px) {
    .text-display {
      font-size: 52px;
    }
    .text-h2 {
      font-size: 32px;
    }
  }
}
```

### 2c. `app/page.tsx:150` — hero `<h1>` (no className change needed)

```
<h1 className="text-display text-[color:var(--ink)]">
```
Unchanged JSX — `.text-display`'s new values apply automatically. Confirm: at the mobile 40px size
inside the existing `max-w-[440px]` column, "Never overpay for a hotel again." (28 characters) does
not overflow or force an awkward break — this is shorter than the dark prototype's line and well
within the 440px column at 40px/700-weight Space Grotesk; no line-wrap regression expected. At the
768px+ step (52px), the same column width comfortably fits 2 lines, consistent with today's 44px
rendering (which already wraps to 2 lines at that width).

### 2d. `app/page.tsx:301–306` — how-it-works numeral, className + inline-style removal

Current:
```jsx
<span
  className="text-display leading-none"
  style={{ color: 'var(--line-ivory)' }}
  aria-hidden
>
  {n}
</span>
```

New — swap to `.text-numeral`, remove the inline `style` entirely (color now lives in the class):

```jsx
<span
  className="text-numeral"
  aria-hidden
>
  {n}
</span>
```

Note: `.text-numeral` already declares `line-height: 0.9`, so the `leading-none` Tailwind utility
(which set `line-height: 1`) is dropped — 0.9 is tighter and intentional per the research brief's
numeral spec; do not keep `leading-none` alongside it, as `leading-none` is unlayered and would win
over the component-layer `line-height` declaration, silently reverting this part of the directive.

### 2e. `app/page.tsx:323` — dark-band `<h2>` (no className change)

```
<h2 className="text-display text-[color:var(--text-inverse)]">
```
Unchanged JSX. Flagged for awareness, not action: this heading sits on the dark `--ink` band
(`page.tsx:318`), not the light canvas — the type-scale change (size/weight/tracking) still applies
correctly here since D2 is a typographic change with no luminance dependency (unlike D1/D3). No
caveat needed; this is the one `.text-display` usage furthest from "hero," but the research brief's
own audit (`01-research.md` lines 185–188) already scoped this as one of `.text-display`'s four
legitimate jobs, unchanged by this directive.

### 2f. Pricing stat spans — `page.tsx:357`, `page.tsx:402` (no className change)

```
<span className="text-stat text-[color:var(--ink)]">$0</span>
<span className="text-stat text-[color:var(--ink)]">$8</span>
```
Unchanged JSX — `.text-stat`'s new (now-independent) declaration applies automatically. Visually
identical size to today (36px preserved per the research brief — "the bug was duplication, not the
number itself"), only `line-height` (1.1→1) and `letter-spacing` (0→-0.01em) change, both minor.

### 2g. `.text-h2` cascade — confirm every call site still reads correctly

`.text-h2` is a shared component-layer class, not homepage-scoped. Grepped call sites across the
whole app (not just `page.tsx`):

| File | Usage | Effect of weight 700→600, size 30→28/32, tracking 0→-0.01em |
|---|---|---|
| `app/page.tsx` (×5: live teaser, destinations, how-it-works, pricing, FAQ headings) | Section headings | Intended — this is the directive's primary target |
| `app/deals/page.tsx:69` | Error-state `<h1>`, "We couldn't restore this search." | Safe — same visual job (page-level heading), lighter weight reads fine on an error state, arguably better (less alarming than a heavy 700) |
| `app/deals/DealFeed.tsx:1529` | Results heading, "Today's catches" | Safe — same section-heading job as homepage's live-teaser `<h2>`, same visual context (a heading above a card grid), directly analogous, no caveat |
| `app/destinations/[city]/page.tsx:83` | Error-state `<h1>`, same copy as `deals/page.tsx:69` | Safe, same reasoning |
| `app/destinations/[city]/page.tsx:165` | Page `<h1>`, "Hotel deals in {city} today" | Safe — page-level heading, same job as `deals/DealFeed.tsx:1529`; note this usage adds `font-display` redundantly in its own className (`text-h2 ... font-display`) — `.text-h2` already sets `font-family` internally, so this is a harmless no-op both before and after this change, not something this spec needs to fix (out of scope — not flagged by the research brief, not a regression this change introduces) |
| `app/flights/page.tsx:16` | Page `<h1>`, "Search flights across providers" | Safe — same page-heading job |
| `app/account/page.tsx:131` | **Different job** — `<div className="text-h2 text-[color:var(--gold-text)]">{daysLeft}</div>`, a numeric countdown display (days left in trial), not a text heading | **Caveat:** this is using `.text-h2` as a stat/numeral display, not a heading — the new weight-600 will make this countdown number noticeably lighter than it renders today (700). This is a legitimate side effect worth flagging to the account-page owner, but not a regression this spec should silently paper over. Recommend: leave as-is for this pass (out of scope — `/account` was not audited in the research brief and this ticket's scope is the homepage), but note in the handoff that `account/page.tsx:131` should probably be moved to `.text-stat` in a follow-up ticket, since numeral-display is exactly what `.text-stat` is for and `.text-h2` is now explicitly a heading-only class post-split |
| `app/components/research/*Harness.tsx` (Housekeeping, CheckinTimeFit, LuggageStorage, EvCharging) | Internal research/QA harness headings, not user-facing production surfaces | Safe — these are dev-only preview harnesses; even if the type shift reads oddly there, it carries no user-facing risk |
| `app/components/admin/AdminUserSearch.tsx` | Admin tool heading | Safe — same "some heading, some context" reasoning as above rows; admin surfaces aren't visually audited by this ticket but a weight/size heading change here is low-risk and consistent with the rest of the product's headings shifting together |
| `app/components/ui/DealCard.tsx` (grep hit) | False positive — this is the string `"DealCardCity"` `id`/related identifiers, not an actual `.text-h2` class usage. Re-checked: `DealCard.tsx` does not use `.text-h2` anywhere in its className strings (verified by reading the full file) | No effect |

**Net finding:** `.text-h2`'s cascade is broad but safe everywhere it is used as an actual heading
(the overwhelming majority of call sites). The one true outlier is `app/account/page.tsx:131`,
which repurposes the class for numeral display — flagged above as a follow-up, not blocking this
ticket.

### 2h. `.text-display` cascade — the one other real call site

`app/components/ui/PriceBlock.tsx:20` uses `.text-display` for its `size="display"` variant. Grepped
every `.tsx` file in the repo (both `app/` and the root-level `components/`) for `<PriceBlock` —
**zero JSX call sites exist.** `PriceBlock` is currently dead code (only its type/function
declaration exists, never rendered anywhere in the app). This means the D2 type-scale change has
**no live surface impact** through `PriceBlock` — noted for completeness, not a blocker, and not
something this spec asks the UI stage to clean up (out of scope, unrelated to the four directives).

---

## 3 — D3: Anchored ambient glow — exact edits

### 3a. `app/page.tsx:146` — hero `<section>` needs `position: relative` and a z-index stacking
context added

Current:
```jsx
<section className="mx-auto max-w-[1140px] px-5 pb-20 pt-16">
  <div className="flex flex-col items-center gap-12 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-16">
```

New:
```jsx
<section className="relative mx-auto max-w-[1140px] px-5 pb-20 pt-16">
  <div className="hero-atmosphere" aria-hidden />
  <div className="relative z-[1] flex flex-col items-center gap-12 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-16">
```

(Content div gains `relative z-[1]` so it stacks above the new atmosphere layer; the atmosphere
`<div>` itself is empty/decorative, `aria-hidden`, and gets its positioning/`z-index:0` from the CSS
class below — it does not need `pointer-events-none` added inline since the CSS rule declares it.)

### 3b. New CSS in `app/globals.css` (add after the `.hero-card-glass` rule from §0, or any other
convenient spot after the `@layer components` type-scale block)

```css
.hero-atmosphere {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(circle at 50% 42%, rgba(159, 225, 203, 0.35), transparent 22rem);
  mask-image: linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
}

@media (min-width: 900px) {
  .hero-atmosphere {
    background-image: radial-gradient(circle at 68% 20%, rgba(159, 225, 203, 0.35), transparent 26rem);
  }
}
```

No grid-line texture layer — per the research brief, dropped entirely, not adapted.

### 3c. Mobile/desktop breakpoint reasoning (explicit answer to "does the glow need
breakpoint-specific handling")

**Yes — and it's handled above, at exactly the layout's own breakpoint.** The hero content div
switches from `flex-col items-center` (text stacked above a horizontally-centered card) to
`min-[900px]:flex-row` (text left, card right) at 900px — the same breakpoint Tailwind's arbitrary
variant already uses in the existing JSX (`page.tsx:147`). Below 900px, the card stack is
horizontally centered under the text block, not off to one side — so anchoring the glow at 68%
horizontal (correct for the two-column desktop layout) would visibly miss the card on mobile,
sitting in empty space to the right of a centered element. The mobile default (`circle at 50% 42%`)
is centered horizontally to match the centered card, and shifted down vertically (42% vs desktop's
20%) because the card sits *below* the text block in the stacked mobile layout, not beside it — the
card's actual vertical position in the section is lower on mobile than on desktop, where text and
card share the same vertical center.

**Why no viewport-width media query is needed beyond the one 900px step:** the atmosphere layer is
positioned `absolute; inset: 0` **inside the hero `<section>`**, which itself is capped at
`max-w-[1140px]` — so the gradient's `%`-based anchor coordinates are relative to the *section's own
box*, not the viewport. This means 1280px, 1440px, and any wider desktop viewport all render
identically (the section box stops growing at 1140px and centers itself), and no additional
breakpoint is needed for "desktop 1280px" specifically — 1280px and the 900px-and-up rule behave
the same. At 375px, the section box is the full (padded) viewport width, and the mobile anchor
values apply directly — also no separate 375px-specific rule needed beyond the single mobile default
already given.

**Horizontal overflow:** the radial gradient's `transparent 22rem`/`26rem` fade radius (352px/416px)
is allowed to extend past the section's own edges without adding any new overflow risk — `body` in
`globals.css:150` already declares `overflow-x: clip`, which clips at the viewport level regardless
of the section's own `overflow` setting. No additional `overflow-hidden` needs to be added to the
hero `<section>` or its atmosphere `<div>`.

### 3d. D3 pass/fail restated for this spec

The glow must be visibly anchored behind wherever the hero card stack actually renders at the
current viewport (centered-below on mobile, right-column on ≥900px), read as soft ambient light
(not a colored stain) at both 375px and 1280px, and fully fade out (via the shared `mask-image`) by
the bottom of the hero section at every viewport width, before the logo-strip section begins.

---

## 4 — D4: Corner radius — exact edits

### 4a. `app/globals.css:98`

```css
--radius-card: 24px;
```
→
```css
--radius-card: 16px;
```

This is a single-token change with the broadest cascade in this entire spec — see §7 for the full
enumeration of every surface it touches beyond the homepage.

### 4b. `app/globals.css:283–286` — `.btn-conversion`

Current:
```css
.btn-conversion {
  background: var(--accent);
  color: var(--ink); /* white on coral is 2.8:1; ink on coral is 6.6:1 (AA) */
}
```

New:
```css
.btn-conversion {
  background: var(--accent);
  color: var(--ink); /* white on coral is 2.8:1; ink on coral is 6.6:1 (AA) */
  border-radius: var(--radius-input);
}
```

`--radius-input` is the existing `12px` token (`globals.css:100`), reused per the research brief's
recommendation — no new token added. `.btn-outline` (`globals.css:288–292`) is not touched; it keeps
inheriting `border-radius: var(--radius-pill)` (999px) from the shared `.btn` base
(`globals.css:266`), preserving the primary/secondary shape distinction the directive establishes.

### 4c. Pass/fail restated

Every card using `--radius-card` renders at 16px (was 24px) with no markup changes required beyond
what's already specified in §1. Every `.btn-conversion` instance sitewide (not just the three on
the homepage — see §7) renders as a 12px rounded-rectangle, visibly distinct in shape from
`.btn-outline`'s pill.

---

## 5 — Mobile 375px / desktop 1280px summary checklist

| Concern | 375px | 1280px |
|---|---|---|
| Hero glow anchor | `circle at 50% 42%` (mobile default, §3b) | `circle at 68% 20%` (≥900px override, applies unchanged from 900px through 1280px+, §3c) |
| Hero glass panel | Present on the single visible front card (peeking card is `hidden` below `min-[380px]`, so glass has one card to apply to at 375px, not two) | Present on both front + peeking card, per existing `min-[900px]:-inset-x-6 min-[900px]:-top-6` peeking-card positioning (unchanged by this spec) |
| Card grid columns (live teaser) | `grid-cols-1` (unchanged Tailwind responsive classes, not touched by this spec) | `min-[1024px]:grid-cols-3` (unchanged) — new 16px radius + rest shadow render consistently across all 3 columns |
| `.text-display` hero size | 40px (new mobile default, §2a) | 52px (new ≥768px step, §2b — already active well below 1280px, no separate 1280px behavior) |
| `.text-h2` size | 28px (new mobile default) | 32px (new ≥768px step) |
| `.btn-conversion` radius | 12px (token-driven, no breakpoint variance) | 12px (same) |
| Overflow / clipping | `body { overflow-x: clip }` already present, confirmed sufficient (§3c) | Same |

No directive in this spec requires a 1280px-specific rule beyond the existing 768px/900px steps
already defined — 1280px falls inside the "desktop" range for all four directives and behaves
identically to any other ≥900px viewport.

---

## 6 — Copy changes: none

Confirmed against every string touched by this spec:
- Hero `<h1>`: "Never overpay for a hotel again." — unchanged.
- Dark-band `<h2>`: "One deal. Four marketplaces. Zero tabs." — unchanged.
- How-it-works numerals: "01" / "02" / "03" — unchanged (only their class + removal of an inline
  `style` attribute; the rendered text nodes `{n}` are untouched).
- All five `.text-h2` section headings on the homepage — unchanged.
- `$0` / `$8` pricing stats — unchanged.
- All three `.btn-conversion` button labels ("Join for free," "Get started free," "Start free
  trial") — unchanged; every other `.btn-conversion` instance sitewide (§7) also keeps its existing
  label, this spec only changes the shared class's `border-radius`.
- No `aria-label`, `alt` text, or other accessible-name string is touched anywhere in this spec.

---

## 7 — Cascade audit: every surface affected by editing `DealCard.tsx`, `LockedDealCard.tsx`,
`--radius-card`, `.text-h2`, and `.btn-conversion`

This is the section the research brief flagged as a UI-stage concern (`01-research.md` lines
102–109) and the parent task explicitly asked to be enumerated by grep, not assumed. Findings below
are from `grep -rn` across `app/` and the root-level `components/` directory, not inference.

### 7a. `DealCard` / `LockedDealCard` (shadow-rest + glass mechanism)

| Call site | Surface | Verdict |
|---|---|---|
| `app/page.tsx` ×4 (hero, live-teaser ×2, dark-band) | Homepage | Target surface — intended |
| `app/deals/DealFeed.tsx` ×3 (feeds `/deals` and `/destinations/[city]`, confirmed via `DealFeed` import in `app/deals/page.tsx` and `app/destinations/[city]/page.tsx`) | `/deals` full feed grid, `/destinations/[city]` feed grid | **Safe, desirable, no caveat.** Both surfaces use the identical grid pattern as the homepage's live-teaser section (`grid grid-cols-1 gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3`, confirmed at `DealFeed.tsx:1223` — byte-identical gap/breakpoint values to `page.tsx:229`). A rest-state shadow that reads correctly on a 3-column homepage grid reads identically on this grid — same card size, same gap, same density. The glass mechanism (`.hero-card-glass`, §0) is scoped to the homepage's specific wrapper class and does **not** apply here — `DealFeed.tsx`'s cards render plain, unglossed, exactly as today, just with the new rest shadow and tighter radius. |
| `app/components/research/HotelEvChargingHarness.tsx` ×1 | Internal research/dev harness (`aria-labelledby="ev-result-preview"`, "Active result pattern" — a component-preview tool, not a user-facing route) | Safe — dev-only surface, cosmetic change has no user impact |
| Test files (`app/components/ui/__tests__/DealCard.test.tsx`, `app/components/__tests__/HotelAccessibilityFit.test.tsx`, `HotelPoolEvidenceLedger.test.tsx`, `GuestReviewEvidence.test.tsx`, `HotelFundsPolicyComparison.test.tsx`, `QuietStayEvidenceLedger.test.tsx`) | Jest/RTL tests using `renderToStaticMarkup` | **Verified safe — grepped every test file that imports `DealCard`/`LockedDealCard` for shadow/radius/className assertions (`toHaveClass`, literal `shadow-`/`radius-` string matches): zero hits.** Every test in this repo asserts on content, accessible names, or conditional rendering, never on the exact className string of the card root. No test breakage expected from either the shadow addition or the radius token change. |

### 7b. `--radius-card` token (24px → 16px)

Grepped every file referencing `radius-card` across `app/` and `components/` — **43 files**, far
broader than the homepage. Full enumeration by category:

| Category | Representative files | Verdict |
|---|---|---|
| Homepage + shared deal cards | `page.tsx`, `DealCard.tsx`, `LockedDealCard.tsx` | Target — intended (§1, §4) |
| Deal feed / destinations | `deals/page.tsx`, `deals/DealFeed.tsx`, `deals/[dealId]/page.tsx`, `deals/[dealId]/error.tsx`, `deals/[dealId]/loading.tsx`, `deals/[dealId]/not-found.tsx`, `deals/ResultCoverageBoundary.tsx`, `deals/HotelRecoveryUI.tsx`, `destinations/[city]/page.tsx` | Safe — same reasoning as §7a: these are card/panel surfaces stylistically continuous with the homepage, a tighter radius reads as one consistent design language across the funnel, not a mismatch |
| Auth / account / onboarding | `join/_form.tsx`, `auth/error/page.tsx`, `login/page.tsx`, `login/verify/page.tsx`, `account/page.tsx`, `onboarding/OnboardingClient.tsx` | Safe — form panels and status cards, same shape-language logic applies; no reason a 24px-radius login panel should look "more correct" than a 16px one, and this makes the whole product internally consistent rather than leaving these as an inconsistent leftover |
| Admin | `admin/users/[userId]/page.tsx`, `admin/AdminMutationDialog.tsx`, `admin/AdminAccountDossier.tsx`, `admin/AdminUserSearch.tsx`, `admin/AdminAccessState.tsx` | Safe — internal tooling, cosmetic-only change, no functional risk |
| Marketing/content | `blog/page.tsx`, `blog/[slug]/page.tsx` | Safe — same card-panel logic |
| Flights (outside the deals/hotel core) | `components/flights/FlightResults.tsx` (×5 usages), `components/baggage/BaggageFeeEstimator.tsx` (×2 usages) | **Caveat, flagged not blocking:** these live in the *root-level* `components/` directory (not `app/components/`), a separate, less-audited part of the codebase reached via `app/flights/FlightsClient.tsx`. The research brief did not audit `/flights` at all (out of scope, homepage-only brief). Radius is a low-risk, non-color, non-layout token change — a `--radius-card` shift from 24→16px will not break `/flights` visually in any structural sense, since it's the same "how rounded is a bordered panel" decision applied consistently. No action needed, no different value needed; flagging only so the TEST stage knows to spot-check `/flights` renders correctly, since it wasn't part of the design audit that produced this spec. |
| ~25 remaining component files (`AlertSignup.tsx`, `HotelCard.tsx`, `FlightCard.tsx`, `PropertyPhoto.tsx`, `DealScorePanel.tsx`, `PremiumHubBar.tsx`, various `Hotel*.tsx` evidence/policy panels, `WifiEvidenceLedger.tsx`, `LocationQualityBadge.tsx`, etc.) | Mostly `app/components/`-scoped, hotel detail page and deal-detail supporting UI | Safe — same reasoning throughout: `--radius-card` is used consistently as "the panel/card radius" everywhere it appears, never repurposed for an unrelated shape (e.g., no file uses it as an avatar/pill radius where 16px vs 24px would read as a functional bug rather than a style choice) |

**Net finding:** `--radius-card` is the single highest-leverage token in this spec — one line change
in `:root` restyles nearly every bordered panel across the entire product, not just cards. This is
consistent with the token's own name and its consistent usage pattern (never repurposed), so this
spec does not recommend narrowing the change to a homepage-scoped token — the research brief's D4
directive (a `:root`-level change) is correct as specified, but the UI stage and TEST stage should
both be aware the literal blast radius is "the whole app," not "the homepage."

### 7c. `.text-h2` (weight/size/tracking change) — see §2g above for the full per-file table.
Net finding restated here for the cascade summary: safe everywhere except `app/account/page.tsx:131`
(a numeral-display misuse of the heading class, pre-existing, not introduced by this change,
flagged as a follow-up ticket candidate, not a blocker).

### 7d. `.btn-conversion` (border-radius 999px pill → 12px rounded-rect)

Grepped every `btn-conversion` usage across `app/` — **12 call sites total**, 3 on the homepage, 9
elsewhere:

| File | Context | Verdict |
|---|---|---|
| `app/page.tsx` ×3 | Homepage hero CTA, both pricing card CTAs | Target — intended |
| `app/join/_form.tsx:131` | Join form submit button | Safe — paired with `.btn-outline` at line 142 in the same form (secondary action directly below it), so the primary/secondary shape distinction this directive establishes reads correctly here too, not just on the homepage |
| `app/deals/[dealId]/page.tsx:203` | Deal-detail page CTA (paired with a separate `.btn-primary` elsewhere on the same page, `page.tsx:537`, which is unaffected — `.btn-primary` doesn't inherit the pill/rect distinction, it's a third, separate button treatment already) | Safe |
| `app/components/LandingNav.tsx:99` | Site nav "Join" CTA, `btn-sm` size variant | Safe — 12px radius on a `min-height: 36px` small button (`.btn-sm`, `globals.css:296–300`) still reads as a clearly rounded rectangle, not a near-square; no minimum-size concern |
| `app/components/ui/PremiumHubBar.tsx:73` | Premium upsell bar CTA | Safe |
| `app/account/AccountClient.tsx:291` | Account page CTA (paired with `.btn-outline` at line 386 and `.btn-primary` at line 427 elsewhere on the same page) | Safe |
| `app/onboarding/OnboardingClient.tsx:336` | Onboarding flow final-step CTA (paired with `.btn-outline` at lines 302 and 322 in the same flow) | Safe |

**Net finding:** every non-homepage `.btn-conversion` instance already exists alongside a
`.btn-outline` sibling in the same flow (form, page, or nav), meaning the primary/secondary shape
distinction this directive introduces reads as a coherent, intentional pattern everywhere it
appears — not a homepage-only quirk. No caveat needed for any of the 9 non-homepage instances.

---

## 8 — Summary: file-by-file edit list for the UI stage

| File | Edits |
|---|---|
| `app/globals.css` | Add `--shadow-card-rest`, `--glass-bg-light`, `--glass-blur-light`, `--glass-border-light` to `:root` (after line 102). Change `--radius-card` 24px→16px (line 98). Replace `.text-display`, `.text-stat`, `.text-h2` declarations; add `.text-numeral` (lines 211–234 region). Update the `@media (min-width: 768px)` block to bump `.text-display` to 52px and add a `.text-h2` 32px step (lines 465–471 region). Add `border-radius: var(--radius-input)` to `.btn-conversion` (lines 283–286). Add two new rule blocks: `.hero-card-glass article, .hero-card-glass a[aria-label^="Locked premium deal"] { ... }` and `.hero-atmosphere { ... }` + its `@media (min-width: 900px)` override. |
| `app/components/ui/DealCard.tsx` | Line 141: add `shadow-[var(--shadow-card-rest)]` to the article's base className. |
| `app/components/ui/LockedDealCard.tsx` | Line 41: add `shadow-[var(--shadow-card-rest)]` to the anchor's className. |
| `app/page.tsx` | Line 146: `<section>` gains `relative`; add `.hero-atmosphere` decorative div; content div gains `relative z-[1]`. Line 175: wrapper div gains `hero-card-glass`. Lines 301–306: numeral span swaps `text-display leading-none` + inline `style` → `text-numeral`, no inline style. Lines 351, 389: both pricing card divs gain `shadow-[var(--shadow-card-rest)]`. No other JSX changes — `.text-display`/`.text-h2`/`.text-stat` usages elsewhere in this file need no className edits, they inherit the new values automatically. |

No edits to `app/preview/dark-home/page.tsx` or any `.theme-dark-preview`-scoped CSS. No edits to
any provider, API route, or business-logic file. No copy changes anywhere.

**Handoff:** `UI-homepage-light-refine-01` — implementation stage should read this doc in full
before touching any file, run `npx tsc --noEmit --incremental false` after edits (should be
unaffected, all changes are className/CSS, no type surface changes), and manually verify §7's
cascade table spot-checks (`/deals`, `/destinations/[any-city]`, `/join`, `/flights`) in addition to
the homepage itself before committing.

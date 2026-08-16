# UX Research — Light Homepage Refinement (post dark-prototype review)

**Ticket:** UXR-homepage-light-refine-01
**Input:** User review of `UI-dark-homepage-prototype-01`. Verdict: *"no keep the old design, just maybe
use some of elements used there."* Four techniques were explicitly named for adaptation — the dark
palette itself was explicitly rejected. This brief does not re-litigate whether the dark theme ships;
it exists to translate four already-solved *mechanics* from `docs/pipeline/dark-homepage-prototype/03-design.md`
onto the real, production, light-mode `app/page.tsx` + `:root` tokens in `app/globals.css`.

**Scope of this brief:** the four techniques the user named, and only those four:
1. Elevation / glass depth
2. Refined type scale / hierarchy
3. Anchored ambient glow behind the hero
4. Tighter corner radius (cards + primary CTA)

**Explicitly out of scope (not requested, not covered here):** dark palette, D6 (teal/coral color-job
reassignment), D7 (dark-band panel rebuild), copy changes, any change to `DealCard.tsx` /
`LockedDealCard.tsx` business logic, provider/API logic. Where card-component *style* edits are
implied by elevation or radius (below), that is a UI-implementation-stage concern, flagged but not
resolved here.

**Audited source (production, not a copy):**
- `app/page.tsx` — full file, 609 lines, read in full for this brief
- `app/globals.css` — full file, 821 lines, `:root` token block (lines 80–133) and the shared `.text-*`
  scale (lines 208–258, 465–471) read in full
- `app/components/ui/DealCard.tsx` (root `<article>` classes, line 141)
- `app/components/ui/LockedDealCard.tsx` (root `<a>` classes, line 41)
- `docs/pipeline/dark-homepage-prototype/03-design.md` — the dark spec, read in full as the source of
  the four already-solved mechanics

---

## Why a straight port of the dark values does not work

The dark spec's D2/D3/D4 mechanics all lean on one structural fact that the light homepage does not
have: **headroom**. `--bg: #0B0A0A` and the dark `--surface: rgba(255,255,255,0.035)` sit at opposite
ends of the luminance range — a 3.5%-white overlay on near-black is trivially visible, and a
0.22-opacity teal radial gradient glowing out of that same near-black reads unambiguously as *light
emanating from a surface*, because there is nothing else bright in the frame to compete with it.

The light homepage's tokens are the inverse: `--bg: #FAF7F2` (cream) and `--surface: #FFFFFF` (white)
differ by about 8 RGB units — they are already nearly the same luminance. There is very little
range left to spend on translucency effects, and colored gradients don't have a dark field to glow
against — on a near-white canvas a saturated patch of color reads as a *stain*, not ambient light.
This is the single biggest adaptation constraint below, and it means D2 (elevation) has to do
almost all of the "depth" work through real shadow, not through the translucency trick the dark
version used; D3 (glass) has to be far more restrained and selectively placed; and D4 (glow) has to
drop opacity by roughly 3–4x and lose its grid-line companion entirely.

---

## D1 — Elevation / glass depth

### Current code

`app/components/ui/DealCard.tsx:141` (the shared card used everywhere on the homepage — hero,
live-teaser grid, dark band):

```
className="overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] ... group-hover:shadow-[var(--shadow-card-hover)]"
```

`app/components/ui/LockedDealCard.tsx:41` — same pattern:

```
className="... rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] ... hover:shadow-[var(--shadow-card-hover)]"
```

`app/globals.css:101`: `--shadow-card-hover: 0 8px 24px rgba(20,18,16,0.08);` — the **only** shadow
token that exists today, and it is applied **exclusively on hover/group-hover**. At rest, every card
on the homepage (hero card, live-teaser grid ×3, destination tiles, pricing cards) has **zero
box-shadow** — depth is carried entirely by a 0.5px `--line-ivory` (#E8E2D8) hairline border on a
white card sitting on a cream page. This is the exact "everything at the same elevation, no resting
depth cue" problem the dark research (Finding 2, referenced in `03-design.md` §4) already diagnosed —
it turns out the *light* homepage has this problem too, today, in production; the dark prototype's
`--shadow-card-rest` fix (`03-design.md:64`) was scoped to `.theme-dark-preview` only and never
touched the light tokens.

### Adapted technique

The dark mechanic was: introduce a `--shadow-card-rest` token, apply it via a stable selector
(`main article`, `a[aria-label^="Locked premium deal"]`) so no shared component file needs editing,
then let `--shadow-card-hover`'s existing wiring in `DealCard.tsx`/`LockedDealCard.tsx` handle the
raised state. That two-tier *structure* (rest shadow + existing hover shadow) translates directly.
The *values* do not — a dark-appropriate shadow is `0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)`,
which relies on near-total black opacity to read at all; on a cream page that same recipe would be
either invisible (too little opacity) or muddy (too much, competing with the existing hairline
border). A light-appropriate rest shadow needs to sit *below* the existing `--shadow-card-hover`
(0.08 alpha) in both spread and opacity, so hover still reads as a distinct, larger event:

```css
--shadow-card-rest: 0 1px 2px rgba(20, 18, 16, 0.04), 0 1px 1px rgba(20, 18, 16, 0.03);
```

This is deliberately closer to a "soft contact shadow" than the dark version's ambient glow-shadow —
on white/cream, a shadow this size reads as "this card is a physical object sitting slightly above
the page," which is the elevation cue the light system is actually missing. It is not trying to add
atmosphere (that job belongs to D3 below); it's trying to add a resting depth cue that isn't there
today. Keep `--shadow-card-hover` (0.08 alpha) exactly as-is — it already does its job correctly and
just needs a lighter rest-state sibling underneath it, not a redesign.

**Implementation note (flag for UI stage, not resolved here):** unlike the dark prototype, which was
an isolated preview route forbidden from touching shared components, this change is meant to become
the production card style everywhere the card renders — so the correct implementation site is
`DealCard.tsx:141` / `LockedDealCard.tsx:41` directly (add `shadow-[var(--shadow-card-rest)]`
alongside the existing hover class), not a route-scoped selector trick. That's a UI-stage decision,
not a research one, but it changes the blast radius (every card on every page that uses these two
components, not just the homepage) and is worth the design stage knowing before it specs exact
classes.

### Glass — does it translate?

**Partially, and only in one place.** `backdrop-filter: blur()` glass is a genuinely weaker effect on
a light canvas for two compounding reasons: (1) white-on-cream has almost no luminance range to blur
— there's nothing visually "behind" a translucent white panel worth refracting, unlike the dark
version where a translucent panel let the teal atmosphere and grid texture show through; (2) light-on-
light blur, when there *is* something behind it, tends to read as haze/muddiness rather than the
crisp "frosted window" read glass gets on dark surfaces, because white backdrop-blur softens contrast
in a direction the eye already reads as "washed out," not "elevated."

The one place it's worth doing anyway: the hero deal-card stack (`page.tsx:174–195`), specifically
*because* D3 below puts an anchored glow directly behind it — that gives a light glass panel
something worth refracting, the same logic the dark spec used to justify glass on its hero stack
(`03-design.md:270`, "so the repositioned hero glow visibly refracts through both layers"). Nowhere
else on the page has a colored field behind a card, so nowhere else should get glass — applying it to
the flat-white pricing cards or destination tiles, which sit on plain `--bg`/`--surface` with no glow
behind them, would just be a contrast-softening effect with no payoff, i.e. exactly the "muddy" risk
called out above. Elevation (the rest/hover shadow pair) is the technique that should carry the
"considered depth" read across the whole page; glass is a single accent limited to the hero.

Concrete value, restrained on purpose (contrast with the dark version's `rgba(23,21,18,0.55)` +
20px blur, which leans on near-opacity+heavy blur because it's covering pure black):

```css
--glass-bg-light: rgba(255, 255, 255, 0.62);
--glass-blur-light: 10px;
--glass-border-light: 1px solid rgba(255, 255, 255, 0.8);
```

Applied only to the hero `DealCard` + peeking `LockedDealCard` stack, over the glow from D3. Card
text/content must stay on an effectively-opaque white plane for AA contrast — 0.62 alpha is chosen so
the glow tints the edges of the panel without dropping the white background below the density needed
for `--ink` (#141210) text to keep its existing AA ratios; do not push alpha lower than ~0.6 without
re-testing contrast on the card's own copy.

### Delta

| | Dark prototype | Adapted for light |
|---|---|---|
| Rest shadow | `0 1px 2px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06)` — ambient/border hybrid | `0 1px 2px rgba(20,18,16,.04), 0 1px 1px rgba(20,18,16,.03)` — soft contact shadow |
| Where elevation applies | Every card, everywhere on route | Every card, everywhere on homepage (same breadth) |
| Glass | Hero stack **and** both pricing cards | Hero stack **only** |
| Glass alpha/blur | `rgba(23,21,18,.55)` / 20px | `rgba(255,255,255,.62)` / 10px |
| Mechanism | New token, applied via component-safe selector (route was untouchable) | New token, applied directly in `DealCard.tsx`/`LockedDealCard.tsx` (homepage is the real target) |

### D1 — Testable directive

**Add a `--shadow-card-rest` token to `:root` in `app/globals.css`
(`0 1px 2px rgba(20,18,16,0.04), 0 1px 1px rgba(20,18,16,0.03)`) and apply it as the resting-state
box-shadow on every card that currently only gets a shadow on hover** — `DealCard.tsx:141`,
`LockedDealCard.tsx:41`, and the two pricing cards (`page.tsx:351`, `page.tsx:389`, both currently
`bg-[color:var(--surface)]` with no shadow class at all). Keep `--shadow-card-hover` unchanged.
**Additionally**, wrap the hero `DealCard` + peeking `LockedDealCard` stack (`page.tsx:175`, the
`<div className="relative w-full">`) in a glass treatment — `background: rgba(255,255,255,0.62)`,
`backdrop-filter: blur(10px)`, `border: 1px solid rgba(255,255,255,0.8)` — and apply it nowhere
else on the page. Pass/fail: every card on the homepage has a visible (if subtle) shadow at rest,
distinct from and smaller than its hover shadow; only the hero card stack has any translucency/blur;
`--ink` text inside the glass panel still meets its documented AA contrast ratio.

---

## D2 — Refined type scale / hierarchy

### Current code

`app/globals.css:211–226`:

```css
.text-display { font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: 0; }
/* → 44px at ≥768px, globals.css:467 */
.text-stat    { font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: 0; } /* byte-identical to .text-display, no responsive step */
.text-h2      { font-size: 30px; font-weight: 700; line-height: 1.1; letter-spacing: 0; } /* no responsive step at all */
```

`.text-display` is used for **four different jobs** on the homepage today:
- Hero `<h1>` — `page.tsx:150` ("Never overpay for a hotel again.")
- Dark-band `<h2>` — `page.tsx:323` ("One deal. Four marketplaces. Zero tabs.")
- How-it-works decorative numerals ("01"/"02"/"03") — `page.tsx:301`, with an inline
  `style={{ color: 'var(--line-ivory)' }}` bolted on as the *only* mechanism differentiating a
  decorative numeral from an `<h1>` — same font-size, same weight, same tracking, color is doing 100%
  of the "recede" work
- `.text-stat` (pricing `$0`/`$8`, `page.tsx:357`/`402`) isn't literally `.text-display`, but its CSS
  is a byte-for-byte duplicate of it — same effective scale under a different name

Meanwhile `.text-h2` — used for five section headings (live teaser, destinations, how-it-works,
pricing, FAQ — `page.tsx:219, 255, 278, 342, 453`) — is **only** 6–14px smaller than
`.text-display` and shares the identical weight (700), line-height (1.1), and tracking (0). The only
lever separating "this is the hero" from "this is a section heading" from "this is a decorative
background numeral" is font-size and, in one case, a hand-rolled inline color override. This is
functionally the same "one scale doing three-plus jobs" finding the dark research made (Finding 1,
`03-design.md:34`) — it turns out it was never fixed on the light site either; the dark spec's D1 only
patched `.theme-dark-preview`-scoped classes.

### Adapted technique

The dark fix's mechanism — separate, purpose-named scale classes (hero / section-h2 / eyebrow /
numeral / stat) that differ in more than one axis (size **and** weight **and** tracking, not size
alone) — translates cleanly; it has nothing to do with color or luminance. What should change for
light is which axis carries the *most* weight, because the light site doesn't need as aggressive a
size jump as the dark prototype took (36→64px hero): the light hero already has a responsive step
(36→44px) and a longer line of body copy next to it competing for the same 440px column, so pushing
past ~52–56px risks wrapping awkwardly inside that fixed-width column. The recommended split:

```css
/* Hero — distinct from text-h2 by size, weight, AND tracking (today: size only) */
.text-display {
  font-size: 40px;      /* was 36 */
  font-weight: 700;      /* unchanged */
  line-height: 1.05;     /* was 1.1 — tighter, more "considered" */
  letter-spacing: -0.02em; /* was 0 — new */
}
@media (min-width: 768px) {
  .text-display { font-size: 52px; } /* was 44 */
}

/* Section H2 — now diverges on weight too, not just size */
.text-h2 {
  font-size: 28px;       /* was 30 — small step down, makes room for the hero to grow */
  font-weight: 600;      /* was 700 — the missing axis */
  line-height: 1.15;
  letter-spacing: -0.01em;
}
@media (min-width: 768px) {
  .text-h2 { font-size: 32px; }
}

/* Numerals get their own scale, no longer .text-display + a color hack */
.text-numeral {
  font-size: 56px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.02em;
  color: var(--line-white); /* #D8D2C6 — one step dimmer than --line-ivory, still legible as texture on cream */
}

/* Pricing stat, split off from .text-display so it stops being an accidental duplicate */
.text-stat {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}
```

One deliberate divergence from the dark spec worth flagging: the dark version kept hero and h2 at the
*same* weight (600/600) and separated them almost entirely by size + tracking degree. On a light,
lower-contrast-by-nature background, weight is a cheaper and more reliable differentiator than
tracking — a 100-weight step (700→600) is visible at a glance regardless of viewing conditions,
whereas a 1% tracking delta is easy to miss on body-copy-adjacent headings. Recommend using weight as
the primary lever here and tracking as a secondary one, reversed from the dark spec's emphasis.

### Delta

| | Dark prototype | Adapted for light |
|---|---|---|
| Hero size | 36 → 56 → 64px (3 steps) | 40 → 52px (2 steps, smaller max — fits existing 440px hero column) |
| Hero vs H2 weight | 600 vs 600 (same) | 700 vs 600 (now differs — primary lever) |
| Hero vs H2 tracking | -0.02em vs -0.01em | -0.02em vs -0.01em (kept, secondary lever) |
| Numeral | New `.dp-numeral`, 56→80px, color at 0.06 white-alpha | New `.text-numeral`, 56px flat, color `--line-white` (#D8D2C6, a real token, not a low-alpha white — light has no "alpha over black" trick to lean on) |
| Stat | Split from display, 40→48px | Split from display, kept at 36px (existing size was already fine — the bug was duplication, not the number itself) |

### D2 — Testable directive

**Split `.text-display` from `.text-stat`** (currently byte-identical, `globals.css:211`/`220`) so
they are independently declared even if a value briefly matches, and **give the how-it-works numeral
its own `.text-numeral` class** instead of reusing `.text-display` + an inline `color` override
(`page.tsx:301`). **Add a weight divergence between `.text-display` (700) and `.text-h2` (600)** —
currently both 700 — plus tighter tracking on both (-0.02em / -0.01em, currently 0/0) and a modest
size bump to the hero's desktop step (44px → 52px, `globals.css:467`). Pass/fail: given the hero
`<h1>`, a section `<h2>`, the numeral "01", and the `$8` stat side by side, a first-time viewer can
correctly rank them by importance without reading the words, using type alone (today, hero and
numeral are visually identical apart from color, which fails this test).

---

## D3 — Anchored ambient glow behind the hero

### Current code

There is no ambient glow, texture layer, or `atmosphere` mechanism anywhere in the light homepage —
`app/page.tsx`'s hero section (`page.tsx:146–197`) is a plain `max-w-[1140px]` container directly on
`--bg` (#FAF7F2), no background-image, no radial-gradient, no absolutely-positioned decorative layer
of any kind. This is a true gap, not a "weak version of something that exists" — there's nothing to
audit against except "flat cream, no atmosphere."

### Adapted technique

The dark mechanic (`03-design.md` §5, `globals.css:565–594`) is: one `position: absolute; inset: 0`
layer behind the hero content, a `radial-gradient` anchored at coordinates matching where the hero's
visual weight actually sits (66% 22% — behind the card stack, not a generic corner), a companion
1px-grid texture, and a `mask-image` fade controlling how far down the page it's visible. Four of
those five pieces translate; one should be dropped outright:

- **Anchoring logic** (glow positioned behind the actual hero card stack, not an arbitrary corner) —
  translates directly, this is layout math, not a color decision. Same coordinate logic applies:
  roughly 66–70% horizontal / 15–25% vertical, matching the hero card stack's position in the
  `min-[900px]:flex-row` two-column layout, `page.tsx:147`.
- **Radial-gradient mechanism itself** — translates, but the opacity has to come down hard. The dark
  version's 0.22 alpha teal glow works because it's the brightest thing in a near-black frame. The
  same 0.22 alpha teal `rgba(14,90,84,0.22)` on `#FAF7F2` cream would render as a visible dirty-green
  smudge — teal at that strength is *darker* than the cream canvas, so instead of "glowing," it reads
  as a shadow stain. Recommend **0.06 alpha, and use `--primary-soft` (#9FE1CB, the mint token) not
  `--primary`** (#0E5A54, the deep teal) as the color source — a light mint tint sitting slightly
  *lighter/brighter* than cream can plausibly read as ambient light; a dark teal tint sitting *darker*
  than cream cannot, no matter how low the opacity goes, because it's fighting the direction of the
  effect (light glows *up* in brightness, not down).

  ```css
  background-image: radial-gradient(circle at 68% 20%, rgba(159, 225, 203, 0.35), transparent 26rem);
  ```

  (Using `--primary-soft`'s actual RGB — `159,225,203` — at 0.35 alpha, which nets out visually
  closer to the dark version's perceptual weight than a literal 0.06-alpha `--primary` would, because
  a light tint needs more alpha to be perceptible against a light field, not less — the two aren't on
  a shared linear opacity scale once the base and tint swap which one is "brighter.")

- **Grid-line texture companion** (`03-design.md:577–578`, the two 1px `linear-gradient`s at 0.022
  white-alpha) — **does not translate, drop it.** On near-black, a barely-visible white grid reads as
  subtle texture. On cream, a barely-visible *anything* at low alpha either vanishes completely (if
  lighter than cream) or reads as a faint dirty grid pattern (if any darker/warmer channel is
  involved) — there's no equivalent "texture that only shows up as depth, never as clutter" available
  on a light field the way there is on black. This is the one piece of D4's mechanism that should be
  left out entirely rather than weakened.
- **Mask-image fade / full-scroll-depth coverage** — the dark version's mask deliberately keeps the
  atmosphere at 35% strength for the *entire* remaining scroll (`03-design.md:335–341`) because an
  all-black page with zero texture past the hero looks dead. The light homepage doesn't have that
  problem — it already alternates `--bg`/`--surface` bands section-to-section (logo strip, destinations,
  how-it-works, FAQ are all `bg-[color:var(--surface)]`, `page.tsx:200, 253, 276, 451`), which already
  gives every section a visible boundary without any glow. Recommend the glow **fade out completely by
  the end of the hero section** (~700–800px), not persist page-wide — extending it would fight the
  existing section-band rhythm rather than complement it.

  ```css
  mask-image: linear-gradient(to bottom, black 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
  ```

### Delta

| | Dark prototype | Adapted for light |
|---|---|---|
| Color source | `--primary` (#0E5A54, deep teal), literal RGB `14,90,84` | `--primary-soft` (#9FE1CB, mint), literal RGB `159,225,203` |
| Opacity | 0.22 | 0.35 (higher number, but lower *effective* visual weight — see note above) |
| Anchor | 66% 22%, behind hero card stack | Same coordinates, same logic |
| Grid texture | Yes, 0.022 white-alpha | No — dropped, doesn't translate |
| Scroll coverage | Full page, settles at 35% strength, never disappears | Hero section only, fades to 0 by ~800px |

### D3 — Testable directive

**Add one `position: absolute; inset: 0; z-index: 0` decorative layer inside the hero `<section>`**
(`page.tsx:146`, needs `relative` added to the section and the existing content wrapped so it sits
above `z-index: 0`), using `radial-gradient(circle at 68% 20%, rgba(159, 225, 203, 0.35), transparent 26rem)`
— i.e. `--primary-soft`, not `--primary` — masked to fade to fully transparent by the bottom of the
hero section only. No grid-line texture layer. Pass/fail: the glow is visibly anchored behind the
hero card stack (not a generic corner decoration), reads as soft ambient light rather than a colored
stain at any zoom level, and has fully disappeared by the logo-strip section below it.

---

## D4 — Tighter corner radius (cards + primary CTA)

### Current code

`app/globals.css:98–100`:

```css
--radius-card: 24px;
--radius-pill: 999px;
--radius-input: 12px;
```

`--radius-card` (24px) is used, via the same `rounded-[var(--radius-card)]` pattern the dark spec
also relied on, across every card on the homepage: `DealCard.tsx:141`, `LockedDealCard.tsx:41`,
destination tiles (`page.tsx:266`), both pricing cards (`page.tsx:351, 389`). `.btn-conversion` (the
coral primary CTA — "Join for free," "Get started free," "Start free trial," `page.tsx:157, 382, 436`)
and `.btn-outline` (the secondary "See live deals" link-style CTA) both inherit `border-radius:
var(--radius-pill)` from the shared `.btn` base class (`globals.css:266`) — meaning **primary and
secondary CTAs are visually the same shape today**, a full 999px pill, with no shape-based hierarchy
between them at all.

### Adapted technique

This is the one technique among the four that translates with **zero adjustment** — corner radius has
no color or luminance dependency, so the dark spec's exact reasoning and even its exact secondary
value apply unchanged:

```css
--radius-card: 16px;   /* was 24px */
```

For the CTA shape split, the dark spec introduced a new `--dp-radius-cta: 12px` token
(`03-design.md:78`) applied only to `.btn-conversion`. Light doesn't need a new token for this —
`--radius-input: 12px` already exists in `:root` (`globals.css:100`) at exactly that value, currently
used only for form fields (`field-input`, `globals.css:339`). Reusing it for the primary CTA is
better than adding a redundant `--radius-cta` token: same numeric outcome, one fewer token to
maintain, and it ties the primary-action shape language to the same "input-adjacent, considered"
shape already used for the site's most functional (non-pill) surfaces.

```css
.btn-conversion {
  border-radius: var(--radius-input); /* 12px, reusing the existing token — no new one needed */
}
```

`.btn-outline` stays untouched, still `var(--radius-pill)` (999px) — this is what creates the
primary/secondary shape distinction the dark spec's D5 also established (`03-design.md:441`,
"a deliberate visual distinction rather than an accident of both buttons sharing one shape").

### Delta

| | Dark prototype | Adapted for light |
|---|---|---|
| `--radius-card` | 24px → 16px | 24px → 16px (identical — no adaptation needed) |
| CTA radius mechanism | New token, `--dp-radius-cta: 12px` | Reuse existing `--radius-input: 12px` — no new token |
| Secondary CTA | Unchanged, stays pill | Unchanged, stays pill |

### D4 — Testable directive

**Change `--radius-card` from `24px` to `16px` in `:root`** (`globals.css:98`) — this cascades
automatically to every card on the homepage with no markup changes, exactly as it did in the dark
prototype. **Add `border-radius: var(--radius-input)` to `.btn-conversion`** (`globals.css:283`),
reusing the existing 12px token rather than introducing a new one. Leave `.btn-outline` and
`--radius-pill` untouched. Pass/fail: every card on the homepage renders at the new, visibly-tighter
16px radius; the three `.btn-conversion` instances (hero, both pricing cards) render as a
rounded-rectangle distinct in shape from the still-pill-shaped `.btn-outline` "See live deals" link.

---

## Summary — directive coverage

| Directive | What changes | Where |
|---|---|---|
| **D1** | New `--shadow-card-rest` token + resting-state shadow on all cards; glass panel on hero card stack only | `globals.css` `:root`, `DealCard.tsx`, `LockedDealCard.tsx`, `page.tsx:175` |
| **D2** | Split `.text-display`/`.text-stat`; new `.text-numeral`; weight divergence between `.text-display` (700) and `.text-h2` (600); tighter tracking on both | `globals.css:211–258, 467`, `page.tsx:301` |
| **D3** | New anchored radial-gradient glow behind hero, mint-toned, hero-scoped only, no grid texture | `page.tsx:146` (new layer), `globals.css` (new rule) |
| **D4** | `--radius-card` 24px→16px; `.btn-conversion` gets `--radius-input` (12px) | `globals.css:98, 283` |

**Explicitly not carried over from the dark spec, with reasons:** the grid-line atmosphere texture
(reads as clutter on light, not depth); full-page glow persistence via mask-image (light already gets
section rhythm from alternating `--bg`/`--surface` bands, doesn't need it); glass on the pricing cards
(no glow behind them on light to justify the blur); teal (`--primary`) as the glow color (reads as a
stain, not light, on a canvas brighter than it is) — `--primary-soft` substituted instead.

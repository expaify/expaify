# UX Research — Dark Homepage Prototype (why it reads as "AI slop")

**Ticket:** UXR-dark-homepage-prototype-01
**Input:** `docs/pipeline/dark-homepage-prototype/01-discovery.md` (referenced by the pipeline; the
actual predecessor artifact present in this worktree is `01-test.md`, the QA sign-off for the
rejected first attempt — read for context on what shipped and passed a purely mechanical bar).
**User verdict on the shipped prototype:** *"bro this is trash not sure who made this, or it was
made by other llms."*

## Method

- Read `app/preview/dark-home/page.tsx` in full (source of truth for structure/markup).
- Read the `.theme-dark-preview` block in `app/globals.css` (lines 490–571) plus the base
  (light-mode) token block it overrides (lines ~80–130) and the shared type-scale/button/card
  primitives (lines 203–334) that the dark route inherits unchanged.
- Read `app/components/ui/DealCard.tsx` and `app/components/LandingNav.tsx` — the two components
  that carry the most visual weight on the page and are reused byte-for-byte from the light site.
- Fetched `https://expaify.com/preview/dark-home` directly. Caveat, stated plainly: the fetch tool
  converts HTML → markdown and summarizes with a small model — it has no access to computed CSS,
  so it cannot perceive color, gradient, glow, blur, shadow, or grid treatment at all. Its output
  literally reported "no elaborate gradients or patterns are evident," which is not evidence there
  aren't any — it's evidence the tool can't see them. Source-code inspection is the authoritative
  method for a visual critique like this one and is what the rest of this brief is based on.
- Attempted `https://terafab.ai/` — returned HTTP 403 (blocked). Per the assignment's fallback
  instruction, reasoning below uses the well-documented Linear.app / Vercel.com (dark sections) /
  Raycast.com pattern language, which is the same design lineage terafab.ai draws from and the one
  the user is pointing at with "Linear × terafab."

---

## Finding 1 — Nothing about the type scale changed for dark; only the color did

**What the code does:** `app/globals.css:210-258` defines the *entire* type system as five fixed
sizes used everywhere in the product: `.text-display` (36px → 44px at ≥768px, weight 700),
`.text-h2` (30px, 700), `.text-h3` (20px, 700), `.text-body` (15px), `.text-small` (13px),
`.text-caption` (11.5px). The dark route (`app/preview/dark-home/page.tsx`) imports and uses these
same five classes verbatim for the hero `<h1>`, every section `<h2>`, every card `<h3>`, and all
body copy — the `.theme-dark-preview` CSS scope (lines 490-571) redefines *only* color tokens
(`--ink`, `--ink-soft`, `--bg`, etc.), never `font-size`, `font-weight`, `line-height`, or
`letter-spacing`. Concretely: the hero headline "Never overpay for a hotel again" renders at
**44px/700/tracking:0** — the identical size/weight used for the "01" / "02" / "03" step numerals
in How It Works (`text-display`, line 304) and functionally close to the `$0`/`$8` pricing stat
(`text-stat`, also 36-44px/700). One scale is doing hero-moment duty, decorative-numeral duty, and
price-tag duty simultaneously.

**What the reference pattern does:** Linear/Vercel/Raycast-style dark hero type is not the same
scale as the rest of the marketing page turned white. It's a purpose-built scale: hero headlines
run 56-72px+ on desktop with tight, often *negative* letter-spacing (-0.02em to -0.04em) and a
lighter weight than you'd expect (500-600 semibold, not 700 bold) — bold-everywhere at large sizes
reads as shouty marketing copy, not calm premium software. Secondary headings step down more
sharply (often 2x+ the ratio between H1 and H2) to create obvious hierarchy, and small labels
(eyebrows, badges) get *increased* tracking (0.05-0.1em, uppercase) rather than the default 0
tracking used everywhere in this codebase.

**Delta:** Recoloring `.text-display` from `#141210` to `#FFFFFF` is a palette swap, not a
typographic redesign. The "large, calm typography" the user asked for requires a scale that
doesn't exist in this codebase yet — dark mode inherited a scale built for a dense, card-heavy
marketplace listing page, then asked it to also carry a luxury-SaaS hero.

**Directive D1 — build a dark-route-only display scale, do not reuse `.text-display`/`.text-h2`
for hero/section headings.** Concretely: hero H1 60px/64px desktop (36px mobile), weight 600, 
letter-spacing -0.02em, line-height 1.05. Section H2 at 34-38px, same weight/tracking treatment,
stepped down clearly from the hero (not the near-parity that exists today between `text-display`
and `text-h2`, 44px vs 30px — closer, but the *weight* is identical 700/700 which flattens the
hierarchy further). Eyebrow/label text (pricing tier names, footer column headers — currently
`text-caption uppercase tracking-wider`) should get real tracking (0.08em+) and a smaller, dimmer
treatment to read as metadata, not competing headlines. This is scoped entirely to the preview
route's CSS/markup — it does not touch the shared `.text-*` classes the light site depends on.

---

## Finding 2 — There is no elevation system; only a border and a hover-only shadow

**What the code does:** `DealCard.tsx:141` renders every card as
`border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)]` with **no shadow at
rest** — `--shadow-card` is `none` in both light and dark palettes (`app/globals.css:125`, never
overridden in the dark scope) and the only shadow that exists,
`--shadow-card-hover: 0 8px 32px rgba(0,0,0,.5), 0 0 40px rgba(14,90,84,.08)`, fires solely
`group-hover`. In the dark palette, card surface (`#171512`) sits only ~4% luminance above page
background (`#0B0A0A`) — one hairline 10%-white border is the *entire* mechanism separating "card"
from "page." Nothing in the file uses `backdrop-filter` or `blur(...)` anywhere — despite "glass/
frosted panels" being explicit in the brief, the word and the CSS property are both absent from
the codebase. Every surface in the design — nav, cards, pricing panels, footer — sits at the exact
same implied elevation.

**What the reference pattern does:** Linear/Vercel/Raycast dark surfaces build depth through
*layering*, not just borders: cards typically sit 1-2 perceptible luminance steps above the page
background (not 4%), get a soft ambient shadow at rest (not hover-only), and premium panels
frequently use a translucent/blurred background (`background: rgba(255,255,255,0.03)` +
`backdrop-filter: blur(20px)`) so content behind genuinely refracts through — that's what makes a
panel read as "glass" rather than "a rectangle with a border." A subtle 1px inner top highlight
(`inset 0 1px 0 rgba(255,255,255,0.06)`) is also a common device to simulate a light source
hitting the top edge of a raised surface — again, absent here entirely.

**Delta:** The prototype has zero elevation vocabulary. Everything is either "flat" or, on hover
only, "flat plus a shadow that appears from nowhere." There's no resting-state depth cue at all,
which is precisely the "everything same elevation" failure mode named in the brief.

**Directive D2 — introduce a 3-tier elevation system for the dark route specifically:** (1) page
background `#0B0A0A`; (2) resting card/panel surface with a visible luminance step
(`background: rgba(255,255,255,0.035)` over the dark canvas, not a flat hex a few percent lighter)
*plus* a resting ambient shadow (`0 1px 2px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06)`) so
cards read as raised before any interaction; (3) a hover/raised state that lifts further
(translateY + larger blur radius, already present) and *brightens* the border
(`rgba(255,255,255,.16)` → closer to `.24`), not just adds a shadow. Apply an inner top-highlight
(`inset 0 1px 0 rgba(255,255,255,.05)`) to the pricing cards and hero deal card specifically, since
those are the two "hero panel" moments on the page.

**Directive D3 — give at least the pricing cards and the hero's floating deal-card stack an actual
glass treatment**, not just a bordered rectangle: semi-transparent surface color +
`backdrop-filter: blur(16-24px)` so the atmosphere glow (Finding 3) visibly refracts through the
panel edges. This is the single most identifiable "premium dark SaaS" signature the user is
pointing at with "glass/frosted panels" in the brief, and it's the one piece of the ask that has
zero implementation today.

---

## Finding 3 — The glow/grid "atmosphere" layer is decorative wallpaper, not an integrated light source

**What the code does:** `.dark-preview-atmosphere` (`app/globals.css:523-535`) is a single fixed
`background-image` stack applied once, globally, behind the entire page: two radial gradients
(teal at 18% opacity centered 78%/7%, coral at **5.5% opacity** centered 12%/46%) plus a flat
48px×48px grid of 1px lines at **2.2% white opacity**, the whole thing masked to fade out via a
vertical `linear-gradient` mask by ~88% down the page. Two consequences follow directly from the
code: (a) the coral glow is essentially invisible at 5.5% opacity — it exists in the stylesheet
but contributes nothing perceptible; (b) because the mask is a single page-level fade, everything
below roughly the "How it works" section — pricing, FAQ, footer, more than half the page's actual
content — renders against **flat, textureless `#0B0A0A`** with no atmosphere at all. The grid
itself is uniform density/opacity across its full extent (no falloff toward edges, no brightening
near content, no perspective), positioned with no relationship to any specific element (not
centered on the hero headline, not radiating from a CTA) — it's a texture, not a light source.

**What the reference pattern does:** In Linear/Vercel-style dark hero sections, glow and grid are
usually (a) scoped tightly to the hero/CTA area rather than smeared across the whole page, (b)
tied to a specific visual anchor (glow originates *from* the primary CTA, a product screenshot, or
directly behind the headline — not floating at an arbitrary percentage coordinate), and (c) grid
lines fade radially or directionally so they read as receding into a horizon rather than as a
uniformly repeating tile. Later marketing sections on a long page typically get their *own*,
smaller-scale ambient treatment (a single soft glow behind a section heading, a subtle top-border
highlight) rather than being left flat once the hero's effect fades out.

**Delta:** The current implementation checks the literal box ("has a radial glow," "has a grid")
without doing the thing that makes those devices read as premium: intentional placement tied to
content, and consistent (if reduced) treatment for the full scroll depth of the page, not just the
top 900px.

**Directive D4 — anchor glow to content, not to arbitrary coordinates, and give every dark section
some (even minimal) ambient treatment.** Concretely: move the teal glow so it originates from
behind/above the hero CTA cluster or the floating deal card rather than the top-right corner in
isolation; drop the coral glow's opacity floor to something perceptible (12-15%) or cut it and
commit fully to teal as the dominant hue with coral reserved for CTA accents only (see Finding 5);
give the pricing section and the dark contrast band (Finding 6) their own small radial glow behind
the section heading rather than relying on the hero's fade-out mask to cover the whole page — a
16-20rem soft glow at 8-10% opacity per section is enough to avoid the "flat black wallpaper"
problem in the back half of the page.

---

## Finding 4 — Buttons and cards kept identical shape language; only recolored

**What the code does:** `.btn` (`app/globals.css:260-276`) defines pill radius
(`--radius-pill: 999px`), 44-48px height, and padding — used unmodified by both light and dark
routes. The dark scope (`app/globals.css:537-551`) only touches `border-color`/`color`/`box-shadow`
on `.btn-outline` and the text color on `.btn-conversion`. `--radius-card: 24px` is likewise
untouched. Every interactive shape on the page — button pill radius, card corner radius, badge pill
radius — is pixel-identical between the light marketplace site and the "premium dark SaaS
redesign."

**What the reference pattern does:** Dark premium SaaS sites frequently use a *tighter* corner
radius than light consumer/marketplace sites (8-14px rather than 24px pill-adjacent cards) because
sharper geometry reads as more considered/technical, whereas very round corners read as friendly/
consumer (appropriate for expaify's *light* marketplace mode, less so for a "calm, luxury, Linear-
esque" dark mode). Primary CTAs in this pattern language are also frequently *not* full pills —
they trend toward 8-10px rounded rectangles with a subtle gradient or inner glow rather than a flat
fill.

**Delta:** Zero shape differentiation between "consumer deal marketplace, daytime" and "premium
dark SaaS" — the only variable that changed anywhere in the interactive-element system is color.

**Directive D5 — reduce corner radius specifically for the dark route's cards and primary CTA,
independent of the shared `--radius-card`/`--radius-pill` tokens** (route-scoped CSS variables,
same pattern already used for `--bg`/`--surface`/etc.): cards to ~14-16px, primary CTA to a
10-12px rounded rectangle rather than a full pill. Keep the secondary/outline button as a pill if
a soft distinction between "primary action shape" and "secondary action shape" is wanted — but
right now they're both the same pill, so there's no shape hierarchy at all between primary and
secondary CTAs, on top of no shape differentiation from the light theme.

---

## Finding 5 — Coral (`--accent #FF6B4A`) is present but functionally invisible; teal is under-committed

**What the code does:** Coral appears in exactly two places on the dark route: (1) the atmosphere
glow at 5.5% opacity (Finding 3 — imperceptible), and (2) `.btn-conversion` background, inherited
unmodified from light mode, with only its *text* color re-pinned for contrast
(`app/globals.css:543-545`). Teal (`--primary #0E5A54`) fares slightly better — it's the price
numeral color, the "Price Verified" badge, link-hover color, and the premium pricing card's border
— but every one of those is a direct, unmodified carry-over from the light palette, not a treatment
considered for a dark canvas. Nothing on the page uses teal or coral as a *glow source* on an
interactive element (no coral-rim CTA glow on hover, no teal ambient light behind the premium
pricing card), and `--primary-soft` (`#9FE1CB`, a light mint) is used only as a small footer dot
and inline text accent — never as a surface or glow tint even though it's specifically a "soft"
variant seemingly built for exactly that purpose.

**What the reference pattern does:** Premium dark SaaS sites tend to commit hard to one accent hue
as the primary interactive/glow color and use it confidently and repeatedly — CTA hover glows,
active-state borders, focus rings, badge treatments, and background radial gradients all pull from
the same 1-2 accent hues so the brand color reads as an intentional system, not a coincidental
carry-over from a different theme.

**Delta:** expaify already owns a distinctive, legible teal that could anchor the entire dark
palette's identity (it's the color used for "Price Verified," savings callouts, and links — i.e.
it already means "trust/value" in the product's own vocabulary) but it shows up dark-mode as a
timid 18%-opacity corner blob and an inherited link color, never as a deliberate glow or elevation
cue. Coral is essentially decorative dead weight in dark mode as currently implemented.

**Directive D6 — commit teal as the dark theme's signature glow/interaction color and give coral a
single, confident, deliberate job (not decoration).** Concretely: use teal for hover-glow on the
primary CTA (`box-shadow: 0 0 32px rgba(14,90,84,.35)` on hover/focus, not just a border-color
swap), for the focus ring, and for the premium pricing card's ambient glow (tie Finding 3/4's
section-level glow to the premium tier specifically, reinforcing "this is the recommended option"
visually, not just via a border). Give coral exactly one job — e.g., the annual-plan savings badge
and the discount-percentage chip on deal cards — at full, confident opacity/saturation, and drop it
from the passive atmosphere layer entirely if it can't be pushed above ~12% without going full
Miami-vice; a single confidently-used accent beats two timid ones.

---

## Finding 6 — The one deliberate dark contrast section on the light site is neutralized in the dark redesign

**What the code does:** On the live light homepage (`app/page.tsx:318-340`), the "One deal. Four
marketplaces. Zero tabs." section uses `bg-[color:var(--ink)]` — a deliberate near-black band that
interrupts an otherwise cream/white page to create a visual event partway down the scroll. The QA
doc (`01-test.md`, item 6) confirms the dark route swapped this to
`bg-[color:var(--bg)]` (`app/preview/dark-home/page.tsx:321`) specifically so it wouldn't render as
a jarring white band on an already-black page — a reasonable fix for the immediate bug, but it has
an unaddressed side effect: **that section's entire reason to exist was contrast, and on the dark
route it's now bg-identical to every other section on the page.** The QA pass correctly verified
the fix doesn't break contrast/accessibility; it did not evaluate whether the section still
functions as a visual event, and it doesn't — scrolling through the dark route, this section is
now indistinguishable from the sections above and below it except for a hairline top/bottom border.

**What the reference pattern does:** Long-scroll premium dark pages still create rhythm and visual
events through alternating surface treatment even within an all-dark canvas — e.g., alternating
page-background sections with slightly-elevated "panel" sections (a different surface tone, an
inset glow, a contained max-width card rather than full-bleed), not by relying on a light/dark
swap that no longer exists once the whole page is dark.

**Delta:** This is a structural gap the QA sign-off didn't catch because it was scoped to
correctness/accessibility, not to whether the section still does its job. It's exactly the kind of
"technically passes, still reads as thoughtless" gap the user's reaction is naming.

**Directive D7 (bonus, addresses a functional not just aesthetic gap):** give this section its own
distinct surface treatment now that the light/dark swap trick is gone — e.g., render it as a
contained, elevated panel (using the Finding 2 elevation system) inset within the page rather than
full-bleed, or give it the strongest version of the teal ambient glow on the page (Finding 4/6) so
it's unambiguously the "hero proof point" section rather than one of seven visually identical
full-bleed bands.

---

## Summary — ranked directives for UXDES to spec against

1. **D1 — Dark-route-only type scale.** Hero 60-64px/600/-0.02em, distinct from body-page
   `.text-h2`/`.text-h3`, distinct weight step (not uniform 700 everywhere), real tracking on
   eyebrow/label text.
2. **D2 + D3 — Elevation + glass system.** Resting-state shadows and a visible surface-tone step
   (not 4% luminance), plus real `backdrop-filter: blur()` glass treatment on the pricing cards and
   hero deal-card stack — the single most literal gap against the brief's explicit "glass/frosted
   panels" ask.
3. **D4 — Anchor glow to content, cover the full scroll depth.** Move glow off arbitrary
   coordinates onto the hero CTA/deal-card cluster; give pricing and the dark contrast band their
   own small ambient glow instead of leaving the back half of the page flat.
4. **D5 — Reduce corner radius for dark-route cards/primary CTA**, route-scoped, to create shape
   differentiation from the light marketplace theme and a primary/secondary shape hierarchy.
5. **D6 — Commit teal as the dark theme's signature interactive glow color**; give coral exactly
   one confident job instead of two timid, barely-visible ones.
6. **D7 — Rebuild the "one deal, four marketplaces" section as a distinct elevated/glowing panel**
   now that the light-site's black-band-on-white contrast trick no longer applies on an all-dark
   canvas.

None of these require touching `app/page.tsx`, API routes, or any shared component contract —
all seven are scoped to the `.theme-dark-preview` CSS block and the `app/preview/dark-home/`
route-local markup, consistent with how the rejected first attempt was already isolated.

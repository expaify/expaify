# P9.1 Eng handoff: Homepage + global chrome + tokens
(Verbatim from Helena, expaify's marketing/design lead, dated 2026-08-19. Parent spec: files/priority-9-premium-ux-ui.md §13 Session 2. Went through a full critique + mockup + owner-approved visual-QA cycle before this handoff was written.)

**Status:** Ready for eng, pulled forward by owner on 2026-08-19.
**Phase:** P9.1 only (homepage + nav/footer + tokens). Not P9.2 /deals, not hubs skin, not auth re-route.

## 0. Goal
Ship a Booking/Airbnb-caliber homepage craft using existing brand (cream / coral / teal / Geist) without touching conversion structure. Wow = layout, media, hierarchy, locked-card honesty, destination photography. Not a dark recolor.
North star: warm cream trading floor for hotel prices: photographic, numeric, quiet, coral only when it's time to act.

## 1. Scope
In: design tokens, global Navbar + Footer, homepage IA rebuild, shared DealCard/LockedDealCard "locked law", DestinationTile row (6-8) + All 26 link, trust strip (remove "Trusted by 2,400+"), how-it-works + median-vs-now mini visual, delete duplicate deal section above pricing, motion + reduced-motion, mobile Join fix, chat z-index policy, feature flag `p9_1_homepage` + rollback.
Out: /deals redesign (P9.2), destination hub skin (P9.3), auth flow changes (P9.4), dark homepage theme, new colors/rebrand, changing 30%/60-day/8-check/unlock economy/Premium price logic, invented deals or fake social proof, WebGL/Lottie/parallax.

## 2. Design tokens
### 2.1 Color
| Token | Value | Role |
|---|---|---|
| --bg-canvas | #FAF7F2 | Page |
| --bg-surface | #FFFFFF | Cards, modals |
| --bg-surface-muted | #F3EEE6 | Wells, filter-like strips |
| --ink-primary | #1C1917 | Headings |
| --ink-secondary | #5C5852 | Body |
| --ink-tertiary | #8A847C | Meta |
| --brand-coral | #FF6B4A | Primary CTA, % badge |
| --brand-coral-pressed | ~8% darker coral | Active |
| --brand-teal | #0E5A54 | Links, secondary emphasis |
| --brand-teal-soft | teal @ 8-12% alpha | Selected chips, Free card lift |
| --border-subtle | #E8E2D8 | Default border |
| --border-strong | #D4CCC0 | Input neighbor |
| --lock-overlay | rgb(28 25 23 / 0.45) | Over blurred photo |
| --shadow-1 | 0 1px 2px rgb(28 25 23 / 0.06) | Resting card |
| --shadow-2 | 0 8px 24px rgb(28 25 23 / 0.08) | Hover / hero card |
Stop: coral full-bleed backgrounds; rainbow badges; pure #000 body text.

NOTE (orchestrator): expaify already has a real design-token system in app/globals.css (--ink, --brand #0E5A54, --bg #FAF7F2, --surface #FFFFFF, --line-ivory, etc.) predating this doc -- Helena's token names above are illustrative, not a literal file to overwrite. Reconcile: reuse the EXISTING token variable names/values already in app/globals.css wherever they already express the same role (they mostly already match these hex values almost exactly), only ADD new tokens for roles that don't exist yet (e.g. --lock-overlay, --shadow-2 if genuinely missing). Do not fork a second parallel token system.

### 2.2 Typography
Font: Geist Sans only (already the site's font via --font-display/--font-sans in globals.css). Tabular nums on all prices (font-variant-numeric: tabular-nums).
Display H1: 48-56px/1.05/-0.02em. Section H2: 28-32px/1.15. Eyebrow: 12-13px/0.08em uppercase tracking. Body: 16px/1.55. Small/meta: 13px/1.4. Price now: 26-28px semibold tabular (hero), 22-24 on strip cards. Price usual: 14-15px tertiary + strikethrough. % badge: 13-14px semibold on coral pill. FAQ/long text measure: max-width 36-40rem.

### 2.3 Spacing / layout
Base 4px, scale 4/8/12/16/24/32/48/64/80/96. Page max 1200-1280px. Section-y desktop 80-96px, mobile 48-64px. Nav height 64px.

### 2.4 Radius
--r-sm 8px (chips, inputs), --r-md 12px (buttons), --r-lg 16-20px (deal cards, hero media, dest tiles), --r-pill 999px (filter chips only, NOT primary buttons -- reconcile with the site's existing button convention if it already uses pill buttons; if so keep pill for the primary CTA button specifically, per how the existing site/prior mockup does it).

### 2.5 Motion
Card hover: translateY(-2px) + shadow-2, 180ms ease. Button: brightness/opacity 100ms. Reduced motion: all transformative motion off. Forbidden: parallax, scroll-jack, confetti, lock shake.

## 3. Homepage IA (top to bottom)

### 3.1 Navbar
[Logo] Deals Destinations Login [Get free alerts]
One coral filled CTA labeled "Get free alerts", href = existing free path (e.g. /login?intent=free + existing growth UTMs like utm_campaign=free_alerts -- do not invent a new funnel, reuse whatever URL pattern LockedDealCard.tsx already uses: /login?intent=free&city=...&utm_source=...&utm_medium=...&utm_campaign=free_alerts).
Text links: Deals -> /deals, Destinations -> destinations index, Login -> existing login.
REMOVE or demote nav "Join the club" / trial pill so it never competes with free alerts. Trial CTA stays in Pricing section only.
Sticky, cream ~80% + backdrop blur, height 64px.

### 3.2 Hero
Desktop: grid ~0.45fr/0.55fr, gap 32-48, vertically centered. Mobile: stack eyebrow -> H1 -> sub -> primary CTA -> text link -> hero deal card.
Eyebrow: product proof e.g. "26 cities · 60-day median · 30%+ only" -- must say the real, current canonical destination count, never region-scoped.
H1: keep existing value prop/wording if it's already converting -- do not invent new positioning that drops the 30% median story, just improve the visual treatment.
Sub: one line.
Primary: "Get free alerts" (coral).
Secondary: text link "See live deals" -> /deals.
Absent: trial button, star ratings row, "Trusted by 2,400+" anywhere in hero.
Hero deal card: ONE live qualified real deal from the real API (empty state = quiet text, never a fake hotel). Image ~16:10, r-lg, shadow-2. Overlay on image: % off pill only (one home for the percentage, not also repeated as a separate line). Body: hotel name (1-line clamp), city + dates, price row "now | usual" tabular, meta line "60-day median · N checks" using REAL fields from the API, one button "View deal". Free path as a small text link under the card (not a second coral button).

### 3.3 Trust strip
OTA wordmarks (only the ones actually licensed/real in this codebase -- check lib/pipeline/otaLinks.ts for what's real, do not add logos for partners with no real integration) grayscale/mono, equal height ~20-24px. Proof line e.g. "Flagged only at ≥30% below 60-day median · ≥8 checks". DELETE any "Trusted by 2,400+" or similar invented-number copy if present anywhere on the homepage.

### 3.4 Live strip
Header + text link "See all" -> /deals. Exactly 3 real DealCards, equal height. Locked-card rule per §4.3. At most one locked demo card in this row of 3.

### 3.5 Destinations
6-8 DestinationTiles (curated real featured cities from the actual tracked_markets list -- do not invent city names, use real ones from the destinations already in this codebase). Photo, city name, optional live count if cheap. Aspect 4:5 or 1:1, r-lg, hover lift. Mobile: horizontal scroll snap. Below: text link "All 26 destinations ->" to the full index (real current count, check actual active market count in the DB/codebase rather than assuming 26 is still current). REMOVE the wall of ~26 equal plain button/rects as the primary destination UI if that's what currently exists on the real homepage.

### 3.6 How it works
Keep the existing 3-step meaning (watch -> flag median drops -> book on OTA). Add a compact "median vs now" mini visual under step 2 (simple CSS/SVG two-bar comparison, no chart library dependency needed). Avoid generic multicolor icon salad.

### 3.7 Kill duplicate proof
Remove any second full deal module repeating the hero's deal (e.g. a duplicate "one deal / four marketplaces" block) if the current homepage has one. Max one large proof deal object above pricing (the hero card).

### 3.8 Pricing
Free plan visually primary (teal-soft border or shadow-1 lift vs Premium). Entitlement bullets stay exactly as they are today (word-for-word, do not touch pricing copy/logic). Premium CTA (Start trial / Join) may live here, not in nav/hero.

### 3.9 FAQ + footer
FAQ accordion unchanged in content, cream well background, measure 36-40rem. Footer: sparse, bg-canvas (cream) token, teal links -- if the site has any other footer variant elsewhere using a different (e.g. white/light) background, make sure it's using the same canvas token, no light footer sitting under a cream/dark page.

### 3.10 Chat widget
z-index below the sticky nav CTA, must never cover the hero primary button.

## 4. Components

### 4.1 Button
primary: bg coral (#FF6B4A), text color WCAG-AA-checked against that coral (pick white or near-ink #141210, whichever passes, and use it consistently), height 44-48px, px 20, r-md, no gradient.
secondary: surface + 1px border, or outline.
tertiary: teal text, no box.
disabled: reduced opacity + not-allowed cursor, not a broken-looking gray.

### 4.2 DealCard (homepage use)
Image top 3:2 or 4:3 (hero variant can be 16:10). % badge on image (one home for the percentage). Title clamp 1 line. Meta: city · dates. Price row. Footer meta: checks/median. Single CTA "View deal". Hover: lift 2px + shadow-2.

### 4.3 LockedDealCard -- THE LAW (P0, ship this correctly)
If a real imageUrl exists: show the real image, blur it (8-12px), lock overlay (--lock-overlay), centered lock icon + "Members" (or the site's existing premium label), optional text link "Free alerts for {city}".
If NO imageUrl exists: a branded gradient background + city name text. NEVER a single letter "e" or any generic glyph-only tile pretending to be a hotel photo.
CONCRETE BUG TO FIX: app/components/ui/PropertyPhoto.tsx currently has a `brandedFallback` code path (around the `if (!src || failed)` block) that renders a literal hardcoded "e" character in a small square div as the fallback when there's no image. This is the exact violation of the law above. Fix it: when brandedFallback is used (no image URL, or failed load), render a branded gradient/tint background (using existing --brand/--primary tokens, e.g. a soft gradient from --primary-soft to --primary or similar existing token) with the city name text visible on it -- remove the literal "e" square entirely. Do not touch PropertyPhoto's other behavior (loading/error state machine, sizes, non-branded fallback path) beyond this specific fallback visual.
Applies to homepage live strip and any locked teaser on /.

### 4.4 DestinationTile
Image fill + bottom gradient scrim for name legibility. Name + optional live count. Click -> existing destination hub route. Alt text = city name.

### 4.5 Navbar / Footer
Per §3.1 and §3.9.

### 4.6 MedianVsNow (tiny)
~120-160px wide, ~40-48px tall. Labels "Median" / "Now". Teal muted vs coral now bar. Decorative, not required to be interactive.

## 5. Breakpoints
mobile <640px: single column, dest horizontal scroll, nav compact, section-y 48-64, hero stacked.
tablet 640-1023: hero can stay stacked or go 2-col if space allows; live strip can wrap 1-2 col but prefer 3 only when width >= ~960.
desktop >=1024: hero 45/55, live strip 3 col, dest 6-8 in one row (or 4+4 wrap).
wide >=1280: content capped at page-max, side margins grow.
Touch targets: CTA min height 44px, FAQ rows min ~48px hit area. Hero deal card min width desktop ~360-400px.

## 6. Mobile Join fix (P0, include in this ticket)
Problem: on mobile, "Join"/trial competes with or displaces "Get free alerts", or appears as the dominant sticky/nav action, muddying the free-alert growth path.
Fix: mobile nav/sticky chrome exposes "Get free alerts" as the ONLY filled coral CTA (same hierarchy as desktop). "Join"/"Start trial" must NOT appear as a nav pill or sticky primary on the marketing homepage -- trial only in Pricing (and logged-in account entry if it already exists there as plain text). If a sticky mobile bar exists, it labels "Get free alerts" -> the free intent URL, never "Join". After hamburger-menu open, free alerts stays obviously primary (top of sheet or footer-of-sheet as the primary button). Do NOT fix this by removing free alerts or forcing trial before email on the free path.

## 7. DO NOT TOUCH (conversion-critical, hard boundary)
- Deal math: 30%+, 60-day median, >=8 checks -- labels AND meaning, unchanged.
- Free vs Premium entitlements: exact current numbers (1 city, 3 unlocks/week, etc.) unchanged.
- Free path: /login?intent=free (+ city params where supported) -- exact URL pattern unchanged.
- City-first activation / post-signup destination picker behavior -- unchanged.
- OTA handoff: "View deal" -> OTA, never an expaify checkout.
- Unlock economy -- no redesign for aesthetics.
- Growth UTMs -- keep exact existing utm_campaign=free_alerts (and other existing) patterns.
- Hub content model -- out of scope for P9.1.
- Any A/B test currently live on hero copy -- do not touch mid-test (if none exists, N/A).
Allowed: visual CSS, component structure, demoting Join in nav, killing duplicate modules, locked-photo craft, destination tiles, chat z-index.

## 8. Content / data requirements
Featured 6-8 city slugs + images: use real active markets + real photo assets already in the codebase (destination hub OG/hero images or existing brand assets) -- must be real places already tracked, not invented.
Live hero deal + 3 strip deals: existing real deals API, respect free/premium lock rules.
OTA logo assets: only for OTAs actually real/licensed in this codebase (check lib/pipeline/otaLinks.ts).
Canonical destination count: use whatever the real current active market count is (verify against the database/codebase, do not hardcode a number from this doc without checking).
Copy: prefer the existing H1/subline if it's already converting -- hierarchy/visual changes only, don't rewrite value-prop copy.

## 9. Acceptance criteria
P0 (must pass):
- No locked "e" (or any letter placeholder) anywhere on the homepage.
- Nav + hero: exactly one coral primary CTA = "Get free alerts"; no "Join" pill in nav.
- Mobile: "Join" is not primary; free alerts is reachable and visually primary.
- Destination section = photo tiles (6-8) + "All 26" (or real count) link; not a wall of plain pills/rects.
- Free-intent URLs and UTMs still fire correctly on all free CTAs (verify against the exact existing pattern, don't change it).
- Hero prices/math match the real API response -- no invented numbers anywhere.
- Duplicate full deal section above pricing is gone (if one currently exists).
- Any "Trusted by 2,400+"-style invented social-proof number is removed.
P1:
- Tokens applied consistently (coral/teal/cream/radius/shadow).
- Trust strip = real OTA logos + product proof line.
- Live strip is exactly 3 cards, locked cards use the photo+blur law (§4.3), not the "e".
- How-it-works has the median-vs-now mini visual.
- Section spacing ~80-96px desktop.
- Hover motion 2px/180ms; prefers-reduced-motion respected.
- Chat widget never covers the primary CTA.
- Coral button text passes WCAG AA contrast; focus rings visible on all interactive elements.
- Feature flag off restores the exact previous homepage.
P2:
- Geist-only fonts (no stray Roboto/system fallback showing through anywhere it shouldn't).
- Footer sparse, cream canvas background.
- Empty hero-deal state (no qualifying live deal) is clean, not broken-looking.

## 10. Feature flag + rollback
Implement a feature flag (env var is fine, e.g. `NEXT_PUBLIC_P9_1_HOMEPAGE` or reuse any existing flag pattern if one exists in this codebase -- check first) gating the new homepage IA vs the current one, so it can be toggled off in one deploy without a code revert if something looks wrong in production. Default OFF until explicitly verified and approved to go live.

## 11. Implementation order (follow this sequence)
1. Design tokens (reconcile with existing app/globals.css tokens per the note in §2.1, add only what's missing) + Button variants
2. LockedDealCard "law" fix (§4.3, the PropertyPhoto.tsx "e" bug) -- ships independently of the rest, real bug fix
3. Navbar (desktop + mobile Join fix, §3.1 + §6)
4. Hero editorial + HeroDealCard
5. Trust strip
6. Live strip (3 cards)
7. DestinationTile row
8. How it works + MedianVsNow
9. Delete duplicate proof section (if one exists)
10. Pricing visual emphasis only (Free primary) -- copy/logic unchanged
11. FAQ/footer polish
12. Chat z-index
13. Feature flag wiring + this doc's P0 acceptance checklist verified

## 12. One-line for eng standup
P9.1: tokenized cream homepage, one coral "Get free alerts" in nav/hero, photo destination row, kill locked "e" and duplicate deals, demote mobile Join, don't touch free-alert or unlock plumbing.

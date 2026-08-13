# UXR: Brand Icon Set — Research

## Audit method
Re-ran and extended the discovery doc's grep rather than trusting its numbers. Discovery claimed `grep -rln "<svg" app/components/` returns 19 files — the actual count today is **14** in `app/components/` and **23** across the full `app/` tree (discovery scoped its grep too narrowly and missed `app/page.tsx`, `app/login/*`, `app/join/_form.tsx`, `app/deals/*`, `app/book/BookingFlow.tsx`, `app/auth/error/page.tsx`, and the sparkline test file). Read `ShareButton.tsx`, `WatchCityPill.tsx`, `TrustLine.tsx`, `StarRow.tsx`, `LockedDealCard.tsx`, `HotelCard.tsx`, `DealFeed.tsx`, `CompareRow.tsx`, and `deals/[dealId]/page.tsx` directly, plus a `viewBox`/`strokeWidth` grep across every file in the wider set.

## What the current code actually does (verified)
Every one of discovery's four cited geometries checks out exactly as described:
- `ShareButton.tsx` — `viewBox="0 0 24 24"`, `strokeWidth="2"`, displayed at 17px
- `WatchCityPill.tsx` — `viewBox="0 0 16 16"`, `strokeWidth="1.75"`, displayed at 16px (native 1:1)
- `TrustLine.tsx` — `viewBox="0 0 10 10"`, filled bars, no stroke at all
- `StarRow.tsx` — `viewBox="0 0 12 11"`, filled star path, no stroke

But the wider audit surfaces a sharper finding discovery didn't have: **this isn't just "12 new icons need a system" — three concepts that already exist have already been reinvented independently, multiple times, with different geometry each time**, which is live proof the drift is active, not hypothetical:

| Concept | Independent implementations found | Geometries |
|---|---|---|
| **Star rating** | `StarRow.tsx` (shared component) · `HotelCard.tsx` local `StarRow` function (lines 352-367, a full duplicate, not an import) · `DealCard.tsx`/`LockedDealCard.tsx` `starChars()` unicode `★☆` | `12x11` filled / `12x12` filled with different unfilled-state token (`--line-ivory` vs `--border-strong`) / no SVG at all, just text glyphs |
| **Lock / premium gate** | `LockedDealCard.tsx` inline · `deals/[dealId]/page.tsx` inline (two separate instances, lines 164 and 392) · `DealFeed.tsx` `LockGlyph()` (line 271) | `22x22@1.75` / `24x24@1.75` and `20x20@1.75` / `14x14@2` — same rect+path lock shape, three different stroke widths and sizes |
| **Chevron / check / arrow** | `HotelCard.tsx` (14x14, no stroke width shown for fill glyph), `DealFeed.tsx` (three separate instances: 12x12@2.5, 13x13@2.5, 14x14@2), `join/_form.tsx` (14x14, no stroke shown), `FlightCard.tsx` (12x12/14 mismatch, 14x14) | at least 5 distinct stroke widths for what should be one glyph family |

Discovery's constraint section said "at most 2 of 12 target concepts have any existing improvised precedent (watchlist, hotel deals)." That undercounts: **premium/lock (`LockedDealCard.tsx`) is a third pre-existing, already-fragmented concept**, and star rating — while not one of the 12 target icons — is the clearest existing evidence of what happens without a shared source: the same idea gets rebuilt three incompatible ways within components that sit one prop-drill apart (`HotelCard.tsx` renders its own `StarRow`, five lines from where it could have imported `ui/StarRow.tsx`).

Full geometry inventory across the wider `app/` tree turned up **at least 10 distinct `viewBox`/`strokeWidth` pairs** and **10 distinct display sizes** (10, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 48px), confirming the problem is systemic, not confined to the 4 files discovery cited.

`CompareRow.tsx` genuinely has zero icon markup — confirms discovery's claim that marketplace comparison has no existing precedent at all. No icon package (`lucide-react`, `react-icons`, `heroicons`) is in `package.json` — confirmed.

## Reference pattern comparison
**Booking.com** (trust badges — Genius loyalty, free cancellation, verified stay): every badge is icon + label together, never icon alone; the same badge component/sprite is reused verbatim across search results, the property page, and the booking confirmation screen — one canonical render, many call sites, never a re-authored SVG per surface.

**Google Flights** (price-tracking bell, CO2 leaf, status checks): all stroke-based, uniform 2px-equivalent stroke on one grid, color driven entirely by `currentColor` inherited from the parent (never a hardcoded fill per instance). Toggleable icons (e.g. "track this price") swap between an **outline and filled variant of the same glyph** on activation — they never swap to an unrelated icon to represent "on" vs "off."

**Delta from this repo:**
| | Reference pattern | This repo today |
|---|---|---|
| Source of truth | One component/sprite per concept, imported everywhere | Zero shared source; each file hand-authors its own SVG |
| Geometry | One grid, one stroke-width, reused at every size | 10+ viewBox/strokeWidth pairs across 23 files |
| Color | `currentColor`, parent sets it from a small fixed palette | Mixed: some `currentColor` (ShareButton, LockedDealCard), some hardcoded `var(--ink-faint)` via `fill` (TrustLine), no consistent rule |
| Toggle states | Outline ↔ filled variant of the *same* glyph | `WatchCityPill.tsx` already does this correctly (Plus → Check) — the one place in the codebase that matches the reference pattern, and worth preserving as the template |
| Icon-alone meaning | Never — always paired with visible text or an `aria-label` on the parent control | Matches already (`ShareButton`, `WatchCityPill` both put the label on the button, not the glyph) — constraint 2 in discovery is correctly scoped |

The gap is almost entirely on **source-of-truth and geometry**, not on the accessibility or interaction-state conventions — those are already sound in the two components (`ShareButton`, `WatchCityPill`) that this repo got right. The design directives below exist to extend those two correct patterns to all 12 new icons rather than to invent new conventions.

## Design directives

**D1 — Canonical geometry, fixed everywhere:** `viewBox="0 0 16 16"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, `strokeLinecap="round"`, `strokeLinejoin="round"` for all 12 icons, at every display size. Only `width`/`height` may vary per call site — `viewBox` and `strokeWidth` never change. This is not a new number invented for this ticket: it is `WatchCityPill.tsx`'s existing, shipped, already-accessible geometry, promoted to the standard instead of one-offed. Rationale for picking this over a 24-unit grid (used most often today): at native 1:1 (16px, the documented smallest in-use size), it already clears the discovery's ≥1.5px-rendered-stroke floor with margin (1.75px rendered), and every larger display size only scales the stroke *up*, never risking the floor. Testable: a new icon file with any other `viewBox` or `strokeWidth` value fails review.

**D2 — Three display sizes, no others:** `16px` (sm — inline with caption/small text: footer trust line, pills, badges), `20px` (md — default, body/button-adjacent), `24px` (lg — standalone/section-header use, e.g. the paywall gate icon). This replaces the current 10-value sprawl (10–48px) found in the audit. The existing 48px `DealFeed.tsx` empty-state airplane is a pre-existing exception — leave it alone, but it is not precedent for any of the 12 new icons. Testable: any new icon call site passing a size outside {16, 20, 24} fails review.

**D3 — Color is `currentColor`; the call site picks from exactly 4 tokens:** `text-[color:var(--ink-soft)]` (default — neutral/decorative, matches `TrustLine.tsx`'s existing faint-ink convention), `text-[color:var(--primary)]` (active/selected/CTA-adjacent — e.g. watchlist "watching" state, direct-booking link), `text-[color:var(--gold-deep)]` (reserved solely for the verified-savings / premium-unlock accent, per discovery constraint 1), `text-[color:var(--accent)]` (reserved solely for urgent/alert states — e.g. a price-drop badge — used sparingly, matching the existing coral convention noted in discovery). No raw hex, no 5th token, ever. Testable: `grep` for any `stroke="#` or `fill="#` in the new icon module should return nothing.

**D4 — Decorative by default, matching `TrustLine`/`WatchCityPill`/`ShareButton` precedent exactly:** every icon in the set ships `aria-hidden="true"` `focusable="false"` as a component default. An icon may never be the sole accessible content of a control — the parent control (`<button>`/`<a>`) carries the `aria-label`, never an SVG `<title>`. Testable: any new icon rendered as the only child of an interactive element without a parent `aria-label` fails review.

**D5 — Toggle-state icons reuse the outline↔filled pattern already proven in `WatchCityPill.tsx`, not a glyph swap:** any of the 12 concepts that has an on/off or tracked/untracked state (watchlist, email alerts, destination tracking) renders as an outline variant by default and a filled or checked variant of the *same* base glyph when active — both variants share the D1 geometry contract. Do not introduce a second toggle idiom (e.g. color-only, or two unrelated icons) for any new stateful icon. Testable: any stateful icon whose "on" and "off" renders don't share the same base path structure fails review.

## Icon registry (12 concepts, for UXDES to map to files/props)
deal alerts · watchlist (precedent: `WatchCityPill.tsx`, reuse its Plus/Check geometry directly under D1/D5) · price history · verified savings (accent color per D3) · email alerts · destination tracking · direct booking · no hidden fees · marketplace comparison (currently zero precedent — greenfield) · premium unlocked deals (precedent: 3 existing fragmented lock implementations in `LockedDealCard.tsx`, `deals/[dealId]/page.tsx`, `DealFeed.tsx`'s `LockGlyph` — consolidate to one) · privacy/no ad trackers · hotel deals

## Open item flagged, not solved here
`TrustLine.tsx` (filled bars, no stroke) and `StarRow.tsx`/`HotelCard.tsx`'s duplicate star implementation (filled paths, no stroke) both predate the "rounded-line" brand direction discovery's constraint 3 names and are themselves inconsistent with each other and with the stroke-based D1 contract. They are out of scope for the 12 new icons but are the single clearest piece of evidence for *why* a shared registry matters — recommend a follow-up ticket to consolidate `HotelCard.tsx`'s local `StarRow` into an import of `ui/StarRow.tsx`, and to replace `DealCard.tsx`/`LockedDealCard.tsx`'s `starChars()` unicode glyphs with the same shared component, once the 12-icon set proves the pattern.

# UXDES: Brand Icon Set — Design Spec

Upstream: `docs/pipeline/BRAND-ICON-SET/01-discovery.md`, `docs/pipeline/BRAND-ICON-SET/02-research.md`.

## 0. Verification pass before designing

Re-read every file research cited directly before locking geometry, to design against what ships today, not what the brief summarized:

- `app/components/ui/WatchCityPill.tsx` — confirmed `PlusIcon`/`CheckIcon`, both `viewBox="0 0 16 16"`, `strokeWidth="1.75"`, 16×16 native. `PlusIcon`: `d="M8 3v10M3 8h10"`, `strokeLinecap="round"` only. `CheckIcon`: `d="M3 8.5l3.2 3.2L13 5"`, `strokeLinecap="round" strokeLinejoin="round"`. Button uses `.btn-pill` (sets `color: var(--ink)`) / `.btn-pill.active` (changes `border-color`/`background` only — **does not** recolor the icon; the icon inherits `--ink` in both states today).
- `app/globals.css` — confirmed the 4 tokens D3 restricts to all exist verbatim: `--ink-soft: #5C5852`, `--primary: #0E5A54`, `--gold-deep: #8C6A1D`, `--accent: #FF6B4A`. Confirmed global `:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px }` plus `box-shadow: var(--focus-ring)` on interactive elements — no icon-level focus styling is ever needed, the parent control already gets one everywhere in this codebase.
- **Lock/premium duplication, re-counted exactly:** 3 independent authorings, not the "3 files with 2 in one" the research narrative implied on a loose read — confirmed by direct grep, not the summary table:
  - `app/components/ui/LockedDealCard.tsx:67-70` — `24×24` viewBox, `22×22` displayed, `stroke="var(--ink)"` (hardcoded var, not `currentColor`), `strokeWidth="1.75"`.
  - `app/deals/[dealId]/page.tsx:164-167` — `24×24` viewBox, `24×24` displayed, `stroke="var(--ink)"`, `strokeWidth="1.75"`. (Research's brief said "two separate instances, lines 164 and 392" — line 392 is a distinct account/profile glyph, `circle`+`path`, unrelated to the lock. Corrected here; only one lock authoring in this file.)
  - `app/deals/DealFeed.tsx:271-276` (`LockGlyph`) — `24×24` viewBox, `14×14` displayed, `stroke="currentColor"`, `strokeWidth="2"`. One authoring, reused at two call sites (`:385` inline in a locked filter pill, `:439` inline in a locked filter option row) — the duplication is across *files*, this one is already at least locally shared.
  - All three use the same underlying shape (`rect` body + arc `path` shackle) with three different stroke-widths/sizes/color-sourcing — confirms research's read that this is one concept, fragmented, not three different icons.
- `app/components/HotelCard.tsx:352-366` — confirmed local `StarRow` function, byte-different from `app/components/ui/StarRow.tsx` (`12×12` vs `12×11` viewBox, `--border-strong` vs `--line-ivory` unfilled-star token). Real duplicate, not an import.
- `app/components/ui/LockedDealCard.tsx:11-14` / presumably `DealCard.tsx` — `starChars()` unicode `★☆` glyphs, no SVG at all.
- `app/components/ui/index.ts` — barrel re-exports one named component per file (`CompareRow`, `DealCard`, `DealChip`, `LockedDealCard`, `PriceBlock`, `StarRow`, `TrustLine`, `WatchCityPill`). No existing "many variants behind one dispatcher component" precedent in this codebase — noted, addressed in §1.

Nothing above overturns any of D1–D5. It sharpens exact call-site line numbers for the consolidation plan in §7 and fixes one miscount in the research narrative.

---

## 1. Architecture decision: one `Icon` component with a `name` prop, not 12 files

**Decision: a single new module, `app/components/ui/icons/Icon.tsx`, exporting one `Icon` component, one `IconName` union type, and one `IconSize` union type. Not 12 separate icon files.**

This appears to cut against the codebase's own convention — `app/components/ui/` today is one file per named export, and the barrel `index.ts` re-exports them individually. I'm deviating from that on purpose, for a reason specific to what this ticket is actually fixing:

1. **The problem is the absence of a single source of truth for geometry, not the absence of file-per-concept organization.** Every duplicate research found (star rating ×3, lock ×3) happened because a component author hand-typed `viewBox`/`strokeWidth`/`d` again instead of importing something that already existed. 12 separate icon files reproduces the exact failure mode this ticket exists to close: each file can independently drift its `viewBox` or `strokeWidth` over months of unrelated edits, exactly like `ShareButton`/`WatchCityPill`/`TrustLine`/`StarRow` already did with zero coordination between them. A single component makes D1's contract (`viewBox`, `strokeWidth`, cap/join) a value hardcoded once in one function signature — not a convention 12 files have to remember to copy correctly.
2. **D5's toggle contract is a data-modeling fit for one component, not a code-duplication risk across two.** "Outline and active variants share the same base glyph" is naturally expressed as two path fragments keyed under one icon name in one lookup table. Splitting outline/filled into separate files (or worse, 24 files for 12 concepts × 2 states) means the pairing that D5 requires ("on" and "off" must visually agree) is enforced by author discipline instead of by the data structure. A registry keyed by name with `{ base, active? }` makes mismatched pairs structurally harder to introduce.
3. **D2/D3 become type-checkable at call sites.** `size` typed as `16 | 20 | 24` turns "any new icon call site passing a size outside {16, 20, 24}" (D1's testable rule) into a compile error, not a review-time grep. `name` typed as the 12-member `IconName` union turns "which concepts exist" into autocomplete instead of tribal knowledge of which files exist in a folder.
4. **This isn't a wholesale convention change.** `ui/` already has precedent for a shared, stateless, multi-consumer presentational leaf that isn't "one business component per file" — `PropertyPhoto.tsx` is used by `HotelCard`, `LockedDealCard`, and others as exactly that kind of shared visual primitive. `icons/Icon.tsx` is the same category of thing, just for line-art marks instead of photos. It lives in a new `ui/icons/` subfolder so it reads as infrastructure, not as a 13th sibling of `WatchCityPill.tsx`/`LockedDealCard.tsx` (which are business components with fetch logic, state, and layout — categorically different from a pure presentational leaf).

**What this is not:** this is not a general-purpose icon library with dozens of unrelated glyphs. It has exactly the 12 concepts in the registry, typed as a closed union — adding a 13th requires a deliberate edit to the union and the registry, not a drive-by new file. That closedness is itself part of what keeps this from becoming the next thing that drifts.

### API contract

```tsx
// app/components/ui/icons/Icon.tsx
export type IconName =
  | 'deal_alert'
  | 'watchlist'
  | 'price_history'
  | 'verified_savings'
  | 'email_alert'
  | 'destination_tracking'
  | 'direct_booking'
  | 'no_hidden_fees'
  | 'marketplace_comparison'
  | 'premium_unlocked'
  | 'privacy'
  | 'hotel_deals'

export type IconSize = 16 | 20 | 24

type IconProps = {
  name: IconName
  size?: IconSize        // default 20 (md)
  active?: boolean        // default false — only affects the 3 stateful names (§6); ignored for the other 9
  className?: string      // caller supplies exactly one of the 4 D3 color-token classes here
}

export function Icon({ name, size = 20, active = false, className }: IconProps) {
  const entry = ICONS[name]
  const body = (active && entry.active) ? entry.active : entry.base
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {body}
    </svg>
  )
}
```

`ICONS` is a module-private `Record<IconName, { base: ReactNode; active?: ReactNode }>` — not exported. Callers only ever go through `<Icon name=… />`; nothing outside this file touches raw path data. `IconName` and `IconSize` are exported so call sites and future icon additions get type safety.

**Barrel wiring:** add one line to `app/components/ui/index.ts`:
```ts
export * from "./icons/Icon";
```
No changes to any other line in that file.

---

## 2. Canonical geometry (D1, restated as the literal contract)

Every one of the 12 icons, at every size, every state:
```
viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75}
strokeLinecap="round" strokeLinejoin="round"
```
This is `WatchCityPill.tsx`'s exact shipped geometry, promoted to the standard — not a new number. Only `width`/`height` (via the `size` prop) ever change per call site. No icon spec below deviates from this; where an icon needs a filled accent (a solid dot, a solid "active" fill), that accent is a per-element override (`fill="currentColor" stroke="none"` on one `<path>`/`<circle>` child) — the same technique `WatchCityPill`'s own `CheckIcon`/`PlusIcon` siblings and `TrustLine.tsx`'s filled bars already use elsewhere in this codebase. The `<svg>` root's own `fill`/`stroke`/`strokeWidth`/`viewBox` attributes never vary.

---

## 3. Display sizes (D2)

| Size | Role | Example use |
|---|---|---|
| **16px** (sm) | inline with caption/small text | footer trust line, filter-pill lock badge, inline metadata |
| **20px** (md, default) | body/button-adjacent | toggle buttons (email alert, destination tracking), card metadata rows |
| **24px** (lg) | standalone / section-header | paywall gate icon, empty-state icon, hero-adjacent marks |

No responsive/breakpoint-based sizing. The 3 sizes are chosen by the icon's semantic role at its call site (inline vs. button vs. standalone), not by viewport width — the same `size` value is used at 375px and 1280px. This deliberately rules out a mobile/desktop size-state split: introducing one would recreate the "10 distinct display sizes" sprawl D2 exists to close.

---

## 4. Color (D3) — token assignment per icon

Every icon renders via `currentColor`; the call site supplies exactly one of the 4 tokens as a `className`. Default role per concept (call sites may deviate only for the documented active/urgent cases below — never introduce a 5th token or a raw hex):

| Icon | Default token | Note |
|---|---|---|
| `deal_alert` | `text-[color:var(--ink-soft)]` | neutral marker |
| `watchlist` | `text-[color:var(--ink-soft)]` (off) → `text-[color:var(--primary)]` (on, optional) | see §6; today's `WatchCityPill` leaves color at `--ink` via `.btn-pill` and this spec does not require changing that (§7.2) |
| `price_history` | `text-[color:var(--ink-soft)]` | neutral, data-adjacent |
| `verified_savings` | `text-[color:var(--gold-deep)]` | **only** icon besides `premium_unlocked` allowed to use gold, per D3's "reserved solely for verified-savings/premium-unlock accent" |
| `email_alert` | `text-[color:var(--ink-soft)]` (off) → `text-[color:var(--primary)]` (on) | see §6 |
| `destination_tracking` | `text-[color:var(--ink-soft)]` (off) → `text-[color:var(--primary)]` (on) | see §6 |
| `direct_booking` | `text-[color:var(--ink-soft)]` | neutral; may use `--primary` if rendered inside a primary-styled CTA link, matching that control's existing text color |
| `no_hidden_fees` | `text-[color:var(--ink-soft)]` | neutral trust marker |
| `marketplace_comparison` | `text-[color:var(--ink-soft)]` | neutral |
| `premium_unlocked` | `text-[color:var(--gold-deep)]` | **changed from today's 3 implementations**, which all hardcode `var(--ink)`/`currentColor`-as-ink. Gold is the correct token per D3 ("premium-unlock accent") — this is a deliberate, small visual correction during consolidation, not a preserved regression. Flagged explicitly in §7.1 as a visible diff from current shipped color. |
| `privacy` | `text-[color:var(--ink-soft)]` | neutral |
| `hotel_deals` | `text-[color:var(--ink-soft)]` | neutral |

`--accent` (urgent/alert) is not a *default* for any of the 12 — it's reserved for a call site that needs to signal urgency on top of one of these icons (e.g., a price-drop badge wrapping `deal_alert`). No icon in the registry hardcodes `--accent`; a call site opts in by passing `className="text-[color:var(--accent)]"` instead of the default.

Testable per D3: `grep -rn 'stroke="#\|fill="#' app/components/ui/icons/` must return nothing.

---

## 5. Accessibility (D4)

Every icon ships `aria-hidden="true"` and `focusable="false"` unconditionally — not a prop, not overridable, baked into `Icon`'s own `<svg>` (see §1 code). This matches `TrustLine`/`WatchCityPill`/`ShareButton` exactly. No icon ever carries an `aria-label` or `<title>` itself.

Rule for every call site: if `<Icon/>` is the **only** child of an interactive element (`<button>`/`<a>`), that element must carry its own `aria-label`. If the icon sits next to visible text (the far more common case in this codebase — `WatchCityPill`'s "Watch {city}" label, `ShareButton`'s external status text), no extra `aria-label` is needed; the visible text is already the accessible name.

Focus: never on the icon (`focusable="false"` plus `aria-hidden` removes it from the tab order and AT tree entirely). Focus styling is always the parent control's, via the existing global `:focus-visible` rule (`outline: 3px solid var(--primary)` + `box-shadow: var(--focus-ring)`, already applied to every `button`/`a`/`input`/etc. in `app/globals.css:133-140`). No new focus CSS is introduced by this spec.

---

## 6. Toggle states (D5) — the 3 stateful icons

Registry marks 3 of the 12 concepts as stateful: `watchlist`, `email_alert`, `destination_tracking`. Each has an `active` variant in the registry; the other 9 icons have `base` only and ignore the `active` prop entirely.

**Resolving one ambiguity in D5 explicitly, since it matters for implementation:** D5's testable rule says "on" and "off" must "share the same base path structure," but the precedent it names as the model to reuse — `WatchCityPill`'s `Plus → Check` — is not byte-identical path data (a cross and a checkmark are different shapes). The rule is satisfied at the **geometry-contract level** (same `viewBox`, `strokeWidth`, cap/join, same 16×16 silhouette weight), not at the level of identical `d` strings. "Same base glyph" means: both states read as two moments of one concept inside one fixed box, never two semantically unrelated symbols (a padlock swapping to a heart would fail this; a plus swapping to a check inside the same pill button, denoting "this action just completed," passes — it's what already shipped and what research explicitly named as correct). This spec follows that interpretation for all 3 stateful icons below.

### `watchlist`
Reuses `WatchCityPill.tsx`'s existing geometry verbatim — not re-derived, copied exactly:
- `base` (off): `<path d="M8 3v10M3 8h10" strokeLinecap="round" />`
- `active` (on): `<path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />`

### `email_alert`
- `base` (off) — outline envelope:
  ```
  <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
  <path d="M3 5l5 3.5L13 5" />
  ```
- `active` (on) — same envelope silhouette, plus a small solid confirmation dot (badge) top-right, matching the "plus → check = confirmation" idiom, not a different envelope shape:
  ```
  <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
  <path d="M3 5l5 3.5L13 5" />
  <circle cx="12.5" cy="4" r="1.75" fill="currentColor" stroke="none" />
  ```

### `destination_tracking`
- `base` (off) — outline map pin:
  ```
  <path d="M8 2c-2.35 0-4.25 1.85-4.25 4.15 0 3.1 4.25 7.85 4.25 7.85s4.25-4.75 4.25-7.85C12.25 3.85 10.35 2 8 2z" />
  <circle cx="8" cy="6.3" r="1.4" />
  ```
- `active` (on) — identical pin silhouette, solid-filled (classic outline→solid pin toggle, same technique as a map app's "tracking this place" state):
  ```
  <path d="M8 2c-2.35 0-4.25 1.85-4.25 4.15 0 3.1 4.25 7.85 4.25 7.85s4.25-4.75 4.25-7.85C12.25 3.85 10.35 2 8 2z" fill="currentColor" stroke="none" />
  ```

Interaction rule for all 3 (mirrors `WatchCityPill`'s already-shipped, already-correct pattern — do not invent a second pattern):
- Tap/click/Enter toggles `active`; the button also carries `aria-pressed={active}`.
- Color: `--ink-soft` at rest, `--primary` when `active` (per §4). `watchlist` is the one exception — see §7.2, its existing shipped color behavior (stays `--ink` via `.btn-pill`, unchanged by `.active`) is preserved rather than upgraded, to avoid an unrequested visual diff on a component this ticket isn't otherwise touching.
- Pending/error state during the toggle's underlying network call: follow `WatchCityPill.tsx`'s existing pattern exactly — swap the icon for a `<span className="spinner" aria-hidden />` while pending, set `aria-busy={pending || undefined}` on the button, surface errors in an `aria-live="polite"` status region below the control. This spec does not invent a new async UX for stateful icons; it requires reusing the one already shipped and correct.

---

## 7. Consolidation plan (in scope for this ticket)

Two consolidations are in scope. One is explicitly out of scope, with a stated reason.

### 7.1 Premium/lock — consolidate 3 authorings into `Icon name="premium_unlocked"`

Registry geometry:
```
<rect x="4" y="7.5" width="8" height="6" rx="1.25" />
<path d="M6 7.5V5.75a2 2 0 0 1 4 0V7.5" />
```
(Rect body + arc shackle — the same shape family all 3 existing implementations already independently arrived at; this just fixes it to one 16×16@1.75 authoring.)

Replace all 3 call sites:

| File : line | Current | Replace with |
|---|---|---|
| `app/components/ui/LockedDealCard.tsx:67-70` | inline `24×24` svg, `22×22` displayed, `stroke="var(--ink)"` | `<Icon name="premium_unlocked" size={24} className="text-[color:var(--gold-deep)]" />` |
| `app/deals/[dealId]/page.tsx:164-167` | inline `24×24` svg, `stroke="var(--ink)"` | `<Icon name="premium_unlocked" size={24} className="text-[color:var(--gold-deep)]" />` |
| `app/deals/DealFeed.tsx:271-276` (`LockGlyph`, used at `:385` and `:439`) | inline `24×24` viewBox / `14×14` displayed, `stroke="currentColor"`, `strokeWidth="2"` | delete the local `LockGlyph` function; both call sites become `<Icon name="premium_unlocked" size={16} />` (16px — these are inline, caption-adjacent uses inside a filter pill/option row per §3's role table, and `DealFeed`'s call sites already sit in `text-caption`-scale rows, not standalone) |

**Flagged visible diff, not a silent regression:** all 3 current implementations render the lock in ink/neutral color (`var(--ink)` or inherited `currentColor` from an ink-colored parent). §4 assigns `premium_unlocked` to `--gold-deep` per D3's stated rule ("reserved solely for the verified-savings / premium-unlock accent"). This is a deliberate correction surfaced by consolidation — three inconsistent ad hoc choices converging on the one the research-stage color contract actually specifies — not an accidental color change. Call out explicitly to the UI stage and TEST stage so it isn't mistaken for a bug: the lock icon will visibly turn gold where it was previously black/ink at all 3 sites.

### 7.2 Watchlist — refactor `WatchCityPill.tsx` to consume `Icon`, remove its local duplicate

`WatchCityPill.tsx`'s own `PlusIcon`/`CheckIcon` functions (lines 14-28) are the *source* of the `watchlist` icon's geometry (§6) — but leaving them in place after copying their paths into the new registry would create a 4th copy of the same shape family the moment this ships, which is precisely the failure mode this whole ticket exists to close. In scope:
- Delete `PlusIcon()` and `CheckIcon()` from `WatchCityPill.tsx`.
- Replace `{pending ? <span className="spinner" aria-hidden /> : watching ? <CheckIcon /> : <PlusIcon />}` with `{pending ? <span className="spinner" aria-hidden /> : <Icon name="watchlist" active={watching} />}`.
- **No `className` passed** — deliberately. `.btn-pill` already sets `color: var(--ink)` and `.btn-pill.active` doesn't override it (confirmed in §0); passing no className means the icon inherits `currentColor` from the button exactly as today. This keeps `WatchCityPill`'s visual output byte-identical pre/post-refactor — it's a pure de-duplication, not a redesign of an already-correct, already-shipped component. (This is the one icon where the §4 "on → `--primary`" default does **not** apply, by design, to avoid an unrequested visual change to a component outside this ticket's problem statement.)

### 7.3 Star rating — explicitly out of scope, not silently dropped

Research flagged 3 independent star-rating implementations (`StarRow.tsx`, `HotelCard.tsx`'s local duplicate, `LockedDealCard`/`DealCard`'s `starChars()` unicode glyphs) as "the single clearest piece of evidence for why a shared registry matters" and explicitly recommended a **follow-up ticket**, not inclusion in this one. This spec keeps that scoping, for two concrete reasons beyond "research said so":

1. **Different visual language, not a drop-in.** Every one of the 12 icons in this registry is stroke-based (`fill="none"`, `stroke="currentColor"`) per D1. Stars today are filled-shape, no-stroke (`StarRow.tsx`'s `viewBox="0 0 12 11"` filled path; `HotelCard`'s `12×12` filled duplicate). Consolidating them into *this* system isn't a mechanical dedupe like the lock icon was — it requires first deciding whether star rating adopts the rounded-line stroke direction (a real design decision affecting how a 5-star row reads at a glance) or stays filled-shape as its own documented exception the way `DealFeed.tsx`'s 48px empty-state airplane already is per D2. That decision needs its own discovery/research pass, not a paragraph appended here.
2. **`starChars()`'s unicode glyphs aren't an SVG problem at all.** `LockedDealCard.tsx`/`DealCard.tsx` render `★☆` as text characters, not markup this Icon system can absorb by adding a registry entry — fixing that means replacing a text-rendering call site with a `<StarRow>` import, a separate, mechanically distinct change from anything in this ticket's D1–D5 contract.

Recommendation carried forward unchanged from research: a follow-up ticket (`UXD-STAR-RATING-01` or similar, outside this pipeline run) to (a) decide filled-vs-stroke for star rating against the rounded-line brand direction, (b) replace `HotelCard.tsx`'s local `StarRow` duplicate with an import of `ui/StarRow.tsx`, and (c) replace `LockedDealCard.tsx`/`DealCard.tsx`'s `starChars()` with the same shared component. Not actioned here.

---

## 8. Per-icon geometry reference (all 12, viewBox 0 0 16 16 implied)

| # | `IconName` | Concept | Stateful | Geometry (children of the `<svg>`) |
|---|---|---|---|---|
| 1 | `deal_alert` | Deal/price-drop alert marker | No | `<path d="M8 2.5c-2 0-3.25 1.6-3.25 3.75v2.1c0 .55-.22 1.08-.6 1.47L3 11h10l-1.15-1.18a2.1 2.1 0 0 1-.6-1.47v-2.1C11.25 4.1 10 2.5 8 2.5z" />`<br>`<path d="M6.6 12.5a1.5 1.5 0 0 0 2.8 0" />` |
| 2 | `watchlist` | Watchlist toggle | **Yes** | See §6 |
| 3 | `price_history` | Price history / trend | No | `<path d="M2.5 11l3-3.5 2.5 2L13.5 4" />`<br>`<circle cx="13.5" cy="4" r="1" fill="currentColor" stroke="none" />` |
| 4 | `verified_savings` | Verified savings badge | No | `<path d="M8 2l4.5 1.6v3.4c0 3.3-2.05 5.6-4.5 6.6-2.45-1-4.5-3.3-4.5-6.6V3.6L8 2z" />`<br>`<path d="M5.8 8.2l1.6 1.6 3-3.4" />` |
| 5 | `email_alert` | Email alert toggle | **Yes** | See §6 |
| 6 | `destination_tracking` | Destination tracking toggle | **Yes** | See §6 |
| 7 | `direct_booking` | Direct booking / bypass middleman | No | `<path d="M6 3H3v10h10v-3" />`<br>`<path d="M9 3h4v4" />`<br>`<path d="M13 3L7 9" />` |
| 8 | `no_hidden_fees` | No hidden fees / transparent pricing | No | `<path d="M2.5 8.5L8 3h4.5a1 1 0 0 1 1 1V8.5L8.5 14a1 1 0 0 1-1.4 0L2.5 9.9a1 1 0 0 1 0-1.4z" />`<br>`<circle cx="10.5" cy="5.5" r="0.9" />` |
| 9 | `marketplace_comparison` | Marketplace/provider comparison | No | `<path d="M2.5 13h11" />`<br>`<path d="M5 13V6" />`<br>`<path d="M11 13V9" />` |
| 10 | `premium_unlocked` | Premium/paywall gate | No | See §7.1 |
| 11 | `privacy` | Privacy / no ad trackers | No | `<path d="M2.5 8c1.4-2.6 3.4-4 5.5-4s4.1 1.4 5.5 4c-1.4 2.6-3.4 4-5.5 4S3.9 10.6 2.5 8z" />`<br>`<circle cx="8" cy="8" r="1.5" />`<br>`<path d="M3 3l10 10" />` |
| 12 | `hotel_deals` | Hotel deals | No | `<path d="M2.5 12.5V6.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V9" />`<br>`<path d="M2.5 9h11a1 1 0 0 1 1 1v2.5" />`<br>`<path d="M2.5 12.5h11" />`<br>`<circle cx="4.5" cy="7" r="0.6" fill="currentColor" stroke="none" />` |

All coordinates sit inside the 0–16 box on both axes; nothing above needs adjustment to fit the D1 viewBox. Every stroke-only path above renders with the `<svg>` root's `fill="none" stroke="currentColor" strokeWidth={1.75}`; the two icons using a filled accent (`price_history`'s dot, `no_hidden_fees`'s hole, `hotel_deals`'s pillow dot) set `fill="currentColor" stroke="none"` on that one child element only, same technique as §2.

---

## 9. States summary (per AGENTS.md stage-3 requirement)

| State | Applies to | Behavior |
|---|---|---|
| Default | all 12 | `base` registry entry, default token per §4 table |
| Hover | icons inside interactive controls | icon itself has no hover style; the parent control's existing hover class (e.g. `hover:border-[color:var(--primary-soft)]`) is unchanged by adopting `Icon` — icon color only changes via `active`, never via `:hover` alone |
| Focus | icons inside interactive controls | never on the icon (`focusable="false"`); parent control's global `:focus-visible` ring, unchanged (§5) |
| Active/On | `watchlist`, `email_alert`, `destination_tracking` | `active` registry entry + `aria-pressed="true"` on parent button; color per §4/§6 |
| Pending (async toggle) | the 3 stateful icons, when wired to a network call | icon replaced by `<span className="spinner" aria-hidden />`, `aria-busy` on button — reuse `WatchCityPill`'s existing implementation, do not invent a new one (§6) |
| Disabled/at-cap | stateful icons whose control can be blocked (e.g. `watchlist` at the 10-city cap) | icon rendering unchanged; button gets `aria-disabled="true"` and reduced opacity per `WatchCityPill`'s existing `atCap` handling — this spec doesn't change that logic, only the icon markup inside it |
| Mobile 375px / Desktop 1280px | all 12 | identical — `size` is chosen by semantic role (§3), not viewport; no breakpoint variants exist or are needed |
| Loading/empty/error (page-level) | N/A to `Icon` itself | `Icon` is a stateless presentational leaf with no data dependency; any loading/empty/error handling belongs to the consuming component (e.g. a future `EmailAlertToggle`), which must follow the same async pattern named above, not a new one |

---

## 10. Acceptance checklist for the UI stage

- [ ] `app/components/ui/icons/Icon.tsx` created with the exact API in §1, `ICONS` registry per §6/§7.1/§8.
- [ ] `app/components/ui/index.ts` gets the one added export line (§1).
- [ ] `LockedDealCard.tsx`, `app/deals/[dealId]/page.tsx`, `DealFeed.tsx` all switched to `<Icon name="premium_unlocked" .../>` per §7.1's table; `DealFeed.tsx`'s local `LockGlyph` deleted.
- [ ] `WatchCityPill.tsx`'s local `PlusIcon`/`CheckIcon` deleted; replaced with `<Icon name="watchlist" active={watching} />`, no `className` (§7.2). Visual output must be pixel-identical to today — this is the one call site where a diff means a bug, not an intended improvement.
- [ ] `grep -rn 'stroke="#\|fill="#' app/components/ui/icons/` returns nothing (D3).
- [ ] No new icon call site anywhere passes a `size` other than `16`/`20`/`24` (D2; enforced by the `IconSize` type, verify no `as any`/`as IconSize` casts were used to route around it).
- [ ] Star rating (`StarRow.tsx`, `HotelCard.tsx`'s duplicate, `starChars()`) is untouched — out of scope per §7.3, not a leftover TODO.

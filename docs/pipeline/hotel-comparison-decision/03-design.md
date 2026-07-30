# UX Design Spec: Hotel Comparison Decision Support

**Ticket:** UXDES-HOTEL-COMPARISON-DECISION-01 · **Stage:** UXDES · **Priority:** P1 · **Date:** 2026-07-30
**Feature slug:** `hotel-comparison-decision`
**Upstream:** `02-research.md` (which supersedes `01-discovery.md` wherever they disagree — see §0.3)

**Files re-read this stage:** `app/components/ui/DealCard.tsx` (151 lines), `app/components/ui/CompareRow.tsx`, `app/deals/DealFeed.tsx` (`ApiDeal` :121-141, grid :1182, card render :1893-1929, pending overlay :1790-1817, `statusAnnouncement` :511/:689-693/:903, `resetFilters` :987), `app/components/HotelSearchCriteria.tsx` (:186-196, the repo's existing dialog pattern), `app/components/ui/PropertyPhoto.tsx`, `app/globals.css` (tokens :34-84, type scale :176-209).

---

## 0. What this spec delivers, and what it deliberately does not

### 0.1 Two shippable units, in order

| Unit | Directive | Depends on | Ship |
|---|---|---|---|
| **A — Fixed-slot `DealCard`** | §7.2 | nothing | **First. Independently.** Zero new props, zero new state, zero selection. Survives any board ruling on §5. |
| **B — Side-by-side panel** | §7.1, §7.3, §7.4 | Unit A's slot order | Second. Additive optional props on `DealCard`; transient state in `DealFeed`. |

Unit A is specified in §2 as a complete change that can be implemented, reviewed, and merged with no reference to Unit B. If the board rules that §5's selection interpretation is out of scope, **§2 still ships and still closes the alignment half of the problem.** It does not close the 375px co-presence half; nothing that respects the no-persistence constraint can.

### 0.2 The baseline is UNMEASURED

Discovery claimed the baseline was queryable today. It is not (§3.3 of the research brief). `hotel_detail_viewed`, `hotel_detail_back_to_results`, `hotel_decision_section_reached`, and `hotel_room_handoff_started` are all rejected `400` at `app/api/analytics/route.ts` and silently discarded by `sendBeacon`. Two of discovery's three baseline metrics cannot be computed at all, and the third cannot be attributed to a specific hotel until `deal_id` is added to `hotel_result_card_opened`.

**This spec therefore states no baseline number and no target number.** Nobody can currently size the population of shoppers who open 2–3 hotels. Any success criterion written against a percentage would be fabricated. The instrumentation work is carried into `DEV-HOTEL-COMPARISON-DECISION-01` (§8). Until it lands, the only honest interim proxy is card-open count per `analytics_session_id` in **`analytics_events`** (not `product_analytics_events`, which nothing writes to), bucketed 1 / 2–3 / 4+, and it cannot distinguish distinct hotels from repeat opens of the same hotel.

### 0.3 Corrections carried forward — cite these, not discovery

- **`CompareRow` does not render on live feed cards.** Every non-mock card gets an `href` (`DealFeed.tsx:1906`) and renders **"View deal"** (`DealCard.tsx:123`). The `CompareRow` branch (`:125`) is reachable only on href-less cards. The collision this spec designs around is **conceptual** — expaify has taught "Compare" to mean *one hotel, many sellers* — not spatial. **Do not distort layout to avoid an adjacency that does not occur.**
- **`ApiDeal` carries `hotelId`, `checkInDate`, and `nights`** in addition to the five attributes discovery names.
- **`DealCard`'s `expired` prop is never passed by any call site.** Its four branches (`:66, 92, 120, 128`) are unreachable in production. This spec preserves them as component-level branches and specifies their slot behaviour so the component stays internally coherent, but does not treat `expired` as a live state to optimise for.

### 0.4 Explicitly not specified here

No Deal Score cell. No guest-rating cell (it is not persisted anywhere; `[dealId]/page.tsx:457` hardcodes `hasVerifiedGuestRating={false}`). No total-stay-cost row — `docs/pipeline/hotel-total-stay-cost/` owns it. No placeholder cell for any of the above: an empty column advertises a missing feature on every comparison. No change to any file under `app/deals/[dealId]/`. Nothing that persists.

---

## 1. Hierarchy on this surface

Stated once, and every layout decision below follows from it.

**Primary — the price judgment.** Nightly price, "usually" strike-through, discount chip. Largest type on the card (`text-h2`, `--primary`). In the panel, the first two rows.

**Secondary — the comparable evidence.** Savings/night, class, area, check-in window, price freshness, sample depth. Uniform `text-caption`. These are the cells that must be diffable, and they are secondary precisely because they only matter *relative to another card*.

**Tertiary — context and action.** Hotel name, photo, "View deal", the AI headline, the fee promise. The name and photo identify; the headline persuades. Neither is comparable, and the headline is the single largest source of vertical drift, so it leaves the comparable block entirely.

**The selection control is deliberately quaternary.** It sits below the primary action, is visually quiet, and never competes with "View deal". Most shoppers should never notice it. The feature is a rescue for the 2–3-candidate shopper, not a new primary path.

---

## 2. UNIT A — Fixed-slot `DealCard` (§7.2)

### 2.1 Governing rule

> **Every slot reserves its height on every card, in every state, always. Only the contents vary.**

No conditional `? … : null` may collapse vertical space inside the comparable block. Today three do — savings (`:103`), headline (`:100`), "Price checked" (`:108`) — plus two structural drifts the research brief did not name and that are larger than all three combined:

- **`h3` is `line-clamp-2` with no reserved height** (`:74`). A one-line hotel name pulls every slot below it up by ~21px. In a live feed, name length is effectively random, so **this is the dominant misalignment source.**
- **The "Example" pill occupies its own row on mock cards only** (`:69-73`), shifting the entire card down ~28px.

Both are fixed below.

### 2.2 Slot order (final)

Inside `<div className="space-y-3 px-4 pb-4 pt-3">`:

| # | Slot | Reserved height | Contents |
|---|---|---|---|
| 1 | **Name** | exactly 2 lines | `h3`, hotel name, `line-clamp-2` |
| 2 | **Price row** | 1 row | price · `/ night` · `usually $X` · `DealChip` (or "Expired" pill) |
| 3 | **Savings** | 1 caption line | `Save $60/night` — or empty |
| 4 | **Meta** | 1 caption line | `★★★★☆ · Austin · Mar 3–9` |
| 5 | **Freshness** | 2 caption lines | `Price checked 2 hours ago` + `Based on 128 price checks over 60 days` |
| 6 | **Photo** | fixed (`PropertyPhoto size="card"`) | photo, with the "Example" marker overlaid on mock |
| 7 | **Action** | `min-h-11` (44px) | "View deal" / mock's not-bookable box / `CompareRow` |
| 8 | **Selection** | `min-h-11` (44px) | Unit B only. In Unit A this slot does not exist. |
| 9 | **Context** | unreserved — may vary freely | headline, then `expaify never adds fees` |

Slots 1–7 are the **comparable block**. Slot 9 is below every fixed element by design: nothing that varies in height sits above anything that must align.

### 2.3 What changes from today

1. **Meta line moves below the price row.** Today it is inside the header (`:77-80`), above the price, so it inherits the name's drift. Moving it under the price row puts it at a fixed offset from the price, which is what §7.2 item 3 asks for.
2. **Name gets a reserved two-line height.** `min-h-[2.75em]` on a `text-body leading-snug` element = exactly 2 × 1.375em. Font-size-relative, so it survives any type-scale change.
3. **Headline moves from between the price row and savings (`:100-102`) to slot 9**, below the photo and below the action.
4. **"Based on {n} price checks over 60 days" moves up** from below the action (`:128-132`) into the freshness slot, joining "Price checked …". The two are one idea — how much evidence stands behind this price — and they belong in one slot.
5. **"· expaify never adds fees" splits off** into slot 9 as its own line. It is a trust statement about expaify, not evidence about this hotel; keeping it in the freshness slot would force that slot to reserve 3 lines instead of 2 (the combined string wraps to two lines at both 375px and the 1024px three-column width).
6. **The "Example" pill moves out of the flow and onto the photo** as an absolutely-positioned overlay in a `relative` wrapper.

On (6) — the alternative was reserving a pill row on all cards, which taxes every real card ~28px of dead space at 375px to align cards that are excluded from comparison anyway. The overlay costs zero vertical space and is *more* visible over an image than as a small pill above a bold heading. Mock cards additionally keep their not-bookable copy in the action slot, which is the strongest signal at the decision point. If a reviewer prefers the reserved row, it is a one-line change and the rest of this spec is unaffected.

### 2.4 Copy — every visible string in Unit A

| Slot | Condition | Exact string |
|---|---|---|
| 1 | always | `{hotelName}` |
| 2 | always | `{formatMoney(dealPrice)}` · `/ night` · `usually {formatMoney(medianPrice)}` |
| 2 | `expired` | pill: `Expired` |
| 2 | not expired | `DealChip` (unchanged) |
| 3 | savings ≥ $20/night, not mock, not expired | `Save {formatMoney(savings)}/night` |
| 3 | otherwise | *(empty, height reserved)* |
| 4 | always | `{stars glyphs} · {city} · {checkInWindow}` |
| 5 | not mock, `updatedAt` present | `Price checked {timeAgo}` |
| 5 | not mock, `updatedAt` null | `Price not checked yet` |
| 5 | not mock, line 2 | `Based on {snapshotCount} price checks over 60 days` |
| 5 | mock | `Example price — not checked against live rates` *(line 2 empty, height reserved)* |
| 6 | mock | overlay pill: `Example` |
| 7 | not mock, not expired, has `href` | `View deal` |
| 7 | mock | `Sample hotel — not bookable` |
| 7 | expired | *(empty, height reserved)* |
| 7 | not mock, not expired, no `href` | `CompareRow` (unchanged — its own copy is out of scope) |
| 9 | headline present | `{headline}` |
| 9 | not mock, not expired | `expaify never adds fees` |

`Price not checked yet` is new. It replaces today's silent omission when `timeAgo(null)` returns null on a live card. A reserved-but-blank freshness line on a live card would read as a rendering bug; the explicit string is honest and keeps the slot populated.

`Example price — not checked against live rates` is new, and is a deliberate refinement of §7.2 item 4. The research brief put `Sample hotel — not bookable` in the freshness slot. But that string is already in the action slot (`:121`), and duplicating it wastes the freshness slot rather than filling it. The freshness slot's job is to say *what evidence stands behind this price*; on a mock card the honest answer is "none, this is an example". Both strings now do work, and `Sample hotel — not bookable` is preserved verbatim in its current position.

### 2.5 Tailwind — per slot

Container unchanged: `space-y-3 px-4 pb-4 pt-3`.

```
1  Name       h3   text-body font-display font-bold leading-snug line-clamp-2
                   min-h-[2.75em] text-[color:var(--ink)]
2  Price row  div  flex min-w-0 flex-wrap items-baseline gap-2      (unchanged)
                   price  span text-h2 leading-none text-[color:var(--primary)]
                   / night span text-caption self-end pb-0.5 leading-none text-[color:var(--ink-faint)]
                   usually span text-small leading-none text-[color:var(--ink-faint)] line-through
3  Savings    p    text-caption min-h-[1.6em] font-medium text-[color:var(--primary)]
4  Meta       p    text-caption min-h-[1.6em] leading-snug text-[color:var(--ink-faint)]
5  Freshness  div  min-h-[3.2em] space-y-0
                   line1 p text-caption font-medium leading-[1.6] text-[color:var(--ink-soft)]
                   line2 p text-caption leading-[1.6] text-[color:var(--ink-faint)]
6  Photo      div  relative
                   overlay span absolute left-2 top-2 z-10 inline-flex
                     rounded-[var(--radius-pill)] bg-[color:var(--surface)]/90 px-2 py-1
                     font-display text-caption font-bold leading-none text-[color:var(--ink-soft)]
                     shadow-[var(--shadow-card-hover)]
7  Action     p    flex min-h-11 items-center justify-center rounded-[var(--radius-input)]
                   border border-[color:var(--primary)] text-small font-medium
                   text-[color:var(--primary)]
   Action/mock p   flex min-h-11 items-center justify-center rounded-[var(--radius-input)]
                   border border-dashed border-[color:var(--line-white)] text-small
                   font-medium text-[color:var(--ink-faint)]
   Action/empty div min-h-11
9  Context    div  space-y-1
                   headline p text-caption font-medium leading-snug text-[color:var(--primary)]
                   fees     p text-caption leading-snug text-[color:var(--ink-faint)]
```

`min-h-[1.6em]` and `min-h-[3.2em]` are 1 and 2 lines of `.text-caption` (`line-height: 1.6`, `globals.css:206-209`), expressed in `em` so they track the element's own font size. The dashed-border treatment for the mock action box reuses the existing `unavailable` pattern from `CompareRow.tsx:103` — same meaning (present but not actionable), same visual language. No new colours, no new font sizes.

### 2.6 Responsive

- **375px** (`grid-cols-1`): one card per viewport. Alignment does nothing here on its own — this is exactly why Unit B exists. The card must not grow: total added reserved height vs today is **+1 caption line worst case** (name reservation when the name is one line, minus the headline moving out of the block). Card height is now *constant* across all live cards at a given viewport, which also makes infinite-scroll layout stable.
- **680px** (`grid-cols-2`) and **1024–1280px** (`grid-cols-3`): every card in a row now has slots 1–7 at identical y-offsets. This is the acceptance test.
- No slot has a breakpoint-conditional height. Reserved heights are `em`-relative, so they are identical at every width.

### 2.7 Unit A acceptance

1. At 1280px, three cards in one grid row have the top edge of slots 1–7 at identical y-offsets, regardless of name length, headline presence, savings ≥ $20, or `isMock`.
2. Adding or removing a `headline` on any card changes no y-offset in slots 1–7.
3. `DealCardProps` and `DealCardDeal` are byte-identical to today. No call site changes. The `DealFeed.tsx:1904-1925` and `:1797` / `:1814` invocations are untouched.
4. The `expired` and `isMock` branches still render, and both keep every slot reserved.
5. `npx tsc --noEmit --incremental false` exits 0.

---

## 3. UNIT B — The side-by-side panel (§7.1, §7.3, §7.4)

### 3.1 Naming — resolved

**The word is "side by side". Everywhere. Including accessible names.**

| Surface | String |
|---|---|
| Card control, visible label | `Side by side` |
| Card control, accessible name (unselected) | `Add {hotelName} to the side-by-side view` |
| Card control, accessible name (selected) | `Remove {hotelName} from the side-by-side view` |
| Card control, accessible name (at cap, unselected) | `Add {hotelName} to the side-by-side view. Limit of 3 reached.` |
| Open button | `See them side by side ({n})` |
| Panel heading | `Side by side` |
| Panel close | `Close side by side` |
| Column remove | `Remove {hotelName} from the side-by-side view` |
| Clear all | `Clear all` / accessible name `Clear the side-by-side view` |

Prohibited in every user-visible string, `aria-label`, `title`, `alt`, and live-region message: **Compare, Comparison, Watch, Watching, Save, Saved, Track, Alert, Follow, Bookmark, Shortlist, Wishlist, Pin.** ("Comparison" is added to the brief's list — it is the same word wearing a suffix, and it is the likeliest leak in a heading.)

Glyph: **two rounded vertical bars** (a two-column mark), `aria-hidden`, `currentColor`, 16×16, next to the checkbox. Prohibited: bell, bookmark, heart, star, eye, plus-sign.

The whole feature is UI-only and free. No `isPremium` reference, no lock, no upsell, no `subscriptions.watchlist` read or write, on any tier.

### 3.2 The card control (slot 8)

Rendered as a **sibling of the card's `<a>`**, never inside it — nested interactive content inside an anchor is invalid and unusable with a screen reader. `DealCard` returns a `relative` wrapper containing the `<a>` and the control.

Position: **full-width row directly under the action slot**, `min-h-11` (44px), left-aligned, `text-caption`. Not the top-right corner: an absolutely-positioned control there would force a permanent right-indent on both lines of the `line-clamp-2` name, and at 375px the name has ~180px to work with. Below the action it costs no horizontal space, reads correctly as subordinate to "View deal", and lands in tab order immediately after the card link — which is exactly what §7.3 requires.

Markup: a native `<input type="checkbox">` with a visible `<label>`. Not a toggle button — the semantics are "this is one of a set", the state is binary, and screen readers already announce "checked / not checked, 2 of 3". Do not reimplement it.

**Additive props on `DealCard`, all optional, none renaming or removing anything:**

```
selectable?:        boolean            // false/undefined → slot 8 not rendered at all
selected?:          boolean
selectionDisabled?: boolean            // cap reached and this card is not selected
onSelectChange?:    (next: boolean) => void
```

Unit A ships before these exist. When `selectable` is falsy the component is byte-equivalent in output to Unit A.

**Eligibility — the control renders only when all of these hold:**

| Exclusion | Rule | Why |
|---|---|---|
| Mock (`isMock`) | no control | not linkable, not bookable, no live price |
| Locked (`deal.locked`) | no control | renders `LockedDealCard`, a different component (`DealFeed.tsx:1893-1902`) with a placeholder name and city — there is nothing to compare |
| Expired | no control | `DealFeed` passes `selectable` only for live cards; the branch is unreachable regardless |
| No `href` | no control | href-less cards are homepage/hero/sample contexts |
| Cold sample feed (`isColdSampleFeed`, `:1142`) | no control on any card | every card is mock |
| Mock feed (`isMockFeed`, `:1190`) | no control on any card | `realDealCount === 0` |
| Pending overlay (`:1793`, `:1810`) | control renders but is inside the existing `inert aria-hidden` subtree | it inherits inertness for free; **nothing floats above the overlay** |
| Skeletons (`:1928`) | no control | not a deal |

In practice `DealFeed` computes once:
`const selectionEnabled = !loading && !error && !isColdSampleFeed && !isMockFeed && realDealCount >= 2`
and passes `selectable={selectionEnabled && !deal.isMock}`. Below two live deals there is nothing to line up, so the control does not appear at all — no dead affordance.

### 3.3 State model

Held in `DealFeed`: `const [lineup, setLineup] = useState<string[]>([])` — an ordered list of `deal.id`. Order is selection order; the panel renders columns in that order.

**Destroyed (set to `[]`, panel closed) by:**

| Trigger | Where |
|---|---|
| any filter apply | `:689` |
| any single filter removal | `:690` |
| `resetFilters()` | `:987`, `:1009` |
| undo | `:692` |
| sort change | `:767`, `:833` |
| criteria edit | `:903` |
| filter request failure | `:708`, `:716` |
| navigation away from `/deals` | component unmount |
| any reload | state is not persisted |

**Not destroyed by:** infinite-scroll `loadMore` (`:1123-1140`). This is an interpretation of §7.3's "any feed mutation", and it is deliberate. The constraint's stated reason is that "a comparison of offers that are no longer in the feed is not an in-context comparison" — `loadMore` is purely additive, removes nothing, and every selected deal stays co-resident in the same render. Clearing on scroll-load would destroy the set for the exact user this feature targets: the one scrolling a long feed looking for a third candidate. **If a reviewer disagrees, clearing on `loadMore` is a one-line change; nothing else in this spec depends on it.**

**Defensive prune.** After any `deals` update, drop ids not present in `deals`. With the rules above this should never fire; it is a guard against a future code path, not a designed state.

**Zero persistence.** No `localStorage`, `sessionStorage`, `document.cookie`, URL param, or table. Reloading `/deals` yields an empty set.

### 3.4 The open control

Rendered in normal document flow, **directly above the grid** (between the coverage-narrowing notice at `:1877-1891` and `<div ref={gridRef}>` at `:1892`). It scrolls with the page.

**It is not sticky, not fixed, and not floating.** A persistent bar that follows the viewport is the Booking.com tray, which this ticket forbids. It also would have to sit above the `inert aria-hidden` pending-overlay grid, which §3.4 of the research brief explicitly prohibits. In-flow placement satisfies both constraints with no special-casing.

Rendered only when `lineup.length >= 1`. Contents:

```
[glyph] 2 selected     [ See them side by side (2) ]     [ Clear all ]
```

| Count | Open button | Behaviour |
|---|---|---|
| 1 | `See them side by side (1)`, `aria-disabled="true"`, muted | click/Enter does not open; announces `Pick one more hotel to see them side by side.` in the live region; hint also renders inline below the button |
| 2 | `See them side by side (2)`, enabled | opens |
| 3 | `See them side by side (3)`, enabled | opens |

`aria-disabled`, **never** the `disabled` attribute. A `disabled` button is removed from the tab order, which breaks focus restoration when the panel closes at count 1 after a column removal (§3.7) and hides the reason from keyboard users. The click handler no-ops and announces instead.

Copy:
- Count label: `1 selected` / `2 selected` / `3 selected`
- Inline hint at count 1: `Pick one more hotel to see them side by side.`
- Inline hint at count 3: `That's the limit — 3 at a time.`
- `Clear all`, accessible name `Clear the side-by-side view`

Tailwind:
```
wrapper  mb-4 flex flex-col gap-3 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]
         px-4 py-3 text-small leading-5 text-[color:var(--text-2)]
         sm:flex-row sm:items-center sm:justify-between
button   btn btn-outline w-full sm:w-auto
         aria-disabled:opacity-60 aria-disabled:cursor-not-allowed
clear    min-h-11 px-2 font-medium text-[color:var(--brand)] underline-offset-4 hover:underline
hint     text-caption text-[color:var(--text-3)]
```
This is the same container treatment as the existing coverage-narrowing notice at `:1878`, so the feed gains no new visual idiom.

### 3.5 The panel

**Presentation: a modal dialog, at every width.** Bottom sheet below 640px, centred above it — the repo's existing pattern from `HotelSearchCriteria.tsx:186-193`. One implementation, one focus model, one resize behaviour, and precedent already in the codebase. An inline expander was rejected: at 375px it would push the grid down and require vertical scrolling to see the columns it exists to put side by side.

```
overlay  fixed inset-0 z-50 flex items-end bg-[color:color-mix(in_srgb,var(--text-1)_32%,transparent)]
         sm:items-center sm:p-6
dialog   role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={honestyId}
         max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-[var(--radius-card)]
         bg-[color:var(--bg-surface)] p-5 shadow-[var(--shadow-lift)]
         sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-[720px] sm:rounded-[var(--radius-card)] sm:p-6
```

Backdrop `mousedown` on the overlay itself closes, matching `HotelSearchCriteria.tsx:189-191`.

#### Header

```
Side by side                                          [ Close ]
Two hotels from your current results.        (or "Three hotels…")
```

- `h2`, `text-h3 text-[color:var(--text-1)]`, `id={titleId}`, `tabIndex={-1}`
- Subhead `text-small text-[color:var(--text-2)]`: `Two hotels from your current results.` / `Three hotels from your current results.`
- Close: `min-h-11 min-w-11`, visible `×` glyph `aria-hidden`, accessible name `Close side by side`

#### Rows

One attribute per row, across all columns, in Unit A's slot order. **Every cell in every column is populated. There are no blanks and no dashes.**

| # | Row label | Cell value | Empty-value rule |
|---|---|---|---|
| — | *(column header)* | `{hotelName}`, `line-clamp-2`, `min-h-[2.75em]` | — |
| 1 | `Per night` | `{formatMoney(dealPrice)}` | never empty |
| 2 | `Usually` | `{formatMoney(medianPrice)}` | never empty |
| 3 | `Off usual price` | `{discountPct}% off` | never empty |
| 4 | `You save` | `{formatMoney(savings)}/night` | `Under $20/night` when `0 < savings < 2000`; `No saving vs usual` when `savings <= 0` |
| 5 | `Class` | `{n}-star` | `stars ?? 3`, matching the card |
| 6 | `Area` | `{city}` | never empty |
| 7 | `Check-in` | `{checkInWindow}` | never empty |
| 8 | `Price checked` | `{timeAgo(updatedAt)}` | `Not checked yet` when `updatedAt` is null |
| 9 | `Price checks` | `{snapshotCount} over 60 days` | never empty |

Row 1 is `text-h3 text-[color:var(--primary)]`; every other value is `text-small text-[color:var(--text-1)]`. Labels are `text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]`. Row 4's `No saving vs usual` is the honest string when the median sits at or below the deal price — it never renders "$0 saved", per §7.2.

**No Deal Score row. No guest-rating row. No total-stay-cost row.** See §0.4.

#### Per-column actions

Under each column, a remove control: `min-h-11`, visible `Remove`, accessible name `Remove {hotelName} from the side-by-side view`.

Under that, a link to the deal: visible `View deal`, accessible name `View deal: {hotelName}` — matching `DealCard.tsx:146` exactly, so the same action has the same accessible name on both surfaces. This is the panel's exit to booking; without it the panel is a dead end and the shopper has to close it, find the card again, and click through.

#### Honesty line

Fixed, always present, `id={honestyId}`, at the foot of the panel:

> **Room details, taxes, fees, and cancellation terms are set by the provider — check them before booking.**

`text-caption text-[color:var(--text-3)] border-t border-[color:var(--border)] pt-3 mt-4`. This mirrors the language already used at handoff (`CompareRow.tsx:120`) and prevents the table from implying that the attributes it *cannot* show are comparable.

### 3.6 Panel layout, by width

**Below 680px — label-above blocks.** Each attribute renders as a full-width `text-caption` label line, then a grid of values, one column per selected hotel:

```
container   space-y-4
block       space-y-1
label       text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]
values      grid gap-3 grid-cols-2   (2 selected)
            grid gap-3 grid-cols-3   (3 selected)
```

At 375px the dialog content width is ~335px. Two columns ≈ 160px each; three ≈ 103px each. `$189`, `24% off`, `4-star`, `Austin`, `2 hours ago` all fit on one line at `text-small` in 103px. Hotel names clamp to two lines.

**This means there is no horizontal scroll at 375px at any count, including three.** §7.3 permitted a pinned-label scroll region as a fallback for three columns; it is not needed. A layout with no scroll is strictly better — a horizontally scrolled table cannot be diffed without moving the viewport, which is a weaker version of the same failure this feature exists to fix.

**680px and above — true table grammar.** Sticky label column plus one column per hotel:

```
grid grid-cols-[7.5rem_repeat(2,minmax(0,1fr))]   (2 selected)
grid grid-cols-[7.5rem_repeat(3,minmax(0,1fr))]   (3 selected)
gap-x-4 gap-y-3
```

Labels sit in column 1, right-aligned, vertically centred with their row. Alternating row background `odd:bg-[color:var(--bg-muted)]` for horizontal tracking. At 1280px the dialog is capped at 720px wide and centred, so three columns get ~200px each — comfortable.

Both layouts render the same content in the same order. Only the label position changes.

### 3.7 Every state

| # | State | Rendering |
|---|---|---|
| B0 | **0 selected** | No open control. Cards show unchecked controls. Feed is otherwise identical to Unit A. |
| B1 | **1 selected** | Open control appears in flow above the grid: `1 selected`, button `See them side by side (1)` with `aria-disabled="true"`, inline hint `Pick one more hotel to see them side by side.` `Clear all` present. All other controls remain enabled. |
| B2 | **2 selected** | Button enabled, `See them side by side (2)`. No hint. |
| B3 | **3 selected — cap reached** | Button enabled, `See them side by side (3)`. Inline hint `That's the limit — 3 at a time.` **Every unselected card control gets `aria-disabled="true"`, `opacity-60`, and the accessible name suffix `Limit of 3 reached.`** The three selected controls stay fully enabled so a swap is one uncheck away. **No earlier selection is ever silently dropped.** |
| B4 | **Cap-blocked click** | The `onChange` handler `preventDefault()`s and announces `You can line up 3 hotels at a time. Remove one to add another.` in the live region. The checkbox does not visually change. The control keeps `aria-disabled`, not `disabled`, so it stays focusable and the reason is reachable by keyboard. |
| B5 | **Panel open, 2 columns** | §3.5 / §3.6. |
| B6 | **Panel open, 3 columns** | Same, third column added; layout per §3.6. |
| B7 | **Column removed → 2 remain** | Column disappears; grid recomputes to 2 columns; panel stays open; focus moves to the *next* column's remove control, or the previous one if the last column was removed; live region: `{hotelName} removed. Two hotels side by side.` |
| B8 | **Column removed → 1 remains** | Panel closes. Focus returns to the open control (which is why it is `aria-disabled`, not `disabled`). Live region: `{hotelName} removed. Pick one more hotel to see them side by side.` |
| B9 | **Clear all** | Set empties, panel closes if open, open control disappears. Focus moves to `gridRef` (`:1892`, already `tabIndex={-1}`). Live region: `Side-by-side view cleared.` |
| B10 | **Cleared by filter / sort / criteria change** | Set empties and panel closes *before* the request resolves. The existing `statusAnnouncement` message is **suffixed**, not replaced: `Filters applied. Showing 24 deals. Side-by-side view cleared.` One announcement, not two competing ones. If focus was inside the panel, it moves to `gridRef`. |
| B11 | **Filter request fails** | Set is already cleared by B10 and stays cleared. Existing failure copy (`:708`, `:716`) is suffixed the same way. It does not resurrect. |
| B12 | **Pending overlay active** | Set already cleared by B10 → no open control, and every card control is inside the `inert aria-hidden` subtree (`:1793`, `:1810`) and therefore unreachable. **Nothing new is rendered outside that subtree.** |
| B13 | **Loading / error** | `selectionEnabled` is false. No controls, no open control, no panel. |
| B14 | **Cold sample feed / mock feed** | `selectionEnabled` is false. No controls anywhere. `ColdSampleFeedIntro` (`:1875`) is unchanged. |
| B15 | **Fewer than 2 live deals** | `realDealCount < 2` → `selectionEnabled` false → no controls. A single-result feed shows no dead affordance. |
| B16 | **Locked cards present** | `LockedDealCard` is untouched. It renders no control. A mixed feed of locked and live cards works normally; only live cards are selectable. |
| B17 | **`loadMore` appends** | Set survives (§3.3). New cards render unchecked controls, `aria-disabled` if the cap is already reached. |
| B18 | **Reload / return via `backHref`** | Empty set, no panel, no open control. Nothing is restored, by design. |

### 3.8 Keyboard and focus

**Feed tab order per card, unchanged in structure:**
`… → card link ("View deal: {hotelName}") → side-by-side checkbox → next card link → …`

The checkbox is a DOM sibling immediately after the `<a>`, so this order is the natural one — no `tabIndex` above 0 anywhere.

**Open control:** in flow above the grid, so it is reached before any card. Space/Enter activates; at count 1 it announces the hint instead of opening.

**Panel:**
- On open, focus moves to the `h2` (`tabIndex={-1}`).
- Focus is **trapped** inside the dialog while open: Tab from the last focusable wraps to the first, Shift+Tab from the first wraps to the last. Same treatment as `HotelSearchCriteria`'s `dialogRef`.
- Order inside: `h2` → Close → column 1 Remove → column 1 View deal → column 2 Remove → column 2 View deal → (column 3 …) → wrap. Values are not focusable.
- **Escape closes and restores focus to the open control.** If the open control no longer exists (set cleared while open — B10), focus goes to `gridRef`.
- Backdrop click closes with the same focus restoration.
- The dialog is labelled by its `h2` and described by the honesty line.

**Focus ring:** every interactive element uses the existing `--focus-ring` / `--focus-outline` tokens. The card checkbox's ring must be visible against `--surface` and must not be clipped by the card's `overflow-hidden` (`DealCard.tsx:66`) — the control is a sibling of the `<article>`, in the outer wrapper, so it is outside the clipping context. **This is a real regression risk if the control is ever moved inside the `<article>`; do not move it.**

**Live region:** reuse the existing `resultStatusMessage` / `statusAnnouncement` region (`:511`, `:1239`, `#hotel-sort-status` at `:1735`, `role="status" aria-live="polite" aria-atomic="true"`). Do not add a second live region — two polite regions on one surface produce interleaved, unreadable announcements.

### 3.9 Complete Unit B copy inventory

Every user-visible string and every accessible name. Nothing else may be added.

**Card control**
- Visible label: `Side by side`
- Accessible name, unselected: `Add {hotelName} to the side-by-side view`
- Accessible name, selected: `Remove {hotelName} from the side-by-side view`
- Accessible name, cap reached and unselected: `Add {hotelName} to the side-by-side view. Limit of 3 reached.`

**Open control**
- `1 selected` · `2 selected` · `3 selected`
- `See them side by side (1)` · `(2)` · `(3)`
- Hint at 1: `Pick one more hotel to see them side by side.`
- Hint at 3: `That's the limit — 3 at a time.`
- `Clear all` — accessible name `Clear the side-by-side view`

**Panel**
- Heading: `Side by side`
- Subhead: `Two hotels from your current results.` / `Three hotels from your current results.`
- Close: `×` (`aria-hidden`) — accessible name `Close side by side`
- Row labels: `Per night` · `Usually` · `Off usual price` · `You save` · `Class` · `Area` · `Check-in` · `Price checked` · `Price checks`
- Value fallbacks: `Under $20/night` · `No saving vs usual` · `Not checked yet`
- Column remove: `Remove` — accessible name `Remove {hotelName} from the side-by-side view`
- Column link: `View deal` — accessible name `View deal: {hotelName}`
- Honesty line: `Room details, taxes, fees, and cancellation terms are set by the provider — check them before booking.`

**Live-region announcements**
- `You can line up 3 hotels at a time. Remove one to add another.`
- `{hotelName} removed. Two hotels side by side.`
- `{hotelName} removed. Pick one more hotel to see them side by side.`
- `Side-by-side view cleared.`
- Suffix appended to existing filter/sort messages: ` Side-by-side view cleared.`

Grep the diff for `Compare`, `Comparison`, `Watch`, `Save` (as a verb — `You save` is a noun-phrase row label and is intentional), `Track`, `Alert`, `Follow`, `Bookmark`, `Shortlist`, `Wishlist`, `Pin`. `You save` and `No saving vs usual` are the only permitted appearances of the letters "sav", and neither is an action.

### 3.10 Unit B acceptance

1. Clicking the card control never navigates and never fires `onOpen`.
2. Selecting a third deal leaves all three selections intact and marks every other control `aria-disabled` with a visible reason.
3. Any filter, sort, criteria change, undo, or reset empties the set and closes the panel, with one combined announcement.
4. At 375px, two columns and three columns are both readable with no horizontal scroll.
5. Mock, locked, cold-sample-feed, mock-feed, loading, error, and `realDealCount < 2` states expose no control anywhere.
6. Nothing renders outside the `inert aria-hidden` pending-overlay subtree while a filter request is in flight.
7. Tab reaches the control immediately after the card link; Escape closes the panel and restores focus to the open control.
8. The diff contains zero occurrences of `sessionStorage`, `localStorage`, `document.cookie`, `isPremium`, `watchlist`, `alert_preference`, or `alert_min_discount`, and touches no file under `app/deals/[dealId]/`.
9. `ApiDeal` gains no field. No new route, no new fetch.
10. `npx tsc --noEmit --incremental false` exits 0.

---

## 4. Open board decision — not resolved here

UXR agrees with discovery that `docs/pipeline/hotel-compare/` is superseded and `UXDES-HOTEL-COMPARE-01` should not be opened (§8 of the research brief). **That call belongs to the board and this spec does not make it.** This spec is written for `hotel-comparison-decision`. If the board rules the other way, this ticket closes as the duplicate and §2 (Unit A) should be salvaged into whichever pipeline survives — it is the fix for the alignment half of the problem and it is independent of any selection decision.

`hotel-compare` §8.5's `sessionStorage` persistence is **not** designed here under any ruling. It belongs to `hotel-shortlist-share`.

---

## 5. Out of scope — needs its own tickets

Re-verified this stage. Not touched.

1. **P0 — `lib/db/schema.sql` has committed merge-conflict markers at 272, 395, 408.** The file is not valid SQL. The conflict spans `analytics_events` (HEAD, carrying the `(session_id, occurred_at)` index the live route depends on) and `product_analytics_events` (incoming). Resolution is a product decision about which table is canonical, not a mechanical merge.
2. **P0 — detail-page analytics events are silently rejected in production.** `hotel_detail_viewed`, `hotel_detail_back_to_results`, `hotel_decision_section_reached`, `hotel_room_handoff_started` — all 400. This affects **every** hotel pipeline whose measurement plan cites those events, not just this one. It warrants its own P0 rather than riding along in `DEV-HOTEL-COMPARISON-DECISION-01`; the DEV ticket below carries it only so this feature is not blocked waiting for that P0 to be scheduled.
3. **`app/components/HotelCard.tsx` — 1079 lines of dead code**, still listed in `AGENTS.md`'s file map as the live hotel result card. Fifth stage to rediscover it. Needs a deletion ticket or a file-map correction.
4. **`DealCard`'s `expired` prop is never passed by any call site.** Either wire it from `deals.status` / `expires_at` or remove it. This spec keeps its branches coherent but cannot make them reachable.
5. **Two analytics suites assert mutually incompatible contracts and both pass** (`route.test.ts:78` vs `HotelDecisionAnalytics.test.tsx:102`). The missing integration test is in the DEV ticket; the general pattern needs a QA look.

---

## 6. Handoff

**`UI-HOTEL-COMPARISON-DECISION-01`** — implement §2 (Unit A) and §3 (Unit B), in that order, as two commits. UI-only: `app/components/ui/DealCard.tsx`, a new `app/components/ui/SideBySidePanel.tsx`, and the selection state plus in-flow open control in `app/deals/DealFeed.tsx`. No API route, no provider, no `ApiDeal` field, no business logic.

**`DEV-HOTEL-COMPARISON-DECISION-01`** — §7.5 of the research brief, carried intact: reconcile `HotelDecisionAnalytics`'s emitted values with `app/api/analytics/route.ts`'s allowlist (`entry_source`, `viewport_group`, `score_state`, `price_freshness_state`, `section`, `position`); add an integration test that posts a real `HotelDecisionAnalytics` payload through `parseBody` and asserts 202; add `deal_id` to `hotel_result_card_opened`; allowlist this feature's two events (a selection event and a panel-open event) carrying `deal_id`, `viewport_band`, `filter_state`, and the selected count. **Not a blocker for shipping — a blocker for measuring.**

No code was changed in this stage. Design produces docs only.

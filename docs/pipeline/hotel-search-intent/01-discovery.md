# 01 — Discovery: Hotel Search Intent Guidance

**Ticket:** UXD-HOTEL-SEARCH-INTENT-01
**Stage:** UX Discovery
**Feature slug:** `hotel-search-intent`
**Date:** 2026-07-30
**Scope:** Guidance, examples, and validation around the existing hotels-first search model. Excludes natural-language search and personalized recommendations.

---

## 1. Problem statement

> A first-time traveler arriving at expaify has no visible way to say where and when they want to stay — the only search-looking control on the results page is a disabled Premium natural-language box, and the real destination + date capture is hidden behind an "Edit" button on a card that reads like a receipt of a search the user never made.

---

## 2. Who is affected, and where

**Who:** First-time, unauthenticated or newly-registered visitors with a specific trip in mind ("I need Lisbon in October"). Users who arrive with no destination in mind are served fine by the deal feed; users with intent are the population that breaks.

**Where in the flow — the actual traced path:**

| Step | Surface | What the user can express |
|---|---|---|
| 1 | `/` (`app/page.tsx`) | **Nothing.** The homepage is marketing-only: hero, logo strip, teaser cards, how-it-works, pricing, FAQ. There is no search input anywhere on it. The two CTAs are "Join for free" (`/join`) and "See live deals" (`/deals`). |
| 2 | `/deals` (`app/deals/page.tsx` → `DealFeed.tsx`) | Lands on an unscoped feed: heading "Today's catches", subtitle "Deals across 20 destinations, updated daily". |
| 3 | `/deals` — criteria summary (`HotelSearchCriteria.tsx:27`) | A card headed **"Your search"** showing "All destinations · Any check-in date · Guests & rooms not captured" — describing a search the user never performed. Intent capture is behind its **"Edit"** button. |
| 4 | `/deals` — `SearchBar` (`app/components/ui/SearchBar.tsx`) | The one control that *looks* like search — full-width text input with a magnifier button. For free users it is `disabled`, placeholder "Upgrade to search deals in plain English", helper text "Natural-language search is included with Premium." |
| 5 | `/deals` — criteria editor (`HotelSearchCriteria.tsx:93`) | Destination `<select>` (20 tracked cities + "All destinations"), and a "Check-in window" **From**/**Through** date pair. |

The affordance hierarchy is inverted: the visually dominant search control is gated and out of the intended model, while the in-model control is a secondary text button on an informational card.

### 2a. Three intent dimensions, three different failure modes

The ticket names destination, dates, and stay type. In the current model:

- **Destination** — capturable, but only as one of 20 hardcoded cities (`lib/trackedMarkets.ts`). A user typing/looking for Berlin, Sydney, or Denver has no way to learn, before or after searching, that coverage is a fixed 20-city list. The dropdown is the *only* disclosure of coverage and it requires opening a modal to read.
- **Dates** — capturable, but the field means something non-obvious. It is a **check-in window** (a range of acceptable arrival dates), not a stay. The helper text under the fields says so — "Deals may have different check-out dates and stay lengths" — but only *after* the user has opened the editor and read past two date inputs labeled "From" and "Through", which every competing travel product uses to mean check-in/check-out.
- **Stay type / stay length** — **not capturable at all.** `HotelSearchCriteriaV1` (`lib/hotels/searchCriteria.ts:4`) carries `destination`, `dates`, and `occupancy`, and `occupancy` is permanently `{ state: 'not_captured' }`. Nights, room count, party size, and property type cannot be expressed. The UI states this honestly ("Guests & rooms not captured", "This version of expaify can't filter hotel deals by party size yet") but states it *inside the editor*, after the user has already committed attention to filling a search form.

### 2b. A built, unmounted intent-capture component

`app/components/HotelDestinationCombobox.tsx` (528 lines) is a complete accessible typeahead with location typing (`city`, `airport`, `airport_area`, `district`, `neighborhood`, `landmark`, `region`), scope helper copy (`hotelDestinationScopeHelper`), a `minimumCharacters` / `too_short` state, and `idle | loading | ready | empty | error` lookup states. `HotelDestinationSearchState.tsx` wraps it. **Neither is imported by any page or component** — only by their own tests. The repo already contains a better intent-capture control than the one shipped; it is dead code. Downstream stages must decide whether the fix reuses it or the model stays a `<select>`, and must not assume it is wired.

---

## 3. Measurable signals that the problem exists

These are observable in the current code and the existing analytics sink (`lib/analytics.ts` → `/api/analytics` → Postgres), without new instrumentation for the first four:

1. **Result-page arrivals carry no intent.** `resolveHotelSearchCriteria` returns `{ status: 'missing' }` unless the URL carries `criteriaVersion`/`criteriaSchema`. Since no homepage or nav link ever emits those params, **every organic arrival at `/deals` is a criteria-less arrival**, and `/deals` synthesizes an empty `{ city: '', dateFrom: '', dateTo: '' }` draft (`app/deals/page.tsx:77`). Baseline: share of `hotel_results_viewed` where `criteria_source = 'deals_page'` and destination is `all` **and** dates are `missing` — expected today at or near 100%.

2. **Intent capture is abandoned rather than completed.** `hotel_criteria_edit_started` fires on editor open; `hotel_criteria_edit_cancelled` fires on Escape/backdrop/Cancel; `hotel_criteria_edit_applied` fires on success. The cancelled-to-applied ratio is the direct discovery metric for "the user opened the form and could not or would not complete it."

3. **Incomplete searches are silently unmeasurable.** The submit button is `disabled={!valid || !changed || submitting}` (`HotelSearchCriteria.tsx:238`), and `submit()` returns early on the same condition with **no event fired and no message rendered**. A user who opens the editor and presses "Update results" without changing anything, or with an invalid range, gets a dead control and no explanation. Field-level errors only render after `attempted` is set, which can only become true via a submit that the disabled button prevents from ever dispatching. The "incomplete searches" and "query corrections" the ticket asks us to measure are, today, structurally invisible.

4. **Malformed-but-accepted searches return zero results with no guidance.** `isValidHotelDate` (`lib/hotels/searchCriteria.ts:130`) accepts any well-formed ISO date, and the `<input type="date">` fields carry no `min` or `max`. A check-in window of `2019-03-01 – 2019-03-05` validates, applies, and returns an empty feed indistinguishable from "no deals right now." Same for a far-future window beyond the 60-day snapshot horizon. Baseline: share of applied criteria whose `dateFrom` is in the past or more than 60 days out.

5. **Off-coverage destination intent is unmeasured by construction.** Because destination is a `<select>` of 20 cities, a user wanting an untracked city produces no signal at all — no failed query, no zero-result search, just an abandonment. This is the one signal that requires new instrumentation to observe, and downstream stages should treat that as a finding rather than an absence of demand.

---

## 4. Constraints the solution must respect

1. **Data integrity — coverage is a fixed 20-market list.** `TRACKED_MARKETS` drives snapshots, and Deal Score requires ≥10 (feed rules: `MIN_SNAPSHOTS`) historical points per property. Guidance may not imply searchable coverage beyond those 20 cities, and must never present a destination we cannot score. Any "we don't cover that yet" path must be honest, not a zero-result dead end.

2. **Semantic honesty over familiar form patterns.** The date fields are a check-in *window*, and occupancy/stay length genuinely are not captured. The fix must make those truths legible *before* the user invests effort — it may not borrow Booking.com's check-in/check-out + guests form shape to feel familiar, because that would promise filtering the data layer cannot perform.

3. **Accessibility and 375px mobile.** Every field needs a programmatic label, `aria-describedby` error wiring, an `role="alert"` error path that is actually reachable, a ≥44px touch target, and a working tab order. The existing editor is a focus-trapped `role="dialog"` and that behaviour must be preserved, not regressed. No overlapping text at 375px.

4. **(Scope guard, not a design constraint)** Natural-language search and personalized recommendations are out of scope. The `SearchBar` may be *repositioned or de-emphasized* in the hierarchy, but its parsing behaviour and Premium gating are not to be changed by this feature.

---

## 5. Success statement

> This is solved when a first-time user can state a destination and a check-in window from the entry point in one pass — and, when their intent falls outside what expaify covers (untracked city, past date, beyond the 60-day horizon), sees which part was out of range and what to do next — **without** mistaking the Premium natural-language box for the search control, **without** having to open a modal to discover the 20-city coverage list, and **without** receiving an empty feed as the only feedback on a malformed search.

---

## 6. Intent-capture hypothesis

**Hypothesis:** First-time hotel search intent fails at expaify not because the form is hard to fill, but because *the form is not the thing that looks like search, and the model's limits are disclosed only after the user commits*. Making the in-model destination + check-in-window capture the primary affordance at the entry point, disclosing the 20-market coverage and the "check-in window, not stay dates" semantics *at the point of input*, and giving every rejected or empty-yielding intent a named reason will convert criteria-less arrivals into scoped ones.

### Measurable completion criteria

Stated as deltas against the baselines in §3. Downstream stages own the design and thresholds; these define what "done" is measured against.

| # | Criterion | Metric | Baseline | Target |
|---|---|---|---|---|
| C1 | Arrivals at results carry intent | Share of `hotel_results_viewed` with destination `selected` **or** dates `checkin_window` | ~0% | ≥ 35% |
| C2 | Started intent capture completes | `hotel_criteria_edit_applied` ÷ `hotel_criteria_edit_started` | measure at kickoff | ≥ 70%, and strictly above baseline |
| C3 | Blocked submits become visible and rare | New event on rejected submit (invalid or unchanged) fires 100% of the time it is rejected; rejected-submit rate per completed capture | unmeasurable today | instrumented; ≤ 15% |
| C4 | Malformed date intent is caught at input | Share of applied criteria with `dateFrom` in the past or > 60 days out | measure at kickoff | ≤ 2% |
| C5 | Off-coverage intent is named, not silent | Share of destination-intent attempts resolving to an untracked market that receive an explicit out-of-coverage response rather than an empty feed | 0% (unmeasurable) | 100% of detected cases |
| C6 | Search control is not confused with the Premium box | Free-user interaction attempts on the disabled `SearchBar` per session on `/deals` | measure at kickoff | strictly below baseline |
| C7 | No regression | Existing feed, filter, sort, and deal-detail flows unchanged; 375px and 1280px both usable; `tsc` and tests exit 0 | — | required |

C3 and C5 require new analytics events. C6 requires instrumenting the disabled state. These are measurement additions inside the guidance/validation scope, not new product features.

### Explicit non-goals

- No natural-language or free-text query parsing.
- No personalized or history-based destination suggestions.
- No occupancy, room-count, or property-type **filtering** — the data layer cannot honour it. Disclosing that it is not captured is in scope; capturing it is not.
- No change to `HotelSearchCriteriaV1`'s schema semantics, to Deal Score, or to provider adapters.
- No expansion of the tracked-market list.

---

## 7. Open questions for UX Research (Stage 2)

1. Should the entry point for scoped search be the homepage hero, or should `/deals` gain a persistent search header? The homepage is a conversion-optimized marketing page and adding a form there is a hierarchy decision, not a discovery one.
2. Reuse `HotelDestinationCombobox` (already built, richer, accessible, currently dead) or keep the 20-item `<select>`? A combobox over a closed 20-city list is arguably the wrong control; a combobox is right only if out-of-coverage input gets a real response. Research must pick one and say why.
3. What is the honest scope-limit disclosure pattern — inline helper at the field, a coverage line above the form, or a post-submit out-of-coverage state? Compare against how Google Flights discloses unsupported routes and how Booking.com handles a destination with no availability.
4. Is "check-in window" the right user-facing label at all, or does the concept need renaming? Research owns the copy directive; Design owns the final string.

---

## 8. Handoff

Next stage: **UXR-HOTEL-SEARCH-INTENT-01** — UX Research. Research must read the actual source files listed below rather than trusting this summary.

**Source files traced for this report:**
- `app/page.tsx` — homepage; confirmed no search surface
- `app/deals/page.tsx` — results entry, criteria resolution
- `app/deals/DealFeed.tsx` — feed, criteria summary mount (`:1486`), editor mount (`:1956`), analytics
- `app/components/HotelSearchCriteria.tsx` — summary, editor, validation, context/mismatch states
- `app/components/ui/SearchBar.tsx` — Premium natural-language box (out of scope, in the way)
- `app/components/HotelDestinationCombobox.tsx`, `app/components/HotelDestinationSearchState.tsx` — built, unmounted
- `lib/hotels/searchCriteria.ts` — `HotelSearchCriteriaV1`, `isValidHotelDate`, `resolveHotelSearchCriteria`
- `lib/trackedMarkets.ts` — the 20-market coverage list
- `app/destinations/[city]/page.tsx` — city entry point, seeds destination with empty dates
- `lib/analytics.ts` — event sink and validation

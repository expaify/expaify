# UXD-HOTEL-DATE-FLEXIBILITY-01 — Discovery: Flexible-Date Hotel Search

**Stage:** UX Discovery · **Priority:** P1 · **Feature slug:** `hotel-date-flexibility` · **Date:** 2026-07-30
**Surface:** hotel search criteria → hotel results feed → hotel deal detail
**Next stage ticket:** `UXR-HOTEL-DATE-FLEXIBILITY-01`

---

## 1. Problem statement (one sentence)

A traveler whose hotel dates can flex has no way to learn that a nearby check-in date exists — not on the criteria summary, not on a zero-result feed, not on a deal whose exact date is expensive or unbookable — so their only recovery is to reopen the editor and guess at another date window, and expaify already holds the inventory that would have answered them.

## 2. Who is affected, and exactly where

**Who:** Travelers who arrive with a soft date window ("first half of August, Miami") rather than a fixed one. This is the majority of leisure hotel intent and the audience expaify's "cheapest acceptable window" promise targets. Highest risk: a first-time visitor whose first search happens to land on a date with thin or no inventory — their first impression is an empty screen.

**Three break points, in flow order:**

1. **Search criteria (`app/components/HotelSearchCriteria.tsx`).** The editor collects an exact `From`/`Through` check-in window via two bare `<input type="date">` fields (`:218`, `:223`). There is **no flexibility affordance at all** — no "± days", no "my dates are flexible", no indication that the window is a hard filter. The helper copy under the fieldset says only *"Deals may have different check-out dates and stay lengths."* (`:227`). The user cannot express flexibility, so the system cannot act on it.

2. **Results feed (`app/deals/DealFeed.tsx`).** `dateFrom`/`dateTo` are applied as hard SQL bounds — `AND d.check_in_date >= $n` / `<= $n` (`lib/pipeline/dealDetection.ts:265–274`). One day outside the window and a matching hotel is invisible. When that yields zero rows, the filtered empty branch (`DealFeed.tsx:1837–1853`) renders `ResultCoverageBoundary` plus two generic buttons — **Edit search** and, on a city page, **See all destinations**. Neither states which check-in dates *do* have inventory. Recovery is: open the modal, retype two dates, submit, hope. There is no ±N-day widening and no "nearest available check-in" statement.

3. **Deal detail (`app/deals/[dealId]/page.tsx`).** The detail page renders exactly one `check_in_date` and a derived check-out (`:281–283`). If that exact date is expensive or the provider link is missing, the page is terminal for a date-flexible user. Worse: when the deal's `check_in_date` falls outside the criteria the user searched with, `hotelCriteriaContextStatus` (`:250`) returns `mismatch` and `HotelCriteriaMismatchAlert` (`HotelSearchCriteria.tsx:259`) **blocks the provider handoff** — *"Provider options are unavailable until you review the mismatch."* A date-flexible traveler who would happily take the adjacent date is hard-stopped by a date-strictness rule and given the choices *Edit search* or *Back to matching results*. This is the sharpest instance of the problem: the product treats an acceptable alternative date as an error condition.

## 3. Measurable signal that the problem exists

Each measure below maps to a signal that is either already emitted or is a named instrumentation gap for UXR to confirm.

| Measure asked for in the ticket | Signal available today | Gap |
|---|---|---|
| **Date edits** | `hotel_criteria_edit_applied` fires with a changed-field list that already distinguishes `date_from` / `date_to` (`DealFeed.tsx:882–883, 904`); `feed_filter_chip_removed` fires with `filter: 'dateFrom' \| 'dateTo'` (`:1013`). | Repeat date-only edits inside one session are countable but nobody has counted them. **The core metric — consecutive date-only edits per session, and how many follow a zero-result render — is derivable now and unmeasured.** |
| **Zero-result recovery** | `feed_empty_filtered_viewed` (`:1360`) and `feed_empty_cold_viewed` (`:1366`) fire on the empty branches. | Neither payload carries whether a date filter was active, so "empty *because of dates*" cannot be separated from "empty because of city/discount/stars". `date_from_active` / `date_to_active` already exist on `hotel_results_viewed` (`:1264–1265`) — the empty events simply omit them. |
| **Conversion after alternative-date discovery** | `hotel_result_card_opened` (`:1349`) and the handoff events exist. | There is no alternative-date affordance to attribute conversion to. **This measure is unbuildable until the signal ships** — it is the post-launch success metric, not a pre-launch one. |

**The structural signal, independent of analytics:** the same hotel can hold several active deal rows at different check-in dates — the deals table's uniqueness is `(hotel_id, market_id, check_in_date)` (`lib/db/schema.sql:147`), and detection upserts per check-in date (`lib/pipeline/dealDetection.ts:99`). **Adjacent-date inventory demonstrably exists in the row set, and no read path anywhere in `app/` or `lib/` ever asks for it.** The only date query shape in the codebase is the hard `>=`/`<=` filter. That asymmetry is the defect.

**Corroborating asymmetry:** flights already ship date flexibility. `/api/search` accepts `flex=1` and expands the Travelpayouts query to a ±3-day departure window (`app/api/search/route.ts:248, 309–316`), with dedicated coverage reporting (`flexibleDateCoverage`, `:59`). Hotels have no equivalent parameter, no equivalent coverage type, and no equivalent control. The product contains the concept; the hotel flow was left out.

## 4. Constraints the solution must respect

1. **Honesty over helpfulness (data integrity).** A nearby-date signal may only name a date and price that came from a real, non-expired deal row. Never extrapolate a price to an unpriced date, never present a nearby date as bookable without its own provider link, and never let a nearby-date comparison alter the primary offer's Deal Score verdict or confidence. Money stays `{ priceCents, currency }` in integer minor units end to end. If nearby dates were not checked, say *not checked* — do not render silence as *none cheaper*.

2. **Lightweight, bounded, cache-respecting (performance).** The signal must read existing deal rows over a bounded check-in band, served by the existing `(hotel_id, market_id, check_in_date)` and `(market_id, status)` indexes. **Out of scope: any per-date calendar-pricing infrastructure** — no new provider fan-out per date, no price-grid table, no nightly job changes. Nearby-date resolution must never block or delay the primary results render.

3. **Subordinate and accessible (brand + a11y).** The primary result price and verdict keep their hierarchy; the flexibility signal is secondary, caption-scale, one line. It must be usable at 375px without pushing the price or the primary action below the fold, must be keyboard-reachable with a visible focus ring if interactive, and must expose its full meaning (date, price, and the fact that it is an alternative) to a screen reader — the existing hotel surfaces set that aria bar and it must not regress.

## 5. Success statement

**This is solved when a first-time user whose dates are flexible can, without reopening the search editor and retyping dates, see that a nearby check-in date exists — and act on it — from the results feed and from a deal whose exact date is expensive or unbookable.**

Validated minimum requirement this discovery asserts, for UXR to confirm or refute:

- **Minimum interaction:** one declaration of flexibility at criteria time (a ±N-day band on the existing check-in window, not a calendar), plus one subordinate line per affected surface that names a real alternative check-in date and its price, plus one action that applies that date without a full re-entry of criteria. Three touchpoints, no new page.
- **Minimum data:** the existing active deal rows for the same hotel (detail) or the same market (feed) within the ±N-day band around the user's window, with `check_in_date`, `nights`, `deal_price_cents`, `snapshot_count`, and `ota_links` — all already on the row. **No new provider call and no new table.**
- **Minimum instrumentation:** `date_from_active` / `date_to_active` added to the empty-state events, and a nearby-date exposure/apply event pair, so "conversion after alternative-date discovery" becomes measurable at launch rather than retrofitted.

## 6. Scope boundaries and adjacent tickets

**In scope:** the criteria → results → detail path for expressing and acting on date flexibility, including the zero-result date-recovery case and the mismatch hard-stop at `[dealId]`.

**Explicitly out of scope:**
- Full calendar-pricing infrastructure (per-date price grids, date-matrix UI, provider fan-out per date) — excluded by the ticket.
- **`date-flex-savings`** (`docs/pipeline/date-flex-savings/`) already carries a design spec for `NearbyDateNote`, a *savings-framed* secondary line on `DealCard` and `/deals/[dealId]`. **This ticket must not respecify that component.** The distinct, unclaimed problem here is the *search-criteria and zero-result recovery* half: expressing flexibility up front, and recovering when a date window returns nothing. UXR's first task is to reconcile the two so the delivered surface is one element with one data contract, not two competing lines. If UXR finds the overlap total, it should say so and reduce this ticket to the criteria-input and empty-state halves rather than duplicate work.
- `hotel-no-results-recovery` owns the untracked-destination 400-as-error bug and destination-axis widening; this ticket owns only the **date** axis of no-results recovery.
- `flexible-date-deal-confidence` owns flight-side flexible-date confidence copy. Referenced here only as precedent.
- The `PriceUnavailable` dead-end in `HotelCard.tsx` is touched by `date-flex-savings` §1.3; flagged, not claimed.

## 7. Conflicts and risks flagged for downstream

- **Risk — the mismatch rule may be load-bearing.** Softening `HotelCriteriaMismatchAlert` for date-adjacent deals touches a trust guardrail built deliberately (it blocks handoff so a user never books dates they did not search). UXDES must design a *user-acknowledged date change*, not a silent relaxation of the check. Do not remove the guard.
- **Risk — free-plan locking.** Locked deal rows return `dealPriceCents: 0` and empty `otaLinks` (`app/api/deals/route.ts:38–49`). A nearby-date signal must never leak a locked deal's price, and must not surface a locked alternative as if it were actionable.
- **Open question for UXR — band width.** ±3 days is the flight precedent (`app/api/search/route.ts:309–316`). Whether the same band is right for hotels, where inventory is sparser per date, is unvalidated. UXR must ground the band in observed `check_in_date` density per market, not copy the flight number.

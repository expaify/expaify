# UXR-RATE-ELIGIBILITY-01: Hotel Rate Eligibility Clarity — Research Brief

Date: 2026-07-22  
Stage: UX Research  
Priority: P0  
Upstream: `docs/pipeline/rate-eligibility/01-discovery.md`  
Method: source audit of this worktree plus interaction-pattern and supplier-contract review using current first-party documentation

## Executive Decision

expaify should treat rate eligibility as a **supplier-attributed, rate-level fact**, not a property trait and not a promise that expaify has verified the traveler. The usable model is three-state for each in-scope restriction family:

1. `restricted` — the supplier explicitly returned a membership, residency, age, or non-refundable condition;
2. `clear` — the supplier explicitly returned that this condition does not apply; and
3. `not_provided` — the supplier omitted the condition, the adapter does not support it, or the value is ambiguous.

The overall rate state may be **Restricted rate** as soon as one supported restriction is known. It may be **No reported rate restrictions** only when all four in-scope families are explicitly clear under a documented supplier contract. Any other combination remains **Restrictions not provided**, with any known facts still shown in detail. Missing data must never be normalized to `clear`.

This distinction matters because prospective suppliers expose different slices of the problem. Booking.com can identify logged-in/mobile deal types and target rates driven by booker country or user group; Expedia Rapid exposes member-deal and refundability fields and can return age/occupancy rejection reasons; Duffel Stays exposes cancellation timelines. None of those isolated values proves that membership, residency, age, and refundability are all unrestricted.

Current Hotellook offers cannot populate even one of these states from rate-level evidence. The honest current state for every offer is therefore **Restrictions not provided**.

## 1. Current-Code Evidence

This section describes the implementation in this worktree. It is not reference guidance.

### 1.1 The normalized hotel contract has no eligibility field

`HotelOffer` contains identity, location, quality evidence, integer-cent nightly price, price basis, image, supplier, and deeplink (`lib/types.ts:137-151`). It has no rate-plan identifier or membership, residency, age, refundability, cancellation, or restriction provenance. `NormalizedHotelOffer` is only an alias (`lib/types.ts:153`).

Consequences:

- a provider adapter cannot preserve a returned restriction;
- a component cannot distinguish `restricted`, `clear`, and `not_provided`; and
- the selected offer cannot carry eligibility meaning into review.

### 1.2 Hotellook provides a property-level “from” price, not a selectable rate plan

`HotelLookCacheEntry` models property identity, class, location, address, distance, `priceFrom`, photo, and property type (`lib/providers/hotellook.ts:10-28`). The mapping converts `priceFrom` to integer USD cents and constructs a property deeplink (`lib/providers/hotellook.ts:383-393`, `448-486`). There is no room/rate object or restriction payload to map.

Cached offers are validated only for the existing fields (`lib/providers/hotellook.ts:318-380`). Adding eligibility UI without a new normalized contract and richer supplier would therefore create display states with no evidence behind them.

### 1.3 “Review hotel” currently means valid money plus valid URL

The card computes `canBook` from a valid HTTP(S) deeplink and valid `Money` only (`app/components/HotelCard.tsx:400-412`). Eligibility does not participate. The collapsed card shows rate source and freshness absence (`app/components/HotelCard.tsx:34-49`), then Deal Score and **Review hotel** (`app/components/HotelCard.tsx:479-500`).

The expanded panel says the provider confirms final total, taxes, fees, room availability, cancellation policy, and terms (`app/components/HotelCard.tsx:416-419`, `571-578`). That sentence defers discovery; it does not say whether the displayed price is restricted.

### 1.4 Eligibility meaning is dropped before review

`BookingHotelContext` carries offer/provider identity, hotel/location, integer-cent price, price basis, and provider URL (`lib/booking/config.ts:18-29`). Validation and URL serialization preserve exactly those fields (`lib/booking/config.ts:276-337`, `360-385`). There is no eligibility state or supplier provenance to show on the review page.

The hotel review makes the selected nightly rate visually primary and says the booking partner confirms the live rate and final details (`app/book/BookingFlow.tsx:235-280`, `643-668`). **Continue to provider** then opens the affiliate URL in a new tab (`app/book/BookingFlow.tsx:670-684`). This is the last expaify-controlled decision point, yet it carries no rate-eligibility fact.

### 1.5 The behavioral baseline is instrument-shaped but not measurable in production

The current review emits:

- `hotel_handoff_viewed` on mount;
- `hotel_handoff_continue_clicked` on provider click;
- `hotel_handoff_returned` after a continue → hidden → visible sequence; and
- `hotel_handoff_back_clicked` if the user returns to search before continuing

(`app/book/BookingFlow.tsx:569-628`, `653`). This corrects the upstream discovery's statement that no handoff events exist: those event calls are present in the current branch.

However, `track()` only writes `console.debug` in development and does nothing in production (`lib/analytics.ts:1-7`). The event properties also contain no eligibility state or explicit reason. A visibility return can mean a price change, sold-out room, fees, room mismatch, normal comparison, or an eligibility problem. The current code therefore cannot produce an honest eligibility-abandonment baseline.

## 2. Supplier Attribute Research

The table separates what first-party documentation says from what expaify may safely normalize.

| Supplier / contract | Supplier-provided evidence | What it can support | What it cannot prove |
| --- | --- | --- | --- |
| **Current Hotellook adapter** | Only `priceFrom` plus property metadata in current code | No in-scope family | Any rate-level eligibility state, including “unrestricted” |
| **Booking.com Demand API** | Request `booker.platform`, `booker.country`/state, and `booker.user_groups`; product `deal.tags` can identify `logged_in_deal` and `mobile_rate`; cancellation policy returns `non_refundable`, `free_cancellation`, or `partially_refundable` | A logged-in/member condition when the selected product is explicitly tagged; mobile targeting; product refundability; country/user-group context used to retrieve an eligible product | `deal: null` means no deal, not “no restrictions”; country input alone is not a supplier statement that the rate is residence-restricted; one clear family does not clear the others |
| **Expedia Rapid Lodging** | Rate-level `member_deal_available`; optional `current_refundability` with refundable / partially refundable / non-refundable; country code and occupancy are request inputs; optional `unavailable_reason` can return constraints such as `minimum_child_age` | Candidate member-rate signal after confirming the selected-rate semantics; structured refundability; an explicit age/occupancy rejection for an unavailable result | A displayed available rate's comprehensive age/residency eligibility; `member_deal_available: false` plus refundable does not clear every other family; an unavailable-property reason is not a rate badge |
| **Duffel Stays** | Each rate has a `cancellation_timeline`; Duffel describes cancellation policy, payment method, loyalty program, and rate code as rate characteristics | Refundability/penalty evidence for the selected rate, including non-refundable when the documented timeline semantics support it | Member, residence, or age eligibility from the cited Stays contract; “loyalty programme” as a rate characteristic is not itself proof of member-only access |

### Supplier-normalization rules

1. **Normalize only selected-rate evidence.** Search-request context (for example, `country=us`) is an input, not a restriction label. A property-level promotion or unavailable reason must not be attached to an available rate unless the supplier contract explicitly makes that relationship.
2. **Keep coverage metadata.** Each adapter must declare whether it can explicitly return `restricted` and `clear` for each family. Without this, a false/nullable value is impossible to distinguish from an unsupported field.
3. **Preserve source and freshness.** Eligibility must travel with the same offer ID, supplier, and fetch time as the displayed price; no inference from hotel name, location, price, URL text, or traveler profile.
4. **Do not collapse “deal” into “eligibility.”** A public seasonal discount is not a member rate. Booking.com's documented `deal: null` means no discount indicator; it does not certify that cancellation, residence, or age constraints are clear.
5. **Revalidate at the handoff boundary when the supplier supports it.** Booking.com recommends orders/preview and Expedia Rapid provides Price Check because price, availability, and policies can change. expaify currently redirects rather than books, so it must say the provider confirms live acceptance; it must not upgrade supplier-reported evidence into a guarantee.

## 3. Reference Interaction Patterns

This section is pattern guidance, not a claim that expaify has the same inventory or booking control.

### 3.1 Booking.com: qualify the rate before showing it, label the reason, deepen policy later

Booking.com's Demand API makes eligibility inputs part of the search request: platform, country/state, and authenticated user groups determine which targeted or closed-user-group rates may be returned. Its display guidance says logged-in deals may only be shown to users meeting the eligibility criteria, labels the deal, and treats `deal: null` as a reason to show no discount indicator—not as proof of an unrestricted product.

The interaction progressively deepens policy information. Search/availability can return a basic cancellation type and free-cancellation deadline; order preview returns the applied policy and fees before booking. The pattern is:

1. do not advertise an exclusive price to an unqualified audience;
2. identify why a visible price is special at the price-selection point; and
3. repeat and expand the selected product's consequential terms before commitment.

For expaify's search → review → redirect flow, the equivalent is a compact, supplier-attributed state beside the price on results, then the complete known conditions immediately after the selected rate on review. Since expaify cannot verify Booking.com identity, it must never imitate the authenticated-deal behavior merely by showing “member price.”

### 3.2 Expedia Rapid: attach conditions to the rate and verify the selection

Rapid Shopping returns room-specific rates with promotion/refundability information and tokenized links. Its launch requirements require cancellation policy or a non-refundable tag before purchase, and Price Check verifies the selected rate before booking. Rapid also separates an unavailable reason from an available rate and notes that only one unavailable reason may be returned even when several restrictions apply.

The useful pattern is structural:

- restriction and refundability are attributes of a specific rate, not a generic hotel disclaimer;
- a concise state appears while choosing;
- the selected rate is checked again before commitment; and
- one returned reason must not be presented as an exhaustive account of every possible restriction.

expaify does not own the supplier checkout, so it cannot reproduce Price Check without a new provider integration. It can still preserve the same rate-level evidence into review and explicitly mark the provider as the final acceptance boundary.

## 4. Exact Gap

| Dimension | Current expaify code | Reference / supplier pattern | Delta |
| --- | --- | --- | --- |
| Data granularity | One property-level `priceFrom` offer | Selected room/rate product with conditions | Current offer is not rich enough to support populated states |
| State semantics | No field; silence | Explicit condition, explicit clear value where supported, or contractually understood null | Missing-data and unrestricted are indistinguishable |
| Result hierarchy | Price → Deal Score → CTA; restrictions absent | Exclusive/conditional reason located with rate selection | User can select an apparently public rate without seeing its condition |
| Review continuity | Price and supplier survive; eligibility cannot | Selected rate terms repeat and deepen before commitment | The most consequential rate condition is dropped at the last expaify boundary |
| Multiple restrictions | No representation | Multiple rate attributes can coexist; one unavailable reason may be incomplete | No precedence, count, or coverage rule |
| Measurement | Development-only viewed/clicked/returned calls, no reason | Funnel plus explicit failure reason or supplier status | A return is observable in code but cannot be called an eligibility reversal |

## 5. Design Directives for UXDES

These five directives are specific and testable. They define behavior and final copy rules; UXDES still owns layout and token-level specification.

### Directive 1 — Model each family as three-state and derive the overall state conservatively

The four families are `membership`, `residency`, `age`, and `refundability`. Each must be `restricted`, `clear`, or `not_provided`, with supplier, offer ID, and fetched-at provenance.

Overall derivation:

- if any family is `restricted` → **Restricted rate**;
- if all four are explicitly `clear` → **No reported rate restrictions**;
- otherwise → **Restrictions not provided**.

When a known restriction coexists with unknown families, keep **Restricted rate** but add **Other eligibility details not provided** in the detailed list. Never translate an absent field, `deal: null`, a request country, or an unsupported adapter field into `clear`.

Acceptance test: fixtures covering all 3^4 family combinations produce the rule above; a single missing family makes the overall all-clear state impossible.

### Directive 2 — Put one compact overall signal beside the displayed rate, before “Review hotel”

On the collapsed hotel card, place one text-based line in the price/decision cluster before the CTA. It must remain visible without opening **Details** and understandable without color.

Final collapsed copy:

| Overall state | Copy |
| --- | --- |
| Restricted, one known condition | Use the exact condition label from Directive 3, for example **Members only** or **Non-refundable** |
| Restricted, two or more known conditions | **Restricted rate · {N} conditions** |
| All four explicitly clear | **No reported rate restrictions** |
| Partial or absent coverage, no known restriction | **Restrictions not provided** |

Do not add four chips to the 375px card. Do not use “Eligible,” “Verified eligible,” “Public rate,” or “No restrictions,” because expaify has not validated the traveler and the supplier remains the acceptance authority.

Acceptance test: at 375px and 1280px, the line appears before **Review hotel**, does not overlap the price or CTA, is exposed in the card's accessible name, and the state is identifiable with color disabled.

### Directive 3 — Repeat full conditions immediately after price on review, in hard-eligibility-first order

Add a **Rate restrictions** section directly after **Selected nightly rate** / **Rate expectation** and before the booking-partner block. Do not bury it in the offer reference or generic terms paragraph.

Order multiple known conditions as:

1. residency — **Residents of {supplier place label} only**;
2. age — **Ages {min}+ only**, **Ages {min}–{max} only**, or **Maximum age {max}** as supported;
3. membership — **{supplier membership label} members only**; and
4. commitment — **Non-refundable**.

Use the supplier's structured place, age bound, and membership label; do not invent or broaden them. Under the list, use exactly one state-specific support line:

| State | Supporting copy |
| --- | --- |
| Restricted | **Confirm you meet every listed condition before continuing. The booking partner makes the final eligibility decision.** |
| All four clear | **{Provider} reports no membership, residency, age, or non-refundable restriction for this rate. The booking partner confirms live terms.** |
| Not provided | **{Provider} did not provide complete rate restrictions. Check membership, residency, age, and refund terms before paying.** |

If some restrictions are known and other families are not provided, append **Other eligibility details not provided by {Provider}.** after the known list.

Acceptance test: a four-condition fixture renders all four once in the prescribed order on review; none is truncated or hidden behind an accordion at 375px; the same state and condition count shown on the result survive URL/context validation without changing meaning.

### Directive 4 — Keep the handoff available, but never turn evidence into traveler validation

Known or unknown restrictions do not disable **Review hotel** or **Continue to {Provider}**: expaify does not collect enough identity information to decide eligibility, and asking users to self-qualify is outside scope. The current price-plus-valid-link availability gate remains conceptually separate.

The CTA accessible name and adjacent support text must include the overall state. A restricted rate must not use success styling or a checkmark. An all-clear rate may use neutral styling but not a “verified” badge. The generic provider-confirmation copy may remain for final total and availability, but it must not replace the explicit **Rate restrictions** section.

Acceptance test: keyboard and screen-reader users encounter selected price → Rate restrictions → provider role → **Continue** in that order; all three overall states keep a reachable CTA and announce their state before the action.

### Directive 5 — Measure informed avoidance and explicit reversal, not presumed conversion loss

Instrument a production analytics sink before using funnel numbers. Reuse the existing handoff event names where practical, and add eligibility properties rather than creating parallel funnels.

Required events and properties:

| Event | When | Required non-PII properties |
| --- | --- | --- |
| `hotel_rate_eligibility_exposed` | Card signal becomes viewable | ephemeral offer key, supplier, overall state, restriction types, known count, coverage count, card position, viewport band |
| `hotel_handoff_viewed` | Review opens | same eligibility properties plus price basis/currency; this is the result → review numerator |
| `hotel_handoff_continue_clicked` | External CTA activates | same eligibility properties plus named/unnamed partner |
| `hotel_handoff_returned` | Existing continue → hidden → visible sequence completes | supplier, overall state, away-duration bucket; classify only as **observed return** |
| `hotel_handoff_return_reason_prompted` | Return reason prompt is shown | supplier, overall state, away-duration bucket |
| `hotel_handoff_return_reason_submitted` | Traveler chooses a reason | one enum: `membership_required`, `residency_required`, `age_requirement`, `non_refundable`, `price_changed`, `sold_out`, `fees_or_total`, `room_mismatch`, `just_comparing`, `other`, `prefer_not_to_say` |
| `hotel_handoff_return_reason_dismissed` | Prompt closed/skipped | supplier, overall state |

Do not collect hotel name, free text, provider URL, membership number, age, residency, or account status. Do not repeatedly prompt within the same search session.

Report these measures separately:

- **result → review rate** = unique reviewed exposed offers / unique exposed offers;
- **review → provider rate** = unique continued reviews / unique reviewed offers;
- **observed return rate** = returned handoffs / continued handoffs;
- **prompt response rate** = submitted reasons / prompted returns; and
- **reported eligibility reversal rate** = submitted membership + residency + age + non-refundable reasons / submitted reasons.

A lower result → review rate for visibly restricted offers can represent successful informed avoidance, not a defect. The repair succeeds directionally when reported eligibility reversals fall without a broad unexplained rise in `price_changed`, `sold_out`, or review abandonment. Pre/post comparisons must be segmented by supplier, overall state, restriction type, viewport, and card position. Do not claim causality from an uncontrolled pre/post shift, and never count a visibility return or a dismissed prompt as an eligibility failure.

## 6. Validation Plan for UXDES and TEST

Use provider-shaped fixtures rather than generic prose:

1. member-only, all other families not provided;
2. residence-only with a supplier place label;
3. minimum-age restriction;
4. non-refundable only;
5. all four restrictions together;
6. all four explicitly clear;
7. refundability clear but the other three not provided;
8. no family supported (current Hotellook); and
9. malformed/contradictory supplier data, which must degrade to `not_provided` and never all-clear.

For each fixture, verify collapsed card, expanded details, booking URL/context round-trip, review, CTA accessible name, 375px wrapping, 1280px hierarchy, keyboard order, and text-only comprehension.

Comprehension pass condition: after viewing the result card and review, a first-time user can state either the exact known conditions or “the provider did not give expaify complete restrictions.” They must not say that expaify verified their personal eligibility.

## 7. Boundaries, Risks, and Out-of-Scope Findings

- **Provider dependency:** Hotellook cannot populate a known restriction or all-clear state. A future HotelProvider with rate-level conditions and explicit per-family coverage is required. That is DEV/provider work, not something UI may infer.
- **Cancellation-policy ownership:** This ticket owns the concise non-refundable condition as one rate restriction. Cancellation deadlines, partial-refund schedules, penalty amounts, and payment timing remain with `docs/pipeline/cancellation-policy/` and `docs/pipeline/room-rate-clarity/`.
- **Loyalty ownership:** “Members only” means access to this displayed rate. Whether the booking earns hotel-brand points, elite credit, or benefits remains with `docs/pipeline/loyalty-benefit-clarity/` and must not be implied.
- **Guest-fit ownership:** A rate's minimum/maximum age is in scope only when supplier-provided. Party occupancy, beds, child policy, and room fit remain with `docs/pipeline/guest-room-fit/`.
- **No booking-success claim:** expaify has no provider callback or completed-booking signal. The proposed measurement can describe handoff, observed return, and self-reported reason—not purchase conversion or confirmed supplier rejection.
- **Upstream recovery:** the discovery artifact was absent from this branch at start. It was restored unchanged from the repository's monitor auto-commit `b48fc5c`, which contains only `docs/pipeline/rate-eligibility/01-discovery.md`.

## 8. First-Party Sources

Accessed 2026-07-22.

- [Booking.com Demand API — Discounts and rates](https://developers.booking.com/demand/docs/accommodations/discounts)
- [Booking.com Demand API — Displaying discounts](https://developers.booking.com/demand/docs/accommodations/display-discounts)
- [Booking.com Demand API — Search for accommodation](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties)
- [Booking.com Demand API — Cancellation policies](https://developers.booking.com/demand/docs/orders-api/cancellation-policies)
- [Booking.com Demand API — Displaying pricing information](https://developers.booking.com/demand/docs/accommodations/display-prices)
- [Expedia Rapid Lodging — Shopping](https://developers.expediagroup.com/rapid/lodging/shopping/about-shopping-api)
- [Expedia Rapid Lodging — Launch requirements](https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs)
- [Expedia Rapid Lodging — Constructing cancellation policies](https://developers.expediagroup.com/rapid/lodging/shopping/constructing-cancellation-policies)
- [Duffel Stays — Key concepts](https://duffel.com/docs/api/overview/stays-key-concepts)
- [Duffel Stays — Displaying the cancellation timeline](https://duffel.com/docs/guides/displaying-the-cancellation-timeline)

## Handoff

Create `UXDES-RATE-ELIGIBILITY-01` to turn the three-state semantics, exact copy, hierarchy, responsive behavior, keyboard/focus treatment, and measurement states above into an implementation-ready design specification. The design must treat **Restrictions not provided** as the only currently reachable Hotellook state and identify populated states as provider-dependent.

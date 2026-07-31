# UXR-HOTEL-CANCELLATION-FLEXIBILITY-01 — Hotel Cancellation Flexibility Clarity

**Stage:** UX Research · **Priority:** P0 · **Upstream:** `docs/pipeline/hotel-cancellation-flexibility/01-discovery.md`  
**Date:** 2026-07-31  
**Method:** source audit of the active deal feed, hotel provider, shared offer contract, hotel card, saved-deal detail, booking context, handoff, and analytics allowlist; adjacent-pipeline review; official API-pattern comparison against Booking.com Demand API and Expedia Rapid Lodging.

## Research decision

The presentation hypothesis is **conditionally supported at the interaction-pattern level, but cannot be implemented or product-validated with expaify's current data**.

Showing two same-product rates side by side, with the flexibility premium and provider-stated cancellation outcome in the same decision unit, is the correct pattern to test. Booking.com and Expedia both attach cancellation terms to a specific product/rate rather than to the property. However, expaify currently has neither two bookable hotel rates nor the identifiers and attributes required to prove they are like-for-like. Its only active hotel adapter returns one cached property `priceFrom`; the active deal feed persists one observed property price and creates generic OTA search links.

Therefore:

- **Do not ship a flexible-versus-restricted selector, comparison card, filter, badge, or computed premium now.** Populated comparison states would be fabricated.
- **Do preserve the comparison hypothesis as a gated future state.** UXDES may specify the eligibility logic and research fixtures, but its current-runtime design must fail closed to a single honest absence state.
- **Do not duplicate the cancellation-policy taxonomy.** Deadline, cancellation charge, no-show charge, partial/conflicting evidence, and honest absence remain owned by `docs/pipeline/hotel-cancellation-clarity/02-research.md`. This brief owns only whether two rates qualify for a flexibility comparison and how that tradeoff is framed and measured.

This is a repair finding, not approval for a new provider integration or new comparison feature.

## 1. Current-code evidence

### 1.1 The active customer surface is a saved-deal feed, not the richer `HotelCard` search path

The active `/deals` feed renders `app/components/ui/DealCard.tsx`, whose data contract contains one `dealPrice`, one historical `medianPrice`, a check-in window, and generic OTA links (`DealCard.tsx:17–34`). The card shows the observed price and the historical comparison, then either `View deal` or `CompareRow` (`:83–130`). It has no room, rate-plan, occupancy, inclusion, rate ID, refund outcome, or cancellation-policy field.

The snapshot pipeline confirms that this is one property-level observation:

- `lib/pipeline/dealDetection.ts:9–20` reads one `latest_price_cents` per hotel/check-in grouping.
- `:93–114` persists one `deal_price_cents`, `median_price_cents`, and generic `ota_links` into `deals`.
- `DealRow` at `:155–175` has no selected room/rate or cancellation evidence.

The visible “usually” price is a historical baseline for Deal Score; it is **not a second live rate choice**. It must never be relabeled as the price of a flexible room.

### 1.2 The only `HotelProvider` returns cached property pricing, not rate products

`lib/providers/hotellook.ts` is the only hotel adapter in the provider path. Its parsed response shape has `hotelId`, property attributes, and `priceFrom`, but no room ID, rate ID, occupancy, inclusions, taxes/fees total, refundability, deadline, charge, or no-show outcome (`hotellook.ts:23–42`).

The adapter:

- calls only `https://engine.hotellook.com/api/v2/cache.json` (`:18`, `:474–481`);
- maps one `priceFrom` into `pricePerNight` (`:499`, `:516–519`);
- builds a property deeplink containing a hotel ID but no selected-room or rate token (`:436–437`, `:520`);
- hardcodes `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` (`:409`, `:540`); and
- returns search coverage as `unconfirmed` (`:468`, `:550`).

Travelpayouts' own API reference describes this cache request as cached hotel-room pricing and explicitly says it does not contain room-availability information. Its example response contains `priceFrom`, `priceAvg`, percentiles, and property fields—not bookable rate alternatives. This corroborates the code contract; it does not expand it. [Travelpayouts Hotels Data API](https://travelpayouts.github.io/slate/#displays-the-cost-of-living-in-hotels)

No other file in `lib/providers/` implements a live hotel rate-shopping contract. `bookingComRapidApi.ts` implements `FlightProvider`; Amadeus, Duffel, Kiwi, and Travelpayouts are flight providers. Provider support for the proposed comparison is therefore **zero**.

### 1.3 `HotelOffer` cannot prove like-for-like or carry a policy schedule

`HotelOffer` has one `pricePerNight` and an optional fixed price basis (`per_night_before_taxes_fees`) (`lib/types.ts:556–578`). It has no:

- stable room/product/rate identifier;
- stay dates or occupancy bound to the price;
- room basis, bed basis, board/inclusion set, or payment timing;
- total-stay price or tax/fee inclusion basis;
- cancellation policy object, absolute deadline, cancellation charge, refund outcome, or no-show outcome; or
- collection of alternative rates for one property.

The adjacent `rateEligibility.refundability` field is only `restricted | clear | not_provided` (`lib/types.ts:440–471`). Its evidence shape has no cancellation-specific qualifier, and `lib/hotels/rateEligibility.ts:57` deliberately reduces refundability to bare `restricted`. It cannot support “free until X, then Y” or compare two policy schedules.

### 1.4 None of the rendered surfaces can answer the ticket's decision question

| Surface | Current evidence | Exact gap |
|---|---|---|
| Active result card | One observed nightly price versus a historical median (`DealCard.tsx:83–107`). | The two numbers compare **now versus normal**, not restricted versus flexible. No rate choice exists. |
| Saved-deal detail | One “Observed nightly rate,” explicitly before taxes and fees (`app/deals/[dealId]/page.tsx:373–390`). | No room/rate identity, flexibility premium, deadline, or consequence. |
| Rich `HotelCard` path | One `HotelOffer.pricePerNight`; a generic eligibility chip can say `Non-refundable` or `Restrictions not provided` (`HotelRateRestrictions.tsx:118–150`). | The live adapter always resolves to `not_provided`; there is no paired rate. Cancellation is incorrectly mixed with booking eligibility. |
| Booking review | Copy says the provider shows room options and cancellation policy after handoff (`BookingFlow.tsx:1124–1128`), followed by `HotelRateRestrictionsSection` (`:1158–1169`). | First meaningful comparison occurs outside expaify; the review context still contains one price and no room/rate ID. |

The saved-deal page also states that the “provider confirms room-level details” (`app/deals/[dealId]/page.tsx:366–369`). That is accurate disclosure of absence, but it does not let a traveler evaluate flexibility before leaving.

### 1.5 Current analytics cannot validate the hypothesis

The server route has a strict event/property allowlist (`app/api/analytics/route.ts:12–50`, `:58–91`). Existing events can observe the surrounding funnel:

- `hotel_result_card_opened`
- `hotel_detail_viewed`
- `hotel_provider_handoff_clicked`
- `hotel_handoff_viewed`
- `hotel_handoff_continue_clicked`
- `hotel_handoff_returned`
- `hotel_handoff_back_clicked`

There is no event for comparison eligibility, policy exposure, selected rate, correct policy comprehension, or clarification. Existing handoff return events also have no policy-specific reason. No current baseline can be claimed for “clarification exits.”

## 2. Reference-pattern guidance

This section is external guidance, not evidence about expaify's implementation.

### Booking.com Demand API: policy is product-scoped and becomes more specific toward commitment

Booking.com's current Demand API returns a cancellation policy per accommodation product. At pre-booking, search/availability can return a policy type and `free_cancellation_until`; at preview, the product returns a schedule of effective times and charges. Booking.com explicitly notes that policies can vary per room/product. [Booking.com cancellation policies](https://developers.booking.com/demand/docs/orders-api/cancellation-policies-3.1), [Booking.com Orders FAQ](https://developers.booking.com/demand/docs/orders-api/orders-faqs)

Interaction implication: the cancellation claim belongs to the selected rate product, and the deadline is the primary concise fact. Detailed charges can progressively disclose, but they must remain associated with that same product.

### Expedia Rapid Lodging: one boolean is insufficient

Expedia Rapid constructs each rate's cancellation policy from `refundable`, `cancel_penalties`, and `nonrefundable_date_ranges`; non-refundable stay-date ranges can override other penalty rules. [Expedia Rapid cancellation-policy guidance](https://developers.expediagroup.com/rapid/lodging/shopping/constructing-cancellation-policies?locale=en_US)

Interaction implication: “refundable” alone is not enough to compare choices. A usable comparison needs the applicable window and consequence, and it must not flatten partial or date-dependent policies into a binary badge.

### Synthesized pattern and delta

| Interaction dimension | Booking.com / Expedia pattern | expaify today | Delta |
|---|---|---|---|
| Comparison unit | A specific room/product/rate. | A property-level cached or snapshotted price. | No common product unit. |
| Choice | Multiple rate products may differ in policy and price. | One observed price; historical median is not bookable. | No flexibility choice. |
| Primary policy fact | Refundability outcome plus absolute deadline when applicable. | At most a generic `Non-refundable` eligibility condition; live data is absent. | No deadline or attributed outcome. |
| Consequence | Time-based charge schedule or non-refundable date range. | No cancellation charge/refund/no-show shape. | Binary cannot represent the policy. |
| Commitment | Product policy is repeated/expanded before booking. | Provider-deferential prose before outbound handoff. | Decision is exported to the provider. |

The transferable pattern is **rate-scoped, deadline-first comparison with progressive detail**. The references' visual styling and confident booking-surface voice are not transferable: expaify is metasearch and may state only adapter-supported facts with source attribution.

## 3. Like-for-like eligibility definition

Two offers may be shown as a cancellation-flexibility tradeoff only if **every** field below is present, provider-supported, and exactly equal after conservative normalization:

1. Property ID and supplier.
2. Check-in, check-out, and stay length.
3. Occupancy: adult count, child count and child ages, plus room count.
4. Room/product basis: provider room ID, room name, bed configuration, and occupancy capacity.
5. Inclusions: board/meal plan and every price-bearing inclusion or credit.
6. Price basis: total-versus-nightly basis, included/excluded taxes and fees, pay-now/pay-later timing, and currency.
7. Freshness: both rates returned by the same live shopping response or refresh token/version.

The rates must also have distinct stable rate IDs and distinct provider-supported cancellation outcomes. The cancellation schedule itself is **allowed to differ**; that is the variable being compared.

Any missing, stale, conflicting, or unequal comparison field makes the pair ineligible. Equality of marketing room names alone is insufficient. Cross-provider pairing is out of scope until expaify has a provider-neutral reconciliation contract; differences in inventory, taxes, payment timing, and policy interpretation make “same room” unsafe to infer.

Price comparison is permitted only on a consistent total-stay basis using integer `Money`. The flexibility premium is:

`flexible total price − restricted total price`

It may also be divided by a known positive night count for supporting “per night” copy, but the total premium remains primary. It must never be computed from the current historical median or from two prices with different tax/fee bases.

## 4. Presentation-hypothesis validation

### Desk validation result

The hypothesis passes a **pattern and internal-validity check** under the strict eligibility gate:

- Co-location reduces the memory burden of comparing price on one surface and policy on another.
- A visible total premium answers “what does flexibility cost?” directly.
- Deadline and consequence prevent the favorable-sounding but incomplete interpretation of a generic `Refundable` label.
- Holding property, stay, occupancy, room, inclusions, currency, price basis, and freshness constant isolates cancellation flexibility as the meaningful difference.

It fails when any gate field differs. In those cases, showing the pair as “cheaper restricted versus pricier flexible” would misattribute some or all of the price difference to cancellation.

This is not behavioral validation. No participant sessions or product events were available in this stage, so no comprehension, confidence, or exit-rate uplift is claimed.

### Required prototype test before feature approval

Use a controlled, non-production prototype with three randomized scenarios. Do not use live provider brands or imply that the fixtures are bookable.

| Scenario | Fixture | Correct behavior / answer |
|---|---|---|
| A — eligible pair | Same property, dates, occupancy, room/bed, inclusions, currency, total-price basis, source response; $420 non-refundable versus $468 free until Fri, 14 Aug, then $468 charge. | Participant can identify the $48 total flexibility premium, deadline, and consequence, then choose either rate with a coherent reason. |
| B — false pair | $420 room-only queen versus $468 breakfast-included king, with different cancellation policies. | UI does not label the $48 as a flexibility premium; participant recognizes that the products differ. |
| C — incomplete policy | Same product and prices, but the “flexible” rate has a deadline and no post-deadline charge from the provider. | UI names the missing charge; participant does not claim full refundability after the deadline. |

Run the task with 8–12 first-time hotel bookers, including at least four people who describe their plans as likely to change, on both 375px and desktop layouts. Capture choice, verbal explanation, correction/help use, time to answer, and a supporting 1–5 confidence rating.

**Advance threshold:**

- at least 80% correctly identify the total premium, deadline, and post-deadline consequence in A;
- at least 80% reject a pure-flexibility interpretation in B;
- at least 80% correctly name the missing fact in C;
- zero participants interpret missing policy data as free cancellation; and
- no material mobile/desktop comprehension gap (greater than 15 percentage points).

Failing any threshold returns the presentation to UXDES. These thresholds validate comprehension, not legal interpretation or the commercial value of a provider integration.

## 5. Design directives for UXDES

### D1 — Gate comparison eligibility before rendering any flexibility choice

Create one pure eligibility outcome: `eligible | not_comparable | insufficient_evidence | stale_or_conflicting`. It must evaluate all fields in §3 before UI rendering.

- `eligible`: render the two-rate tradeoff.
- `not_comparable`: rates are valid but at least one product attribute differs. Do not calculate or display a flexibility premium.
- `insufficient_evidence`: a required identity, basis, or policy field is absent. Do not render an empty comparison table.
- `stale_or_conflicting`: rates come from different freshness versions or evidence conflicts. Suppress comparison and require refresh/provider confirmation.

**Current-runtime result:** every Hotellook and saved-deal offer resolves to `insufficient_evidence`. Exact current copy: **“Cancellation choices are not available for this observed price. Compare room rates and cancellation terms with the booking partner.”**

**Testable:** no `DealCard`, saved-deal detail, `HotelCard`, or handoff state can show `Flexible option`, `Lower price`, or a premium when eligibility is not `eligible`; the historical median is never accepted as a candidate rate.

### D2 — For an eligible pair, frame one variable: total price for cancellation flexibility

The comparison unit is two rate rows under a shared “Same stay and room” summary. Show only provider-supported facts, in this fixed hierarchy:

1. **Total stay price** — primary, with taxes/fees basis adjacent.
2. **Cancellation outcome** — `Non-refundable`, `Partially refundable`, or `Free cancellation until {absolute date}`.
3. **After-deadline consequence** — provider-stated cancellation charge or `Cancellation charge not provided`.
4. **Source and freshness** — provider name and checked time.

Between rows, show **“{Money} more for cancellation flexibility”**, where `{Money}` is the total-stay difference in the same currency and basis. Avoid `Flexible rate` as a standalone promise, `Refundable` without a deadline, and any computed refund amount.

**Testable:** changing room, inclusion, occupancy, currency, price basis, payment timing, or freshness in a fixture suppresses the premium; a valid $420/$468 fixture renders `$48 more for cancellation flexibility`, not a percentage-only claim.

### D3 — Incomplete policy evidence stays visible and never rounds up

Inherit the state taxonomy and exact policy lexicon from `hotel-cancellation-clarity/02-research.md`. Within this comparison:

- missing deadline: `Cancellation deadline not provided`;
- missing post-deadline charge: `Cancellation charge not provided`;
- explicit non-refundable provider outcome: `Non-refundable`;
- conflicting evidence: `Cancellation terms conflict — compare with the booking partner`.

A missing fact does not automatically make two products comparable. If the missing fact prevents the user from identifying the flexibility tradeoff, the overall result is `insufficient_evidence`, and only the absence copy from D1 renders.

**Testable:** partial evidence never renders `Free cancellation`, `Fully refundable`, or a favorable color-only signal; screen-reader text names the missing/conflicting fact.

### D4 — Keep the comparison at the decision point and repeat the selected outcome at handoff

If a future approved provider makes `eligible` reachable:

- results/detail: show the eligible comparison before the outbound provider CTA;
- selection: one row is chosen with a native radio control or equivalent single-select semantics; price and policy remain in the accessible name/description;
- handoff: repeat selected total price, cancellation outcome, deadline, and provider-stated consequence before “Continue”; and
- mobile 375px: stack complete rate rows vertically; never split a row into horizontally scrollable policy columns.

For current data, render only D1's concise absence disclosure on detail/handoff. Do not repeat four empty subfields on every result card; that would add density without a decision.

**Testable:** keyboard users can traverse and select exactly one eligible rate, focus remains visible, DOM order matches visual order, and the handoff summary matches the selected rate ID. At 375px no policy string truncates or overlaps the price.

### D5 — Instrument exposure, eligibility, selection, comprehension proxy, and exits without policy text

Register every event and allowed/required property server-side before emission. Never send provider policy prose, hotel names, or dates as analytics values.

- `hotel_cancellation_comparison_evaluated` — `surface`, `eligibility_state`, `failure_reason`, `provider`, `viewport_group`
- `hotel_cancellation_comparison_viewed` — `surface`, `provider`, `premium_bucket`, `restricted_policy_state`, `flexible_policy_state`, `viewport_group`
- `hotel_cancellation_rate_selected` — `surface`, `provider`, `selected_policy_state`, `premium_bucket`, `selection_changed`
- `hotel_cancellation_handoff_continued` — `provider`, `selected_policy_state`, `premium_bucket`, `policy_details_seen`
- `hotel_cancellation_clarification_opened` — `surface`, `provider`, `missing_fact`, `eligibility_state`

Use bounded categories: `premium_bucket = 0 | 1_25 | 26_50 | 51_100 | 101_plus`; `failure_reason = product_mismatch | basis_mismatch | missing_identity | missing_policy | stale | conflicting | current_provider_unsupported`. Join to the existing handoff return funnel by a non-PII session/offer context already permitted by the analytics architecture; do not infer that every return was caused by cancellation.

**Testable:** current unsupported offers emit `comparison_evaluated` with `insufficient_evidence/current_provider_unsupported` but never `comparison_viewed`; an eligible fixture emits at most one view per offer/surface exposure; route tests reject raw policy text and unregistered properties.

## 6. Scope and dependency call

UXDES may proceed only as a **contract-and-absence-state spec**. A populated production comparison is blocked pending all of the following:

1. an explicitly approved live hotel rate-shopping provider behind `HotelProvider`;
2. a provider contract returning multiple rate products, stable room/rate IDs, full comparison fields, structured cancellation evidence, and affiliate-safe selected-rate deeplinks;
3. integer-minor-unit total pricing with a consistent taxes/fees and payment basis;
4. the prototype comprehension test in §4 meeting its thresholds; and
5. coordination with `hotel-cancellation-clarity` so one cancellation taxonomy and one evidence component serve card, detail, comparison, and handoff.

Out of scope: interpreting whether a provider policy is legally enforceable; calculating a refund; comparing rates across providers; changing providers; building a room inventory browser; or fixing the existing URL-provenance risk identified in `hotel-cancellation-clarity/02-research.md`.

## Handoff

**Next ticket:** `UXDES-HOTEL-CANCELLATION-FLEXIBILITY-01`

UXDES should specify the strict comparison gate, current unsupported-provider absence state, eligible research-fixture state, partial/conflicting behavior, 375px/1280px and keyboard behavior, final UI copy, and analytics contract. It must not present populated rate comparisons as shippable against the current Hotellook or saved-deal contracts.

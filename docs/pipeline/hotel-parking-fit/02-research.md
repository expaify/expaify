# UX Research — Hotel Parking Fit

**Ticket:** `UXR-HOTEL-PARKING-FIT-01`  
**Stage:** UX Research  
**Priority:** P0  
**Date:** 2026-07-22

## Source inputs

- Discovery: `docs/pipeline/hotel-parking-fit/01-discovery.md`
- Current code audited directly:
  - `lib/types.ts`
  - `lib/providers/hotelAmenityEvidence.ts`
  - `lib/providers/hotellook.ts`
  - `app/api/search/route.ts`
  - `app/components/HotelCard.tsx`
  - `app/components/__tests__/HotelCard.accessEvidence.test.tsx`
  - `lib/booking/config.ts`
  - `app/book/BookingFlow.tsx`
  - `app/book/__tests__/BookingFlow.test.tsx`
  - `lib/analytics.ts`
  - `app/page.tsx` and `app/deals/DealFeed.tsx` for live-surface verification
- Settled upstream evidence discipline reused rather than forked:
  - `docs/pipeline/hotel-amenity-provenance/02-research.md`
  - `docs/pipeline/hotel-access-requirements/02-research.md`
  - `docs/pipeline/hotel-amenity-fit/02-research.md`
- Current reference sources, evaluated at the interaction and data-semantics level:
  - Booking.com Demand API, [Retrieve accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details)
  - Booking.com Connectivity, [ParkingFeePolicy](https://developers.booking.com/connectivity/docs/api-reference/parkingfeepolicy)
  - Expedia Group Rapid, [Content reference lists](https://developers.expediagroup.com/rapid/lodging/content/content-reference-lists?locale=en_US)
  - Expedia Group Rapid, [Property Message Center](https://developers.expediagroup.com/rapid/lodging/manage-booking/property-message-center?locale=en_US)

## Research question

Can a driver compare and carry forward the true parking fit of a hotel—facility, selected-stay space, location, cost and basis, reservation rule, operator, and evidence source—without reading a property-level parking fact as a promise that a space will be available?

## Research summary

No. The current implementation has a conservative property-level signal, but it is not a parking decision model.

Today expaify can preserve one canonical parking fact, `on_site_parking`, with provider source, property scope, status, coarse fee state, and a `guaranteed` or `requestable` certainty. `HotelCard` can show a collapsed **On-site parking** chip only for a provider-attributed, confirmed property fact and correctly warns assistive-technology users to review fees and space availability. Expanded details distinguish confirmed, requestable, unavailable, unclear, and not-returned access evidence. This is a useful trust foundation.

However, the same object is being asked to represent two different claims: **a parking facility is documented** and **a usable space exists for these dates**. It cannot express a nearby option, exact charge or charge basis, reservation rule, operator, or selected-stay space state. Parking evidence is also dropped before the `/book` review, and no parking-specific interaction or post-review sequence is measured.

Reference supply validates the proposed dimensions but also shows why a single boolean is unsafe. Booking.com's current accommodation-details vocabulary exposes parking as a list with `price`, `charge_mode`, `type`, `location`, and `reservation`; its connectivity vocabulary separately supports on-site/nearby/none, reservation needed/not needed/not available, and public/private. Expedia's content model distinguishes property-, room-, and rate-level amenities, and its post-booking messaging guidance treats parking options, reservations, hours, and nightly/hourly costs as details that may need direct property coordination. Neither `public/private` nor an amenity category proves who operates the parking, and property content still does not prove a space for a selected stay.

The smallest safe solution is therefore an **array of normalized parking options** plus a separate selected-stay space state. Every dimension must permit `unknown` or `not_returned`; only explicit supplier evidence may populate it. The comparison layer should summarize location + cost + space certainty, details should expose the complete evidence, and the booking review should repeat known facts plus unresolved confirmation tasks.

## Current-code evidence

### 1. Shared types preserve provenance but collapse the parking decision

`HotelAmenityEvidence` has `id`, `label`, `status`, `scope`, `sourceLabel`, optional `fee`, `fetchedAt`, `confidence`, and `certainty` (`lib/types.ts:119-147`). The reusable status model correctly distinguishes `confirmed`, `unavailable`, `not_returned`, and `unknown`; scope already includes `property`, `room`, `rate`, and `selected_stay`.

The gap is parking-specific structure:

- The only parking identifier is the string `on_site_parking`; there is no option identity or array of distinct parking choices.
- `certainty` has only `guaranteed` and `requestable`. It does not say whether that certainty applies to facility presence, reservation workflow, or selected-stay space.
- `fee` is only `included`, `paid`, or `unknown`; there is no `{ priceCents, currency }` amount or basis.
- There is no location kind, provider-documented parking distance/address, reservation requirement, operator, or selected-stay space field.

This means `HotelAmenityEvidence` is still suitable as the common provenance envelope, but `on_site_parking` must not be stretched into the full parking contract.

### 2. Provider normalization is safe but cannot represent supplier parking vocabulary

`ACCESS_FACTS` contains one parking item, `on_site_parking`, at property scope (`lib/providers/hotelAmenityEvidence.ts:18-25`). `validConfirmedCombination` accepts only property-scoped parking with `guaranteed` or `requestable` certainty (`:70-83`). The adapter preserves `fee` only for this identifier (`:143-145`). Missing input becomes a complete set of `not_returned` facts, while malformed non-array input becomes `not_returned` evidence plus an `error` state (`:151-176`). Those defaults correctly avoid turning silence into absence.

The duplicate rule chooses the lower numeric precedence, ordered `unavailable`, `unknown`, `not_returned`, `confirmed` (`:29-34`, `:163-170`). That is conservative when contradictory evidence appears, but it also confirms the model expects one fact per canonical id; it cannot retain an on-site paid option alongside a nearby included option.

### 3. Hotellook has no native parking supply in the current integration

The live `HotelLookCacheEntry` shape includes an optional expaify-shaped `amenityEvidence` field but no native facilities or parking field (`lib/providers/hotellook.ts:12-31`). Both cached and live flows pass that field through `normalizeHotelAmenityEvidence` (`:371-392`, `:460-501`). The provider's actual base response therefore supplies no documented route to exact parking location, amount, basis, reservation rule, operator, or selected-stay space.

For the current Hotellook integration:

- facility evidence is supportable only if `amenityEvidence` has already been enriched upstream;
- exact parking details are not supportable by the declared response contract;
- comparison-ready parking coverage is effectively zero without a richer provider or enrichment source;
- selected-stay space coverage is zero because the provider contract contains no stay-scoped parking inventory.

The correct current default is **Parking details not provided**, not **No parking**.

### 4. Search streaming exposes a general access state, not parking completeness

`GET /api/search` sends `hotel-access-status: loading`, streams hotel offers, then resolves the general access state to `ready` or `error` (`app/api/search/route.ts:396-416`). This can support a parking loading/error treatment indirectly, but it does not report parking completeness, comparison readiness, or selected-stay coverage. An access state of `ready` can legitimately contain all parking fields as `not_returned`.

### 5. The card protects against one false promise but hides critical deltas

`HotelCard` re-normalizes access evidence, rejects invalid source/scope/certainty combinations, and fills missing canonical facts with `not_returned` (`app/components/HotelCard.tsx:47-113`). The parking fee copy has only three outcomes: included, additional charge applies, or not documented (`:115-119`).

Collapsed behavior is deliberately narrow. The card shows at most one access chip, preferring elevator over on-site parking; parking appears only when it is confirmed, guaranteed, property-scoped, and sourced (`:737-750`). Its accessible name says the provider confirms the property has on-site parking and instructs the user to review fees and space availability in details (`:746-750`). Consequently:

- a driver may see no parking signal because elevator won the single-chip slot, not because parking is absent;
- nearby parking can never appear;
- paid parking with an unknown amount looks identical across hotels;
- selected-stay certainty cannot be compared.

Expanded **Access & room requests** supports loading, error, all-not-returned, all-unknown, confirmed, requestable, and unavailable states (`:250-320`). Confirmed parking copy states that the property has on-site parking and labels it a property-level fact that must be confirmed for the specific room/rate (`:147-152`, `:194-208`). Requestable copy includes the exact no-guarantee clause (`:124-138`). Tests explicitly guard these rules and responsive one-column/two-column behavior (`app/components/__tests__/HotelCard.accessEvidence.test.tsx:83-319`).

The remaining UX gap is hierarchy. Parking is one row among elevator and room requests, so the user cannot scan a complete parking option as a unit. Location, cost, reservation, operator, and selected-stay space are absent rather than explicitly unknown.

### 6. Booking review drops all parking evidence

`BookingHotelContext` contains hotel identity, provider, name, location, nightly price, price basis, and provider URL, but no amenity or parking evidence (`lib/booking/config.ts:30-41`). `buildHotelBookingHref`, parsing, and validation serialize only those fields (`:377-447`, `:470-506`).

`HotelSummary` repeats rate and location evidence only (`app/book/BookingFlow.tsx:235-281`). The provider-confirmation block names final total, taxes, fees, room availability, and cancellation policy, but not parking (`:725-733`). A general **Special requests** section explains that requests are not guaranteed (`:735-760`), yet it does not carry the selected hotel's known parking facts or name the unresolved parking check.

This creates an evidence discontinuity: a user can review parking on the result card, select the hotel, and then encounter a review page that behaves as if parking had never been assessed.

### 7. Analytics cannot measure parking review or a post-review decision

The handoff currently emits `hotel_handoff_viewed`, `hotel_handoff_continue_clicked`, `hotel_handoff_back_clicked`, and `hotel_handoff_returned`; its bounded properties cover source, partner host, currency, price, price basis, and location precision (`app/book/BookingFlow.tsx:569-693`). The general special-request block has a 50%-visible-for-one-second reach rule, which is a useful precedent (`:588-626`).

No result-card parking impression, parking-detail open, parking-section reach, or evidence-completeness property exists. `lib/analytics.ts` only logs in development, so these events currently establish an instrumentation contract, not a production telemetry pipeline.

### 8. The audited result card is not mounted on a current live page

A repository-wide component search finds `HotelCard` only in its own file and tests; neither `app/page.tsx` nor `app/deals/DealFeed.tsx` mounts it. `/api/search` still emits hotels, but the current `app/page.tsx` is a marketing page and `DealFeed` renders a different deal-card system.

This does not invalidate the component-level findings, but it changes measurement readiness: no card-impression or section-reach denominator is valid until a scoped implementation mounts the parking surface in a real user flow. Surface wiring is a delivery dependency, not work for this UXR ticket.

## Reference-pattern comparison

### Pattern 1 — Booking.com: structured facility detail, separate from stay inventory

Booking.com's current accommodation-details guide returns `parking_facilities` as a list rather than one property boolean. Its documented fields cover price, charging model, type, location, and reservation. The example distinguishes a public, nearby facility where reservation is not possible and charges may apply. The separate connectivity contract supports parking type `on_site`, `location_nearby`, or `none`; reservation `needed`, `not_needed`, or `not_available`; and parking property `public` or `private`.

Interaction guidance for expaify:

- Present each usable parking option as a coherent group of facts.
- Put location, cost, and reservation rule together; users should not assemble them from unrelated amenity rows.
- Preserve explicit negative values such as no parking or reservation not possible.
- Do not infer selected-stay space from the property-details response. The reference describes a facility policy, not a held space for the user's dates.
- Do not map `public` to third-party or `private` to hotel-operated. Access classification is not operator identity.

Current delta: expaify has one `on_site_parking` fact and a coarse fee state. It cannot retain multiple options or any of Booking.com's location/reservation/type structure.

### Pattern 2 — Expedia Group: scope-aware content with post-booking coordination

Expedia Rapid documents amenities at property, room, and rate-plan scope and treats them as complimentary only when no surcharge or restriction is specified. Its Property Message Center guidance identifies parking options, reservation instructions, operating hours, and nightly/hourly charges as information properties may share, and recommends a direct property message path after booking when travelers need confirmation.

Interaction guidance for expaify:

- Keep property facility content separate from rate/stay evidence.
- If the normalized contract lacks a parking charge or restriction, do not infer included/free.
- Carry unresolved parking work into handoff as a concrete confirmation task, not a generic disclaimer.
- Post-booking coordination is a legitimate later resolution path; pre-booking expaify must still show what is known versus unresolved.

Current delta: expaify already has a scope enum and conservative fee default, but the booking review drops the evidence and offers only generic special-request guidance.

## Exact gap

| Decision dimension | Current expaify code | Reference-supported pattern | Required delta |
|---|---|---|---|
| Facility | One `on_site_parking` fact with explicit status | Zero or more structured parking facilities/options | Preserve multiple normalized options and explicit no-facility evidence |
| Selected-stay space | Cannot represent it for parking | Property details do not imply stay inventory | Separate `selectedStaySpace`; default unknown/not returned; populate only from date/rate-scoped evidence |
| Location | Implied on-site by canonical id | On-site, nearby/off-site, none; street may be separately classified | Explicit location kind; never collapse nearby/street into on-site |
| Cost | Included/paid/unknown only | Charge model and sometimes price; hourly/nightly details may arrive separately | Integer-minor-unit amount plus explicit basis when documented; paid without amount remains unknown amount |
| Reservation | Misuses `certainty=requestable` as the only process signal | Needed, not needed, not possible | Dedicated reservation rule; do not equate “not possible” with “space unavailable” |
| Operator | Absent | Public/private is available in some supply, but is not operator | `hotel_operated` / `third_party` / `unknown`; populate only from explicit operator evidence |
| Provenance | Source, scope, confidence, fetched time | Structured facility source plus possible later property communication | Preserve source and freshness per option/dimension; do not merge conflicting providers silently |
| Unknowns | General access unknown/not returned | Sparse fields and later clarification are normal | Show critical unknowns in comparison, detail, and handoff; never omit them as if resolved |

## Validated provider-neutral contract

The contract must support multiple options because a property can have on-site and nearby parking with different cost or reservation rules. It should reuse `HotelEvidenceStatus`, `HotelEvidenceScope`, `HotelAmenityConfidence`, and `Money` rather than create a competing provenance model.

```ts
type ParkingLocationKind = 'on_site' | 'nearby_off_site' | 'street' | 'unknown'

type ParkingSpaceState =
  | 'confirmed_for_selected_stay'
  | 'unavailable_for_selected_stay'
  | 'not_returned'
  | 'unknown'

type ParkingReservationRule =
  | 'required'
  | 'not_required'
  | 'not_possible'
  | 'available_on_request'
  | 'first_come_first_served'
  | 'unknown'

type ParkingOperator = 'hotel_operated' | 'third_party' | 'unknown'
type ParkingCostState = 'included' | 'paid' | 'unknown'
type ParkingCostBasis = 'per_night' | 'per_stay' | 'per_entry' | 'per_hour' | 'unknown'

interface HotelParkingOptionEvidence {
  id: string
  facilityStatus: HotelEvidenceStatus
  facilityScope: 'property'
  selectedStaySpace: ParkingSpaceState
  location: {
    kind: ParkingLocationKind
    distance?: HotelLocationDistance // provider_documented only for parking
    address?: string
  }
  cost: {
    state: ParkingCostState
    amount?: Money
    basis: ParkingCostBasis
  }
  reservation: ParkingReservationRule
  operator: ParkingOperator
  sourceLabel: string
  fetchedAt?: string
  confidence?: HotelAmenityConfidence
}
```

Normalization rules:

1. `facilityStatus=confirmed` says only that the supplier documents an option. It never changes `selectedStaySpace`.
2. `selectedStaySpace=confirmed_for_selected_stay` requires explicit date/rate/stay-scoped supplier evidence. A property facility, a reservation rule, or `available_on_request` cannot populate it.
3. `facilityStatus=unavailable` is an explicit supplier statement of no facility/option; missing or malformed data becomes `not_returned` or `unknown`.
4. `cost.amount` is valid only as `{ priceCents: integer, currency }`. If the supplier says charges may apply or paid but gives no reliable amount/basis, keep `state=paid`, omit `amount`, and use `basis=unknown`.
5. `reservation=not_possible` means advance reservation is not accepted. It does not mean no space exists, nor does it prove first-come-first-served unless that wording is explicit.
6. `public/private` supply must not populate `operator`. Hotel-operated versus third-party requires explicit operator evidence.
7. Nearby distance/address may be shown only when provider documented; do not calculate a parking distance from the hotel's coordinates.
8. Conflicting or duplicate options must not use the current destructive one-id precedence. Retain distinct options; if two records appear to describe the same option and conflict, downgrade the conflicting dimension to `unknown` and preserve provenance for audit.

### Supply readiness by field

| Contract field | Current Hotellook path | Booking reference vocabulary | Dependency |
|---|---|---|---|
| Facility status | Partial only through optional enriched `amenityEvidence` | Supported | Provider mapping can support later |
| Selected-stay space | Not supported | Not established by property details | Requires a live inventory/confirmation source; remain unknown now |
| On-site vs nearby | On-site only through canonical id | Supported | Richer provider/DEV mapping needed |
| Street | Not supported | Can exist as a separate parking service/policy, not safely inferable from current sample | Explicit supplier mapping needed |
| Exact amount | Not supported | A price field exists, but charge semantics must be validated | Richer provider plus money/basis validation needed |
| Basis | Not supported | Not complete in the property-detail example; Expedia messaging recognizes nightly/hourly wording | Explicit structured basis or conservative unknown |
| Reservation rule | Only ambiguous `requestable` certainty | Supported | Dedicated field and provider mapping needed |
| Operator | Not supported | Public/private does not establish operator | Remain unknown until explicit operator supply exists |
| Source/freshness | Supported | Supported conceptually | Reuse current provenance fields |

The contract is validated as the smallest safe *decision* model, but current provider coverage cannot fill most of it. UXDES must design the unknown-dominant state as the default release state, not a fallback.

## Design directives for UXDES

### 1. Make the collapsed signal a three-part decision summary, not a parking boolean

When at least one parking facility is explicitly documented, the result card may show one parking summary after location/quality and before actions. Its accessible and visible meaning must include:

- location: `On-site parking` or `Nearby parking`; never generic `Parking` when location is known;
- cost: `included`, exact documented amount + basis, `paid — amount not provided`, or `cost not provided`;
- space: `space confirmed for these dates` only for explicit selected-stay evidence; otherwise `space not confirmed`.

If no facility data was returned, show at most one neutral comparison line: **Parking details not provided**. If the provider explicitly reports no option, show **[Provider] reports no parking option at this property**. Missing, unknown, and unavailable must be distinguishable in text, not only color or icon. At 375px the summary must wrap below the hotel identity without displacing nightly rate, Deal Score, or **Review hotel**; at 1280px it may remain one compact row. Do not let elevator or another access fact suppress the parking summary when parking is the scoped surface.

**Test:** side-by-side fixtures for confirmed on-site, confirmed nearby, explicit none, and not returned produce four different visible and screen-reader interpretations; no fixture implies a space unless `selectedStaySpace=confirmed_for_selected_stay`.

### 2. Give parking a dedicated expanded section with fixed question order

Replace parking's single row inside **Access & room requests** with a dedicated **Parking** section, while leaving other access evidence in its existing panel. For every returned option, present the same order:

1. **Option:** on site / nearby / street / location not provided.
2. **Space for your stay:** confirmed / unavailable / not confirmed / provider did not provide stay-specific space information.
3. **Cost:** included / exact amount + basis / paid, amount not provided / cost not provided.
4. **Advance action:** reservation required / not required / not accepted / request available, not guaranteed / first come only / rule not provided.
5. **Operated by:** hotel / third party / operator not provided.
6. **Source:** provider and updated time when valid.

Show provider-documented distance/address only under nearby parking. Loading must preserve known stale evidence and announce **Refreshing parking details…**; initial loading says **Checking parking details…**; error says **Parking details could not be checked. Confirm location, cost, reservation rules, operator, and space availability with the booking partner.** The section itself is not interactive; tab order remains hotel CTA then **Details**, with expanded content read in DOM order. The **Details** control retains `aria-expanded` and `aria-controls`; status changes use polite live regions and must not move focus.

**Test:** every field has a visible unknown outcome; the section fits one column at 375px and may use two columns only when each option remains a single grouped reading unit at 1280px; keyboard expansion retains focus on the toggle.

### 3. Carry a bounded parking snapshot and unresolved task into booking review

`BookingHotelContext` must carry the normalized parking snapshot needed for display, not vendor prose. The `/book` review must repeat the selected result's known option(s) and end with exactly one status-driven next step:

- all critical facts known, but no stay-space confirmation: **Parking is documented, but expaify has not confirmed a space for your dates. Check availability with the booking partner before you pay.**
- reservation required: **This parking option requires advance reservation. Complete or confirm it with the booking partner; expaify has not reserved a space.**
- third-party: **This option is operated by a third party. Confirm payment, access, and cancellation terms with that operator or the booking partner.**
- unknown-dominant: **Parking location, cost, reservation rules, operator, or space availability are still not fully documented. Confirm them before you pay.**
- explicit selected-stay confirmation: **The provider reports a parking space for these dates. Recheck the live booking terms before payment.** This is permitted only when the stay-scoped contract supports it and still must not say expaify reserved the space.

The provider CTA accessible name must include `Parking space not confirmed` whenever selected-stay space is not explicitly confirmed. Parking cost must not be added to the hotel total unless the provider's total-price contract explicitly includes it; otherwise it remains a separate disclosed charge.

**Test:** round-trip serialization/parsing preserves every bounded enum and integer-money field, rejects malformed/oversized values, never serializes raw free text, and renders the same certainty before and after the result-to-review transition.

### 4. Treat unknowns and conflicting evidence as first-class outcomes

UXDES must specify separate final copy for:

- provider returned no parking fields;
- provider returned an unclear/malformed parking value;
- provider explicitly reports no parking option;
- facility is documented but selected-stay space is not returned;
- paid parking has no amount and/or no basis;
- reservation rule, operator, or nearby location detail is unknown;
- multiple options exist;
- sources conflict.

Do not use **available parking**, **parking included**, **free parking**, **reserved**, or **guaranteed** unless the exact dimension and scope justify it. `not_possible` reservation copy must be **Advance reservation is not accepted**, never **Parking unavailable**. `public/private` must not become hotel/third-party operator copy.

**Test:** comprehension Tasks 1–6 below meet the stated release thresholds, including explicit none versus not provided and hotel-operated versus third-party.

### 5. Instrument verified exposure and sequenced decisions without inferring motive

Define and test bounded analytics events on the actual mounted result surface and handoff. No raw address, URL, property/provider prose, or free text may be emitted. Events must be deduplicated per `searchId + offerId + surface + evidenceRevision` for an impression/reach and per user action for clicks.

**Test:** a generic Details click does not count as parking review; a section reach requires 50% visibility for one continuous second; rejection/handoff events link only to a prior reach for the same search and offer; browser abandonment remains unclassified.

## Measurement specification

### Shared bounded properties

Use these properties where relevant:

- `searchId` — ephemeral opaque search-session id, not raw query text
- `offerId` — provider offer id already used by the flow
- `provider` — normalized provider id
- `surface` — `results_card` or `booking_review`
- `viewportGroup` — `mobile_375_767` or `desktop_768_plus`
- `optionCountBucket` — `0`, `1`, `2_plus`
- `completenessBucket` — defined below
- `facilityState` — `confirmed`, `explicit_none`, `not_returned`, `unknown`
- `locationState` — `on_site`, `nearby_off_site`, `street`, `mixed`, `unknown`
- `spaceState` — `confirmed_selected_stay`, `unavailable_selected_stay`, `not_returned`, `unknown`
- `costState` — `included`, `paid_exact`, `paid_amount_unknown`, `unknown`
- `reservationState` — `required`, `not_required`, `not_possible`, `requestable`, `first_come`, `unknown`, `mixed`
- `operatorState` — `hotel`, `third_party`, `unknown`, `mixed`
- `evidenceRevision` — stable schema/version label, not provider text

Do not send raw parking amount in section/impression events. Amount can remain in the booking context for display; behavior reporting needs only the cost bucket.

### Coverage definitions and denominators

Compute coverage on deduplicated displayed hotel offers, segmented by provider, destination market, date-presence, and viewport. An offer shown twice in the same search counts once in the search-level denominator.

- **Any-evidence coverage:** offers with at least one supplier-returned parking dimension, including an explicit negative / all unique displayed hotel offers.
- **Facility coverage:** offers where facility state is confirmed or explicit none / all unique displayed hotel offers.
- **Comparison-ready coverage:** offers where facility, location, cost, reservation, and operator are each returned with a non-unknown value / all unique displayed hotel offers. Selected-stay space is intentionally reported separately rather than hidden inside this rate.
- **Selected-stay coverage:** offers with explicit selected-stay confirmed or unavailable evidence / all unique displayed offers whose search includes valid check-in and checkout dates.
- **Unknown share by dimension:** offers where that dimension is `unknown` or `not_returned` / all unique displayed offers.

An explicit negative counts as evidence. A normalized fallback or inferred default does not.

Completeness buckets:

- `none`: every parking dimension is `not_returned` or `unknown`.
- `facility_only`: facility is known, but none of location/cost/reservation/operator is known.
- `partial`: facility plus at least one—but not all—of location/cost/reservation/operator is known.
- `comparison_ready`: facility, location, cost, reservation, and operator are all known; selected-stay space is not confirmed.
- `stay_confirmed`: comparison-ready and selected-stay space is explicitly confirmed for the chosen dates/rate.
- `explicit_none`: provider explicitly reports no parking facility/option; other option fields are not applicable, not unknown.

### Events and sequence rules

1. `hotel_parking_signal_impression`
   - Fire once when at least 50% of the collapsed parking summary is visible for 500 ms.
   - Denominator for signal interaction: unique signal impressions.

2. `hotel_parking_details_opened`
   - Fire on user activation of **Details** only when the expanded card contains a parking section.
   - This measures disclosure demand, not parking review.
   - Detail-open rate = unique offers with open / unique parking-signal impressions.

3. `hotel_parking_section_reached`
   - Fire once when at least 50% of the parking section is visible for one continuous second.
   - Section-reach rate = unique reached offers / unique detail-opened offers.
   - Persist an in-memory `parkingReviewedAt` keyed to the same `searchId + offerId` for sequence attribution.

4. `hotel_property_rejected_after_parking_review`
   - Fire only after a valid section reach and before handoff when the user performs a bounded rejection action: returns/collapses and opens a different offer, or applies a parking-related refinement if one is separately approved later.
   - Required property: `rejectionAction` = `opened_other_offer` or `parking_refinement`.
   - Do not fire on tab close, browser back without a known results state, timeout, or abandonment.

5. `hotel_handoff_after_parking_review`
   - Fire when the user activates **Review hotel** after a valid section reach for that same offer, or activates the external partner CTA after reaching the booking-review parking section.
   - Required property: `handoffStage` = `result_to_review` or `review_to_partner`.

6. `hotel_unresolved_parking_handoff`
   - Fire alongside `review_to_partner` when completeness is not `stay_confirmed` or `explicit_none` and any critical dimension remains unknown/not returned.
   - Required property: `unknownDimensionCountBucket` = `1`, `2`, `3_plus`.

7. Extend `hotel_handoff_returned`
   - Add only `completenessBucket` and `spaceState` carried from the same booking context.
   - Report as return **after a handoff with unresolved parking**, never return **because of parking**.

Primary behavioral readout after instrumentation:

- rejection-after-review rate = unique reviewed offers followed by bounded rejection / unique offers with section reach;
- result-to-review handoff rate = unique reviewed offers handed to booking review / unique offers with section reach;
- unresolved partner-handoff rate = unresolved partner handoffs / all partner handoffs with a valid parking context;
- external return rate by completeness = returned handoffs / partner handoffs, segmented by completeness only.

Run these only after the card is mounted in a real user flow; test fixtures and Storybook-like renders are not production denominators.

## Comprehension tasks

Run moderated prototype sessions with 8–10 drivers who treat parking as a stay requirement. Use both 375px and 1280px variants; counterbalance order. Release gate: at least 85% correct per trust-critical task (Tasks 1–6), with no more than one participant making a false space-guarantee claim in any condition.

1. **Facility versus selected-stay space.** Show `facility=confirmed`, `selectedStaySpace=not_returned`, on-site, paid. Ask: “What do you know about parking, and do you have a space for these dates?” Pass: property has a documented option; a space is not confirmed. Fail: “A space is available/reserved.”

2. **On site versus nearby.** Show one on-site and one nearby option, with a documented nearby distance. Ask which option requires leaving the hotel property. Pass: nearby only. Fail: treats both as on-site or interprets the hotel's general address as the garage address.

3. **Hotel-operated versus third-party.** Show two otherwise identical options with explicit operators. Ask who handles payment or access issues for each. Pass: hotel for hotel-operated; third party/booking partner confirmation for third-party. Fail: assumes physical on-site location means hotel-operated.

4. **Included versus paid/unknown cost.** Compare `included`, `paid` with an exact per-night amount, and `paid` with amount/basis unknown. Ask which hotel has the lowest known parking cost for a three-night stay. Pass: calculates only the exact supplier-supported amount, identifies included correctly, and refuses to rank the unknown amount. Fail: reads “paid” as a known amount or folds it into room price.

5. **Reservation rule versus guarantee.** Show `reservation=required`, `available_on_request`, and `not_possible`, all with selected-stay space unknown. Ask which, if any, already has a space. Pass: none; required means action is needed, requestable is not guaranteed, and not possible means advance reservation is not accepted. Fail: treats required/requestable as reserved or not possible as no parking facility.

6. **Undocumented versus unavailable.** Compare one provider with no parking fields and one explicit `facilityStatus=unavailable`. Ask which hotel is known to have no parking option. Pass: explicit unavailable only. Fail: both.

7. **Booking-review continuity.** Let the participant inspect a partial parking option, choose **Review hotel**, then ask what remains to confirm before payment. Pass: recalls at least the unresolved space plus the shown unknown dimensions using the booking review, without returning to results.

8. **Five-second scan and mobile fit.** Show three collapsed cards for five seconds at 375px. Ask which offers are on-site, nearby, or unresolved and whether any space is confirmed. Pass: correct location for at least two of three and no invented space confirmation. Observe wrapping, CTA displacement, and whether truncation hides a critical qualifier.

## Acceptance criteria for UXDES

- The design spec covers default, initial loading, refresh-with-known-evidence, all not returned, malformed/unknown, explicit no option, one option, multiple options, conflicting evidence, error, and selected-stay confirmed/unavailable states.
- It defines every visible string for facility, location, selected-stay space, cost/amount/basis, reservation, operator, source, and unresolved handoff tasks.
- It keeps on-site versus nearby/street and hotel-operated versus third-party explicit.
- It never promises a space from property-level facility evidence, required/requestable reservation, or absence of an explicit negative.
- It provides 375px and 1280px layouts with no overlap or displacement of nightly rate, Deal Score, location, and booking CTA.
- It specifies focus order, `aria-expanded`/`aria-controls`, grouped option reading order, and polite live-state behavior.
- It names the result surface/wiring dependency and does not claim measurable impressions before that surface is live.
- It hands logic/API work to DEV for the normalized parking contract, provider mapping, safe booking-context transport, and bounded analytics.

## Risks, blockers, and out-of-scope findings

### Delivery dependency

`HotelCard` is currently tested but not mounted by a live page. UXDES may specify the component and booking review, but UI/DEV planning must explicitly identify the real results surface before claiming end-to-end delivery or collecting metrics. This is not fixed in UXR.

### Provider dependency

Current Hotellook supply cannot populate comparison-ready or selected-stay parking evidence. Shipping a polished section against this provider will mostly show unknowns. That is acceptable for trust repair only if coverage is measured and the UI remains concise; it is not acceptable to enrich missing fields through inference or supplier prose parsed in a component.

### Out of scope

- Parking reservation or payment inside expaify.
- Maps, directions, security, surveillance, accessible bays/routes, EV charging, valet/self-park choice, and vehicle clearance.
- A parking filter, parking ranking, or any effect on Deal Score.
- Adding estimated parking cost to hotel price or price history.
- Implementing provider, UI, booking-context, analytics, or live-surface wiring in this research stage.

## Handoff

Create `UXDES-HOTEL-PARKING-FIT-01` to produce an implementation-ready design spec for the provider-neutral parking option contract, collapsed comparison summary, dedicated expanded parking section, booking-review continuity, all unknown/error/conflict states, accessibility behavior, 375px/1280px layouts, and the bounded measurement sequence defined here.

# UXR-HOTEL-ACCESSIBILITY-FIT-01: Hotel Accessibility Accommodation Fit

## Research conclusion

expaify cannot currently support an evidence-backed accessibility-fit decision in its active hotel-deal flow. The data model has useful primitives for status, scope, source, freshness, confidence, and certainty, but the active `/deals` cards and detail page do not consume them. A separate, currently unmounted `HotelCard` demonstrates honest loading, error, missing, unknown, unavailable, requestable, and guaranteed treatments, yet recognizes only an elevator, one compound step-free route, and generic room preferences. Neither surface can establish whether a bookable room or rate meets a mobility, hearing, or visual-access requirement.

The repair should preserve the existing honesty boundary and move it into the active results-to-handoff journey. The interaction pattern to borrow from Booking.com and Expedia is not a generic “accessible” badge: it is the separation of property filters, property facilities, room/product attributes, and stay-specific availability. expaify should improve on those patterns by showing scope and evidence state explicitly and never translating a property amenity or special request into a room guarantee.

## Method and scope

This brief is based on:

- the discovery report at `docs/pipeline/hotel-accessibility-fit/01-discovery.md`;
- source inspection of the active hotel criteria, deal-card, deal-detail, provider, normalization, API-stream, shared-type, and test files;
- a reachability check of production `.tsx` imports and render sites;
- reference-pattern review of current Booking.com public and developer documentation and current Expedia property-room presentation, observed on July 31, 2026.

This is a source and pattern audit, not moderated usability research. Reference patterns are guidance, not evidence that users prefer a specific visual treatment. No provider payload was available in the repository to verify real accessibility-attribute coverage.

## Current implementation evidence

### 1. The active search criteria cannot capture an essential access need

`HotelSearchCriteriaV1` contains destination, dates, occupancy, and source only; its editable draft contains only city and date bounds (`lib/hotels/searchCriteria.ts:4-21`). The active deal feed adds price, hotel class, discount, and sort state, but no accessibility need or evidence-coverage state (`app/deals/DealFeed.tsx:480-494`). The results editor therefore cannot ask for a non-negotiable requirement, and the system cannot evaluate a result relative to one.

This is not merely a missing filter control. There is no persisted criterion against which “fit” could be computed, echoed in the results summary, restored from the URL, or carried to the detail/handoff surface.

### 2. The traveler-facing result card contains no accessibility evidence

The active `/deals` grid renders `DealCard` (`app/deals/DealFeed.tsx:1904-1925`). Its contract contains hotel identity, city, stars, prices, discount, dates, history, links, and freshness, but no amenity or accessibility field (`app/components/ui/DealCard.tsx:17-39`). Its visible hierarchy is hotel/date, price and savings, photo, “View deal,” and price-history trust copy (`app/components/ui/DealCard.tsx:65-132`). A traveler cannot distinguish documented support, a documented mismatch, and no evidence while scanning.

The discovery report describes an elevator chip on a hotel card. That implementation exists in `app/components/HotelCard.tsx`, but repository-wide production `.tsx` usage finds no import or render of `HotelCard`; its only call sites are tests. Designing only that component would not change the active `/deals` experience.

### 3. The active detail and handoff flow overstates room confirmation while showing no room evidence

The active deal-detail page’s “Hotel fit” section contains only hotel class and guest-rating availability (`app/deals/[dealId]/page.tsx:399-412`). The next section immediately hands off to providers (`app/deals/[dealId]/page.tsx:414-424`). No accessibility attribute, source, scope, or confirmation target is shown before that handoff.

More seriously, when dates exist, the detail page says, “Rate shown for this stay context; the provider confirms room-level details” (`app/deals/[dealId]/page.tsx:366-369`). The page has no selected room, rate-level accessibility evidence, room identifier, or confirmation reference. That sentence can be read as assurance precisely where the code has none. It should be removed or replaced with a bounded statement in the design stage.

### 4. The dormant `HotelCard` has a sound honesty pattern but insufficient vocabulary and reach

The shared `HotelAmenityEvidence` contract already distinguishes `confirmed`, `unavailable`, `not_returned`, and `unknown`; scopes of `property`, `room`, `rate`, and `selected_stay`; plus source, freshness, confidence, and `guaranteed` versus `requestable` certainty (`lib/types.ts:120-150`). These are the right primitives to preserve.

The normalizer, however, accepts only seven fixed facts: elevator, on-site parking, one entrance-to-room step-free route, and four room preferences (`lib/providers/hotelAmenityEvidence.ts:18-26`). Unrecognized provider attributes are dropped (`lib/providers/hotelAmenityEvidence.ts:113-117`). Confirmed property facts are restricted to property scope, and generic room preferences can be requestable at room scope or guaranteed only for a selected stay (`lib/providers/hotelAmenityEvidence.ts:64-82`). That is a useful anti-overclaim safeguard.

The dormant card renders honest loading and error status messages, consolidates all-missing and all-unknown results, shows source/freshness where present, and tells users that room requests are not guaranteed (`app/components/HotelCard.tsx:210-334`). Tests cover canonical ordering, request/non-guarantee copy, invalid evidence normalization, state usability, and keyboard-neutral disclosure (`app/components/__tests__/HotelCard.accessEvidence.test.tsx`). These patterns should be reused rather than replaced.

Its limitations remain decisive:

- Only a confirmed, guaranteed, property-scoped elevator can appear in the collapsed scan layer (`app/components/HotelCard.tsx:827-838`, `932-939`). A route, room, bathroom, hearing, or visual need cannot be summarized there.
- `step_free_route` compresses multiple independently failing links into one property fact.
- The vocabulary contains no accessible-room availability, entrance width, internal circulation, bathing configuration, grab bars, shower seat, reachable controls, visual alerts, tactile/Braille signage, or accessible communication fields.
- `HotelOffer` can carry amenity evidence, but the active saved-deal model and UI do not (`lib/types.ts:556-579`).

### 5. Provider and API behavior cannot presently supply verified fit

Hotellook normalizes `entry.amenityEvidence` if it happens to exist and attaches the result to a `HotelOffer` (`lib/providers/hotellook.ts:494-535`). The repository contains no verified live HotelLook payload demonstrating those accessibility fields. Missing input becomes seven `not_returned` facts; malformed input becomes an error (`lib/providers/hotelAmenityEvidence.ts:151-176`).

The search API streams a global hotel-access loading/ready/error state around HotelLook availability (`app/api/search/route.ts:396-459`), but it does not return per-need coverage, filter eligibility, room availability, or a selected-stay guarantee. Meanwhile, the active `/deals` experience is based on saved snapshot deal rows and does not consume this search stream.

Therefore, no downstream design may assume that adding UI controls creates filterable supply. Until a provider capability is verified, the honest product state is “not documented,” not “accessible,” and an essential-need filter cannot promise exhaustive results.

## Heuristic evaluation

| Heuristic | Current evidence | User consequence | Severity |
| --- | --- | --- | --- |
| Match between system and the user’s decision | The system organizes facts around generic amenities and room preferences, not the traveler’s essential need. | Users must translate “elevator” or “requestable” into personal fit and may miss a broken route segment. | P0 |
| Visibility of system status | The dormant card distinguishes loading/error/missing; the active flow shows no accessibility state at all. | Absence is indistinguishable from “not checked,” “not returned,” and “not supported.” | P0 |
| Error prevention | Property facts, room requests, rate eligibility, and selected-stay guarantees are not joined in the active journey. | A user can leave for booking after seeing no warning that the required room feature remains unverified. | P0 |
| Recognition over recall | The active cards require opening provider sites and remembering each property’s details. | Comparison cost increases with every candidate, especially on mobile. | P0 |
| Consistency and standards | Evidence primitives exist but are absent from the production deal-card/detail contracts. | The app is internally consistent in tests but inconsistent at the actual traveler touchpoints. | P0 |
| Accessible interaction | Existing disclosure buttons have focus states and 44px targets, and status messages use polite live regions; the active deal card itself is a large link. | The base interaction is usable, but fit information is unavailable to keyboard and screen-reader users because it is not rendered. | P1 |

## Reference-pattern comparison

### Booking.com: filter at search, then separate property and room detail

Booking.com’s current Demand API supports both accommodation-level and room/product-level facility filters. Its documentation explicitly distinguishes `accommodation_facilities` from `room_facilities`, and describes accessibility as a facilities-filter category ([Filtering and paginating accommodation search results](https://developers.booking.com/demand/docs/accommodations/filter-pagination)). Its details endpoint separately returns property facilities and room records, while its availability endpoint returns products matching dates and guests ([About accommodations](https://developers.booking.com/demand/docs/accommodations/about-accommodation), [Retrieve accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details)).

Booking.com’s public guidance also warns that “accessible” varies by hotel and identifies decision-critical room and property details such as roll-in showers, wider doors, visual alerts, step-free entrances, parking, and lift wayfinding ([What are accessible hotel rooms?](https://www.booking.com/articles/what-are-accessible-hotel-rooms.en-gb.html)).

Pattern guidance for expaify: preserve the separation between property facilities, room facilities, and stay availability. Do not copy the weakness of a single broad accessibility category. A broad filter can aid discovery, but the result must still disclose which selected need is documented and at what scope.

### Expedia: expose accessibility in the bookable room label

Current Expedia property pages expose distinct bookable room products with labels such as “Accessible (Roll-In Shower),” “Accessible (Hearing),” and “Mobility/Hearing Access Tub,” rather than presenting all accessibility as a property-wide promise ([Embassy Suites Gatlinburg property page](https://www.expedia.com/Gatlinburg-Hotels-Embassy-Suites-By-Hilton-Gatlinburg-Resort.h96011359.Hotel-Information?equalTargetTab=tab-5), [Embassy Suites Temecula property page](https://www.expedia.com/Temecula-Hotels-Embassy-Suites-By-Hilton-Temecula-Valley-Wine-Country.h24122.Hotel-Information?equalTargetTab=tab-3)). The useful pattern is proximity: the access characteristic sits with the room name, occupancy, bed, and “View prices” action.

Pattern guidance for expaify: a property-level claim may help shortlist, but room/bathroom or hearing-access fit must be attached to a specific room/product and then to the selected stay. A generic request shown apart from the rate is not an equivalent substitute.

## Exact gap

| Decision step | Current expaify behavior | Reference behavior | Delta to close |
| --- | --- | --- | --- |
| Search criteria | Captures city and dates; occupancy remains not captured; no essential access need. | Booking.com supports property- and room-facility filters alongside stay criteria. | Add an optional, structured essential-need criterion only when the data contract can return evidence coverage; otherwise label it as a comparison preference, not an exhaustive inventory filter. |
| Result scan | Active `DealCard` shows price, discount, date, class, photo, and freshness only. Dormant card may show an elevator. | Search patterns narrow candidates; room marketplaces keep differentiated room traits close to the bookable option. | Every active hotel result must account for each selected essential need as supported, not supported, or not documented. |
| Property detail | Active “Hotel fit” means class and guest rating. Dormant panel mixes property facts and room requests. | Booking.com separates property facilities and room details. | Group evidence by need and scope; split route segments and keep room/bathroom facts out of property-wide claims. |
| Room/rate decision | No internal room selection and no accessible-room data. | Expedia labels differentiated room products with bathing/hearing characteristics. | Show “no room selected” until a specific room/rate is identified; never infer room fit from the property. |
| Handoff | Provider CTA follows a generic claim that the provider confirms room-level details. | Room attributes appear adjacent to room-price actions, with the provider completing availability/booking. | Put unresolved P0 needs immediately before the handoff and state exactly what remains to confirm. |

## Design directives

### Directive 1 — Carry essential needs as explicit criteria, never as a disability profile

The UXDES spec must define an optional “Accessibility needs” group using concrete, functional requirements rather than a generic “Accessible” toggle or medical/disability labels. The first release specification should cover these selectable requirements: step-free route to the room; accessible room and bathroom; roll-in shower; accessible tub; hearing-access alerts; and tactile/Braille wayfinding. “Roll-in shower” and “accessible tub” must remain distinct.

The criteria summary must echo selected needs in plain text. No selection means no fit claim. Selection must not imply that all marketplace inventory was checked. If verified provider filtering is unavailable, results must say exactly: **“Accessibility evidence is limited; results are not filtered exhaustively.”**

Test: after selecting any need, that need survives URL/history restoration, appears in the search summary, and is evaluated on every visible result. No UI or analytics payload asks for diagnosis, disability type, or free-text medical information.

### Directive 2 — Put a three-outcome fit summary on every active result card

For each selected need, the active `DealCard` scan layer must show one of three text outcomes, not color alone:

- **“Documented for this stay”** only when evidence is for the selected room/rate or selected stay and has a source;
- **“Documented mismatch”** only when a source explicitly states the required feature is unavailable at the relevant scope;
- **“Not documented — confirm”** for missing, unknown, stale, malformed, conflicting, property-only evidence used for a room need, or a request without confirmation.

A property fact such as an elevator may be displayed as supporting evidence but must never produce “Documented for this stay” for a room or bathroom need. When multiple needs are selected, the card-level rollup may say **“All selected needs documented,” “Does not match a selected need,”** or **“Some needs require confirmation,”** and must expose the per-need text in the card or its accessible name.

Test: given fixtures for supported, unavailable, not returned, malformed, stale, conflicting, requestable, property-only, and selected-stay evidence, the rollup is deterministic; only selected-stay/rate evidence can produce the strongest match; a screen reader announces the same outcome and need name as the visible UI.

### Directive 3 — Make the detail view an evidence ledger organized by need and scope

Replace “Hotel fit” as class/rating-only content with an “Accessibility fit” section before provider handoff. Order content as: selected essential needs, room/bathroom evidence, arrival-and-route segments, hearing/visual evidence, then supporting context such as parking. Each row must contain: attribute name, outcome, scope (“Property,” “Room,” “Rate,” or “Selected stay”), source, last checked, and certainty (“Documented,” “Request only,” or “Confirmed for selected stay”).

Split the current compound step-free route into independently unknown segments: arrival/drop-off or accessible parking; entrance; reception/common areas; vertical circulation/elevator; route to guest-room entry; and the room/bathroom. Do not infer an unreturned segment from a returned neighbor.

Use the existing neutral treatments for `not_returned` and `unknown`, warning treatment for an explicit `unavailable` mismatch, and polite live regions for loading/error. Do not hide missing attributes under “Other details not documented” when they correspond to a selected essential need.

Test: every selected need has a visible row even when no provider value exists; metadata wraps at 375px without horizontal scrolling; headings and definition lists preserve a logical screen-reader order; loading, partial, empty, error, stale, and conflict states leave price and handoff controls usable.

### Directive 4 — Enforce a room/rate confirmation gate before provider handoff

Remove the unsupported sentence “the provider confirms room-level details.” Until the active flow identifies a specific room and rate, show **“No room selected — accessibility fit is not confirmed.”** If a feature is merely requestable, show **“Request only — not guaranteed until the provider confirms.”** If all selected P0 needs have selected-stay evidence, show **“Selected stay documents all chosen accessibility needs.”**

Immediately above every outbound provider action, list only unresolved selected needs under **“Confirm before booking.”** The CTA may continue to open the affiliate provider, but its accessible name must include whether confirmation remains. A provider link, property-level feature, room-type label, or accepted special request must never be converted into a guarantee without selected-stay evidence and a source/reference.

Test: all outbound paths show the same unresolved-needs boundary; keyboard focus reaches the boundary before the CTA; missing evidence never disables price comparison but prevents a positive fit claim; affiliate markers remain intact.

### Directive 5 — Specify coverage-aware filtering and all system states before visual design

UXDES must define default, loading, partial, empty, error, stale, conflicting, mobile 375px, desktop 1280px, focus/keyboard, and screen-reader states for accessibility criteria, card summaries, the detail ledger, and the handoff boundary.

Filtering semantics must be explicit:

- A **verified-match view** may include only results whose selected needs are documented at the required scope.
- Unknowns must not silently pass as matches and must not be labeled “not accessible.”
- When no verified matches exist but unknown candidates do, show **“No documented matches. Some hotels have incomplete accessibility information.”** Offer a separate action, **“Show hotels to confirm,”** rather than silently mixing them into matches.
- A provider/access-evidence error must preserve already loaded hotel results and say **“Accessibility details could not be checked. Prices and hotel results are still available.”**

Test: count labels distinguish verified matches from hotels-to-confirm; clearing a need restores the prior result set and focus; status changes are announced once; touch targets are at least 44px; no result state relies on color, icon, hover, or truncation for its meaning.

## Evidence model required by the design

The existing evidence interface should remain the base, but the design must assume canonical, provider-mapped IDs and segment-level scope rather than UI-authored prose. At minimum, each rendered fact needs:

- canonical need/attribute ID and normalized value;
- outcome: supported, explicitly not supported, not returned, unknown, stale, or conflicting;
- scope: property, room, rate, or selected stay;
- source label and retrieved/observed time;
- certainty: informational, requestable, or guaranteed for the selected stay;
- room/product identifier when room-scoped;
- confirmation reference when selected-stay certainty is claimed.

The current `HotelEvidenceCertainty` lacks an explicit informational value, and the current status union lacks stale/conflicting outcomes. UXDES may specify their presentation, but DEV must decide whether they become new normalized states or derived presentation states. Neither should be encoded as optimistic `confirmed`.

## Measurement plan

Primary task measure: for a fixture set containing one supported candidate, one explicit mismatch, and one unknown candidate, a first-time participant can correctly classify all three for one declared essential need before provider handoff.

Instrument and compare:

- selected need(s) and evidence coverage category, never diagnosis or free text;
- verified match, mismatch, and confirmation-needed impressions;
- detail-ledger opens by outcome;
- provider handoffs with zero versus one-or-more unresolved P0 needs;
- return-to-results after provider handoff;
- accessibility evidence errors and missing-coverage rates by provider and canonical attribute.

Success guardrails:

- zero fixtures where property-only/requestable evidence yields selected-stay confirmation;
- 100% of selected needs accounted for on each rendered candidate;
- no unknown value counted as unsupported or verified;
- no accessibility filter shown as exhaustive when provider coverage is unverified.

## Constraints and downstream dependencies

1. **Active-surface dependency:** UXDES must target the active `DealCard` plus `/deals/[dealId]` journey, or explicitly document a routing migration. Updating only `HotelCard` would not reach users.
2. **Provider-capability dependency:** current HotelLook payload coverage for fit-critical attributes is unverified. UI can represent missing evidence now, but verified filtering and positive match claims require provider-backed property, room/product, and availability data through `lib/providers`.
3. **Room-selection boundary:** expaify has no internal room selection. The strongest truthful outcome before handoff may remain “not documented/confirm” unless a provider response binds an attribute to the offered room/rate or selected stay.
4. **Repair scope:** this brief does not authorize a new provider integration, disability-profile storage, medical-data collection, booking flow, or accommodation guarantee. Those require separate approval and a verified data contract.
5. **Existing contract:** money, `Result<T>`, env-only secrets, and affiliate-link rules remain unchanged.

## Handoff recommendation

UXDES should produce one implementation-ready specification for the active `/deals` results card, deal-detail “Accessibility fit” ledger, and provider-handoff boundary, including every state in Directive 5. It should reuse the dormant `HotelCard` evidence-state language where truthful, remove the unsupported room-confirmation sentence, and mark any positive/filter state that requires unavailable provider data as blocked rather than designing it as if data exists.

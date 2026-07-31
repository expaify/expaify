# UXR-HOTEL-NOISE-QUIET-FIT-01: Hotel Quiet-Stay Fit Research

Date: 2026-07-31  
Stage: UX Research  
Priority: P1  
Upstream: `docs/pipeline/hotel-noise-quiet-fit/01-discovery.md`

## Research question

Can expaify let a first-time traveller distinguish selected-room or selected-stay facts, property facts, licensed guest-reported patterns, nearby exposure context, and no usable evidence before provider handoff—without turning those inputs into a quiet/noisy verdict or implying a quiet-room guarantee?

## Executive finding

Not in the live product today.

The repository now contains a thoughtful, source-separated `QuietStayEvidenceLedger` and tests for populated, missing, failed, stale-location, conflicting, and malformed fixtures. That is an implemented UI contract, not production evidence. The saved hotel-detail path always passes `NO_QUIET_STAY_EVIDENCE`; `HotelOffer`, Hotellook normalization and cache hydration, booking continuity, `HotelCard`, and `BookingFlow` carry no quiet-stay object. Every live hotel therefore has the same honest fallback, and no result can support a quiet-stay filter, comparison cue, or selected-room statement.

The existing hierarchy is directionally correct but not yet safe as a data contract. It groups selected-stay and property facts together without enforcing strongest-first order; accepts any parseable date rather than a freshness rule; permits only one free-text review summary, which cannot preserve external versus internal-property patterns; and silently converts malformed populated data into generic absence. Several declared per-class states (`stale`, `conflicting`, `not_returned`) have no distinct rendering outside nearby context. These gaps matter before any provider is wired because they can erase provenance or turn unusable evidence into apparently ordinary missing data.

Reference patterns support progressive disclosure and source separation, not a quietness score. Booking.com separates property/room details, availability products, agreement-gated reviews, and order-time special requests; its own order documentation says special requests cannot be guaranteed. Google Hotels uses compact result snapshots, then separates amenities, location and review information on detail, attributes third-party review summaries, and sends users to a booking partner to complete the booking. expaify should borrow those boundaries while exceeding both references on explicit unknown states.

The recommended repair is therefore:

1. keep the ledger, but make its normalized data and state semantics enforce the hierarchy;
2. place the decision evidence before the provider action, with only one source-named availability cue on result cards;
3. keep unknown inventory reachable and explicitly counted if a future positive evidence filter is introduced;
4. repeat only selected-room/stay-applicable evidence at handoff, beside the existing request truth model; and
5. instrument fixed, non-sensitive evidence events only after the current analytics allow-list mismatch is repaired.

No participant study or production quiet-evidence dataset was available. The classification result below is a heuristic/cognitive-walkthrough finding, not proof of user comprehension. A moderated validation protocol and release thresholds are specified before UI implementation can claim success.

## Inputs and method

### Current-code evidence audited

- `docs/pipeline/hotel-noise-quiet-fit/01-discovery.md`
- `lib/types.ts` — `HotelOffer`, location precision, provider and `Result<T>` contracts
- `lib/providers/hotellook.ts` — live response, cached normalization, six-hour cache and affiliate deeplink
- `lib/providers/hotelAmenityEvidence.ts` — current closed amenity vocabulary and request certainty precedent
- `app/api/search/route.ts` — hotel stream and status boundaries
- `app/components/HotelCard.tsx` — collapsed scan hierarchy, expanded detail and booking-context creation
- `app/components/ui/QuietStayEvidenceLedger.tsx` and its tests — implemented evidence UI contract
- `app/deals/[dealId]/page.tsx` — the only production quiet-ledger mount
- `lib/booking/config.ts`, `lib/booking/hotelContextStore.ts`, and `app/book/BookingFlow.tsx` — continuity, handoff and request guidance
- `lib/analytics.ts`, `app/api/analytics/route.ts`, and `app/components/HotelDecisionAnalytics.tsx` — client emission, first-party sink and server validation
- `docs/pipeline/hotel-noise-fit/02-research.md` — earlier broad research, treated as settled input rather than a competing model
- `docs/pipeline/hotel-review-relevance/02-research.md` — licensed review-theme boundary

### Reference patterns checked

The comparison is about interaction and evidence contracts, not visual styling.

1. **Booking.com Demand API.** Property details and room details are available through the accommodation-detail contract; search/availability returns stay-matching products separately; review comments and statistical review scores can be used only when the partner agreement permits them. Order creation accepts optional `special_requests` only after a product is selected and explicitly says they cannot be guaranteed. Sources: [Booking.com accommodation overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation) and [Booking.com order creation](https://developers.booking.com/demand/docs/orders-api/order-preview-create).
2. **Google Hotels.** A result is a compact snapshot; property detail separates location, reviews, rooms and amenities. Google says it licenses some third-party reviews and attributes topic summaries to TrustYou, while amenity and room information may come from multiple source classes. A booking link transfers completion and servicing to the booking partner. Source: [Google Travel Help — Search for hotels](https://support.google.com/travel/answer/6276008?hl=en).

These public references prove that the classes and transaction stages can be separated. They do **not** grant expaify reuse rights or prove that a quiet/soundproof facility, noise theme, or geographic dataset is available under expaify's contracts.

## Current implementation audit

### 1. The ledger exists, but only as an isolated UI contract

`QuietStayEvidenceLedger` defines:

- overall states: `checking`, `evidence_available`, `no_evidence_returned`, `check_failed`;
- provider facts: property soundproofing, room-type soundproofing, and quiet-room option;
- nearby categories: airport, rail, major road and nightlife;
- one guest-review summary with source, window and optional count; and
- location precision, conflicts and per-class state fields.

The renderer correctly:

- labels provider facts, nearby context and guest review theme as separate groups;
- requires attribution and parseable dates before rendering claims;
- suppresses proximity for area/search-area/missing locations;
- keeps conflicting valid items visible;
- states that proximity and other evidence do not predict a specific room; and
- distinguishes a requestable preference from a selected-stay guarantee in copy.

Tests exercise the shell, including 375px-safe class patterns indirectly through the component's responsive layout and semantic section headings. However, the populated fixtures are test-only. The production saved-detail page mounts the ledger after the provider action under **Supporting evidence** and always passes `NO_QUIET_STAY_EVIDENCE` (`app/deals/[dealId]/page.tsx:414-433`). No other production component imports it.

### 2. No evidence reaches the hotel offer or cache

`HotelOffer` contains identity, location, integer-cent price, ratings, access evidence, funds, smoking, rate eligibility and admission policy, but no quiet-stay field (`lib/types.ts:556-579`).

Hotellook's typed live entry contains no quiet-stay, review-theme or environmental-context field (`lib/providers/hotellook.ts:23-42`). Live mapping and cache hydration normalize only the existing allow-listed families. Cached values with extra quiet/noise fields are dropped because `normalizeCachedHotelOffer` never reads them (`lib/providers/hotellook.ts:337-411`). The six-hour cache key is based on location and dates, but there is no quiet-evidence source timestamp, source version or independently refreshable evidence key.

The provider's location model can preserve exact address or paired coordinates. That is a prerequisite for property proximity, not a noise source. No licensed airport geometry, flight path, rail, road, nightlife, venue-hours, construction, event, acoustic or review-text dataset exists in `lib/providers`.

Result: **0% of normalized live offers can carry any of the four evidence classes.** This is a structural code fact, not a statement that hotels are quiet or noisy.

### 3. Results and cards cannot compare quiet-stay fit

`HotelCard` has no quiet evidence prop, collapsed cue, filter relationship or expanded ledger. It creates booking continuity from the same `HotelOffer`, so even a test-only ledger fixture cannot enter the handoff.

The main `/deals` product renders a separate deal-feed model rather than `HotelCard`; a repository search finds `HotelCard` outside its own file only in tests. The saved detail is therefore the only current user-facing quiet-stay surface, and it appears after the provider CTA. A design that modifies only `HotelCard` would remain invisible in the live deal flow.

### 4. Booking continuity preserves request honesty but drops evidence

`BookingHotelContext` and `buildBookingHotelContext` serialize price, identity, location, quality and several policy families, but no quiet-stay evidence or evidence-seen state (`lib/booking/config.ts:50-86`, `1061-1090`). `BookingFlow` consequently cannot repeat property/room evidence.

Its existing **Special requests** block is the correct owner of request status. It says nothing is selected or sent by expaify, says requests depend on availability, and defines selected, sent, acknowledged and guaranteed as separate states (`app/book/BookingFlow.tsx:1211-1239`). The quiet-stay work must not add a checkbox or claim around this guidance-only flow.

### 5. Analytics has a real sink, but quiet measurement and some handoff events are invalid

Unlike the earlier broad research, `lib/analytics.ts` now sends validated events to `/api/analytics`, and the route persists them to Postgres `analytics_events`. Hotel detail view, section reach, handoff start, continue, return and request-guidance event names exist.

There are still three blocking measurement gaps:

1. no quiet-evidence exposure or engagement event exists;
2. `BookingFlow` emits extra properties on `hotel_handoff_continue_clicked` and `hotel_handoff_returned` that are absent from the server allow-list, so the strict parser rejects those payloads rather than recording a partial event; and
3. `BookingFlow` emits `hotel_handoff_return_reason_selected`, but that event is absent from both server event maps, so the bounded feedback currently displays success client-side while the first-party endpoint rejects the event.

The current return reasons also omit the discovery's proposed `Noise or quiet-room details did not match` choice. These are out-of-scope implementation defects, but they mean detail abandonment, qualified handoff and post-handoff complaint intent have no trustworthy production baseline yet.

## Evidence and source capability matrix

| Evidence class | Current availability | Minimum source/rights gate | Raw vocabulary and normalization gate | Freshness and precision gate | Safe claim | Forbidden inference |
|---|---|---|---|---|---|---|
| Selected room/stay provider fact | None | Contracted availability/order/property-response field tied to product, room/rate and searched stay | Retain provider field/id and map only documented `soundproofing_room` or `quiet_room_option`; keep request `requestable`, `transmitted`, `acknowledged`, `guaranteed` distinct | Revalidate with the selected product; a generic rate-fetch timestamp is insufficient | `Provider lists soundproofing for {room type}` or `Provider confirms {named attribute} for this stay` | Every room is quiet; selection or redirect sent a request; a request was fulfilled |
| Property provider fact | None | Contracted property-detail facility with display/derivation rights | Retain provider facility id and source wording; normalized `soundproofing_property` only after Product/Legal and adapter mapping review | Show observed/updated time; refresh when provider details report a change or per approved source SLA | `Provider lists soundproofing for this property. It may not apply to every room.` | All rooms have it; measured acoustic performance; absence means no soundproofing |
| Licensed review pattern | None | Agreement explicitly permits review retrieval **and** display or derivation; Booking.com publicly makes endpoint access agreement-dependent | Replace the current singular free-text theme with multiple bounded items. Preserve source taxonomy and map only documented categories for external street/traffic, nightlife, aircraft, rail/transport and internal corridor, lift, adjoining-room, property venue/event or building-system patterns | Each item needs source window and sample count when supplied. Do not borrow rate fetch time or aggregate-rating freshness. Product/Legal must set minimum sample and maximum age per source before enablement | `Guests mention {bounded pattern}. Summary of guest reviews via {source}.` | Verified property fact; prediction for the next stay; theme inferred from aggregate rating or one review |
| Nearby context | None | Licensed geospatial/POI reference source with reuse/display rights; exact property address or paired coordinates from an attributable provider | Preserve feature class, named reference point, distance method and source version. Do not map broad area labels into property proximity. | Exact/coordinate property precision only; source-specific update SLA required. Nightlife additionally needs documented venue category; temporary hours/events are not inferred. | `{Reference point} is {distance} away in a straight line.` plus caveat | Audible noise, operating hours, flight path, facade exposure, room orientation or current conditions |
| Unknown/unusable | Universal live state | No new source required | Keep reason: `not_returned`, `check_failed`, `insufficient_location`, `stale`, `malformed`, `conflicting` | Never backfill one class from another | State exactly what could not be established | Quiet, noisy, suitable, unsuitable, pass or fail |

### Source-rights conclusion

- Booking.com's public documentation proves a plausible structured facilities/rooms path and an agreement-gated reviews path; it does not prove expaify has credentials, exact facility ids, review derivation rights, or coverage.
- Google demonstrates attributed source separation but is a reference surface, not a reusable data provider for expaify.
- No current provider contract, source-rights record or sampled production payload in this repository establishes any quiet-stay class.
- Therefore every populated state remains **design-ready but provider-blocked**. The only production-truthful state remains explicit unknown.

## Hierarchy comprehension evaluation

### Cognitive walkthrough result

The proposed order is conceptually classifiable when each item answers four questions in reading order: **what is known, who says so, what it applies to, and what remains uncertain**. The current ledger succeeds at source separation and caveats, but it does not fully preserve the discovery hierarchy:

- selected-room/stay and property facts share one heading and render in caller-supplied order;
- the generic `Provider facts` label makes the selected-stay advantage less scannable;
- a single guest summary can merge street/nightlife/aircraft/transport/internal-property patterns;
- malformed evidence reads like ordinary non-return rather than an unusable response; and
- stale/conflicting provider or review states have no dedicated presentation.

Accordingly, the hierarchy is **promising but not user-validated and not implementation-complete**. UXDES must specify two sublevels inside Provider facts—selected room/stay first, property second—and a list of bounded review patterns. It must not introduce four equal-weight badges; semantic headings and scope/source lines should carry the hierarchy.

### Required moderated validation

Test 8–12 first-time hotel travellers at both 375px and 1280px, including at least four people who have previously sought a quieter room or quiet work environment. Do not ask why they are noise-sensitive and do not collect medical or sleep details.

Use five fixtures:

1. selected room-type soundproofing plus a requestable quieter room;
2. property soundproofing plus conflicting licensed internal-corridor reports;
3. airport proximity only;
4. licensed nightlife and adjoining-room patterns with no provider fact; and
5. no evidence, then the provider-directed request guidance.

After each, ask:

- “What does expaify know, and who supplied it?”
- “Does this apply to the property, a room type, or this selected stay?”
- “What does the nearby item tell you—and what does it not tell you?”
- “Did expaify send a quieter-room request?”
- “Is a quiet room guaranteed?”

Release thresholds:

- at least 90% correctly classify selected-stay/room, property, guest-pattern and nearby-context evidence;
- at least 90% identify missing, stale and failed evidence as unknown rather than favourable or unfavourable;
- at least 90% distinguish internal-property patterns from external proximity;
- zero participants say proximity predicts noise in the assigned room;
- zero participants say expaify sent or acknowledged a request; and
- zero participants interpret any non-selected-stay state as a guarantee.

Any zero-tolerance failure requires hierarchy/copy revision and a fresh test before UI implementation proceeds.

## Reference-pattern delta

| Decision point | Booking.com / Google pattern | expaify now | Exact delta |
|---|---|---|---|
| Refinement | Structured, supported attributes can filter results; detail-rich evidence is not flattened into every result | No quiet field, filter or coverage count | Do not ship a `Quiet hotels` filter. A future positive control may be `Provider quiet-stay details available`, must use only valid provider facts, disclose excluded/unknown count and never hide unknown by default |
| Result scan | Google uses a compact snapshot and moves evidence detail into the property page | Live DealCard has no cue; dormant `HotelCard` has no cue | Add at most one source-class availability line only when valid evidence exists; no all-unknown badge and no quiet/noisy label |
| Detail disclosure | Amenities, rooms, location and reviews remain distinguishable; Booking review access is contract-gated | Ledger separates three broad groups but sits after provider action and always shows fallback | Move the ledger into Hotel fit before provider action; split selected room/stay from property within Provider facts; preserve licensed review and nearby classes separately |
| Room choice / request | Booking order requests occur after product selection and are explicitly non-guaranteed | expaify redirects before room selection and only offers provider-directed guidance | Repeat only selected-room/stay-applicable facts; leave request entry to the provider and retain selected/sent/acknowledged/guaranteed distinctions |
| Completion / service | Google transfers booking completion and service to the partner | Handoff has good ownership copy but no quiet evidence continuity | Carry applicable evidence and its caveat into review; never infer a request or guarantee from the outbound action |

## Exact state semantics and copy rules

| State | Required treatment and final copy rule |
|---|---|
| Default / no evidence returned | Detail only: `Quiet-stay details were not provided by this hotel source. Location and rating do not tell us whether a room will be quiet.` No collapsed cue. |
| Checking | Independent polite status: `Checking quiet-stay evidence…` Price, Deal Score, details and provider action remain usable. |
| Check failed | `Quiet-stay evidence could not be checked. Confirm room location, soundproofing, and current surroundings with the booking partner.` Do not imply hotel inventory failed. |
| Insufficient location | `Property-level proximity cannot be calculated from the area information provided.` Suppress distances and nearby categories. |
| Stale class | Suppress the stale claim. Use `Provider quiet-stay details are out of date and are not shown.`, `Nearby context is out of date and is not shown.`, or `Guest noise patterns are out of date and are not shown.` Retain source and last observation date when valid. |
| Malformed / unmapped class | Do not silently relabel it as not returned. Use `Some {provider / nearby / guest-pattern} details could not be verified and are not shown.` If no other valid item remains, the overall state is `check_failed`, not `evidence_available`. |
| Conflicting | `Sources differ. Review each source before deciding.` Keep all valid items, sources, scopes and dates visible; do not average, rank or resolve them. |
| Property fact | `Provider lists soundproofing for this property. It may not apply to every room.` Source and observed date required. |
| Room-type fact | `Provider lists soundproofing for {room type}. Confirm this room type is selected before payment.` Source, room type and observed date required. |
| Requestable | `A quieter room can be requested. Nothing has been sent by expaify, and requests depend on availability.` Only when the provider contract proves request capability. |
| Transmitted | `The booking provider says it sent your quieter-room request.` Requires provider success plus request receipt/reference; an outbound click is insufficient. Not available in current flow. |
| Acknowledged | `The property acknowledged your quieter-room request.` Requires attributable property/provider response. Not available in current flow. |
| Selected-stay guarantee | Name the exact documented attribute: `The provider confirms {attribute} for this selected stay.` Do not shorten to `Quiet room guaranteed`. |
| Nearby context | `{Reference point} is {distance} {unit} away in a straight line. Proximity does not predict noise in a specific room.` Source, update date and exact/coordinate property location required. |
| Guest pattern | `Guests mention {bounded pattern}. Summary of guest reviews via {source}.` Show window and sample count when supplied; no quote or free-text display without rights. |

No state may say `Quiet`, `Likely quiet`, `Noisy`, `Low noise`, `High noise`, `Noise risk`, `Quiet-stay score`, `Good for sleep`, or `Good for calls`. Deal Score remains price-only.

## Design directives for UXDES

### D1 — Enforce the evidence hierarchy in data and reading order

Keep one **Quiet-stay evidence** region, but order it as:

1. `Selected room or stay` provider facts;
2. `Property facts`;
3. `Guest-reported patterns`;
4. `Nearby context`; and
5. an always-readable scope statement: `These details do not predict whether a specific room will be quiet.`

Within review evidence, allow multiple bounded patterns so external street/traffic, nightlife, aircraft and rail/transport evidence cannot be collapsed with internal corridor, lift, adjoining-room, property venue/event or building-system evidence. Preserve provider raw ids/vocabulary in the adapter for audit, but render only approved normalized labels.

The normalized layer—not caller array order—must sort strength and reject invalid scope/certainty combinations. A property-scoped request must not pass as a selected-stay fact. No score, polarity roll-up, recommendation or color-only treatment is allowed.

**Acceptance test:** a fixture supplied in reverse order renders selected-stay → property → guest patterns → nearby context; street noise and corridor noise remain separate; the DOM contains no aggregate quiet/noisy verdict.

### D2 — Put usable evidence before action; keep the result cue factual and sparse

On the actual mounted hotel result surface, render at most one collapsed line after location and before the action, only when at least one valid item exists: `Quiet-stay evidence available · {strongest class label}`. The class label is one of `Selected stay`, `Room type`, `Property`, `Guest reports`, or `Nearby context`; it is not positive or negative. All-unknown, loading, failed, stale-only and malformed-only results add no collapsed line.

On saved/live detail, place the full ledger inside **Hotel fit**, before **Check rooms with provider**. The explicit unknown state also belongs there; its purpose is to prevent silence from being read as a positive signal. Do not leave the only disclosure under post-CTA Supporting evidence.

A future refinement control may be labeled `Provider quiet-stay details available` only after real coverage is measured. It may match valid selected-room/stay or property provider facts only. Activating it must disclose `Showing {matched} hotels; {unknown} more have no provider quiet-stay details` and offer `Show all hotels`. Unknown inventory remains reachable and is never treated as a failed match by default.

**Acceptance test:** at 375px and 1280px, a populated card adds one wrapping line and no overlap; an unknown card adds none; detail presents the ledger before the provider CTA; activating the future control preserves a one-action path back to all/unknown hotels.

### D3 — Make every unusable state distinct, non-blocking and source-specific

Use the exact state table above. Freshness must be decided in the provider/source adapter from a Product/Legal-approved SLA; the component must not define a universal age or accept any parseable date as current. Malformed/unmapped, stale, unavailable/not returned, failed, insufficient-location and conflicting are different states.

If one class fails while another is valid, render the valid class plus the failed class message. If every supplied item is malformed or stale, do not use `evidence_available`; use the appropriate overall failure/unknown state. Loading or evidence failure never disables price review, Deal Score, Back, Details or provider handoff.

Use semantic headings and ordinary reading order. Only actual controls enter tab order. Async checking/failure uses a polite live region; static unknown and conflicts do not announce on load.

**Acceptance test:** fixtures for all six unusable states render different copy; malformed evidence never appears as `not provided`; partial class failure preserves other valid items; keyboard order and CTA availability are unchanged at 375px and 1280px.

### D4 — Carry only applicable evidence into room choice and reuse the request truth model

Add quiet-stay continuity only when populated and validated. At handoff, show a compact **Quiet-stay evidence for this choice** block above the existing **Special requests** block:

- selected-stay facts first;
- selected room-type facts only when the selected product is demonstrably that room type;
- property facts, licensed guest patterns and nearby context may remain for context with their scope caveats; and
- no second unknown panel when no evidence exists, because Special requests already tells the traveller what to confirm.

Do not add a request checkbox, free-text field, auto-selected preference, URL flag, sent state or success toast. The existing selected → sent → acknowledged → guaranteed explanation remains canonical. A request state may advance only from provider adapter evidence, never from clicking the handoff link.

**Acceptance test:** continuing to the provider leaves request state unchanged; a room-type fact disappears when a different/unknown room is selected; no state says a request was sent without a provider receipt.

### D5 — Measure deliberate evidence use and explicit mismatch without sensitive inference

Implement the fixed analytics contract below only after reconciling client payloads with the server allow-list. Use a random per-detail-view correlation id; do not send hotel name, coordinates, raw URL, review text, room number, free text, medical information or a stated reason for needing quiet.

Passive below-fold rendering is exposure, not engagement. Define reach as 50% visibility for one continuous second and engagement as an explicit disclosure open/focus action. Do not infer noise concern from back navigation, dwell time or tab close. Qualified handoff is descriptive, not a conversion target.

**Acceptance test:** server tests accept every documented event/property and reject free text or unknown properties; one detail view emits at most one reach event; a user who never reaches the region is not counted as exposed; complaint intent requires the fixed reason selection.

## Bounded analytics specification

### Event contract

| Event | Trigger | Allowed properties |
|---|---|---|
| `hotel_quiet_evidence_reached` | Region is at least 50% visible for one continuous second, once per detail/handoff view | `view_id`, `surface` (`detail` / `handoff`), `overall_state`, `strongest_class` (`selected_stay` / `room_type` / `property` / `guest_pattern` / `nearby_context` / `none`), `provider_fact_state`, `review_pattern_state`, `context_state` |
| `hotel_quiet_evidence_opened` | User deliberately opens the result/detail disclosure | Same fields plus `result_position_bucket` (`1_3` / `4_10` / `11_plus`) |
| `hotel_quiet_conflict_reached` | Conflict disclosure meets the same visibility threshold | `view_id`, `surface`, `conflict_classes` as a bounded, sorted enum string |
| `hotel_quiet_handoff_started` | Provider action activates | `view_id`, `evidence_reached` (boolean), `overall_state`, `strongest_class` |
| `hotel_handoff_return_reason_selected` | After a detected provider return, user submits one fixed reason | `handoff_session_id`, `reason` (`noise_or_quiet_details_mismatch` plus the existing bounded reasons), `evidence_reached` |
| `hotel_quiet_filter_changed` | Future evidence filter is applied or cleared | `state` (`applied` / `cleared`), `matched_count_bucket`, `unknown_count_bucket` |

Reuse existing `hotel_request_guidance_viewed` and `hotel_request_help_opened`; do not create a request-selected or request-sent event in the current guidance-only capability.

### Metrics

1. **Quiet-stay detail engagement:** unique `hotel_quiet_evidence_opened` / eligible result or detail views with a quiet-evidence state. Report reach separately; never count passive render as engagement.
2. **Post-evidence abandonment sequence:** evidence reached, followed by back to results, refinement or session end without handoff. Compare with eligible views where evidence was not reached. Label as a sequence, not noise-caused abandonment.
3. **Qualified handoff:** unique `hotel_quiet_handoff_started` with `evidence_reached=true` / unique views where usable evidence was reached. Do not set an “increase” target; an informed rejection is valid.
4. **Explicit post-handoff complaint intent:** unique returned handoff sessions submitting `noise_or_quiet_details_mismatch` / unique returned handoff sessions shown the fixed feedback control. No free text and no inference from away duration.
5. **Guarantee-comprehension failure:** measured in moderated research as the share who say a quiet room is guaranteed without selected-stay proof. Production analytics cannot establish comprehension; target remains zero in task testing.

### Analytics prerequisite

Before reporting any rate, repair and test the current allow-list mismatch for `hotel_handoff_continue_clicked`, `hotel_handoff_returned`, and `hotel_handoff_return_reason_selected`. Until server acceptance and database insertion are verified end to end, report these metrics as **unavailable**, never `0%`.

## Acceptance criteria for UXDES

- Every state in the state table is specified for default, loading, empty, error, mobile 375px, desktop 1280px, keyboard/focus, screen-reader and partial-class failure.
- Selected room/stay facts, property facts, guest patterns and nearby context render in strength order and never become a quiet/noisy verdict.
- Guest patterns preserve external and internal-property categories and are licensed, attributed, windowed and sample-bounded.
- Exact/coordinate location plus a licensed source is required for proximity; area/search-area/missing location produces no property distance.
- The mounted production detail places the ledger before provider handoff; all-unknown result cards receive no collapsed badge.
- Unknown inventory remains reachable if a future provider-fact filter exists, with a disclosed unknown count and `Show all hotels` recovery.
- Handoff repeats only applicable evidence and leaves selected, sent, acknowledged and guaranteed request states distinct.
- Analytics uses only fixed enums/booleans, distinguishes reach from deliberate engagement, and records complaint intent only through an explicit bounded choice.
- No new provider, filter, ranking change, review scraping, geospatial integration, room assignment or request messaging is implied by this design ticket.

## Blockers and out-of-scope findings

### Blockers

1. **No licensed quiet-stay source:** no current provider path supplies selected-room/stay facts, property soundproofing, licensed review patterns or attributable nearby context.
2. **No production data continuity:** `HotelOffer`, provider cache, booking context and handoff contain no quiet evidence.
3. **Live placement is too late:** the only production mount always shows unknown and sits after the provider action.
4. **Analytics contract mismatch:** emitted handoff-return and return-reason payloads are rejected by the server allow-list, so required baselines are unavailable.
5. **Current hotel supplier viability:** the earlier broad research recorded Hotellook's published closure; the repository still calls and builds affiliate links for that provider. Provider replacement/repair is a separate P0 dependency before populated evidence can be trusted.

### Out of scope

- Selecting or contracting a hotel, review, map, POI, acoustic, flight-path, road, rail, construction or event provider.
- Scraping reviews, venue pages, maps, property pages or notices.
- Building a quietness score, recommendation, Deal Score input, ranking boost or `Quiet hotels` label.
- Implementing a new filter before provider-fact coverage exists.
- Collecting free-text sleep, health, call, room-location or complaint details.
- Sending provider messages, selecting rooms, assigning rooms, or promising a quiet stay.
- Repairing the Hotellook integration or unrelated analytics events in this UXR stage.

## Handoff

Create `UXDES-HOTEL-NOISE-QUIET-FIT-01` for an implementation-ready specification of the evidence hierarchy, exact unusable states, pre-handoff placement, applicable handoff continuity and bounded analytics contract. The design must remain fallback-first until a licensed source is confirmed, must preserve unknown inventory, and must never turn evidence into a quiet/noisy verdict or non-selected-stay guarantee.

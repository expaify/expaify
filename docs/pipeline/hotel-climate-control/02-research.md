# UXR-HOTEL-CLIMATE-CONTROL-01: Hotel In-Room Climate-Control Confidence

Date: 2026-08-03  
Stage: UX Research  
Priority: P0  
Discovery input: `docs/pipeline/hotel-climate-control/01-discovery.md`

## Research question

Can a traveler compare hotels and review a room option while correctly distinguishing provider-reported cooling, heating, and guest-adjustable control at property, room-category, and selected-room/rate scope—without expaify turning missing, failed, or less-specific evidence into a comfort guarantee?

## Method and evidence boundary

This brief combines three evidence classes and keeps them separate:

1. **Current-code evidence:** direct inspection of the provider contracts and adapters, `/api/search`, the live deal feed and saved-deal detail, `HotelCard`, booking context, handoff UI, and the production analytics validator.
2. **Provider-capability guidance:** official Booking.com Demand API and Hotelbeds documentation. Booking.com's official Demand API is **not** the same integration as expaify's current unofficial `booking-com15` RapidAPI adapter, so its capability is a future-contract signal, not evidence that the current adapter returns those fields.
3. **Reference interaction patterns:** current Booking.com and Expedia property/room pages, reviewed for information scope and hierarchy rather than visual style.

No live supplier sampling was possible in this worktree: `RAPIDAPI_KEY`, `HOTELBEDS_API_KEY`, `HOTELBEDS_SECRET`, `TP_TOKEN`, and `HOTEL_AFFILIATE_ID` are absent, and the repository contains no stored representative climate payload. Therefore this brief reports exact **normalized-contract coverage**, not upstream inventory prevalence. No user sessions or usability participants were available; the comprehension study below is a validated protocol and release gate, not a claimed empirical result.

## Executive finding

The discovery problem is confirmed, with two important corrections.

- Climate evidence is not merely absent from the UI; it is **unrepresentable** in the current normalized contract. `HotelAmenityEvidence` can express generic status, scope, provenance, freshness, and certainty, but the only accepted IDs are seven access/room-request facts. Unknown IDs are discarded. Cooling, heating, guest control, operating period, raw supplier wording, and climate-specific conflicts cannot survive normalization.
- The provider/surface map is narrower and more fragmented than the discovery implies. The current `/api/search` path invokes only the Booking.com RapidAPI hotel adapter. Hotelbeds exists but is not wired into that route. Hotellook is used by a legacy hotel-alert script and document-readiness route. The live `/deals` comparison surface renders `DealCard`, while `HotelCard` is not mounted outside tests. Saved deals come from a separate snapshot pipeline that stores no climate evidence and does not preserve a climate-capable supplier contract.

Accordingly, every currently displayed offer has **0% normalized climate evidence at every scope**, but it is incorrect to label the other 100% `not_returned`: the product cannot yet distinguish provider omission from an unsupported adapter, an unrequested endpoint, or a discarded field. Climate-attributed abandonment is also not currently measurable. The client emits a return event, but the internal analytics endpoint rejects it because extra properties are not allowlisted, and the structured return-reason event is not registered.

## Current implementation audit

### 1. Normalized evidence contract

`lib/types.ts` defines `HotelAmenityEvidence` with:

- status: `confirmed`, `unavailable`, `not_returned`, or `unknown`;
- scope: `property`, `room`, `rate`, or `selected_stay`;
- `sourceLabel`, optional `fetchedAt`, confidence, fee, and `guaranteed`/`requestable` certainty.

That base is useful but insufficient for climate control:

- It has no independent cooling, heating, or guest-control value.
- It has no seasonal/operating qualification or preserved source wording.
- `lib/providers/hotelAmenityEvidence.ts` allowlists only elevator, parking, step-free route, and four room-request facts. An input such as `air_conditioning`, `heating`, or `individually_controlled` is discarded, not normalized as unknown.
- Duplicate precedence selects a single status per ID; it does not retain same-scope or cross-source conflict statements.

This means the current product cannot calculate the discovery taxonomy (`present`, `explicitly_absent`, `not_provided`, `check_failed`, `conflicting`) for climate facts. The safe present-tense label is **contract unsupported**.

### 2. Provider and endpoint coverage

| Provider/path | Current role and payload inspected | Climate-capable source signal | Current normalized result | What may be concluded |
| --- | --- | --- | --- | --- |
| Booking.com via `booking-com15` RapidAPI | Active in `/api/search` and `scripts/snapshot-job.ts`. Search payload maps property identity, coordinates, rating/class, photo, and gross price. No property-detail or room-detail call exists. | None in the repository contract or fixtures. The official Booking.com Demand API is a different integration and cannot prove this adapter's fields. | Cooling 0%; heating 0%; guest control 0%; property/room/rate/selected-stay scope 0%; seasonal, source wording, and climate freshness 0%. | Every successfully normalized offer is climate-contract-unsupported. Do not relabel it as supplier-reported absence or a failed check. |
| Hotelbeds | Adapter is implemented but not called by `/api/search`. Booking API availability maps room/rate price only. Content API call requests `fields=images`; facilities and room facilities are neither requested nor typed. | Official Hotelbeds Content API distinguishes a facility applying to all rooms from `roomFacilities` on a specific room and supports explicit true/false flags. It also distinguishes public-area air conditioning from room-facility group data. | 0% for all three dimensions and all scopes in this adapter. | There is plausible property/all-room/room-category source data, but no approved mapping or live sample. Static content joined to a room code is not by itself selected-rate confirmation. |
| Hotellook | Legacy hotel-alert path plus document-readiness use. Cache entry accepts an untyped `amenityEvidence`, then runs the access-only normalizer. | No climate capability is established by repo fixtures or current provider documentation in scope. | 0% for all climate dimensions/scopes; any climate-like ID would currently be dropped. | Treat as contract unsupported. Do not infer from hotel location, class, photos, or property type. |
| Saved-deal snapshot feed | `lib/pipeline/snapshot.ts` rotates direct RapidAPI sources and stores property/price snapshot fields. `/deals` renders those rows through `DealCard`; saved detail reconstructs a minimal `HotelOffer` with source `expaify`. | No amenity, room, rate, provenance, or climate fields are stored. | 0% for all climate dimensions/scopes. Provider-level climate coverage cannot be reconstructed from saved rows. | This surface needs an evidence source and provenance before it can make any climate statement. |

#### Coverage calculation rules

For a successfully displayed offer under the current contract:

- **Supported and reported:** 0% for cooling, heating, and guest control.
- **Explicitly absent:** 0% observable; explicit negatives are not representable as climate facts.
- **Conflicting:** 0% observable; climate conflicts are not representable.
- **Check failed:** 0% observable; no climate check is attempted and no independent climate load state exists.
- **Not returned:** not calculable for climate; there is no supported climate field whose omission is recorded.
- **Contract unsupported:** 100% of current offers on every inspected path.
- **Selected-room/rate confirmation threshold:** 0%.

These percentages are structural invariants of the inspected mapping, not estimates from a supplier sample. Once a provider contract exists, reporting must use actual displayed-offer denominators by provider, endpoint, cache/live source, dimension, and scope; it must not merge unsupported, omitted, failed, conflicting, and explicit-negative states.

### 3. Comparison and detail surfaces

#### Live deal comparison (`/deals`)

`DealFeed` renders `DealCard`, not `HotelCard`. `DealCard` carries price, median, discount, hotel class, dates, outbound links, quiet-stay evidence, and disruption evidence. It has no climate input or output. The snapshot-backed row does not preserve the supplier or a room/category identifier capable of supporting climate evidence.

#### Search-result `HotelCard`

`HotelCard` contains a mature evidence pattern for access, policies, transport, price scope, and hotel quality, but repository usage outside tests is absent. Its access summary and expanded ledger accept only the access allowlist; climate facts are unavailable. Designing only for `HotelCard` would not repair the current live deal-comparison experience.

#### Saved-deal detail

`app/deals/[dealId]/page.tsx` shows property/stay, price and Deal Score, hotel fit, provider handoff, and supporting evidence. It carries no climate evidence. More importantly, when dates exist it says, `Rate shown for this stay context; the provider confirms room-level details.` The stored deal has no room-level evidence, so this blanket statement can cause a traveler to overgeneralize confirmation to climate control. It must be narrowed before or alongside any climate treatment.

#### Booking review and provider handoff

`BookingHotelContext` preserves multiple evidence families but omits amenity/climate evidence. `buildBookingHotelContext`, inline serialization, stored-context validation, and `HotelDecisionSummary` therefore lose any future climate claim. Current handoff guidance asks the traveler to confirm smoking and other provider details, but has no separate cooling, heating, or adjustability check.

After the outbound click, expaify can observe only its own tab becoming hidden and visible again. It cannot observe which rooms were inspected, whether a booking was completed, what the provider displayed, or why a traveler returned.

### 4. Analytics and measurement validity

The intended return sequence exists in `BookingFlow`: continue click, page hidden/visible, `hotel_handoff_returned`, then an optional mismatch prompt. However, the production internal sink does not currently preserve the sequence as emitted:

- `hotel_handoff_returned` is allowlisted with only `source`, `partnerHost`, and `awayDurationBucket`, while `BookingFlow` also emits `policyState` and `obligationTypes`. The API rejects any non-allowlisted property, so the whole event payload is rejected rather than partially stored.
- `hotel_handoff_return_reason_selected` is emitted with reason, offer/provider, partner host, and handoff session ID, but the event is absent from the analytics event registry and is rejected.
- The present reason `Other hotel details did not match` is not climate-attributable.
- An optional external collector might receive client events if configured, but that cannot substitute for the validated internal baseline without confirming its schema, retention, consent, and join behavior.

Therefore current measurable baselines are:

- climate-evidence exposure rate: unavailable;
- climate comparison-abandonment rate: unavailable;
- internally persisted eligible provider-return rate from this handoff implementation: unreliable until schema/emission align;
- internally persisted climate mismatch rate: unavailable.

## Provider-capability guidance, not current-code evidence

### Booking.com

Booking.com's official Demand API separates search, availability, and details. Its details endpoint can return property facilities and room definitions; search supports a `room_facilities` filter and documents air conditioning as room-facility ID 11 ([Booking.com search examples](https://developers.booking.com/demand/docs/accommodations/search-examples), [details guide](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details)). This establishes that a properly contracted integration can distinguish at least a property facility catalog from room-facility criteria. It does **not** establish that expaify's current RapidAPI search response contains those fields, nor does the documentation inspected establish heating, guest-adjustable control, seasonal operation, or selected-rate guarantees.

### Hotelbeds

Hotelbeds documents two distinct room-facility scopes: `roomFacilities` for a specific room code and facility-group 60 entries applying to all rooms. It also documents `indLogic`/`indYesOrNo` true and false as present and absent, and separately identifies `Air conditioning in public areas` as a property facility ([room-facility scope](https://developer.hotelbeds.com/documentation/hotels/content-api/how-read-facilities-available-room/), [facility logic](https://developer.hotelbeds.com/documentation/hotels/content-api/some-tips-understand-main-features-within-facility/)). That is strong support for a future normalizer preserving room-category versus all-room/property scope and explicit negatives. It does not authorize rewriting static room content as confirmation for a selected rate or stay without a verified room/rate join and conflict check.

## Reference-pattern comparison

### Booking.com: room category first, rate choice beside it

Current Booking.com availability tables place climate attributes such as `Air conditioning`, `Heating`, and in some cases `Single-room air conditioning for guest accommodation` inside a named room's feature summary, beside occupancy, rate conditions, price, and the room-selection control ([representative room table](https://www.booking.com/hotel/tr/safir-corlu.en-gb.html)). The useful interaction pattern is scope through containment: the attribute is attached to the room category the traveler is comparing, not shown as an undifferentiated property badge.

**Delta:** expaify has neither a room-category object nor a climate row, and its current saved-detail copy broadly says the provider confirms room-level details without identifying any confirmed attribute. expaify must label scope explicitly because its evidence will often be sparse and less specific.

### Expedia: property amenities and room amenities are separate disclosures

Current Expedia property pages separate `Property amenities` from `Room amenities`; room amenities can state `Air conditioning (climate-controlled)` and `Heating (climate-controlled)` under a dedicated room section ([representative Expedia property](https://www.expedia.com/Holic-Hotels-AIR-Hotel.h32935735.Hotel-Information?rfrr=HOT.HIS.question.link.click)). The interaction pattern makes a traveler open the room-specific disclosure rather than treating every property facility as an in-room fact.

**Delta:** expaify has no climate disclosure at either level and no unknown-state language. Expedia's wording is supplier content, not a model for expaify to infer “guest adjustable”; expaify may use that conclusion only when the source explicitly supports individual control.

### Shared pattern and limit

Both references place high-value room attributes near the room/rate decision and distinguish room content from general property content. Neither reference consistently exposes provenance, freshness, or a first-class unknown state. expaify should adopt the scope-and-hierarchy pattern while adding conservative evidence-state language; visual mimicry and subjective comfort promises are unnecessary.

## Validated research plan

### Certainty-comprehension study

Run a moderated first-use test with 12 travelers who booked a hotel online in the last 12 months, including at least four who describe room temperature control as a must-have. Do not recruit or segment on medical diagnosis. Randomize hotel names, price order, and scenario order to reduce brand and price bias.

Test five fixtures, with cooling, heating, and guest control always asked separately:

| Fixture | Evidence shown | Correct interpretation |
| --- | --- | --- |
| Selected room/rate | Cooling present and guest-adjustable at selected-room/rate scope; heating not provided | This room/rate confirms cooling and guest adjustment; heating is unknown. |
| Room category | Heating present for a named room category; control not stated | The category reports heating; guest adjustment and selected-rate guarantee are not established. |
| Property only | Air conditioning reported at property scope; control not stated | The property reports cooling; the selected room and guest control are not confirmed. |
| Explicit negative | Cooling explicitly absent for the named room category | Cooling is reported absent for that category; this is not missing data. |
| Missing/failed/conflict | One not provided, one check failed, one conflicting | None may be converted into presence or absence; each limitation remains distinct. |

For each fixture ask, without leading terms: “What do you know about cooling?”, “What do you know about heating?”, “Can you adjust the room temperature yourself?”, and “What does this apply to?” Then ask the participant to choose between two hotels and explain the evidence difference. Capture answer accuracy before confidence.

Release gate:

- at least 10 of 12 participants correctly identify each dimension's state and scope in every property-only and unavailable fixture;
- no more than one participant treats property-only, room-category-only, not-provided, failed, or conflicting evidence as a selected-room guarantee;
- at least 10 of 12 distinguish explicit absence from missing evidence;
- all tasks are completable by keyboard and with the screen-reader text prototype at 375px and 1280px.

If the gate fails, revise hierarchy/copy and rerun the failed fixtures. Self-reported confidence cannot override an incorrect answer.

### Privacy-bounded availability and abandonment measurement

#### Evidence availability

For each displayed offer, log low-cardinality server-derived fields only: provider, surface, endpoint/capability version, cache/live, dimension, evidence state, most-specific scope, qualification-present, observed-time-present, and selected-room-threshold met. Never send supplier prose, hotel name, room name, desired temperature, health information, or free text to analytics.

Report provider denominators separately. An adapter-unsupported offer, provider omission, check failure, explicit absence, and conflict are five different cohorts. Publish no rate for a cohort below the product's privacy minimum; do not combine small cohorts merely to produce a number.

#### Comparison behavior

An eligible comparison session requires at least two genuine hotels rendered and an actual climate treatment exposed. Report these next observable actions: detail opened, another hotel opened, review reached, search changed, provider handoff started, or no further observed action within the predeclared session window. The last state is an **abandonment candidate**, never climate causation.

Compare confirmed-selected-room, room-category, property-only, mixed, and unavailable cohorts while stratifying by provider, result-count bucket, viewport, and whether prices were current. Do not infer motivation from dwell time, tab closure, or away-duration bucket.

#### Provider-return mismatch

First align analytics emission and allowlists so continued, returned, and optional reason events persist under one opaque handoff-session ID. After a detected return, offer one optional single-select prompt:

- Cooling was missing or did not match
- Heating was missing or did not match
- Room temperature adjustment was not confirmed
- Climate details were missing on the provider
- Something unrelated did not match
- Prefer not to say

Report climate reasons only per eligible returned handoff. A return without a selected reason is unattributed. Do not collect explanations, health context, desired temperatures, or room numbers. The prompt must not block return navigation and must remain dismissible.

## Exact gap

Current code:

- cannot represent the three climate dimensions or their conflicts/qualifications;
- requests no climate-capable property/room detail on active search;
- drops unknown amenity IDs in the legacy adapter;
- stores no climate/provenance in deal snapshots;
- shows no climate evidence on the live comparison, saved detail, or review;
- includes an over-broad room-confirmation sentence on saved detail;
- loses climate evidence at booking-context serialization;
- cannot persist the current return/mismatch analytics sequence internally.

Reference/provider patterns:

- attach attributes to property, all-room, or named-room scopes;
- place room attributes beside room/rate choice;
- distinguish public/property facilities from room amenities;
- can preserve explicit provider negatives and, with the right contract, source wording.

The delta is a conservative, provider-neutral climate ledger carried end to end—not a generic A/C badge, comfort score, inferred recommendation, filter, or ranking change.

## Design directives for UXDES

1. **Specify one three-row evidence ledger, never one climate badge.** Cooling, heating, and room-temperature adjustment must each render a textual state from the discovery taxonomy, the most-specific scope, provider label, observed time, and any operating qualification. `not provided`, `check failed`, `conflicting`, and `explicitly absent` require distinct final copy and assistive text. Test: no fixture can produce “climate controlled,” “comfortable,” or “your room has…” unless every stated claim independently meets its scope threshold.

2. **Design for the live surfaces and preserve hierarchy.** Provide treatments for `DealCard` in `/deals`, saved-deal detail, and booking review; do not make `HotelCard` the only target. On a collapsed comparison card, use at most one secondary climate summary after core hotel fit and before the action; on detail/review, expose all three rows before provider handoff. At 375px and 1280px, price and Deal Score remain primary, the provider action remains reachable, labels wrap without overlap, and state is not conveyed by color/icon alone.

3. **Make scope explicit and narrow the existing blanket confirmation.** Final copy must distinguish `At this property`, `For this room category`, and `For this room and rate`. Property or all-room content must never be rewritten as selected-rate confirmation, and missing control language must read `Room temperature adjustment not stated`. Replace `the provider confirms room-level details` with copy limited to what the stored stay/price evidence actually proves. Test: the property-only and room-category comprehension fixtures meet the 10/12 gate.

4. **Carry the same evidence into review and make provider verification actionable.** The spec must preserve all three dimensions, source, scope, freshness, qualification, and conflicts through booking context. The handoff checklist repeats only unresolved dimensions and does not downgrade earlier facts. On provider return, offer the bounded climate mismatch reasons above. Test: a fixture retains byte-equivalent semantic values from provider normalization through card, detail, stored/inline review context, and return prompt.

5. **Design every capability/load state and its measurement contract.** Cover unsupported provider, not returned, loading, check failed, partial, explicit absence, conflict, stale evidence, and confirmed evidence separately, including keyboard focus, retry behavior where a check exists, and screen-reader announcements. Define low-cardinality exposure fields and the comprehension/behavior release gates in the spec; do not ship a climate-attributed abandonment claim until the internal analytics schema accepts and joins the required events.

## Constraints carried forward

- All supplier facts and endpoint calls remain in `lib/providers`; components never parse vendor facility codes or prose.
- Cooling, heating, and guest control remain independent. Missing control wording never becomes individually controlled climate.
- Money, Deal Score, ranking, and filters are unchanged. Climate evidence does not influence the price verdict.
- Only provider-stated facts may appear. Weather, geography, photos, reviews, hotel class, and price are not evidence.
- No copy promises comfort, effectiveness, quietness, reliability, or a temperature range.
- Cache/live provenance and the six-hour search-cache policy remain observable; stale facts do not silently read as current.

## Blockers and out-of-scope findings

### Blockers

- **No current supplier sample:** credentials and representative payloads are unavailable in this worktree. Official docs show possible future fields, not current RapidAPI coverage. A DEV/provider-contract ticket must obtain approved sample payloads before assigning supplier prevalence.
- **No selected-room object:** expaify currently compares property offers and delegates room selection to the provider. Selected-room/rate confirmation remains 0% until an approved contract exposes an attributable room/rate join.
- **Disconnected live surfaces:** `HotelCard` is not mounted in a production path; `/deals` uses `DealCard` backed by a separate snapshot model without climate provenance.
- **Broken internal return measurement:** emitted return and reason payloads do not match the analytics allowlist, so internal climate return/mismatch measurement requires repair before baseline collection.

### Out of scope

- Climate filters, ranking changes, Deal Score changes, provider scraping, a new supplier, weather data, review mining, photo inference, HVAC performance/noise/maintenance ratings, desired-temperature capture, medical profiling, smart-room control, and post-stay comfort claims.
- The snapshot pipeline makes direct external hotel calls outside `lib/providers`; that violates the repository's provider boundary but is not repaired by this UXR ticket.
- Broader room-inventory architecture, provider contracting, analytics implementation, and UI implementation require downstream tickets.

## Handoff

Create `UXDES-HOTEL-CLIMATE-CONTROL-01` to specify the end-to-end three-row climate ledger and its exact copy/states for `DealCard`, saved detail, and booking review; scope labels and narrowed confirmation language; booking-context continuity; bounded mismatch feedback; analytics exposure schema; 375px/1280px layouts; loading/empty/error/conflict/stale states; keyboard and screen-reader behavior; and the comprehension fixtures/release gate above.

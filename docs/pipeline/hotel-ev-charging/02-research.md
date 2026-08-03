# UX Research — Hotel EV-Charging Confidence

**Ticket:** `UXR-HOTEL-EV-CHARGING-01`  
**Stage:** UX Research  
**Priority:** P0  
**Date:** 2026-08-03

## Source inputs and method

- Discovery: `docs/pipeline/hotel-ev-charging/01-discovery.md`
- Current code audited directly:
  - `lib/types.ts`
  - `lib/providers/hotelAmenityEvidence.ts`
  - `lib/providers/hotellook.ts`
  - `lib/providers/hotelbeds.ts`
  - `lib/providers/bookingComHotelsRapidApi.ts`
  - `app/api/search/route.ts`
  - `app/components/HotelCard.tsx`
  - `app/components/ui/DealCard.tsx`
  - `app/deals/DealFeed.tsx`
  - `app/deals/[dealId]/page.tsx`
  - `app/components/HotelDealCriteria.tsx`
  - `lib/booking/config.ts`
  - `app/book/BookingFlow.tsx`
  - `app/components/HotelDecisionAnalytics.tsx`
  - `lib/analytics.ts`
- Current provider/reference documentation:
  - Booking.com Demand API, [About accommodations](https://developers.booking.com/demand/docs/accommodations/about-accommodation)
  - Booking.com Demand API, [Retrieve accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details)
  - Expedia Group Rapid, [Sustainability attributes](https://developers.expediagroup.com/rapid/lodging/content/sustainability?locale=en_US)
  - Expedia Group Rapid, [Content reference lists](https://developers.expediagroup.com/rapid/lodging/content/content-reference-lists)
  - Google Travel Help, [Sustainability in hotels](https://support.google.com/travel/answer/10976106?hl=en)
  - Google Hotel Center Help, [Add your sustainability practices](https://support.google.com/hotelprices/answer/11044341?hl=en)

This was a static contract and interaction-pattern audit. No production payload corpus, provider credentials, traveler interviews, EV-filter analytics, property calls, charger telemetry, or live connector feed was available. The relevant provider environment variables were absent in the worktree, so no authenticated supplier sample could be collected. Coverage findings below are therefore contract coverage, not an estimate of how many hotels actually have chargers.

## Research question

Can expaify truthfully distinguish a provider-listed on-property charger, a provider-listed charger with a documented usability limitation, missing charging evidence, and an explicit no-charger statement—without users reading any of those property facts as a working connector for their dates?

## Decision

**Narrow before proceeding.** The three-state comparison model is useful, but the discovery definition of **Confirmed** must not imply that charging is unrestricted. Current and plausible supplier content can establish that a source *lists* an EV-charging facility at the property. Silence about access, cost, reservation, connector, power, operator, or hours does not establish that those dimensions are unrestricted.

Use these decision outcomes:

1. **Listed on property** (presentation label may remain **Confirmed**): a named provider returns an explicit on-property EV-charging facility. Say **“[Provider] lists EV charging at this property.”** Unknown restriction fields remain visible as not provided; they do not erase the positive presence fact and do not become “no restrictions.”
2. **Limited:** the provider lists on-property EV charging and returns at least one material condition: paid, guest/staff/valet-only, reservation required, first come/limited, connector or power limitation, third-party operation, limited hours, or other structured compatibility/access constraint. Name the condition; never use **Limited** alone.
3. **Unknown:** the provider does not return a usable on-property EV-charging fact, returns malformed/conflicting evidence, or returns only off-property/nearby charging. Unknown is not no charging.
4. **No on-property charging:** a separate explicit negative fact from a named source. It is neither **Limited** nor **Unknown**.

This validates the state architecture but blocks a positive production treatment today: every current hotel adapter yields no usable EV-charging evidence by contract, and the normalizer would discard an EV item even if one appeared. UXDES may specify all states, but UI/DEV must not ship positive fixtures as production facts until a provider sample and mapping pass the evidence gate below.

## Current-code evidence

### 1. The common evidence envelope is reusable, but EV usability has no representation

`HotelAmenityEvidence` already preserves `status`, `scope`, `sourceLabel`, optional `fetchedAt`, coarse fee, confidence, and certainty (`lib/types.ts:120-147`). `HotelOffer` can carry an array of that evidence plus an access load state (`lib/types.ts:687-703`). These primitives correctly separate `confirmed`, `unavailable`, `not_returned`, and `unknown` and distinguish property from selected-stay scope.

The delta is EV-specific structure:

- no canonical EV-charging identifier;
- no access-restriction array;
- no charging-cost amount or basis;
- no connector, power/level, operator, hours, or access-instruction fields;
- no field separating property presence from selected-stay/live connector availability;
- no conflict dimensions or evidence revision for deterministic degradation.

The generic object is a suitable provenance envelope, but not a complete charging decision record. A charging fee must use integer `Money` plus a charging basis; it must never be folded into `pricePerNight` or Deal Score.

### 2. The current normalizer actively drops EV evidence

`ACCESS_FACTS` accepts only elevator, on-site parking, step-free route, and four room requests (`lib/providers/hotelAmenityEvidence.ts:18-25`). `normalizeItem` rejects every unknown id before status, scope, and source validation (`:109-133`). Therefore an item such as `ev_charging` or `electric_car_charging_station` is silently omitted and replaced by the existing canonical facts as `not_returned` (`:151-176`). Fee normalization is explicitly limited to `on_site_parking` (`:143-144`).

The duplicate precedence is conservative—explicit unavailable wins over unknown, not-returned, and confirmed—but it cannot preserve *presence confirmed plus a separate limitation*. EV charging needs one normalized record with independent presence and restriction dimensions, not mutually destructive duplicate status records.

### 3. Every current provider path has zero usable EV coverage by declared contract

| Current path | Payload fields actually consumed | EV result |
|---|---|---|
| Hotellook live/cache | identity, location/address, stars, price, plus optional already-normalized `amenityEvidence` | The vendor-shaped contract has no native charging field. Any enriched EV id would be discarded by the shared normalizer. |
| Hotelbeds | availability response: identity, category, destination/zone, coordinates, rates; content request: images only | Adapter calls `normalizeHotelAmenityEvidence(undefined, 'Hotelbeds')`; all supported access facts become `not_returned`. |
| Booking.com RapidAPI aggregator | search result: identity, coordinates, ratings/class, photos, gross price | Adapter calls `normalizeHotelAmenityEvidence(undefined, 'Booking.com')`; no detail/facilities endpoint is called. |
| Saved-deal snapshot/feed | property identity, market, dates, rate history, image, and OTA links | No amenity or EV field is stored or passed into the active result/detail surfaces. |

The absence of provider credentials prevented a live sample, but it does not change this result: the TypeScript response shapes and mapping code have no route for an EV fact. Contract coverage for on-property status, restriction, cost/basis, reservation rule, connector/power, operator, and hours is **0 of 3 current hotel adapters**. Freshness is also unavailable for EV evidence.

### 4. The richer `HotelCard` is not the active results surface

`HotelCard` normalizes amenity evidence defensively and has a tested expandable evidence panel. It ignores unknown amenity ids and only promotes a sourced, property-scoped guaranteed elevator in its collapsed state; it contains no EV summary or section. More importantly, a repository-wide render search finds `HotelCard` only in its own tests.

The active hotel results are `DealFeed` → `DealCard`. `DealCard` receives property identity, price/median/discount, dates, snapshot count, links, and optional disruption/quiet-stay evidence (`app/components/ui/DealCard.tsx:17-49`). Its visible and accessible result content contains no general amenity or charging slot (`:71-169`). `DealFeed` builds this narrower shape from saved deal rows, not `HotelOffer`.

The implementation target is therefore the active `DealCard` plus saved-deal detail flow. Designing only for `HotelCard` would not repair the user journey.

### 5. The active detail page has a logical placement but no charging data

`app/deals/[dealId]/page.tsx` orders the decision surface as property/stay, price and Deal Score, cancellation, **Hotel fit**, provider handoff, then supporting evidence (`:361-460`). **Hotel fit** currently contains hotel class, an explicit unknown guest rating, disruption evidence, and quiet-stay evidence. This is the correct semantic home for property-level charging detail before handoff, provided price, Deal Score, and the main provider action retain their hierarchy.

The page constructs a minimal `HotelOffer` only inside Deal Score computation, without amenity evidence (`:221-233`). The page's database row and handoff props likewise carry no charging record. A UI treatment cannot recover evidence at render time without upstream storage/provider work.

### 6. Both handoff paths lose charging continuity

The reusable `/book` path defines and validates `BookingHotelContext`, but the context has no amenity or charging field (`lib/booking/config.ts:70-98`). `buildBookingHotelContext` selectively copies funds, smoking, eligibility, admission, and transport evidence, not `amenityEvidence` (`:1206-1238`).

The active saved-deal detail does not use that context. `HotelDealCriteriaHandoff` receives direct OTA links and says the provider confirms live availability and booking terms (`app/components/HotelDealCriteria.tsx:217-251`). It has no bounded charging snapshot or unresolved charging task. A user can therefore choose a hotel because of a future result signal and arrive at the provider action with neither the selected EV state nor the caveat that connector availability is not live.

UXDES must cover both architectures explicitly: the active direct-OTA handoff is the P0 target; the reusable `BookingHotelContext` must gain the same bounded record if `/book` remains a supported hotel path.

### 7. Existing analytics can measure section reach, but not EV comprehension or continuity

`HotelDecisionAnalytics` emits detail view, 50%-visible-for-one-second section reach, provider handoff start, and back-to-results events. `DealFeed` emits result view and card-open events. No event includes EV state, completeness, limitation categories, detail exposure, property switch after EV review, or unresolved EV handoff.

The existing reach observer is a sound implementation precedent. It is not an EV behavioral baseline: no EV surface exists, and `lib/analytics.ts` does not create historical product evidence for the missing events. Causal copy such as “changed because of charging” remains unsupported; sequence language must be “after charging review.”

## Provider-coverage validation

### Plausible Booking.com Demand path

Booking.com's official Demand API separates availability search from static property details. `/accommodations/details` can return `facilities` when requested; each facility has an identifier and may include attributes such as `paid` or `offsite`, while `/accommodations/constants` supplies identifier meanings. This can plausibly support a named property facility, coarse cost state, and rejection of off-site evidence from the on-property state.

It does **not**, from the documented generic facility example, establish EV-specific reservation rules, guest access, connector, power, operator, hours, or a working connector for selected dates. The richer `facility_details.parking_facilities` vocabulary must not be joined onto EV charging merely because both involve parking. A parking reservation rule is not automatically a charger reservation rule.

### Plausible Expedia Rapid path

Expedia Rapid documents property amenity ID `1073743315` as **Electric car charging station**. Its reference model distinguishes property-, room-, and rate-level amenities and says amenities may carry an explicit value where applicable; amenities are treated as complimentary unless a surcharge or restriction is specified. This is sufficient to justify sampling a structured property-content feed rather than parsing display prose.

The public documentation reviewed does not guarantee that this specific attribute consistently carries charging price/basis, access, reservation, connector, power, operator, or hours. It also does not make the amenity selected-stay inventory. Those dimensions must remain unknown unless observed in a contracted payload and mapped from structured supplier fields.

### Reference provenance lesson from Google Hotels

Google defines **Electric car charging stations** as a property providing stations where guests can recharge. Google also explains that hotel sustainability practices are self-reported by properties and not independently verified by Google. The relevant interaction lesson is attribution and hierarchy: a positive facility appears as a property detail with a defined meaning, while provenance limits remain separate from certification or live availability.

For expaify, provider presence is evidence that the provider/property lists a facility—not proof that expaify verified hardware, access, compatibility, uptime, or availability. Avoid the bare phrase **Provider confirmed** unless the exact verification method is contractually known.

### Field readiness and evidence gate

| Field | Current adapters | Plausible structured supply | Release rule |
|---|---|---|---|
| On-property presence | Unsupported | Booking facility + non-offsite attribute; Expedia property amenity | Require canonical id, property scope, named source, fetched time. |
| Explicit no charging | Unsupported | Not demonstrated in reviewed samples | Absence is not negative; require explicit supplier negative. |
| Access restriction | Unsupported | Not demonstrated for EV specifically | Remain unknown until structured EV-specific field is sampled. |
| Cost state | Unsupported | `paid`/surcharge is plausible | Preserve included/paid/unknown; exact cost requires integer money and basis. |
| Exact cost + basis | Unsupported | Not demonstrated | Never parse display prose or estimate. |
| Reservation / first come | Unsupported | Not demonstrated for EV specifically | Do not reuse general parking reservation fields. |
| Connector / compatibility | Unsupported | Not demonstrated | Display provider label only; never infer vehicle fit. |
| Power / charging level | Unsupported | Not demonstrated | Never calculate charge time. |
| Operator / hours | Unsupported | Not demonstrated | Optional only when explicitly structured. |
| Live selected-stay availability | Unsupported | Static content does not supply it | Always out of scope for this ticket. |

Before positive production copy, DEV/provider validation must sample at least 100 displayed offers per intended provider across at least five markets and dated/undated contexts where applicable. Report: explicit positive presence, explicit negative, off-site-only, malformed/conflicting, and unknown shares; then field coverage among positives. Manually inspect at least 20 positive records against the provider-facing property detail to verify scope and wording. If fewer than 20 positives are found, report the full positive census and treat limitation-field estimates as directional only.

**Go gate:** at least 95% of normalized positive records in the manual sample match an on-property EV facility and 100% retain source/scope/fetched time; malformed, conflicting, off-site-only, and missing data degrade to Unknown; no record implies live availability. Otherwise stop positive UI release and ship only an evidence-unavailable design fixture for continued research.

## Reference-pattern comparison

### Pattern 1 — Booking.com: search/availability first, structured facility detail second

The documented architecture retrieves available properties and prices through search, then requests optional facilities from property details. Facility identifiers are resolved through a constants vocabulary, and attributes can qualify facility presence (for example paid or off-site).

Guidance for expaify:

- keep the result signal compact and evidence-backed;
- use detail to expose fixed-order qualifiers and provenance;
- reject off-site-only charging from the on-property positive state;
- do not merge generic parking restrictions into charging;
- treat property details as static facility content, not selected-stay connector inventory.

Current delta: expaify's active results are saved rate records without a facility-details join, and its Booking.com aggregator calls only search. There is no canonical constants mapping or EV detail fetch.

### Pattern 2 — Google Hotels: defined property practice with explicit source limits

Google places property-reported practices on the hotel detail surface and explains the meaning and provenance separately. Missing sections do not establish that a property lacks a practice; Google directs users to another source when information has not been reported.

Guidance for expaify:

- attribute the listing to the provider/property instead of implying expaify verification;
- distinguish absent evidence from an explicit negative;
- keep the property fact separate from compatibility and operational availability;
- provide a clear next confirmation task at provider handoff.

Current delta: expaify has neither EV copy nor a carried source record, and its handoff copy names live room availability without naming unresolved charging availability.

## Design directives for UXDES

### 1. Make results distinguish the four factual outcomes without introducing a filter

Add one compact charging line to the active `DealCard` after property/date identity and before price/action only when a normalized charging record exists. Final state semantics:

- **Confirmed:** `EV charging listed on property · [Provider]`.
- **Limited:** `EV charging listed · [primary limitation]` with remaining limitation count available in the accessible name; paid with unknown amount is `Paid · amount not provided`.
- **Unknown:** `EV charging details not provided` or `On-property charging not confirmed` for off-site-only/conflict/malformed evidence.
- **Explicit negative:** `[Provider] reports no EV charging on property`.

Never show only a lightning icon, color, **EV ready**, **available**, **free**, or **compatible**. At 375px the line may wrap to two lines below identity but must not truncate the limitation or displace nightly price, Deal Score/savings, photo, or **View deal**. At 1280px it may remain one row. Do not add filtering, sorting, ranking, or Deal Score impact.

**Test:** confirmed, limited-paid, limited-reservation, unknown-missing, unknown-off-site, conflict, and explicit-negative fixtures each have different visible and screen-reader meanings; only the whole card remains the result link, so no nested interactive disclosure is added.

### 2. Put a fixed-order EV section in active **Hotel fit**, with every missing/error state specified

Add **EV charging** to the active saved-deal detail before provider handoff. Read facts in this order: (1) on-property status, (2) access/reservation restrictions, (3) cost and basis, (4) connector/power, (5) operator/hours/instructions, (6) source and checked time. Each field must have an explicit unknown outcome; omit no qualifier in a way that implies “none.”

Initial loading says **Checking EV-charging details…**; refresh retains known evidence and says **Refreshing EV-charging details…**; error says **EV-charging details could not be checked. Confirm charging location, access, cost, compatibility, and availability with the provider.** Conflict/malformed says **Charging information is unclear** and names no disputed positive. Off-site-only says **No on-property charging evidence; the provider lists charging away from the property** only if off-site scope is explicit.

The section is informational, uses its heading as the accessible group name, and follows normal DOM order. Live status updates are polite and do not move focus. If a disclosure is needed for secondary details, it is a native button with `aria-expanded`/`aria-controls`; Enter and Space toggle it and focus remains on the control. Use one column at 375px and no more than two columns at 1280px, preserving each fact/value pair as one reading unit.

**Test:** every default/loading/refresh/error/empty/unknown/explicit-negative/limited/conflict state renders at 375px and 1280px without overlap, clipped limitation text, or color-only meaning; keyboard and screen-reader order matches the visible order.

### 3. Preserve the displayed record and one unresolved task through both handoff architectures

The active direct-OTA handoff and reusable `/book` context must carry bounded normalized fields—not vendor prose or raw instructions: presentation state, property status/scope, limitation categories, coarse cost plus optional integer money/basis, optional connector/power/operator/hours labels, source, fetched time, and evidence revision. Validation must degrade invalid or conflicting data to Unknown without blocking the affiliate link.

Immediately above provider actions, repeat the selected state and use exactly one next step:

- Confirmed: **`[Provider] lists charging at this property. Connector availability is not live; confirm access and compatibility before you pay.`**
- Limited: **`Charging has a documented condition: [condition]. Complete or confirm the requirement with the provider; expaify has not reserved a connector.`**
- Unknown: **`On-property charging has not been confirmed. Check location, access, cost, compatibility, and availability with the provider before you pay.`**
- Explicit negative: **`[Provider] reports no EV charging on property.`**

Provider-action accessible names include **Charging availability not live** for Confirmed/Limited and **On-property charging not confirmed** for Unknown. Charging cost remains separate from the room total unless a separately validated rate-total contract explicitly includes it. Affiliate markers and current provider-link validation remain unchanged.

**Test:** serialization/validation round trips the same state and source on result, detail, direct handoff, and `/book`; malformed or oversized input degrades safely; no state says a connector is working, open, reserved, compatible, or available for the selected dates.

### 4. Instrument verified exposure and validate comprehension before positive release

Use bounded values only: `offer_id`, normalized `provider`, `surface`, `state`, `completeness_bucket`, `limitation_categories`, `viewport_group`, and `evidence_revision`. Do not emit raw instructions, URLs, vehicle details, coordinates, connector prose, or price amounts.

- `hotel_ev_charging_state_impression`: once when 50% of the result signal is visible for 500 ms.
- `hotel_ev_charging_details_opened`: on explicit EV disclosure activation only; a card open alone does not count.
- `hotel_ev_charging_section_reached`: once after 50% visibility for one continuous second.
- `hotel_ev_charging_property_changed_after_review`: only when a reached detail is followed by return to results and opening a different property in the same search.
- `hotel_ev_charging_handoff_continued`: provider action after section reach, with whether a confirmation task remains.

Report sequences as **after charging review**, never **because of charging**. Prototype release gate: at least 85% correct on each trust-critical task below, zero participants claiming real-time availability from Confirmed/Limited, and no more than one participant treating Unknown as explicit no charging. Validate with 8–10 EV drivers, counterbalancing 375px and 1280px.

**Test:** impressions/reaches deduplicate by search + offer + surface + evidence revision; detail-open requires an EV-specific action; browser abandonment does not become property change; no raw supplier text enters analytics.

## Measurement and comprehension specification

### Coverage definitions

- **Evidence-backed presence coverage:** offers with explicit sourced on-property confirmed or unavailable status / unique displayed offers.
- **Decision-state coverage:** offers deterministically classified as Confirmed, Limited, Unknown, or explicit negative / unique displayed offers. Unknown counts here because truthful classification is the measure.
- **Limitation coverage:** sourced on-property positives with at least one structured cost/access/reservation/compatibility/power/operator/hours detail / sourced on-property positives.
- **Unknown share:** offers without usable on-property status, including malformed/conflicting/off-site-only / unique displayed offers.
- **Handoff continuity coverage:** handoffs retaining the displayed state, source, revision, and confirmation-task flag / handoffs where an EV state was shown.

Segment by normalized provider, destination market, dates-present status, and viewport. An explicit negative counts as evidence. Provider silence, generic parking, nearby charger data, stale free text, and inferred defaults do not.

Completeness buckets:

- `none`: presence unknown and every limitation field unknown/not returned;
- `presence_only`: on-property presence known; no limitation dimension returned;
- `partial`: presence plus at least one structured dimension returned;
- `decision_ready`: presence plus access, cost, reservation, and connector/compatibility status each explicitly returned, including explicit unknown values from the source;
- `explicit_negative`: sourced no-on-property-charging statement.

No bucket is `live_available`; this ticket has no live-availability contract.

### Prototype tasks

1. **Presence versus live availability.** Show Confirmed with all restriction details unknown. Ask what is known for arrival. Pass: provider lists a property charger; working/open connector for the stay is not known. Fail: charger is guaranteed or reserved.
2. **Limited versus Unknown.** Show a provider-listed paid/reservation-required property beside one with no charging fields. Ask which has a known condition. Pass: Limited property and exact condition; Unknown is missing evidence, not fewer restrictions.
3. **Unknown versus explicit negative.** Ask which hotel is known not to have on-property charging. Pass: explicit negative only.
4. **Cost semantics.** Compare included, paid exact per-session amount, and paid amount/basis unknown. Pass: does not fold charging cost into nightly hotel rate and refuses to calculate unknown cost.
5. **Compatibility boundary.** Show a supplied connector label and no vehicle profile. Pass: can repeat the label but does not claim compatibility or charge time.
6. **Booking continuity.** After choosing a Limited hotel, ask what remains before payment. Pass: restates the limitation and that expaify has not reserved or checked a live connector.
7. **Five-second result scan.** At 375px, identify Confirmed, Limited, Unknown, and explicit negative. Pass: at least three of four correct with no invented availability; observe wrapping and action displacement.

## Acceptance criteria for UXDES

- Covers default, loading, refresh-with-known-evidence, empty/not-returned, error, malformed, conflict, off-site-only, explicit negative, Confirmed, and each Limited category.
- Defines every visible string and accessible name; **Confirmed** never means unrestricted or live available.
- Places the result signal in active `DealCard`, detail in active **Hotel fit**, and continuity in active direct-OTA handoff plus reusable `/book` context.
- Keeps nightly price, Deal Score, property identity, and provider action primary at 375px and 1280px.
- Specifies DOM/focus order, disclosure keyboard behavior, polite live states, and non-color state distinctions.
- Defines bounded analytics and comprehension fixtures without adding an EV filter, ranking, routing, or charger availability.
- Marks positive production rendering dependent on provider sample/mapping evidence, not research fixtures.

## Blockers and out-of-scope findings

### Provider blocker

No current adapter can populate an EV record, and no authenticated payload sample was available. Positive production copy is blocked until a provider detail source passes the evidence gate. This does not block UXDES from specifying the states and fixtures.

### Surface/data blocker

Active results and saved-deal detail are fed by snapshot rows rather than normalized `HotelOffer` amenity evidence. `HotelCard` work alone would not reach users. A future implementation needs an explicit provider-to-snapshot/detail continuity plan.

### Terminology risk

**Confirmed** is likely to be read as verified or available. If UXDES retains the label, every visible instance must pair it with **Provider lists on-property charging** and the no-live-availability boundary. Prototype testing must compare **Confirmed** against **Listed on property**; use the latter if false-certainty is higher for Confirmed.

### Out of scope

- EV filter, sort, ranking, saved preference, or Deal Score changes.
- Charger maps, nearby alternatives, routing, range or charge-time calculation.
- Connector reservation/payment or real-time uptime/availability.
- Vehicle profile or compatibility guarantee.
- Parsing vendor prose in components or merging parking policy into EV policy.
- Provider, UI, booking-context, analytics, or snapshot implementation in this research stage.

## Handoff

Create `UXDES-HOTEL-EV-CHARGING-01` to specify the provider-neutral evidence contract, active result summary, **Hotel fit** detail section, direct-OTA and `/book` continuity, every unknown/error/conflict/explicit-negative state, 375px/1280px behavior, focus/screen-reader rules, final copy, comprehension fixtures, and bounded measurement contract. The design must preserve the narrowed terminology and must not authorize positive production facts before provider evidence passes the stated gate.

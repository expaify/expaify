# UXR-HOTEL-HOUSEKEEPING-FREQUENCY-01 — Hotel Housekeeping-Frequency Research Brief

Date: 2026-08-03  
Stage: UX Research  
Priority: P1  
Feature slug: `hotel-housekeeping-frequency`  
Upstream: `docs/pipeline/hotel-housekeeping-frequency/01-discovery.md`

## Recommendation

**NARROW: validate an evidence-led disclosure in a research prototype, but do not ship a positive production housekeeping expectation until one provider demonstrates usable field coverage.**

The discovery model is semantically necessary but can be smaller in its first presentation. A traveler needs four answer groups, in this order:

1. **Room cleaning:** whether stayover cleaning is documented and its cadence.
2. **Guest action:** whether it is automatic, must be requested/opted into, and any stated channel or cutoff.
3. **Towels and bed linen:** separate statements only when the source distinguishes them.
4. **Applicability and evidence:** property/room/rate/selected-stay scope, source, observed time, and exceptions.

The first three may be summarized in plain language, but the fourth must remain attached to the claim. `Housekeeping available` is not enough evidence to populate any of them. A generic amenity, chain norm, property type, star class, or review must never become a stay-level schedule.

Production is blocked because current normalized coverage is structurally **0% for every housekeeping dimension** and **0% into both handoff paths**. Official provider documentation shows possible content surfaces worth sampling, but no audited expaify adapter currently requests or maps a schedule. No participant sessions were available, so traveler comprehension and confidence are not yet behaviorally validated. UXDES should therefore specify a fixture-backed research prototype and a conditional production contract, not imply that live offers have known service levels.

## Method and evidence limits

This brief combines:

- a static source audit of the live deals feed, saved-deal detail and provider handoff, the separate `HotelCard` → `/book` path, shared types, provider live/cache normalization, and analytics validation;
- a desk review of official Booking.com, Expedia Rapid, Hotelbeds, Google Hotels, Hilton, Marriott, and Hyatt documentation/pages at the interaction and data-contract level; and
- an expert scenario walkthrough of the minimum evidence model across nine policy states.

No authenticated provider payload sample, production coverage export, traveler interview, usability session, or experiment result was available. External property examples show that policy dimensions vary independently; they do not establish coverage for expaify or for an entire brand. The scenario walkthrough validates logical sufficiency and exposes false-inference risks, but it is not evidence of traveler comprehension. The participant plan in §6 is required before a production presentation can be called validated.

## 1. Current-code evidence

### 1.1 The authoritative live path is `DealCard` → saved-deal detail → provider

The populated live deals feed mounts `DealCard` and gives it a saved-deal detail URL (`app/deals/DealFeed.tsx:1893–1927`). The card shows identity, city/date window, nightly price, Deal Score-related price comparison, limited disruption/quiet cues, and `View deal`; it has no housekeeping input or output (`app/components/ui/DealCard.tsx:70–175`).

The saved-deal detail is the authoritative pre-handoff decision surface for this path. It shows calculated stay dates/night count, price and Deal Score, cancellation uncertainty, `Hotel fit`, and then `Check rooms with provider` (`app/deals/[dealId]/page.tsx:290–455`). `Hotel fit` contains class, rating, disruption, and quiet-stay evidence only. `HotelDealCriteriaHandoff` then opens eligible OTA links directly; there is no intervening `/book` review in this path (`app/components/HotelDealCriteria.tsx:127–281`).

**Placement consequence:** for the live flow, the minimum useful disclosure belongs in the saved-deal detail before the provider links and must be repeated in the immediate handoff context. The results card should not gain a universal `Unknown` chip. A compact result cue is justified only when a materially decision-changing, sufficiently scoped statement is actually available.

### 1.2 `HotelCard` and `/book` are a separate, currently unmounted contract

`HotelCard` supports a much richer expanded policy experience and builds a `BookingHotelContext`, but no production TSX file outside tests mounts it. Its review action routes to `/book` (`app/components/HotelCard.tsx:772–910`; `lib/booking/config.ts:1206–1238`). `HotelDecisionSummary` then renders hotel identity, location, price/score, and adjacent policy sections (`app/book/BookingFlow.tsx:335–550`).

This is a valid secondary continuity target if normalized hotel search is made live, but it is not the current saved-deal handoff. UXDES must name both surfaces explicitly instead of treating `HotelCard`, saved detail, and `/book` as one flow. The live saved-deal path is primary; the normalized-offer path must follow the same semantic contract when active.

### 1.3 The data contract cannot represent the policy

`HotelOffer` has no housekeeping-policy field (`lib/types.ts:687–711`). `BookingHotelContext` preserves dates and `nightCount` but no cleaning, request, towel, or linen evidence (`lib/booking/config.ts:70–100`). `buildBookingHotelContext` consequently serializes none of those facts (`lib/booking/config.ts:1206–1238`). The saved-deal database row and handoff component likewise carry no policy record.

The reusable `HotelAmenityEvidence` primitives include source, scope, status, fee, confidence, and freshness, but its normalizer allowlists only elevator, parking, step-free route, and four room requests. Unknown identifiers are discarded (`lib/providers/hotelAmenityEvidence.ts:18–28, 109–117, 151–176`). Reusing its provenance concepts is sensible; adding `housekeeping` as one more amenity ID is not. A cadence/action/linen policy needs its own typed, multi-dimensional evidence because one generic status cannot represent the independent claims.

### 1.4 Current adapter and cache coverage is 0%

The Booking.com RapidAPI adapter requests a search payload, derives price, identity, quality, coordinates, and photo, and explicitly calls `normalizeHotelAmenityEvidence(undefined, 'Booking.com')` (`lib/providers/bookingComHotelsRapidApi.ts:155–200`). The Hotelbeds booking adapter does the same with no content/facility input (`lib/providers/hotelbeds.ts:238–281`). Hotellook can receive a generic `amenityEvidence` value in live or cached data, but the restrictive access normalizer drops an unknown housekeeping identifier (`lib/providers/hotellook.ts:370–410, 495–539`).

Therefore, for the current Booking.com, Hotelbeds, and Hotellook normalized offer paths:

| Dimension | Booking.com adapter | Hotelbeds adapter | Hotellook live/cache | Current usable coverage |
| --- | --- | --- | --- | --- |
| Stayover cleaning exists/does not exist | Not requested or mapped | Not requested or mapped | Not typed; unknown ID dropped | 0% structurally |
| Cleaning cadence | Not requested or mapped | Not requested or mapped | Not representable | 0% structurally |
| Guest action | Not requested or mapped | Not requested or mapped | Not representable | 0% structurally |
| Request channel/cutoff | Not requested or mapped | Not requested or mapped | Not representable | 0% structurally |
| Towel change | Not requested or mapped | Not requested or mapped | Not representable | 0% structurally |
| Linen change | Not requested or mapped | Not requested or mapped | Not representable | 0% structurally |
| Scope/exceptions/fee | No housekeeping claim | No housekeeping claim | No housekeeping claim | 0% structurally |
| Source/freshness | Provider label exists for other facts | Provider label exists for other facts | Provider/fetched time exists for other facts | 0% for housekeeping |
| Continuity to review/handoff | No field | No field | No field | 0% structurally |

These are contract findings, not observations from a random offer sample. An authenticated sample is still required to estimate real upstream availability.

### 1.5 Analytics exists in production, but housekeeping measurement does not

The discovery report says `lib/analytics.ts` logs only in development. Current code is different: development logs locally, while non-development sends to the internal `/api/analytics` sink (`lib/analytics.ts:25–75`). Existing events cover result opens, detail views, section reach, provider handoff, and return behavior (`app/components/HotelDecisionAnalytics.tsx:43–141`; `app/api/analytics/route.ts:12–50`). There is still no housekeeping impression, disclosure open, comprehension response, evidence state, or policy-attributed return reason.

There is also a measurement-integrity risk outside this ticket: several emitted hotel-detail values do not match the analytics route's allowlists (for example, component values `mobile|tablet|desktop` versus route values `mobile_375|desktop_1280|other`, and string section names versus an integer validator). That means existing funnel events cannot be assumed queryable without an analytics audit. This brief does not repair that adjacent system; UXDES should specify new events against the actual server validator, and DEV/TEST must verify acceptance.

## 2. Provider capability and reference-pattern guidance

These references identify possible interaction/data patterns. They do not prove that expaify has access, that a field is populated, or that provider wording is safe to normalize.

### 2.1 Booking.com: details before redirect, but no documented cadence field

Booking.com's official Demand API describes a search → property details → availability/redirect flow. The details endpoint can return facilities, important information, policies, and room details. However, documented typed policy fields cover cots/extra beds, pets, and minimum guest age; facilities are IDs with limited attributes, while property-supplied `important_information` is unstructured. No documented typed stayover-cleaning cadence, request cutoff, towel schedule, or linen schedule appears in the reviewed schema. [Booking.com accommodation overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation), [Booking.com accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details)

Useful pattern: retrieve detail content after selection and keep property facts distinct from room/rate availability. Delta: expaify's current Booking.com adapter uses a third-party search endpoint only and does not perform this detail step. Even if `important_information` mentions housekeeping, it must remain verbatim/ambiguous until a mapping sample proves a stable structure.

### 2.2 Expedia Rapid: scope is explicit, but content presence is not cadence

Expedia Rapid's official content model distinguishes property-, room-, and rate-level amenities and says restrictions/surcharges may be attached. It also distinguishes property-level attributes from room/rate content. This is the strongest reference for keeping scope attached to a fact, but an amenity's presence still does not establish a schedule or selected-stay applicability. [Expedia Rapid content reference lists](https://developers.expediagroup.com/rapid/lodging/content/content-reference-lists), [Expedia Rapid content filtering](https://developers.expediagroup.com/rapid/lodging/content/content-filtering)

Useful pattern: show decision facts on detail, preserve scope, and do not merge property with room/rate. Delta: Expedia Rapid is not a current `HotelProvider` in the audited path. An authenticated content/reference-list sample must identify exact housekeeping IDs/attributes and population rates before it becomes a candidate source.

### 2.3 Hotelbeds: static content must be joined deliberately

Hotelbeds documents a separate Content API for descriptions and facilities and a Booking API optimized for dynamic price/availability. It recommends storing refreshed content rather than calling the Content API in real time. Room facilities may apply either to a specific room or all rooms, and the two sets must be combined deliberately. [Hotelbeds Content API](https://developer.hotelbeds.com/documentation/hotels/content-api/), [Hotelbeds room-facility scopes](https://developer.hotelbeds.com/documentation/hotels/content-api/how-read-facilities-available-room/), [Hotelbeds content refresh guidance](https://developer.hotelbeds.com/documentation/hotels/content-api/how-use-content-api/)

Useful pattern: treat static policy content, dynamic rate context, and room scope as separate sources with their own freshness. Delta: expaify's Hotelbeds adapter calls the Booking API and separately fetches images only; it does not join Content API facilities or rate comments. Facility presence alone is still insufficient for cadence/action/linen claims.

### 2.4 Google Hotels: progressive detail and source humility

Google Hotels uses a progressive pattern: results show a snapshot and key amenities; selecting a property opens a detail page with overview/amenity/room information; booking links then transfer to a partner. Google also states that amenity and room information comes from mixed sources, including properties, partners, research, and user feedback. [Google Travel hotel-search help](https://support.google.com/travel/answer/6276008?hl=en-419)

Useful pattern: keep result cards selective and move evidence depth to detail before partner choice. Limitation: mixed-source amenity aggregation is too weak for expaify's proposed `Confirmed for selected stay` label unless source and applicability are preserved. Google does not provide a model expaify should copy for explicit missing/conflict states.

### 2.5 Public policy examples validate independent dimensions

Official property/brand pages demonstrate why one `daily housekeeping` boolean is lossy:

- Hilton states daily service for some brand groups, every-other-day service for others in the U.S./Canada, additional service by call/message, and possible local-law adjustments. That single policy contains cadence, geography, brand applicability, action channel, and exceptions. [Hilton housekeeping policy](https://www.hilton.com/en/help-center/hotel-information/hiltons-housekeeping-policy/)
- A Marriott property page labels housekeeping `Every Other Day` and separately exposes `Service Request`; another official property page labels `Daily Housekeeping`. These are property-level examples, not chain guarantees. [Marriott Element Nashville](https://www.marriott.com/en-us/hotels/bnaew-element-nashville-vanderbilt-west-end/overview/), [Marriott W Barcelona](https://www.marriott.com/hotels/hotel-information/details-5/bcnwh-w-barcelona/)
- A Hyatt property FAQ explicitly separates daily room cleaning, linen/towel replacement, and specific requests. Even there, the prose does not define whether every daily service includes linen replacement. [Hyatt Regency Houston/Galleria FAQ](https://www.hyatt.com/hyatt-regency/en-US/hourg-hyatt-regency-houston-galleria/faqs)

The interaction lesson is consistent: cadence should be the leading fact, action is a separate instruction, and towels/linen must not inherit the cleaning schedule unless the source explicitly links them.

## 3. Minimum evidence model validation

### 3.1 Smallest safe normalized record

The discovery vocabulary is retained with two refinements: model a cleaning **schedule** rather than a generic availability flag, and preserve exact source text for any value other than unqualified `daily`, `none`, or `not_specified`.

```text
HotelHousekeepingPolicy
  loadState: loading | ready | error
  cleaning:
    state: reported | not_provided | ambiguous | conflicting
    schedule: daily | named_days | every_n_nights | once_during_selected_stay |
              request_only | none | not_specified
    intervalNights?: positive integer
    serviceDays?: property-local weekdays[]
    statements: SupplierPolicyStatement[]
  guestAction:
    mode: automatic | request_required | opt_in_required | opt_out_available |
          not_specified | ambiguous
    channel?: provider-stated bounded text
    cutoff?: provider-stated bounded text
    statements: SupplierPolicyStatement[]
  towels: independent refresh dimension
  bedLinen: independent refresh dimension
  applicability:
    scope: property | room | rate | selected_stay
    propertyId + optional roomId/rateId
    stayThreshold?: provider-stated condition
    exceptions: SupplierPolicyStatement[]
  sourceLabel + fetchedAt + sourceText on every reported dimension
```

Do not add `same_as_cleaning` unless the provider explicitly says the towel/linen schedule is the same. Absence of separate wording resolves to `not_specified`, not inheritance. `Every 2 days` must remain verbatim or ambiguous until the provider defines whether counting begins after check-in and whether service occurs on the second or third calendar day. Named days require a property-local calendar and must not be converted into `every_n_nights`.

### 3.2 Evidence labels

The five discovery states remain useful, with exact display meanings:

| Evidence state | What expaify may say | What it must not say |
| --- | --- | --- |
| Confirmed for selected stay | `For this room and 4-night stay, the provider reports…` | `Guaranteed`; broader property truth |
| Property/room/rate policy | `<Source> reports this property/room/rate policy… Verify exceptions before booking.` | `For your stay`; selected-stay confirmation |
| Ambiguous/conflicting | `We found housekeeping information, but it does not establish one clear schedule.` | A positive or negative summary |
| Not returned | `This provider did not return a housekeeping schedule.` | `No housekeeping`; `Daily`; `Ask at check-in` |
| Check failed | `We could not check housekeeping information.` plus retry/verification path | Provider silence; a cached positive without stale labeling |

`Confirmed for selected stay` is an applicability label, not a fulfillment guarantee. Use `Provider-confirmed for these dates/room` only if the source response is actually keyed to those inputs and supplies the relevant scope. Prefer `Reported for selected stay` in participant testing because `confirmed` may be misheard as a service guarantee.

### 3.3 Expert scenario walkthrough

| Scenario | Minimum evidence | Correct concise expectation | Forbidden inference |
| --- | --- | --- | --- |
| Automatic daily | Cleaning `daily`; action `automatic`; towels/linen unspecified; property scope | `Room cleaning: daily, automatically. Towels and bed linen: schedule not provided. Property policy reported by <source>.` | Fresh towels/sheets daily; selected-stay guarantee |
| Request-only + cutoff | Cleaning `request_only`; action `request_required`; exact channel/cutoff; room or property scope | `Room cleaning only when requested. Request via <channel> by <cutoff>.` | Request is already made; request will be accepted after cutoff |
| Separate refresh rules | Cleaning every 2 nights; towels on request; linen every 4 nights | Three separate rows; no merged sentence that hides differences | Cleaning includes fresh towels/sheets |
| No stayover service | Explicit cleaning `none` from a source capable of negative statements | `No stayover room cleaning is reported for this policy.` | Towels/linen unavailable unless separately explicit |
| Ambiguous wording | `Limited housekeeping` or undefined `regularly` | `Schedule unclear — the provider says “…”` | Convert to periodic/daily/request-only |
| Conflict | Two current applicable statements disagree | `Housekeeping information conflicts. Verify before booking.` plus both bounded statements | Choose fresher or more favorable without conflict rules |
| Missing | Successful provider response without usable policy | `Housekeeping schedule not returned.` | No service; daily norm |
| Retrieval failure | Error/timeout/malformed policy response | `We could not check housekeeping information.` | Not returned; reuse a positive beyond freshness without stale label |
| Scope mismatch | Property policy exists; selected room/rate has a different or absent rule | Show the narrowest applicable fact and conflict/unknown as needed | Promote property statement to room/rate/stay |

The walkthrough validates all four answer groups as necessary. It also shows that `stayover service` need not be a separate visible row when cadence itself is explicit: `daily`, `every N nights`, `request only`, and `none` already answer whether service occurs. The data model may retain a derived existence state, but UI should lead with `Room cleaning` and its schedule to reduce redundancy.

## 4. Exact gap

| Decision layer | Reference pattern | expaify today | Required delta |
| --- | --- | --- | --- |
| Results | Selective key facts; detail on selection | Dense price/deal card; no policy | No default unknown chip; optional sourced risk cue only when evidence is usable |
| Detail | Property facts grouped before room/rate or partner choice | Live saved detail has no housekeeping; rich `HotelCard` is separate | One `Room cleaning during your stay` decision unit before provider links |
| Room/rate scope | Provider content distinguishes property/room/rate | No policy type or IDs | Preserve narrowest scope; never upgrade property to stay |
| Handoff | Relevant facts/instructions remain visible before redirect | Saved detail redirects directly; `/book` is a separate path | Repeat concise expectation or explicit missing/error state immediately above the CTA/link group |
| Missing/conflict | Often omitted in references | Universal but silent unknown | Explicit, non-alarming states in detail/handoff; not on every result |
| Measurement | Impression and next action can be instrumented | General funnel only | Evidence-state exposure, open, handoff, and return-mismatch events plus participant comprehension |

## 5. Hierarchy and copy hypotheses

For a stay of three or more nights, test this hierarchy as one semantic unit:

1. Heading: `Room cleaning during your stay`.
2. Primary line: `Daily, automatically`; `Every 2 nights`; `Only when requested`; `No stayover room cleaning reported`; `Schedule unclear`; `Schedule not returned`; or `Could not check schedule`.
3. Action line, only when applicable: `Request through <channel> by <cutoff>.` If channel/cutoff is missing, say `The provider does not state how or when to request it.`
4. Separate rows: `Towels` and `Bed linen`, each with its own schedule or `Schedule not provided`.
5. Evidence line: `<Scope> policy reported by <source> · checked <time>.` Selected-stay fixtures add the room/rate/date relationship without using `guaranteed`.
6. Verification: `Check the room and rate terms with the provider before booking; service can change.`

For one- or two-night stays, do not infer irrelevance: a request-only or `none` policy can still matter. The ticket's primary trigger remains `nightCount >= 3`, where schedule has the clearest chance to affect the stay. UXDES should show the full unit by default for 3+ nights and may place it under expanded details for shorter stays; missing dates/night count must not be treated as a short stay.

## 6. Traveler comprehension and calibrated-confidence plan

Recruit 10–12 first-time expaify users who booked a hotel stay of at least three nights in the past 12 months. Include, but do not infer from profile, at least four who say predictable cleaning or privacy materially affects selection. Use a within-subject moderated study with randomized first exposure and both 375px and 1280px prototypes.

Test two variants:

- **A — summarized dimensions:** primary schedule/action line, separate towel/linen rows, evidence line, expandable exact wording.
- **B — provider prose first:** exact bounded source wording before the same evidence label.

Cover all nine scenarios in §3.3, with automatic daily, request-only/cutoff, separate towel/linen, ambiguous, and missing as scored core tasks. Ask the factual questions before asking confidence so the scale does not teach the answer.

| Measure | Operational definition | Gate for design progression |
| --- | --- | --- |
| Four-part comprehension | Correctly states cleaning cadence, required action/cutoff, towel rule, and linen rule | ≥80% of participants correct on all four for each explicit core scenario |
| Scope comprehension | Correctly identifies property/room/rate/selected-stay and whether verification remains | ≥80% per scoped scenario; 0 participants call property policy a selected-stay guarantee after reading full unit |
| Missing-state discipline | Does not infer daily, request-only, or no service from missing/error | ≥90% correct across missing + failure; zero high-confidence false service claims |
| Calibrated confidence | 1–5 confidence after each answer, cross-tabulated with correctness | Median ≥4 when correct on explicit scenarios; median ≤3 when making an unresolved policy claim; report confidently wrong (4–5) separately |
| Time to expectation | First exposure to submitted four-part answer | Median ≤25 seconds for explicit core scenarios at each viewport |
| False guarantee | Says service/request is guaranteed, scheduled by expaify, or already requested | 0 after full evidence unit is viewed |
| Decision readiness | `Continue`, `verify`, or `choose another`, with reason | No mandated choice; reason must match evidence state in ≥80% of tasks |

Do not collapse the confidence result into an average. Report a 2×2 calibration table: correct/high confidence, correct/low confidence, incorrect/low confidence, incorrect/high confidence. The last cell is the principal trust failure. A design with faster answers but more confidently wrong assumptions fails.

Production analytics can measure exposure and behavior, not comprehension. If implementation is later approved, add allowlisted events with non-sensitive enums only:

- `hotel_housekeeping_policy_viewed`: surface, evidence state, scope, stay-length bucket, dimension coverage, viewport band;
- `hotel_housekeeping_details_opened`: same context;
- `hotel_housekeeping_handoff_started`: same context plus provider category;
- `hotel_housekeeping_return_mismatch`: traveler-selected `different_schedule|different_action|different_towels|different_linen|other`, shown only after a provider return.

Never label an abandonment as housekeeping-related without an explicit response. Verify every new event against `/api/analytics` request validation in tests.

## 7. Testable design directives

### D1 — Make cadence the primary claim and keep action/linens independent

For `nightCount >= 3`, place one `Room cleaning during your stay` unit in saved-deal `Hotel fit`, before `Check rooms with provider`. Order it: cleaning schedule → required guest action/cutoff → towels → bed linen → evidence/scope. Do not render a redundant `Housekeeping available` row. Do not inherit towel or linen cadence from cleaning unless the source explicitly links them.

**Test:** in the separate-refresh fixture, a participant or screen reader encounters three distinct statements; changing the towel fixture never changes cleaning or linen copy.

### D2 — Gate every positive/negative summary on complete, scoped evidence

Render a normalized schedule only when it has bounded supplier wording, source label, fetched time, applicable property ID, and valid scope; selected-stay wording additionally requires the matching dates plus room/rate identity or an explicit stay-level response. `Daily`, `none`, `request only`, and `every N nights` cannot be inferred from amenities, chain pages, class, property type, reviews, or another offer. Preserve exact text whenever timing semantics or conditions would be lost.

**Test:** missing source/scope/freshness or a mismatched property/room/rate downgrades the presentation to ambiguous/not returned; no positive or negative cadence remains in accessible text.

### D3 — Give missing, ambiguous, conflict, loading, and failure distinct truthful states

Use the exact state headings `Checking room-cleaning policy`, `Schedule not returned`, `Schedule unclear`, `Housekeeping information conflicts`, and `Could not check schedule`. Missing says only that the provider did not return a schedule; failure offers one retry where retrieval exists; conflict exposes up to two bounded current statements and directs verification. None may use an icon/color as the only distinction.

Do not put a default unknown chip on every result. At 375px the detail unit is one column with no truncation; at 1280px towels/linen may form two columns beneath the primary line. Disclosure controls are native buttons/details, keyboard operable, have visible focus, and retain state text in the accessible name.

**Test:** all five states are distinguishable in text at both viewports; missing never contains `no service`, failure never says `not provided`, and a keyboard user can reach/open/close the source wording in order.

### D4 — Preserve the expectation at the exact handoff and measure evidence state

Repeat the same concise schedule/action/towel/linen outcome immediately above the live saved-deal provider links; do not force the traveler to remember a prior panel. The separate `HotelCard` → `/book` path must serialize the same typed policy and render the identical semantic order if it becomes active. A provider CTA must not say or imply that expaify requested service. Emit the four allowlisted events in §6 only after server validation tests prove acceptance.

**Test:** every usable detail fixture survives byte-equivalent normalization into handoff; missing/conflict/error remains the same state; provider activation records the viewed evidence state without property prose or personal data.

### D5 — Keep production behind two evidence gates; use fixtures for research now

UXDES should specify all nine scenarios as a research-only prototype with final copy, loading/error behavior, 375px/1280px layouts, and focus order. Production implementation may proceed only after (a) one provider returns a 100+ offer sample with dimension coverage reported separately and at least one safely normalizable cadence/action combination, and (b) the participant study meets the comprehension and false-guarantee gates in §6. If either fails, production remains explicit `Schedule not returned` only where the check actually occurred; do not manufacture a schedule or launch a comparison cue/filter.

**Test:** research fixtures are not imported by production routes; a provider capability report includes per-dimension denominators, and no production positive fixture appears before both gates pass.

## 8. Handoff and blockers

`UXDES-HOTEL-HOUSEKEEPING-FREQUENCY-01` should produce `docs/pipeline/hotel-housekeeping-frequency/03-design.md` as a conditional research-prototype and evidence-contract spec. It must cover all nine scenarios, the exact hierarchy/copy rules above, loading/empty/error, 375px/1280px, keyboard/focus, source disclosure, and both handoff paths without pretending they are currently unified.

Before production UI or provider work:

1. obtain an authenticated 100+ offer content sample from at least one contracted provider, joined to the actual searched property/room/rate and dates;
2. publish per-provider coverage for cleaning schedule, action/channel/cutoff, towels, linen, scope, exceptions/fees, source, and freshness;
3. confirm that every positive/negative field legally permits display and retention; and
4. run the participant study and pass the calibrated-comprehension gates.

Current blockers:

- no normalized housekeeping evidence type or continuity field;
- 0% structurally representable coverage in all audited adapters and saved deals;
- no authenticated provider payload sample or contractual display assessment;
- no participant evidence, so comprehension remains a hypothesis; and
- existing analytics validator mismatches require a separate repair before funnel data is trusted.

Out of scope: implementing provider/content calls, scraping property pages, inferring policies from brands or reviews, adding a housekeeping filter/ranking signal, requesting service within expaify, modifying the analytics subsystem, or changing Deal Score.

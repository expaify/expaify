# UXR-HOTEL-SOLO-SAFETY-CUES-01 — Hotel Solo-Stay Safety-Cue Research Brief

Date: 2026-08-03  
Stage: UX Research (UXR)  
Priority: P1  
Upstream: `docs/pipeline/hotel-solo-safety-cues/01-discovery.md`

## Decision

**A minimal fact / traveler-report / unknown pattern is supportable without making a safety claim, but it is not supportable as production UI from the current data path. Proceed only with a validation prototype; defer any shipped “solo,” “safety,” or arrival-confidence cue.**

The interaction boundary is viable when all three evidence classes are visibly distinct:

1. a narrowly worded provider/property fact, with source, scope, and observation time when supplied;
2. a topic-specific traveler report, with its own source, qualifying count, and review-period evidence;
3. a first-class not-provided, unclear, conflicting, stale, or failed-check state that names what the traveler should confirm.

The current normalized product path can support only part of layer 1: property location at area or coordinate precision, and sometimes an exact address on the inactive Hotellook adapter. It supports none of the required arrival-instruction facts and none of the topic-specific traveler-report evidence. Current aggregate guest rating, star class, Deal Score, photo, price, city, and straight-line airport distance are not substitutes.

The production recommendation is therefore:

- **STOP:** no generic `Safety`, `Good for solo travelers`, `Safe area`, `Secure`, `24-hour desk`, or reassurance chip; no score, filter, badge, ranking input, colored endorsement, or positive-only cue.
- **NARROW:** preserve existing location, admission, transport, access, disruption, and handoff patterns as independent factual domains. Do not aggregate them into a new claim.
- **GO, validation only:** prototype one detail-level evidence ledger and one material-unknown handoff reminder using controlled fixtures. Reopen production design only after the supply and comprehension gates in this brief pass.

## Method and evidence limits

This brief is based on:

- a static audit of the current deal feed, saved-deal detail, canonical `HotelCard`, booking context, handoff, provider adapters, caching, and analytics in this worktree;
- a contract-capability review of the currently active Booking.com RapidAPI adapter, the Hotellook and Hotelbeds adapters, and official Booking.com Demand API documentation as a plausible future contracted source—not as evidence of current access;
- interaction-pattern research using official Google Hotels and Booking.com documentation;
- scenario walkthroughs for a solo traveler arriving late or in an unfamiliar destination.

No traveler interviews, moderated usability sessions, production payload capture, provider credentials, licensed review feed, property-source sample, incident data, or production comprehension analytics was available. Coverage below means **the audited contract can carry the field**, not that a percentage of real properties supplies it. Prototype thresholds are proposed research gates, not observed benchmarks.

## Current implementation audit

### 1. The live deal shortlist has no evidence contract beyond city-level identity

The user-visible `/deals` path renders `DealFeed` → `DealCard`. `DealCardDeal` carries hotel name, city, star class, image, observed and median prices, discount, date window, price-check count, links, freshness, and optional unrelated quiet/disruption evidence (`app/components/ui/DealCard.tsx:22-50`). It does not carry `HotelLocation`, arrival instructions, transport evidence, admission evidence, topic review evidence, or an evidence revision.

The card renders `{stars} · {city} · {checkInWindow}` (`DealCard.tsx:83-88`). That city string is not a property address or a neighborhood fact. A design that labels it as arrival context would strengthen the evidence beyond its contract.

The feed constructs this reduced object explicitly in `app/deals/DealFeed.tsx:1798` and `:1815`; richer `HotelOffer` fields cannot reach the card by accident. No existing card prop represents “solo traveler” intent.

### 2. Saved-deal detail is the active evaluation surface, but it has only explicit gaps

`/deals/[dealId]` is the live property-evaluation surface. Its first section displays `Area: {city}` followed by `Provider supplied an area, not a street address` (`app/deals/[dealId]/page.tsx:363-366`). Its hotel-fit section explicitly says guest-rating evidence was not provided (`:424-426`). It then hands off to attributed provider links (`:437-464`).

This is honest, but the user must assemble the arrival decision across separate sections. There is no named boundary between:

- what a provider/property source states;
- what travelers report;
- what expaify did not receive or could not verify.

The detail surface also has no check-in time, late-arrival instruction, entry/key process, arrival-contact instruction, or topic-specific solo-traveler review record.

### 3. `HotelCard` contains the strongest provenance patterns, but is not mounted

`HotelCard` is a heavily specified canonical offer component, not the active deal-feed card. Repo-wide imports outside tests show no page mounting it, and no client consumes the `/api/search` hotel NDJSON stream. This limits the immediate user impact of any design targeted only at `HotelCard` to zero.

Within the component, useful patterns already exist and should be reused rather than duplicated:

- location precision and source-aware copy through `getHotelLocationDisplay`, including straight-line distance and a transport caveat (`app/components/HotelCard.tsx:1088-1110`);
- separate quality evidence for hotel class and guest rating (`:1078-1084`);
- independent transport and admission blocks (`:1113-1115`);
- explicit not-provided/error/conflict conventions across access, funds, transport, admission, parking, smoking, and disruption components;
- unchanged evidence carried to review through `buildBookingHotelContext` (`HotelCard.tsx:887`).

The collapsed component is already dense: identity, up to two quality chips, optional access fact, two location lines, price, fee scope, eligibility, admission, parking, transport, funds, pet, smoking, Deal Score, review CTA, and details control (`HotelCard.tsx:914-1070`). A universal unknown “solo arrival” line would add noise; a positive-only line would bias comparison toward provider coverage.

### 4. The shared contracts have adjacent evidence, not a solo-arrival evidence boundary

`HotelOffer` can carry `location`, aggregate `guestRating`, generic `amenityEvidence`, `transportEvidence`, `admissionPolicy`, and several other policy objects (`lib/types.ts:687-711`). It has no dedicated arrival-context envelope and no topic-review object.

The closest reusable vocabularies are:

- `HotelLocation`: `exact`, `coordinates`, `area`, `search_area`, or `missing`; provider/search-fallback/unavailable source; optional documented or calculated straight-line anchor distance (`lib/types.ts:518-550`);
- `HotelEvidenceStatus`: `confirmed`, `unavailable`, `not_returned`, or `unknown`, with evidence scope and source on amenity facts (`lib/types.ts:120-151`);
- `HotelTransportEvidence`: explicit service, direction, operator, cost, hours, required action, source, freshness, and conflict dimensions (`lib/types.ts:206-280`);
- `HotelAdmissionPolicyEvidence`: property identity, supplier identity, fetch time, load state, and sourced statement families for check-in age, identity, local-guest, and occupancy rules (`lib/types.ts:620-653`);
- `HotelRatingEvidence`: aggregate score, scale, source, count, fetch time, and confidence only (`lib/types.ts:97-118`). It has no topic, traveler type, review window, statement, or conflict state.

These objects answer separate questions. They must remain independently attributable. Combining “coordinates present,” “airport transfer documented,” “ID required,” or “8.7/10” into a computed confidence or safety verdict would erase scope and create an unsupported inference.

### 5. Booking context preserves some adjacent facts but has no arrival/report continuity

`BookingHotelContext` carries location, aggregate rating, smoking, transport, rate eligibility, and admission evidence (`lib/booking/config.ts:70-101`). `buildBookingHotelContext` copies those fields into review (`:1206-1238`), and validation keeps malformed optional evidence from blocking a handoff (`:934-1008`).

No dedicated arrival-context record, topic-report record, evidence revision, staleness/conflict envelope, or material confirmation task is preserved. Consequently the booking review cannot guarantee that the user sees the same fact/report/unknown distinction before opening the provider.

`BookingFlow` already provides the correct action boundary: provider-specific review, source-aware location, named hotel-fit evidence, separate transport and admission sections, and a “Check rooms with provider” action (`app/book/BookingFlow.tsx:331-408`, `:1062-1285`). The new pattern should reuse this review checkpoint if it ever passes validation; it should not create a parallel concierge, request, or safety flow.

### 6. Current analytics cannot measure comprehension or cue reliance

The app allowlists hotel result views, result opens, detail views, section reach, provider handoff, handoff return, and some policy-specific events (`app/api/analytics/route.ts:10-48`). None records:

- solo-arrival scenario or intent;
- fact / traveler-report / unknown exposure;
- the evidence revision shown;
- which evidence class a traveler relied on;
- whether a distance was read as route time, walkability, or route quality;
- whether a participant interpreted the pattern as a safety endorsement.

Behavioral events alone cannot answer those comprehension questions. The existing emitter/collector enum mismatch reported by adjacent review research is also still visible: `HotelDecisionAnalytics` emits `search|saved|direct`, `mobile|tablet|desktop`, and `confident|low_confidence|...`, while the collector validates different enum values. A production funnel is not a defensible research baseline until that separate analytics repair is verified end to end.

## Provider and payload capability audit

### Current normalized paths

| Evidence needed | Active Booking.com RapidAPI adapter | Hotellook adapter | Hotelbeds adapter | Production conclusion |
| --- | --- | --- | --- | --- |
| Exact address | Not in typed search payload | Supported when `address` is returned | Not in typed search payload | Not consistently supportable |
| Area/location label | `wishlistName` or search fallback | Provider location name or search fallback | destination/zone or search fallback | Supported, but precision varies |
| Coordinates | Retained when both numbers exist | Retained from nested or flat coordinates | Retained when both numbers parse | Supported as coordinates, not street context |
| Anchor distance and method | Calculated downstream when an airport anchor exists; `straight_line` only | Same | Same | Supportable only with explicit method/caveat; never travel time or route quality |
| Check-in / departure times | Not typed or normalized | Not typed or normalized | Not typed or normalized | 0 audited support |
| Late-arrival instruction | Not typed or normalized | Not typed or normalized | Not typed or normalized | 0 audited support |
| Staff/front-desk availability | Not typed or normalized | Not typed or normalized | Not typed or normalized | 0 audited support; must not infer 24/7 staffing |
| Entry/key instruction | Not typed or normalized | Not typed or normalized | Not typed or normalized | 0 audited support |
| Identity/admission requirement | Capability explicitly unsupported | Capability explicitly unsupported | Capability explicitly unsupported | 0 audited support |
| Transfer/contact instruction | No `transportEvidence` populated | No `transportEvidence` populated | No `transportEvidence` populated | 0 audited support |
| Aggregate guest score | Score retained, but current builder drops returned `reviewCount` | Live path usually creates unknown/inferred rating from star data; cache can retain count | Not populated | Inconsistent; never topic-specific |
| Topic or solo-traveler reports | No topic, text, traveler type, dates, or license metadata | None | None | 0 audited support |
| Source | Adapter-level source retained | Adapter-level source retained | Adapter-level source retained | Supported at offer level; not claim-level for new cues |
| Freshness | Some rating evidence gets fetch time; offer has no general fetched-at field | Some evidence gets fetch time; cache is six hours | Some class evidence gets fetch time | Partial; fetch time is not review recency or property-update time |
| Conflict/stale state | No arrival/report envelope | No arrival/report envelope | No arrival/report envelope | 0 audited support |

The active search route calls `bookingComHotels.searchHotels` (`app/api/search/route.ts:172-179`) and labels returned pages `booking.com` (`:400-429`). That adapter’s `HotelProperty` type includes coordinates, aggregate score/count, class, photo, location label, and gross price only (`lib/providers/bookingComHotelsRapidApi.ts:30-48`). It does not pass `property.reviewCount` into `buildGuestRatingEvidence` (`:64-74`, `:166-190`), so even the typed aggregate count is currently discarded.

Hotellook’s raw shape can carry address, location, coordinates, and price (`lib/providers/hotellook.ts:20-41`), while Hotelbeds’ search shape can carry destination/zone and coordinates (`lib/providers/hotelbeds.ts:41-60`). Neither has the required arrival or review-topic fields in its implemented response contract.

No live provider payload was captured because credentials and an approved provider sample were unavailable. The table must not be converted into a prevalence claim such as “most hotels have coordinates.”

### Plausible future contracted source—capability, not approval

Official Booking.com Demand API documentation demonstrates that a richer, contracted integration can separate the needed data domains:

- `/accommodations/details` exposes address/opening-hours-style property details, retains `checkin_checkout_times`, and supports selected extras rather than treating search results as complete property content ([Booking.com accommodation API overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation), [v3.2 details migration](https://developers.booking.com/demand/docs/migration-guide/v3.2/accommodations/details)).
- Review comments and statistical category scores are separate endpoints, available only when the partner agreement permits them. This makes license/coverage a required capability gate, not a UI assumption ([Booking.com accommodation API overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation)).
- Property contact/address and product policies are requested separately in post-booking order details; eligible properties may return key-collection instructions. Post-booking key collection is not pre-booking entry evidence and must not be moved earlier without an endpoint/source that licenses that use ([Booking.com accommodation order details](https://developers.booking.com/demand/docs/orders-api/order-details-accommodations)).

This documentation shows the proposed evidence separation is technically plausible. It does **not** authorize a new provider, establish expaify’s access, prove coverage, or make the current RapidAPI payload equivalent to Booking.com Demand API data.

### Existing provider-contract conflict

The active Booking.com adapter depends on `RAPIDAPI_KEY`; Hotelbeds depends on `HOTELBEDS_API_KEY` and `HOTELBEDS_SECRET`. Those secret names are outside this ticket’s approved contract, and both adapters leave `deeplink` empty because they cannot attach an affiliate marker. The active adapter does sit behind `lib/providers` and returns `Result<T>`, but provider approval, credentials, and attributable handoff remain unresolved.

This pre-existing conflict blocks any production implementation that relies on those adapters. It does not block a docs-only research brief or controlled prototype, and this ticket does not repair or select a provider.

## Reference pattern comparison

### Booking.com—separate search, property facts, reviews, and post-booking instructions

Booking.com’s documented interaction/data model does not make one result payload carry every kind of truth. Search establishes date-specific candidates; property detail supplies address, facilities, policies, and check-in/check-out times; reviews have separate comments and category scores with agreement-dependent access; key collection appears as an eligible post-booking instruction.

**Pattern to adopt:** bind every item to its lifecycle stage and scope. A property check-in time is not a promise of late arrival; a review is not a property fact; a post-booking key instruction is not a pre-booking guarantee. Progressive disclosure should add detail without strengthening the claim.

**Delta:** expaify currently has a summary search adapter only, no contracted detail/review path, and no normalized arrival envelope. It cannot emulate Booking.com’s detailed property treatment from aggregate search fields.

### Google Hotels—overview first, separate source classes, licensed topic summaries

Google’s hotel placesheet uses an overview for location, user reviews, photos, and amenities, with deeper information in relevant tabs. Its help documentation distinguishes Google-user reviews from licensed third-party reviews, states that Google does not additionally verify those third-party reviews, and attributes topic summaries to TrustYou. Hotel information also comes from mixed sources ([Google Travel Help](https://support.google.com/travel/answer/6276008?hl=en-419)). Third-party lodging review data arrives through configured structured feeds rather than being inferred from an aggregate rating ([Google Hotel Center Help](https://support.google.com/hotelprices/answer/14274025?hl=en)).

**Pattern to adopt:** show a concise overview, then let users inspect source-bounded details; visibly label a topic summary as traveler opinion and name its source. An omitted or unavailable topic signal does not become a property negative.

**Delta:** expaify cannot adopt Google’s mixed-source synthesis. It has neither licensed topic review data nor a configured review feed. Any future report must use bounded language such as `Travelers report…`, never `This hotel is…`, and must retain source/count/period independently of the provider fact.

## Exact gap

| User question | Current code | Reference pattern | Required delta |
| --- | --- | --- | --- |
| Where is the property? | `/deals` has city only; saved detail says area, not address; `HotelCard` can represent precision and straight-line distance but is unmounted | Property detail distinguishes address/location from search context | Reuse `HotelLocation`; never relabel city or coordinates as neighborhood quality |
| What does the property/provider say about my arrival? | No normalized arrival time, late-arrival, desk, entry, or contact instruction | Detail endpoints keep check-in times/policies separate; some instructions are lifecycle-specific | Add a source/scope/freshness-bearing arrival envelope only after a contracted payload proves each field |
| What do travelers report? | Aggregate score only; no topic/traveler type/count/period | Licensed review endpoints and attributed topic summaries | Require licensed topic evidence; keep it separate from facts and ratings |
| What is not known? | Many adjacent components have honest fallbacks, but no single cross-cutting decision boundary | References often omit unavailable detail or have richer first-party supply | expaify must explicitly distinguish `not_provided`, `check_failed`, `unclear`, `conflicting`, and `stale`; none means unsafe |
| What must be checked before leaving expaify? | Generic provider handoff plus domain-specific reminders | Progressive detail and lifecycle-specific confirmation | Repeat only a material unresolved arrival task at review; do not repeat the full ledger or imply expaify contacted the property |

## Scenario walkthrough

### Scenario A—23:40 arrival in an unfamiliar destination

| Evidence fixture | Defensible reading | Prohibited reading |
| --- | --- | --- |
| Exact address + 4.2 km straight-line from airport | The property address and geometric distance are documented; route/time still needs checking | “Close,” “easy to reach,” “walkable,” or “safe route” |
| Check-in from 15:00, no end time or late-arrival instruction | Earliest check-in is known; late-arrival outcome is unknown | “Late check-in available” |
| Property says contact before 22:00 for later arrival | The traveler has a documented action and cutoff to verify/follow | “Front desk staffed all night” or guaranteed entry |
| Travelers report clear late-arrival instructions; 18 qualifying reports through June 2026 | A bounded subjective experience signal from named travelers/source | Verified current property procedure or a safety endorsement |
| Sources disagree about cutoff | Current instruction is unresolved; confirm with provider/property | Choose the more reassuring cutoff |

### Scenario B—daytime arrival, exact location unknown

| Evidence fixture | Defensible reading | Prohibited reading |
| --- | --- | --- |
| Area only | The provider located the property in that area; street context is missing | Neighborhood identity, suitability, or safety |
| Coordinates + calculated airport distance | Relative geometric position only | Driving time, public-transit quality, lighting, or personal risk |
| No arrival facts or topic reports | The source did not supply the evidence; confirmation is needed if material | The hotel lacks a desk, has poor access, or is unsafe |

The walkthrough validates the three-class model: facts, reports, and unknowns answer different questions. It also shows that location alone is not enough to justify a “solo arrival” summary.

## Design directives for UXDES

### D1—Make this a validation-only detail ledger; do not ship a solo/safety shortlist cue

Prototype a single titled region: **`Arrival information`**. Do not use `Safety`, `Solo safety`, `Safe arrival`, `Security`, `Good for solo travelers`, or similar wording anywhere in the fixture, accessible name, event, or analytics property.

Default production guidance remains no new collapsed cue. The prototype may test a shortlist line only in a controlled comparative variant, and only when it contains a concrete fact such as `Address provided by {source}` or `Late arrival: contact before 22:00`. It must never show an unknown-only chip or positive-only badge.

**Test that falsifies:** inspect default, loading, complete, partial, explicit-negative, conflict, stale, and error fixtures at 375px and 1280px. No string or accessible label contains a safety/solo endorsement; no card renders a cue from city, stars, price, photo, Deal Score, aggregate rating, or missing data.

### D2—Use three visibly named evidence classes and prohibit cross-class inference

The detail prototype uses this fixed hierarchy:

1. **`Property and provider facts`**—at most three arrival-relevant rows: location precision, documented arrival instruction, documented entry/transfer/contact instruction. Each row includes source and scope; observation time appears when supplied.
2. **`Traveler reports`**—topic-specific only. Every populated item starts `Travelers report…` and shows source, qualifying count, and review period. Aggregate rating alone renders `Arrival-specific traveler reports not provided.`
3. **`What to confirm`**—only unresolved material items, written as an action. Example: `Confirm the late-arrival instructions with the booking provider before you book.`

Never derive a fact from a report, or a report from an aggregate rating. Never merge the classes into a score, verdict, single icon, or “confidence” label.

**Test that falsifies:** give participants one item from each class and ask them to classify it. The design fails if fewer than 90% correctly classify facts, reports, and unknowns, or if any participant can reach a positive cue by changing only the aggregate rating/Deal Score.

### D3—Represent missing, failed, unclear, conflicting, and stale evidence separately

UXDES must specify these states for each arrival fact/report domain:

| State | Required language rule |
| --- | --- |
| `not_provided` | `{Source} did not provide {item}.` |
| `check_failed` | `{Item} could not be checked.` |
| `unclear` | `{Source}'s {item} was unclear.` |
| `conflicting` | `Sources disagree about {item}.` |
| `stale` | `{Item} was last observed {date}; confirm the current details.` |
| explicit negative | State only the bounded fact, e.g. `The property reports no airport transfer.` |

Missing is never a negative property finding. Error is never absence. Stale evidence may remain visible only with its original source and a current-confirmation action. Conflict never resolves by source priority in the UI.

Use text and structure, not color alone. Reserve warning/error treatment for genuinely actionable conflict/failure/staleness; `not_provided` is neutral.

**Test that falsifies:** fixtures differing only by state produce different visible and accessible copy. In a comprehension check, at least 90% distinguish `not_provided` from explicit unavailable and at least 85% distinguish stale/conflict from current fact.

### D4—Keep distance, arrival time, and traveler reports inside strict lexical boundaries

Distance copy must always include its method and limit: **`{distance} straight-line from {anchor}; not travel time or route quality.`** Do not use `near`, `close`, `walkable`, or an ETA unless a separately approved routing source supplies and scopes it.

Arrival facts describe instructions, not predicted outcomes. Prefer `The property says to contact it before 22:00 for later arrival` over `Late check-in available`. A documented `24 hours` value may be shown only for the exact sourced dimension; it must not become `staff always present`, `secure entry`, or guaranteed admission.

Traveler-report copy must use attribution and hedging: `Travelers report…`, not a bare property assertion. Do not synthesize or quote reviews without a licensed field and permitted display scope.

**Test that falsifies:** after a five-second exposure, at least 90% identify straight-line distance as not travel time, at least 90% say the arrival statement is an instruction rather than a guarantee, and no more than 10% describe the property or route as safety-endorsed by expaify.

### D5—Preserve one evidence revision through detail and material handoff reminder

If the supply and comprehension gates pass, carry the same immutable evidence revision through `HotelOffer` → active deal detail → `BookingHotelContext` → `BookingFlow`. The handoff must not strengthen, summarize away, or refresh individual facts independently.

Repeat only a material unresolved task immediately before the external provider action. Exact pattern: **`Before continuing: confirm {specific unresolved arrival item} with {provider/property}. expaify has not confirmed this for your stay.`** If every tested item is current and sourced, show no reassurance banner; the detail ledger remains the record.

Loading/error must never block the existing provider action. Keyboard order is detail heading → facts → traveler reports → confirmation task → existing provider action. On retry, return focus to the updated status region; on disclosure close, return focus to its trigger.

**Test that falsifies:** a fixture round-trips through build, validation, storage/reference, and handoff without changing evidence revision, source, state, scope, or observation time. A stale/conflicting item remains stale/conflicting at handoff. Failed analytics or evidence refresh does not disable provider navigation.

## Supply and comprehension gates

### Gate 1—approved source and normalized coverage

Before production UI is authorized, Product/Engineering must approve a hotel source and capture a representative payload sample. The sample must demonstrate, per property and per field:

- property identifier and source identity;
- location precision, with address/coordinate provenance and distance method;
- check-in/late-arrival instruction without inferring desk presence;
- entry/key/contact/transfer instruction with lifecycle scope;
- observation time or an explicit absence of one;
- distinct not-provided, explicit unavailable, malformed, conflict, and stale behavior;
- topic-specific review license/display scope, source, qualifying count, and review period if traveler reports are proposed;
- an attributable outbound provider URL.

Recommended minimum for a production pilot: sample at least 200 returned properties across at least five markets and two arrival contexts. At least 30% must have one decision-useful, non-location arrival fact after normalization; otherwise the always-visible region will be dominated by unknowns. This 30% is a proposed launch threshold to test, not an industry benchmark. Review-topic coverage must be reported separately and may not borrow the arrival-fact denominator.

### Gate 2—moderated comprehension and decision value

Run 8–10 moderated sessions with first-time or infrequent hotel-comparison users who travel alone at least occasionally. Include at least four late-arrival scenarios and four unfamiliar-destination scenarios. Test complete, partial, not-provided, explicit-negative, failed, stale, and conflicting fixtures at 375px and desktop.

Compare:

- control: current honest location/guest-rating gaps and provider handoff;
- variant A: detail ledger + material handoff reminder;
- variant B, research only: one concrete sourced shortlist fact + the same detail/handoff treatment.

Required pass conditions:

- at least 90% correctly classify provider/property fact vs traveler report vs unknown;
- at least 90% understand straight-line distance is not travel time or route quality;
- at least 90% understand an arrival instruction is not guaranteed admission/staffing;
- at least 90% distinguish not-provided from explicit unavailable;
- no more than 10% interpret any treatment as an expaify safety endorsement;
- variant B must materially improve five-second identification of a relevant candidate without increasing endorsement or missing-as-negative errors. Otherwise reject shortlist placement.

Do not optimize provider handoff rate alone. A valid outcome is a traveler deciding to confirm an unresolved condition or choose another property while correctly understanding the evidence.

## Placement recommendation

1. **Current `/deals` shortlist: no production cue.** It lacks the evidence contract, and unknown-only or positive-only display would bias comparison.
2. **Active saved-deal detail: target of the validation prototype.** Place `Arrival information` after the existing property/stay identity and before `Hotel fit`/provider handoff, while coordinating with location, check-in logistics, transport, admission, disruption, access, and review-relevance owners. It is a cross-cutting reading boundary, not a duplicate of their full panels.
3. **Canonical `HotelCard`: reuse only after mount strategy is explicit.** If UXDES also specifies this dormant component, state that it is not currently user-verifiable and do not claim a shipped outcome.
4. **Booking review: one material unresolved reminder before provider continuation.** No full duplicate ledger and no reassuring “all clear” state.

## Acceptance criteria for UXDES

- The design spec labels the work **validation-only / not ship-ready** until both gates pass.
- It covers default, loading, complete, partial, explicit unavailable, not provided, check failed, unclear, conflicting, stale, retry, mobile 375px, desktop 1280px, keyboard/focus, and malformed evidence.
- It defines all visible copy; no placeholder or unfinished marker, safety score, safety filter, or generic marketing panel appears.
- It keeps property/provider facts, traveler reports, and unknowns in separately named regions with separate provenance.
- It reuses existing location, transport, admission, access, disruption, review, and booking-handoff contracts instead of creating competing domain fields.
- It explicitly states that aggregate guest rating, star class, price, photo, city, Deal Score, and missing data cannot populate the pattern.
- It documents the current surface split: `DealCard`/saved detail are live; `HotelCard` and the hotel NDJSON client path are unmounted.
- It includes the study fixtures, measures, thresholds, and a decision rule for rejecting shortlist placement.

## Blockers and out-of-scope findings

### Blocking production work

- No current normalized adapter returns a late-arrival, desk, entry/key, check-in-time, or arrival-contact record.
- No current adapter returns licensed topic-specific traveler reports with count and review period.
- The active Booking.com RapidAPI path uses an unapproved secret and cannot supply an attributed deeplink; Hotelbeds has the same provider/secret/handoff problem.
- No production payload sample or prevalence study exists.
- Existing analytics cannot measure comprehension, and adjacent research reports a still-visible emitter/collector enum mismatch.
- `HotelCard` is not mounted and `/api/search` has no hotel-stream client, so component-only work would not repair the live flow.

### Explicitly out of scope

- safety scores, rankings, filters, badges, crime/neighborhood data, maps/routing, incident monitoring, staff verification, certifications, background checks, or predictive risk;
- provider selection, credential approval, API integration, review licensing/mining/summarization, or raw-review display;
- arrival-time input, flight-to-hotel itinerary joining, property messaging, concierge/request submission, or guaranteed entry;
- Deal Score, price, affiliate, snapshot, analytics-schema, or component-mount repairs;
- changing location, check-in logistics, transport, admission, access, disruption, luggage, smoking, or review-relevance domain contracts owned by adjacent tickets.

## Handoff

Create `UXDES-HOTEL-SOLO-SAFETY-CUES-01` for an implementation-ready **validation prototype spec**, not production UI. It must implement the five directives above, cover every evidence/load/viewport/focus state, reuse adjacent evidence contracts, preserve the no-safety-claim boundary, and include the supply/comprehension gates. No UI or DEV handoff should be created from that spec until both gates pass and the provider-contract conflict is resolved.

## References

- [Booking.com Demand API — About accommodations](https://developers.booking.com/demand/docs/accommodations/about-accommodation), accessed 2026-08-03.
- [Booking.com Demand API — Accommodations details v3.2 migration](https://developers.booking.com/demand/docs/migration-guide/v3.2/accommodations/details), accessed 2026-08-03.
- [Booking.com Demand API — Accommodation order details](https://developers.booking.com/demand/docs/orders-api/order-details-accommodations), accessed 2026-08-03.
- [Google Travel Help — Search for hotels on Google](https://support.google.com/travel/answer/6276008?hl=en-419), accessed 2026-08-03.
- [Google Hotel Center Help — Getting started with lodging reviews](https://support.google.com/hotelprices/answer/14274025?hl=en), accessed 2026-08-03.

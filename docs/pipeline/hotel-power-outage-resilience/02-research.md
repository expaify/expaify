# UXR-HOTEL-POWER-OUTAGE-RESILIENCE-01: Hotel power and connectivity resilience

Date: 2026-07-22  
Stage: UX Research  
Priority: P2  
Recommendation: **NARROW — validate the evidence supply and comprehension in a research prototype; do not ship a property badge, filter, sort, or ranking.**

## 1. Executive answer

The user problem is credible for travelers whose trip depends on electricity or connectivity, but the proposed property-level differentiation is **not yet evidence-viable**.

- The shipped `/deals` feed and `/deals/[dealId]` detail contracts have **zero resilience fields**. Current-contract any-signal and decision-grade coverage are therefore 0%, irrespective of what a hotel may claim elsewhere.
- The only hotel evidence contract in the repository can express source, scope, status, and fetch time, but it is wired only to an unused `HotelCard`; its normalizer accepts seven access facts and silently excludes resilience facts.
- The current provider response and stored `deals` rows do not retain a property claim's effective date, verification method, supported loads, duration, connectivity redundancy, or incident status. `fetchedAt` means when expaify retrieved a response, not when the property last verified the claim.
- Booking.com and Expedia's documented accommodation content patterns expose property/room amenities. Booking.com's richer internet detail describes connection type and coverage; Expedia explicitly describes its amenity filter as property-level. Neither reference establishes outage continuity, independent network paths, generator runtime, or selected-stay operation.
- An authoritative alert can establish a geographically and temporally bounded destination context, but a hazard alert does not establish a hotel outage. The current six-hour provider cache is also incompatible with calling a fast-changing operational state “current” unless the data contract gains a shorter alert-specific freshness rule.
- No production resilience impressions, opens, selection events, or confidence measures exist. Compact-disclosure engagement and comprehension are unmeasured, not negative.

The next stage may design a **research prototype and data-gated state model only**. Production design should remain blocked until a representative provider/property audit meets the thresholds in section 8 and users understand missing evidence, scope, recency, and non-guarantee language.

## 2. Method and limitations

This brief used:

1. A static audit of the discovery report and the live feed, detail, API, persistence, provider, evidence-normalization, and analytics code.
2. A contract-level review of official Booking.com and Expedia accommodation-content documentation.
3. A pattern review of official CAP/GDACS alert documentation and Airbnb's feature-verification and limitation disclosures.
4. A proposed mixed-method validation plan and explicit decision thresholds.

This brief did **not** include production analytics, traveler interviews, an eligible-destination dataset, provider credentials, property outreach, or a live property sample. Accordingly:

- Repository-level coverage can be reported; real-world property coverage cannot.
- Reference patterns are guidance, not evidence that expaify users want this disclosure.
- The age windows below are conservative research gates to test with providers and operations stakeholders, not industry standards or safety certifications.

## 3. Current implementation audit

### 3.1 Shipped result scan: `DealCard`

`app/components/ui/DealCard.tsx:15-31` accepts hotel identity, city, star count, price, median, discount, stay window, price snapshot count, OTA links, headline, and price-update time. It has no destination-context or resilience input.

The card hierarchy is:

1. Hotel name and `stars · city · stay window` (`:51-63`).
2. Deal price, usual price, discount, headline/savings, and price freshness (`:66-90`).
3. Property photo (`:92`).
4. OTA price links (`:94-98`).
5. Price-history trust line (`:100-103`).

There is no safe place to derive resilience from the displayed fields. Star class, price, photo, brand, city, and ordinary Wi‑Fi are not continuity evidence.

### 3.2 Feed and API contract

`ApiDeal` in `app/deals/DealFeed.tsx:42-61` and `app/api/deals/route.ts:10-30` contains no amenity, evidence, source, effective-at, expires-at, scope, or resilience state. Locked cards intentionally replace identity and prices and cannot carry a property disclosure.

The feed already handles loading skeletons, request error/retry, filtered empty, cold/sample data, locked results, and mobile-to-three-column layouts. A resilience concept would need to preserve all of these states rather than create a second card hierarchy.

### 3.3 Detail surface

`app/deals/[dealId]/page.tsx:254-263` has a useful price-staleness precedent: it names what is stale, gives an exact checked date, and tells the traveler to verify with the provider. The primary provider handoff appears before price history (`:338-351`). `Stay details` (`:388-401`) documents hotel, area, dates, nights, and explicit unavailable room/rate/guest states, but no continuity facts.

This detail page is the least risky first surface for a research prototype because it has room for source, date, scope, and limitations. The grid card is already information-dense at 375px and should not gain a resilience badge before coverage and comprehension justify scan-level prominence.

### 3.4 Evidence model and unwired `HotelCard`

`HotelAmenityEvidence` (`lib/types.ts:119-147`) is a useful starting shape:

- `confirmed | unavailable | not_returned | unknown`
- `property | room | rate | selected_stay`
- `sourceLabel`, optional `fetchedAt`, `confidence`, and `certainty`

But it is insufficient for continuity evidence. It lacks:

- a source claim's own `verifiedAt`/`effectiveAt` and `expiresAt`;
- verification method and evidence URL/reference;
- conflict/stale/revoked status;
- supported load or named essential service;
- runtime/capacity/fuel limitations;
- connectivity carrier/path independence and backup-power dependency;
- current operating status distinct from installed infrastructure.

`lib/providers/hotelAmenityEvidence.ts:18-26` whitelists only elevator, parking, step-free route, and four room requests. Unknown IDs are discarded at `:109-117`. Missing arrays become `not_returned` and malformed arrays become an error at `:151-176`. The evidence UI in `app/components/HotelCard.tsx` has detailed provenance and missing-state copy, but that component has no live route caller.

### 3.5 Provider and persistence path

`HotellookProvider.searchHotels` fetches at most 20 offers and uses a six-hour cache (`lib/providers/hotellook.ts:415-499`). It passes `entry.amenityEvidence` through the access-only normalizer. When absent, all accepted facts become `not_returned`; resilience IDs would be rejected.

The persisted `deals` table (`lib/db/schema.sql:125-147`) stores price-deal fields and OTA links only. The detection pipeline never persists `HotelOffer.amenityEvidence`. Consequently, even a future live hotel response containing a resilience claim would not reach the shipped feed or saved-deal detail.

### 3.6 Measurement

`lib/analytics.ts` only logs events to `console.debug` in development. The feed calls generic filter/empty-state events; there are no resilience events, selection-confidence measures, or production analytics sink in the audited path. Engagement cannot currently be calculated.

## 4. Coverage audit: what can be claimed now

Discovery requested four coverage measures. They separate repository evidence from an unavailable property sample:

| Measure | Shipped expaify contract | Representative property sample | Interpretation |
|---|---:|---:|---|
| Any-signal coverage | **0%** | Not measured | No resilience field reaches `ApiDeal`, `DealCard`, or stored deal detail. |
| Signal-level: backup power | **0%** | Not measured | No accepted fact ID or stored field. |
| Signal-level: connectivity continuity | **0%** | Not measured | Ordinary Wi‑Fi presence is not continuity. |
| Signal-level: named essential services | **0%** | Not measured | No supported-load/service structure exists. |
| Decision-grade coverage | **0%** | Not measured | Source claim age, scope limits, duration, and verification method cannot all be retained. |
| Unknown/stale/conflict rate | **100% unknown on shipped surfaces** | Not measured | This means “undocumented in this product,” not “unavailable at the hotel.” |

These are contract-coverage results, not a claim that every hotel lacks resilience. A real evidence audit remains a blocker and must sample properties before a production design decision.

### Required provider/property sample

Before production design, audit at least **12 eligible destination-events**, spanning at least three disruption types and three regions, with **30 bookable properties per event** (or every property when fewer than 30). Preserve the denominator, including properties with no returned evidence.

For every claim, capture:

- property ID/name and exact geographic match;
- signal type: backup power, connectivity continuity, or named essential service;
- claim text and structured scope;
- property, provider, auditor, or authority as source;
- source's verification/effective time, not just fetch time;
- expiry/review date and superseding/cancellation state;
- verification method;
- supported loads/services, runtime/capacity, and explicit limitations;
- contradictions across sources.

Do not count marketing copy, reviews, photos without a defined review method, brand-level policies, ordinary Wi‑Fi, “business center,” star class, or “generator available” without supported scope as decision-grade.

## 5. Destination relevance: eligibility without stereotyping

### Recommended eligibility rule

A hotel search/stay is eligible for the research prototype only when **all** of these are true:

1. **Authoritative source:** a public authority, regulated utility/telecom operator, or recognized alert aggregator that identifies its originating authority. News, social posts, reviews, and generic destination reputation do not qualify.
2. **Explicit continuity impact:** the source explicitly names an electricity outage, planned shutoff, telecommunications disruption, or a likely/observed power or communications impact. A cyclone, flood, wildfire, heat, or earthquake alert alone is insufficient.
3. **Geographic match:** the alert polygon/circle, utility service area, or named locality intersects the deal's market. Country- or region-level matching does not qualify when the hotel is outside the affected locality. Property impact must not be inferred from city impact.
4. **Temporal match:** the source's effective/onset-to-expiry period overlaps the selected stay, or a recovery notice explicitly says disruption may persist into it. A “current” alert that expires before a future check-in is irrelevant.
5. **Live lifecycle:** updates and cancellations supersede older messages. If the source has no expiry or update semantics, it cannot trigger the disclosure.

CAP is a useful interaction/data precedent because it separates event, urgency, severity, certainty, onset, expiry, area, description, instruction, and sender. GDACS provides global geospatial hazard events and update timestamps, but its hazard classification alone does not meet criterion 2 or prove local service impact. See [Google's CAP field guidance](https://developers.google.com/public-alerts/guides/cap-requirements/entities/info) and the [GDACS API quick start](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf).

### Destination-context expiry

- Use the authority's `expires`/resolved/cancelled state; do not invent a later validity period.
- If the authority omits expiry, the context is ineligible.
- Apply update/cancel messages immediately and display the source's effective time separately from expaify's fetch time.
- Operational context must be fetched no more than **15 minutes** before display in the validation prototype. This conflicts with the current blanket six-hour provider cache and must be resolved before production work. A six-hour-old fetch cannot be labeled “current.”
- Render nothing when the stay does not overlap the alert. Do not show a destination “resilience risk” label based on history or reputation.

## 6. Property evidence and claim-age rules

No universal expiry is defensible. Use the following as conservative **research inclusion gates**, then revise them from provider audit results:

| Evidence type | Required contents | Prototype inclusion window | Invalidation |
|---|---|---|---|
| Backup-power infrastructure | Verification method/date; supported loads or named services; stated runtime/capacity or “not documented”; property scope | Verified within 180 days | Immediately on contradictory incident report, removal, failed test, or material system change |
| Connectivity continuity | At least two independent upstream paths/carriers or an explicitly documented failover design; power dependency; scope | Verified within 90 days | Immediately on topology/provider change or contradictory incident report |
| Named essential service continuity | Exact service, dependency, scope, and stated duration/capacity | Verified within 90 days | Immediately on facility/system change or contradictory report |
| Current property operating status | Direct property/provider/authority update with effective time | At most 24 hours old and must overlap the stay | Superseded, resolved, or cancelled immediately |
| Selected-stay confirmation | Property/provider confirmation tied to dates and, where possible, booked room/rate | Reconfirm within 7 days of check-in | Any later contrary update |

An installed generator is a property-level infrastructure fact, not evidence that guest rooms, elevators, HVAC, water pumps, kitchens, charging, medical equipment, or telecom equipment will operate. “Free Wi‑Fi throughout the property” is an amenity/coverage statement, not evidence of upstream redundancy or backup power.

Official Booking.com accommodation details illustrate this delta: internet details can identify connection type and property coverage, while facilities remain property content, not incident continuity. Expedia's documented amenity filtering is property-level and explicitly excludes room/rate-plan elements. See [Booking.com accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details) and [Expedia Rapid content filtering](https://developers.expediagroup.com/rapid/lodging/content/content-filtering?locale=en_US).

## 7. Reference-pattern guidance (interaction, not visual style)

### Pattern A: Booking.com / Expedia — structured amenity presence

- **Reference behavior:** expose structured property facilities; Booking adds limited facility-specific detail such as internet connection type and coverage. Expedia supports searching/filtering property-level amenities.
- **Useful lesson:** structured labels and scope are easier to compare than prose.
- **Critical limit:** amenity presence does not establish continuity during an outage. A standard amenity ID must never be upgraded into a resilience claim.

### Pattern B: Airbnb accessibility review — qualify what was checked

- **Reference behavior:** Airbnb requires clear photos for accessibility features, reviews submitted features for accuracy, keeps feature-level evidence, and offers direct host messaging for unanswered detail. Its location-verification disclosure explicitly says only the requested location information was verified and that verification is not a guarantee of other listing claims.
- **Useful lesson:** verify and label the smallest fact, keep evidence attached to that fact, and state what verification excludes. Do not apply a broad “verified hotel” or “resilient” badge.
- Sources: [Airbnb accessibility pattern](https://www.airbnb.com/accessibility) and [Airbnb verification limitations](https://www.airbnb.com/help/article/3542).

### Pattern C: CAP public alerts — source, geography, lifecycle, expiry

- **Reference behavior:** separate sender, area, event, severity/certainty, effective/onset, expiry, description, and recommended action; support updates/cancellations.
- **Useful lesson:** destination context needs an explicit lifecycle. A static city label or evergreen warning is not an acceptable substitute.

### Exact delta

| Dimension | Current expaify | Reference guidance | Delta |
|---|---|---|---|
| Destination eligibility | City and stay dates only | Authority + exact area + explicit impact + lifecycle | Add a separate, auditable context source; never infer from destination name |
| Property fact | No shipped fact | Smallest verified amenity/feature fact | Add fact-level structure and verification method |
| Scope | Unwired generic property/room/rate/stay enum | Display precisely what was checked | Add supported loads/services and dependencies |
| Recency | Price `updatedAt`; evidence `fetchedAt` only | Effective, verified, expires, updated/cancelled | Separate source age from retrieval age |
| Missing evidence | No resilience state | Preserve unknown/not checked | Explicitly say “not documented,” never “does not have” |
| Limitations | Price disclaimer only | Bound verification and avoid guarantees | Fact-specific non-guarantee beside the evidence |
| Comparison | No resilience data or shortlist | Compare only like-for-like structured facts | Block ranking/filtering until coverage supports fair comparison |

## 8. Compact-disclosure and selection-confidence validation

### Prototype conditions

Test on the current detail-page hierarchy first, then a card-level summary only if detail comprehension passes. Use otherwise comparable hotel pairs and randomize:

1. No disruption context/no disclosure (control).
2. Eligible destination context + one decision-grade property fact.
3. Eligible context + partial/mixed evidence.
4. Eligible context + “not documented” for one property.
5. Stale/conflicting evidence, correctly suppressed or labeled.

Include both travelers who self-identify electricity/connectivity as trip-critical and ordinary leisure travelers. Test at 375px and 1280px, with keyboard and screen-reader review.

### Tasks and comprehension checks

Ask participants to choose between two otherwise similar hotels, explain the choice, open the compact disclosure, and answer:

- Which exact fact was documented?
- Who supplied or verified it, and when?
- Does the fact apply to the property, room, rate, or selected stay?
- Which services or loads are and are not covered?
- Does “not documented” mean the hotel lacks the capability? (Correct answer: no.)
- Is uninterrupted service guaranteed? (Correct answer: no.)
- Does destination disruption evidence prove this hotel is affected? (Correct answer: no.)

Collect pre/post choice confidence on a 5-point scale, chosen hotel, disclosure open, time to choice, reversals after expansion, perceived alarm, and trust. Confidence is successful only among participants who pass the critical comprehension checks.

### Instrumentation specification for a later prototype

- `resilience_context_impression`: context source class, event ID, effective/expires, market, stay overlap, viewport.
- `resilience_summary_impression`: hotel/deal ID, evidence state, signal types, oldest source age, scope.
- `resilience_disclosure_opened`: same dimensions plus entry surface.
- `resilience_source_opened`: signal type and source class.
- `resilience_hotel_selected`: evidence state and whether disclosure was opened.
- `resilience_comprehension_submitted`: aggregate correctness only; do not send sensitive traveler-need text.

Open rate is diagnostic, not a success metric. A high rate may mean the summary is useful, alarming, or unclear.

### Go / narrow / stop thresholds

Advance from research prototype to production design only if all are met:

- **Coverage:** any qualifying signal on at least 60% of sampled properties; decision-grade evidence on at least 40%; at least two decision-grade properties in 70% of eligible destination-events; unknown/stale/conflicting rate no more than 40%.
- **Comprehension:** at least 80% correctly distinguish “not documented” from absence, identify scope/recency, and reject a service guarantee; no more than 10% interpret the summary as “power/internet guaranteed.”
- **Decision value:** among participants who comprehend correctly, median confidence improves by at least 1 point on the 5-point scale or the disclosure changes a choice for an evidence-grounded reason without materially increasing decision time.
- **Relevance:** the eligible-context condition improves confidence more than the no-context condition and does not create a material alarm/trust penalty among travelers for whom the criterion is not trip-critical.
- **Freshness:** alert and property sources can meet the expiry rules without presenting six-hour-cached operational claims as current.

Decision logic:

- **GO:** all thresholds pass; specify a compact, fact-level disclosure.
- **NARROW:** destination relevance and comprehension pass but property coverage does not; use a destination-level source link/confirmation prompt, not property differentiation.
- **STOP:** eligibility cannot be sourced reliably, guarantee misread exceeds 10%, “not documented” is routinely read as absence, or evidence is too sparse/incomparable to distinguish properties.

Current decision: **NARROW for research only.** Coverage, comprehension, and freshness have not been validated, and shipped decision-grade coverage is 0%.

## 9. Design directives for UXDES

1. **Design a validation prototype, not a production feature.** Do not add a live badge, “resilience score,” filter, sort, ranking, or Deal Score input. Prototype the detail surface first; card-level prominence is conditional on passing the thresholds in section 8. Testable: no production-ready state implies that undocumented hotels are worse.

2. **Gate destination context on all five eligibility checks.** Eligible compact copy pattern: **“Current electricity or connectivity disruption reported for {exact area}”**, followed by **“Source: {authority} · Applies through {date, time, timezone}.”** Link to the authority. If impact is generic, geography is coarse, expiry is missing, the stay does not overlap, or the event is cancelled/resolved, render no context. Testable: a hazard name or city alone can never trigger the disclosure.

3. **Expose atomic facts, never a broad badge.** A compact summary may say **“Continuity details documented”** only when at least one decision-grade fact exists. Expansion must name the fact, supported scope/load/service, verification method/date, source, expiry, and limitation. Never use “resilient,” “outage-proof,” “verified hotel,” “always online,” or “power guaranteed.” Testable: every positive statement maps to one retained source fact.

4. **Make missing, stale, conflict, loading, and error states semantically distinct.** Use **“Continuity details not documented by this provider”** for `not_returned`; **“Continuity details could not be checked”** for provider error; **“Continuity information is out of date”** for expired evidence; and **“Sources disagree — confirm with the hotel”** for conflict. None may display as “No backup power” or “No reliable internet” unless a decision-grade source explicitly reports unavailability. Testable: users can distinguish all four from confirmed absence.

5. **Keep scope and non-guarantee adjacent to the fact.** Required limitation pattern: **“Property-level information; it does not guarantee service for your room, dates, or the full outage.”** Replace “property-level” only when the evidence is genuinely tied to a selected stay. Provide **“Confirm with the hotel”** as a secondary action; keep price and provider handoff primary. Testable: at 375px, the limitation and source remain available without displacing the price or booking action.

## 10. Blockers and out-of-scope findings

### Blockers

- No representative destination/property evidence sample or provider credentials were available.
- No current-disruption provider, authority allowlist, geographic matcher, or alert lifecycle exists in the repository.
- The six-hour cache policy conflicts with a “current” destination/property operational claim.
- The evidence type cannot represent supported loads, runtime, redundancy, verification method, source-effective time, expiry, stale, conflict, or revocation.
- The live deal pipeline drops all amenity evidence before persistence/API delivery.
- Production engagement and confidence cannot be measured with the current analytics stub.

### Out of scope

- Emergency alerts, safety ratings, disaster prediction, medical-service claims, on-site infrastructure monitoring, traveler verification, a resilience score, Deal Score changes, shortlist construction, or provider integration.
- The unwired `HotelCard` access implementation and adjacent hotel-amenity, workspace-fit, and compare workstreams should be reused where relevant but not changed by this ticket.

## Handoff

Create `UXDES-HOTEL-POWER-OUTAGE-RESILIENCE-01` to specify the **research prototype and data-gated state model only**, covering default/ineligible, eligible, loading, missing, partial, confirmed, stale, conflict, error, mobile, desktop, focus/keyboard, source-link, and non-guarantee states. The design must preserve the NARROW decision: no production badge/filter/ranking until the section 8 gates pass.

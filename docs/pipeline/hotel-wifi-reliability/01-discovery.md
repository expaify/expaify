# UXD-HOTEL-WIFI-RELIABILITY-01: Hotel Wi-Fi Reliability Evidence Discovery

Date: 2026-07-31  
Stage: UX Discovery (UXD)  
Priority: P2  
Method: Static audit of the current hotel offer, provider normalization, result card, and booking handoff. No traveler interviews, production analytics, Wi-Fi measurements, review-topic dataset, or provider-coverage sample was available at this stage.

## User pain point

A traveler who depends on internet access cannot tell whether an expaify hotel is viable because a generic Wi-Fi amenity—if one were shown—would not say whether access costs extra, reaches the guest room, or has reliability evidence strong enough to trust.

The problem is not simply the absence of a `Wi-Fi` label. Presence, price, coverage, and reliability are separate questions. Collapsing them into one positive amenity chip would allow a true property-level claim such as “Wi-Fi available in public areas” to be misread as “dependable Wi-Fi is included in my room.”

## Who is affected and where

The primary affected users are remote and business travelers, people managing time-sensitive responsibilities, and any traveler whose communication, navigation, accessibility, care, or safety plan depends on remaining connected. The need can be critical even when the trip is not labeled “work.”

The failure spans three decisions:

1. **Search evaluation:** a traveler scanning hotel results cannot distinguish a property with documented in-room access from one with lobby-only access, a fee, or no returned Wi-Fi information. The current live deals feed renders `DealCard`, whose deal shape carries no connectivity evidence. The separate `HotelCard` comparison component has evidence patterns for access, parking, funds, admission, pet, and smoking concerns, but no Wi-Fi presentation.
2. **Hotel detail comparison:** expanded hotel information cannot answer the four viability questions: is access documented, is it included or paid, where does it work, and what supports any reliability claim? The user must leave expaify to investigate, and provider wording may still stop at a generic amenity.
3. **Booking handoff:** `BookingHotelContext` does not carry Wi-Fi evidence. The review flow therefore cannot preserve what was known, disclose what remains unknown, or prompt the traveler to confirm the selected room/rate before payment. A choice made using property-level evidence can silently become a selected-stay assumption.

## What the current product establishes

- `HotelOffer` has optional `amenityEvidence`, and `HotelAmenityEvidence` already provides useful provider-neutral primitives: `status`, `scope`, `sourceLabel`, optional `fee`, `fetchedAt`, and `confidence`.
- The implemented normalizer in `lib/providers/hotelAmenityEvidence.ts` allowlists only elevator, parking, step-free-route, and room-request facts. A `wifi` or connectivity item is discarded. Its fee is preserved only for `on_site_parking`.
- The current Hotellook entry shape has a generic `amenityEvidence` passthrough, but its live and cached paths use that restrictive normalizer. The audited provider contract contains no Wi-Fi-specific availability, room coverage, charge, speed, uptime, latency, recency, or review-topic fields.
- `HotelCard` treats `amenityEvidence` as physical-access evidence and does not render Wi-Fi. The live `DealCard` path does not receive `HotelOffer.amenityEvidence` at all.
- Aggregate guest-rating evidence includes source, review count, freshness, and confidence, but no Wi-Fi topic, sentiment, recency distribution, or consistency measure. A general hotel rating cannot serve as connectivity evidence.
- There are no Wi-Fi evidence impressions, detail opens, confirmation actions, provider exits, shortlist reversals, or booking reversals instrumented in the audited flow. Current engagement, conversion, and reversal baselines therefore cannot be calculated from the repository.

The existing evidence primitives can support an honest lightweight framework, including explicit missing states, but the current provider data cannot support a positive Wi-Fi availability or reliability claim. That is an evidence-coverage limitation, not a UI permission to infer.

## Minimum evidence threshold to investigate

Research should validate the following as the smallest decision-useful framework. These are evidence questions, not a prescribed component or layout:

1. **Availability:** provider-confirmed available, provider-confirmed unavailable, not returned, or unclear/conflicting. Missing must never mean unavailable.
2. **Charge:** included, paid, or not specified. “Free” or “included” is valid only when bound to the applicable property, room, or rate evidence; ordinary property availability does not establish a rate inclusion.
3. **Coverage:** public areas only, guest rooms, all documented rooms, selected room/rate, or not specified. Property-level presence must not be promoted to in-room or selected-stay coverage.
4. **Reliability confidence:** one of three plainly separated evidence strengths:
   - **Measured:** a named method, measurement window, sample size or frequency, location/scope, and recency support the stated metric.
   - **Review signal:** Wi-Fi-specific traveler reports identify source, qualifying review count, recency window, and consistency or conflict; they remain experience signals, not measured performance or a guarantee.
   - **Not established:** only presence/coverage is documented, evidence is too thin or old, signals conflict, or no reliability evidence was returned.

Download speed alone is not a reliability guarantee, and neither a provider amenity flag nor a general guest rating may be upgraded into “reliable,” “fast,” “video-call ready,” or similar suitability copy. If current hotel data supplies only availability, charge, or coverage, the framework must show only those facts and state that reliability is not established.

## Measurable signal

### Structural baseline

- **Representable Wi-Fi coverage:** 0% of current normalized offers can retain a canonical Wi-Fi fact through the active amenity normalizer.
- **Decision-grade reliability coverage:** 0% of the audited hotel contract carries a Wi-Fi-specific measurement or review signal.
- **In-product resolution:** 0% of current hotel decisions can answer all four evidence questions within expaify because no current result/detail/handoff surface presents them.

UXR must replace structural baselines with a provider sample before recommending prominence. Report each dimension independently; a property with documented availability but unknown reliability is not “fully covered.”

### Outcome measures for a prototype or later instrumented release

- **Connectivity-evidence engagement:** evidence impressions and opens, segmented by evidence state, viewport, and work/connectivity-dependent intent. Engagement is diagnostic; a high open rate may indicate anxiety or unclear summary copy.
- **Qualified handoff conversion:** review/provider-handoff rate among connectivity-dependent users after they have seen the evidence or explicit missing state, compared with an equivalent control. Do not count increased conversion as success if comprehension falls.
- **Wi-Fi clarity reversal:** share of users who change their hotel choice or abandon the handoff after learning that charge, room coverage, or reliability was missing or weaker than first understood. Track both avoided bad handoffs and late reversals; the target is fewer reversals caused by information appearing only after selection.
- **Comprehension gate:** users correctly distinguish available from included, property/public-area coverage from in-room coverage, review reports from measurements, and “not established” from “unreliable.” Confidence gains count only when these distinctions are understood.

## Constraints

1. **Preserve provenance and evidence strength.** Every provider fact must enter through `lib/providers` and retain source, state, scope, fee status, and freshness where supplied. Provider-confirmed facts, measured evidence, Wi-Fi-specific review signals, conflicting signals, and missing data must remain visibly distinct. Never infer Wi-Fi quality from stars, price, brand, property type, photos, a general guest rating, or the Deal Score.
2. **Make no unsupported performance or selected-stay guarantee.** Do not claim “reliable,” “fast,” “good for calls,” uptime, or selected-room coverage without evidence that directly supports that wording and scope. Measurements are time- and location-bound; review signals are reported experiences; neither guarantees future performance. Property-level availability must direct the user to confirm room/rate details before payment when selected-stay coverage is not documented.
3. **Keep the framework lightweight and compatible.** Reuse the existing amenity-provenance concepts and current result → detail → handoff hierarchy; do not create a connectivity score or alter Deal Score. The evidence must remain comprehensible without color alone and usable at 375px and 1280px. Sparse current data must degrade to precise “not returned/not established” states rather than decorative empty content.

## Success statement

This is solved when a first-time connectivity-dependent traveler can compare an expaify hotel and correctly tell, before provider handoff, whether Wi-Fi is documented, whether a charge is known, whether coverage reaches the room, and whether reliability is supported by measured evidence, Wi-Fi-specific review signals, or not established—without mistaking a generic amenity, missing data, or reported experience for a performance guarantee.

## Boundaries with adjacent work

- **Hotel amenity provenance / amenity fit:** owns the generic status, source, and missing-data discipline and general amenity comparison. This ticket sharpens one amenity whose presence alone is not sufficient for a connectivity-dependent decision.
- **Hotel rate inclusions:** owns whether Wi-Fi is included in the displayed rate. This ticket consumes that fee/inclusion evidence but does not redesign total-rate comparison.
- **Hotel workspace fit:** owns the broader combination of connectivity, desk/workspace, and quiet. This ticket owns the narrower connectivity evidence model and applies even when no work intent is declared.
- **Hotel power-outage resilience:** owns connectivity redundancy and continuity during a credible disruption. Ordinary Wi-Fi availability or reliability evidence must not imply outage resilience.
- **Hotel review relevance:** owns broader review-topic extraction. This ticket may consume only a Wi-Fi-specific, source/count/recency/consistency signal and must label it as reported experience.

Out of scope: live network testing by expaify, traveler speed-test collection, synthetic “Wi-Fi score” or “work-ready” verdicts, outage monitoring, provider integration, filters, ranking changes, saved connectivity preferences, changes to Deal Score, or UI implementation.

## Required UXR focus

The next stage must:

1. Audit the active `DealCard`/deal-detail path, the separate `HotelCard` path, `BookingHotelContext`, provider live/cache normalization, and analytics to name the actual end-to-end surface and data delta.
2. Sample current and plausible hotel-provider payloads to report coverage separately for availability, charge, room coverage, measured reliability, and Wi-Fi-specific review signals. Recommend stop/narrow/go if evidence cannot distinguish hotels honestly.
3. Compare one or two hotel reference patterns at the interaction level, focusing on how they distinguish free/paid, public-area/in-room coverage, structured facts/reviews, and missing evidence—not visual style.
4. Test the minimum evidence threshold and exact comprehension tasks: available vs included; property vs room; measurement vs review report; not established vs unreliable; and reversal after missing clarity is revealed.
5. Produce 3–5 testable design directives for hierarchy, evidence strength, missing/conflict states, and booking-handoff continuity. Reconcile rather than duplicate the completed `hotel-workspace-fit`, `hotel-rate-inclusions`, `hotel-amenity-provenance`, and `hotel-power-outage-resilience` work.

## Blockers and out-of-scope findings

- **Provider-evidence blocker:** the current normalized hotel data cannot substantiate any positive Wi-Fi claim or reliability level. Research can define and test the framework, but implementation must remain provider-contingent.
- **Surface split:** the live deals experience uses `DealCard`, while the richer `HotelCard` evidence component is not mounted by a live non-test route. UXR must identify the intended target before UXDES specifies placement.
- **Measurement blocker:** no production Wi-Fi evidence or feature-specific analytics exists, so engagement, qualified conversion, and reversal rates require prototype research or later instrumentation.

## Handoff

Create `UXR-HOTEL-WIFI-RELIABILITY-01` with this report path and the user pain point above. Research must determine whether current or plausible hotel data can support the minimum framework honestly before recommending a UI treatment.

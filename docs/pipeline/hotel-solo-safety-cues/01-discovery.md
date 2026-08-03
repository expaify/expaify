# UXD-HOTEL-SOLO-SAFETY-CUES-01: Hotel Solo-Stay Safety Cues Discovery

Date: 2026-08-03  
Stage: UX Discovery (UXD)  
Priority: P1  
Method: Static audit of the current hotel offer contract, result/detail components, booking-handoff context, provider normalization, and existing hotel evidence work. No traveler interviews, supplier coverage sample, verified incident data, or production feature analytics was available at this stage.

## User pain point

A solo traveler assessing a hotel cannot confidently continue from a shortlist to a property evaluation because expaify does not clearly separate a small set of sourced, arrival-relevant property facts from general reviews and unknowns—inviting either unsupported assumptions about personal safety or a costly off-platform research detour.

This is not a request for a safety score. A property address, distance, documented arrival instruction, or a traveler review can help someone plan; none establishes that a hotel, neighborhood, route, or stay is safe.

## Who is affected and where

The primary users are solo travelers, especially those arriving in an unfamiliar place, arriving late, carrying luggage, or needing to make an independent decision before provider handoff. The same clarity helps any traveler who has a personal arrival constraint.

The affected flow has two decision points:

1. **Search shortlisting:** while scanning hotel results, the traveler needs to know whether expaify has a precise enough location context and any directly sourced arrival fact worth opening—not a safety conclusion. Today `HotelOffer` can carry provider location evidence and generic amenity/policy evidence, but it has no dedicated, normalized arrival-context evidence. The active deals feed's `DealCard` also does not receive this richer `HotelOffer` evidence.
2. **Hotel detail evaluation and handoff:** after opening a candidate, the traveler needs to distinguish provider/property facts (for example an address, an airport distance with method, or an explicit check-in requirement) from subjective traveler reports and from information expaify did not receive. `HotelCard` has provenance-aware patterns for location, access, transport, admission, funds, smoking, and other policy evidence, but no coherent solo-arrival evidence model. `BookingHotelContext` does not preserve a dedicated arrival-context record through review/handoff.

## What the current product establishes

- `HotelLocation` already models useful, bounded location provenance: provider label/address/coordinates, a precision state, and an optional anchor distance. A displayed distance identifies its method (`straight_line`) and source; it is not an ETA, route quality, or safety claim.
- `HotelAmenityEvidence` establishes a reusable evidence vocabulary: confirmed/unavailable/not returned/unknown, property/room/rate/selected-stay scope, source label, freshness, confidence, and requestability. The active amenity normalizer is an allowlist for access-related facts, so it cannot presently substantiate broader solo-arrival cues.
- Existing policies cover adjacent factual questions—transport/airport transfer, admission and check-in requirements, access features, smoking, funds, and disruption notices—but their evidence is dispersed. A traveler cannot scan one bounded distinction between “documented for arrival,” “traveler report,” and “not provided.”
- General guest-rating evidence carries source, count, freshness, and confidence but is not topic-specific. A rating, star class, price, brand, photo, or Deal Score cannot be repurposed as a safety signal.
- The repository exposes no dedicated solo-traveler intent, property/arrival-cue impressions, detail opens, cue-driven shortlists, provider exits, comprehension checks, or post-handoff reversals. Current confidence, cue reliance, and fact-vs-review confusion cannot be baselined from production telemetry.

## Minimum responsible cue pattern to research

Research should determine whether the following minimal pattern improves decision confidence without creating a safety claim. These are evidence categories and display rules to validate, not a UI prescription.

| Layer | Candidate cue, only when sourced | What it may support | What it must not imply |
| --- | --- | --- | --- |
| Shortlist | Precise provider location or a clearly labelled provider/calculated anchor distance | “Where this property is described as being” and whether more context exists | Neighborhood safety, walkability, travel time, or route safety |
| Detail | Documented arrival fact: stated check-in window, staffed-arrival/late-arrival instruction, entry/access requirement, or provider-confirmed transfer/contact instruction | Practical planning for a stated arrival condition | 24/7 staffing, entry success, personal security, or a guarantee that the instruction remains current |
| Detail | Topic-specific traveler reports, only with source, qualifying count, recency, and clear “traveler reports” labelling | A subjective experience signal a traveler can weigh | A verified property fact, current condition, or safety assessment |
| Detail / handoff | Explicit not-provided, unclear, conflicting, or stale state plus a precise confirmation action | Recognition of what must be checked with the provider/property | A negative safety finding or a reason to rank the hotel lower automatically |

The smallest viable hierarchy is therefore: one factual location/arrival summary at shortlist level when present; a detail-level evidence breakdown that keeps property/provider facts, traveler reports, and unknowns separate; and a handoff reminder only for a material unresolved arrival fact. Do not show a generic “Safety” chip, a numerical ranking, a neighborhood label, a colored reassurance treatment, or an empty marketing panel.

## Measurable signal

### Structural baseline

- **Dedicated cue coverage:** 0% of the audited `HotelOffer` contract currently carries a normalized, end-to-end solo-arrival evidence object that can distinguish factual property/arrival context from traveler reports.
- **Arrival-context continuity:** 0% of audited hotel booking context carries a dedicated arrival fact, source, scope, freshness, conflict state, or review-topic provenance into the handoff review.
- **Fact/review separation:** 0% of the current live hotel result path presents an explicit factual-versus-subjective evidence distinction for this decision.

UXR must replace these structural findings with a provider-payload and prototype sample before recommending any cue prominence. Measure every evidence category independently; location coverage does not prove arrival-instruction coverage.

### Outcome measures for research or a later instrumented release

- **Confidence to continue:** after reviewing a candidate, the share of solo travelers who say they have enough *factual arrival context* to decide whether to inspect the provider listing next. Pair this with a comprehension check; confidence alone is not success.
- **Appropriate cue reliance:** the share of participants who can name the sourced fact they used and explain its limit (for example, “straight-line distance, not travel time” or “provider instruction, not a guarantee”). Track over-reliance on reviews or generic ratings as a failure signal.
- **Fact-versus-review comprehension:** the share who correctly classify each displayed item as a provider/property fact, a traveler report, or information not provided, and who do not call any of them a safety assessment.
- **Late-discovery reversal:** the share who change candidate or abandon a provider handoff because an arrival condition was absent, unclear, or different from their earlier understanding. A reduction is meaningful only if factual classification remains correct.

## Constraints

1. **Use sourced, scoped evidence only.** Every positive or negative factual cue must retain provider/property source, scope, and observation time where supplied. Topic-specific traveler reports need their own source, qualifying count, and recency. Missing, unclear, stale, and conflicting evidence must remain distinct; missing never means unsafe or unavailable.
2. **Use neutral planning language.** Never claim or rank safety, security, neighborhood quality, safe walking routes, lighting, crime risk, staff presence, access control effectiveness, or suitability for a solo traveler. Do not infer these from location, price, hotel class, images, general ratings, review sentiment, or the Deal Score. Facts may describe what a named source states, not what expaify guarantees.
3. **Preserve lightweight, accessible continuity.** Keep shortlist cues limited to directly decision-useful facts and reserve qualifiers/provenance for detail. The pattern must work at 375px and 1280px, not rely on color alone, retain its factual boundary through provider handoff when material, and not introduce scoring, ranking, filtering, or a new data-provider call from a component.

## Success statement

This is solved when a first-time solo traveler can shortlist and evaluate a hotel using a minimal set of clearly sourced location and arrival-context facts, correctly distinguish those facts from subjective traveler reports and unknowns, and decide whether to continue to the provider without mistaking any cue for a safety ranking or guarantee.

## Required UXR focus

1. Audit the active `DealCard`/deal-detail path, `HotelCard`, booking review/handoff context, provider live/cache normalization, and analytics to identify the real end-to-end surface and provenance gaps.
2. Sample current and plausible affiliate-provider payloads. Report separate coverage for exact/area location, distance/route method, check-in/late-arrival instructions, entry or identity requirements, transfer/contact instructions, topic-specific review signals, source, freshness, and conflict states. Recommend stop, narrow, or go if the data cannot preserve these distinctions.
3. Compare one or two reference patterns at the interaction level for factual property information, arrival instructions, user reviews, and unknown states—specifically how they avoid converting logistical context into a safety assertion.
4. Test the minimal pattern with solo-arrival scenarios, including late arrival and unfamiliar destination. Test classification of provider fact vs traveler report vs unknown, whether distance is mistaken for travel time or route quality, and whether any presentation is read as a safety endorsement.
5. Produce 3–5 testable design directives for shortlist hierarchy, detail provenance, missing/conflicting/stale states, and handoff continuity. Reconcile with existing location, transport, admission, access, disruption, smoking, luggage-storage, and review-relevance work rather than duplicating it.

## Boundaries and out-of-scope findings

- **Adjacent work:** location-context work owns location precision and distance disclosure; transport and check-in/admission work own their factual domains; review-relevance work owns topic extraction. This ticket only defines the cross-cutting decision boundary a solo traveler needs.
- **Out of scope:** a safety score/ranking/filter, crime or neighborhood data, maps or routing, real-time incident monitoring, background checks, live staffing verification, property certification, provider integrations, review mining, price/Deal Score changes, and UI implementation.
- **Evidence blocker:** current normalized hotel data has no dedicated arrival-context or topic-specific solo-traveler review record. Research may validate the evidence model, but implementation must not make a positive cue claim until a provider/source sample establishes coverage and provenance.
- **Surface blocker:** the live deals experience and the richer `HotelCard` evidence component are separate surfaces. UXR must establish the intended target before design specifies placement or continuity.

## Handoff

Create `UXR-HOTEL-SOLO-SAFETY-CUES-01` with this report path and the user pain point above. Research must determine whether a minimal, sourced fact/report/unknown pattern can improve solo-traveler decision confidence without creating a safety claim.

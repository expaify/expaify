# UXD-HOTEL-POOL-OPERATING-STATUS-01: Hotel Pool Operating-Status Confidence Discovery

Date: 2026-08-03  
Stage: UX Discovery (UXD)  
Priority: P2  
Method: Static audit of the current hotel result card, saved-deal detail, shared amenity contract, provider normalizer, persistence shape, and analytics allowlist. No production amenity analytics, provider pool-attribute sample, or traveler interviews were available at this stage.

## User Pain Point

A leisure traveler planning to use a hotel pool cannot tell from expaify whether the provider merely lists a pool or discloses operating conditions that fit the stay—season/date coverage, indoor or outdoor setting, and heated status—so the traveler must open the hotel detail or leave for a provider site and may form a false expectation that the pool will be usable.

This is an evidence-confidence problem, not a request for a generic `Pool` amenity chip. “Pool listed” does not establish that it operates during the planned dates, that a seasonal schedule covers the stay, that an outdoor pool is suitable for the traveler’s needs, or that “heated” means a particular water temperature. Provider-disclosed operating attributes also cannot establish live capacity, crowding, temporary maintenance, weather disruption, or day-of-stay access.

## Who Is Affected And Where

The primary affected users are leisure travelers for whom pool use materially influences property choice: families, resort and warm-weather travelers, swimmers, and guests planning rest or recreation at the hotel. The need is especially consequential when a traveler is comparing seasonal destinations, traveling outside peak season, or choosing between indoor and outdoor facilities.

The failure spans the hotel-card-to-detail flow:

1. **Hotel result card:** the reachable deal card shows property identity, city, stay window, price, discount/Deal Score cues, and limited disruption/quiet-stay evidence. It carries no pool fact or pool-operating summary. A traveler cannot distinguish “pool disclosed with a season covering my dates” from “pool listed without operating information” or “no pool information returned” before opening details.
2. **Hotel detail:** the reachable saved-deal detail has a **Hotel fit** section, but it presents hotel class, a missing guest-rating state, disruption evidence, and quiet-stay evidence—not pool existence or operation. A traveler who opened the detail to resolve pool fit still has no answer and must back out or proceed to the provider.
3. **Provider handoff:** the provider is the appropriate boundary for room-level details and current conditions, but expaify currently sends the traveler there without preserving a pool-evidence summary or identifying what remains unverified. Discovery must not treat an outbound click as proof of confidence or successful booking.

There is also an implementation-surface split that UXR must preserve explicitly: `app/components/HotelCard.tsx` contains richer provider-evidence patterns but is not mounted by a live page, while the reachable results path uses `app/components/ui/DealCard.tsx` and `/deals/[dealId]`. This ticket defines the user problem across the reachable card-to-detail flow; it does not authorize surface wiring or UI work.

## Current Evidence And Measurable Signal

### Structural baseline

- Pool evidence rendered on the reachable hotel result card: **0 attributes**.
- Pool evidence rendered in the reachable hotel detail’s **Hotel fit** section: **0 attributes**.
- Canonical pool ids accepted by `lib/providers/hotelAmenityEvidence.ts`: **0**. Unknown ids are discarded; the allowlist currently covers access, parking, and room-request facts.
- Pool or general amenity fields persisted with saved hotel deals in `lib/db/schema.sql`: **0**.
- Pool-specific impression, detail-open, return-to-results, confidence, or provider-handoff analytics in the audited allowlist: **0**.

The current product therefore cannot establish a behavioral baseline for pool-driven exits or confidence. UXR must validate the need and the minimum evidence with research, and a later instrumented release must establish the production baseline before setting a numeric improvement target.

### Primary outcome: fewer amenity-driven detail exits

Measure the share of hotel detail views that end in an explicit return to results after the traveler has opened or encountered pool evidence and identifies pool mismatch or insufficient pool information as the reason:

`pool-related detail exits / eligible hotel detail views with pool intent or pool-evidence exposure`

Compare card-summary exposure with a control or pre-release baseline, segmented by selected dates, evidence state, viewport, and entry source. The desired movement is fewer **late** exits caused by discovering a mismatch only on detail; an earlier card-level rejection of a poor fit is a useful prevented detail open, not a failure. Browser abandonment cannot be labeled pool-driven without an explicit signal.

Guardrails: do not optimize by hiding unknown or mismatch states, and do not infer success from higher outbound handoff alone. Read detail exits together with suitable-property detail opens, back-to-results reasons, provider handoff, and comprehension.

### Primary research outcome: higher calibrated confidence

After evaluating a card and its detail, ask pool-intent leisure travelers how confident they are that they understand what the provider has disclosed for their planned stay, then test whether that confidence is accurate. Success requires both:

- increased self-reported confidence in deciding whether to keep or reject the hotel; and
- correct comprehension of the distinctions between **pool listed**, **disclosed season covers all/some/none of the stay**, **operating dates not provided**, **indoor/outdoor**, **heated status disclosed/not disclosed**, and **live status not confirmed**.

Confidence without correct comprehension is a trust regression. UXR should establish a benchmark and threshold rather than inventing one at discovery.

### Diagnostic coverage measures

- Share of offers with provider-disclosed pool existence, operating schedule/season, indoor/outdoor type, and heated status, reported separately rather than as one “complete” rate.
- Share of dated stays with full, partial, no, or indeterminate overlap against a disclosed operating season.
- Unknown, stale, conflicting, and malformed evidence exposure rates.
- Card pool-summary impression-to-detail-open rate by evidence state; use diagnostically, not as a standalone success metric.

## Minimum Evidence Hierarchy To Validate

The hierarchy below defines the questions that must remain distinct. It does not prescribe a component, icon, or layout.

1. **Can expaify make a dated operating statement?** Only compare selected stay dates with provider-disclosed operating dates or an explicit year-round statement. Report full overlap, partial overlap, no overlap, or indeterminate. Without selected dates or a disclosed schedule, say that operating dates were not provided; do not convert “seasonal” into open or closed.
2. **What facility did the provider describe?** Preserve each disclosed pool separately when possible, including indoor, outdoor, or type not specified. Do not collapse multiple pools into a single positive claim if their schedules or attributes differ.
3. **Is heated status disclosed?** Distinguish heated, not heated, and not provided. “Heated” is a provider attribute, not a promised temperature, comfort judgment, or year-round operation claim.
4. **What is the evidence scope and provenance?** Show that the fact is provider-disclosed, property-level unless a narrower scope is genuinely supplied, with source and freshness where available. Conflicting, stale, malformed, and not-returned evidence must remain explicit.
5. **What remains unverified?** State at the decision boundary that disclosed attributes do not confirm live opening, capacity, maintenance, weather-related closure, hours, guest eligibility, fees, or day-of-stay access unless the provider supplies those exact facts through the evidence contract.

“Appropriate for my stay” may only be a transparent match between selected dates and the traveler’s stated indoor/outdoor or heated preference. It must not become a synthetic pool-quality verdict or an inferred suitability claim.

## Constraints

1. **Provider-disclosed facts only.** Every pool fact must enter through `lib/providers` and preserve the `Result<T>` boundary. Do not infer operation, season, type, heating, temperature, or suitability from photos, climate, destination, hotel class, marketing copy, reviews, price, or Deal Score. Missing evidence is unknown—not no pool, closed, unheated, or unsuitable.
2. **No live-status promise.** Use disclosed schedule and attribute language, not “open now,” “available,” or “guaranteed for your stay,” unless a provider contract explicitly supports that exact scope and freshness. Exclude live capacity, crowd levels, temporary maintenance, weather disruption, sanitation, water temperature, and unreported closures. The provider/property remains the confirmation boundary for current conditions.
3. **Preserve the card-to-detail hierarchy and trust signals.** A concise card signal may help eliminate a mismatch, while detail must expose the evidence, unknowns, and provenance without displacing property identity, price, Deal Score, or stay dates. The meaning must survive at 375px and 1280px, keyboard and assistive-technology use, and cannot depend on color alone. This UXD ticket does not add filters, ranking, a pool score, or UI.

## Success Statement

This is solved when a first-time leisure traveler can move from a hotel card to its detail and accurately determine whether provider-disclosed pool operating dates cover all, part, none, or an unknown portion of the planned stay; whether the relevant pool is indoor or outdoor; and whether heated status is disclosed—without mistaking a listed amenity or dated schedule for confirmation of live capacity, maintenance status, or day-of-stay operation.

## Required UXR Focus

`UXR-HOTEL-POOL-OPERATING-STATUS-01` should:

1. Audit the reachable `DealCard` → `/deals/[dealId]` → provider-handoff path, the orphaned richer `HotelCard`, shared types, provider normalization/cache paths, saved-deal persistence, and analytics to state the exact end-to-end data delta.
2. Sample current and plausible provider payloads and report coverage separately for pool existence, per-pool identity, season/date ranges, year-round operation, indoor/outdoor type, heated status, hours, source, and freshness. Recommend stop/narrow/go if the evidence cannot support an honest distinction between hotels.
3. Compare one or two travel-reference patterns at the interaction level, focusing on listed-versus-operating semantics, seasonal date matching, multiple pools, unknown/conflicting data, and the card-to-detail hierarchy—not visual styling.
4. Validate the hierarchy with leisure travelers using full-overlap, partial-overlap, no-overlap, dates-missing, schedule-missing, indoor/outdoor, heated-status-missing, multiple-pool, stale/conflicting, and temporary-closure-unknown scenarios. Test confidence and comprehension together.
5. Produce 3–5 testable directives defining capability-gated card and detail content, exact date-match semantics, evidence/provenance language, honest confirmation boundaries, and instrumentation for pool-related detail exits and calibrated confidence.

## Out Of Scope And Dependencies

Out of scope: provider integration, UI implementation, amenity filters or ranking, changes to Deal Score, live occupancy/capacity, crowd prediction, maintenance or closure monitoring, weather-based inference, pool hours, temperature guarantees, lifeguard coverage, child suitability or safety, accessibility, fees, spa/hot-tub/waterpark features, review mining, and post-booking property contact.

Dependencies and blockers for later stages:

- **Provider evidence:** the current normalizer cannot retain pool attributes, and no audited provider sample establishes coverage. Positive claims are blocked until UXR validates an evidence source and canonical shape.
- **Persistence and continuity:** saved deals do not persist amenity evidence, so the reachable detail cannot currently reproduce a result-time pool statement.
- **Measurement:** no pool-specific analytics or production baseline exists. Reduced amenity-driven exits and confidence lift require research and later approved instrumentation.
- **Adjacent ownership:** generic status/provenance belongs with hotel amenity-provenance work; temporary reported pool closure may overlap disruption evidence. UXR must reuse those semantics and avoid duplicate or conflicting claims.

## Handoff

Create `UXR-HOTEL-POOL-OPERATING-STATUS-01` with this report path and the user pain point above. Research must validate evidence availability and traveler comprehension before recommending any visible pool-operating treatment.

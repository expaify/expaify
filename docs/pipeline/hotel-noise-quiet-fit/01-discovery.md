# UXD-HOTEL-NOISE-QUIET-FIT-01: Hotel Quiet-Stay Fit Discovery

Date: 2026-07-31  
Stage: UX Discovery  
Priority: P1  
Feature slug: `hotel-noise-quiet-fit`

## User Pain Point

A traveller choosing a hotel for sleep, remote work, or a quiet stay cannot tell whether expaify has credible evidence of street, nightlife, aircraft, transport, or internal-property noise—or no evidence at all—so a low price or convenient location can be mistaken for a suitable room before provider handoff.

## Who Is Affected And Where

This affects travellers for whom noise can make an otherwise good hotel unusable: light sleepers, guests recovering between travel legs, families with young children, and remote or business travellers who need uninterrupted calls or concentration. The need is situational; expaify must not collect or infer health information to establish it.

The decision breaks at three linked points:

1. **Search refinement and comparison.** Travellers cannot narrow or compare hotels on quiet-stay evidence. `app/components/HotelCard.tsx` exposes price, Deal Score, location, quality, policies, and other stay-fit evidence, but no quiet-stay signal. A central, nightlife-adjacent, airport, and residential property can therefore look equivalent on this need.
2. **Hotel detail evaluation.** The saved deal-detail page mounts `QuietStayEvidenceLedger`, but always passes `NO_QUIET_STAY_EVIDENCE`. Its populated provider-fact, nearby-context, and licensed-review states exist only as an unwired UI contract and test fixtures; no live hotel record reaches them. The panel is also placed under “Supporting evidence,” after the provider action, so it cannot currently support a pre-handoff decision.
3. **Room selection and handoff.** expaify does not own room inventory selection or room assignment. `HotelCard`, the saved deal detail, and `BookingFlow` do not carry quiet-stay evidence into the provider handoff. A property-level soundproofing statement or request capability therefore cannot be mistaken for evidence about the room ultimately selected, and expaify cannot claim a quiet-room request was sent, acknowledged, or fulfilled.

## Current, Measurable Signal

The current implementation establishes an honest fallback but not a usable quiet-fit decision:

- The production deal-detail path renders only “Quiet-stay details were not provided by this hotel source.” It has **0% populated quiet-stay evidence coverage** in the wired product path.
- `HotelOffer` and the current hotel provider normalization do not carry the ledger’s provider facts, nearby context, or review themes. The search/results path therefore has no normalized basis for a quiet-stay filter, badge, ranking input, or room-level claim.
- The existing ledger correctly separates provider facts, nearby context, and guest-review themes and rejects malformed or unattributed values. However, its candidate taxonomy does not yet prove source availability, coverage, review licensing, freshness thresholds, or usefulness for distinguishing internal-property noise from external exposure.
- Production analytics already record hotel detail views, provider handoff clicks, back-to-results actions, and provider returns. They do not record quiet-evidence exposure or engagement, and a departure after viewing detail cannot currently be attributed to noise concerns.

The baseline is therefore not “these hotels are noisy.” It is: **expaify cannot presently support or measure a trustworthy quiet-stay assessment for any live offer.**

### Required measurement definitions

1. **Quiet-stay detail engagement:** among users exposed to a hotel result or detail that has a quiet-evidence state, the share who deliberately open or reach the quiet-stay disclosure. Segment by evidence availability and class. Passive rendering below the fold is exposure, not engagement.
2. **Detail abandonment after evidence:** the share who view quiet-stay evidence and then return to results, refine the search, or end the session without starting a provider handoff. Treat this as a sequence, not proof that noise caused abandonment. Compare it with eligible detail views where the evidence was not engaged.
3. **Qualified handoff:** the share who start provider handoff after seeing the applicable evidence and uncertainty disclosure. Higher conversion is not inherently better; an informed rejection of an unsuitable or unknown stay is also a correct outcome.
4. **Post-handoff complaint intent:** among users who return from a provider, the share who explicitly select a bounded reason such as “Noise or quiet-room details did not match.” Do not infer complaint intent from return duration, back navigation, or a closed tab, and do not collect free-text sleep, medical, or room-location details.
5. **Comprehension guardrail:** in task testing, the share who correctly distinguish a documented fact, a guest-reported pattern, a nearby exposure, and missing evidence. Record false “quiet is guaranteed” interpretations separately; the acceptable target is zero.

## Minimum Trustworthy Evidence Hierarchy

This hierarchy ranks evidence by what it can safely support, not by whether it is favourable. Conflicting evidence remains visible and is never averaged into a score.

### 1. Selected room or selected-stay provider facts — strongest

Use only an attributable, current provider assertion tied to the room/rate and searched stay. Minimum useful facts are room-type soundproofing and the state of a quieter-room option: documented for that room, requestable, transmitted, acknowledged, or guaranteed. These states are not interchangeable. Unless a provider explicitly guarantees the selected stay, expaify must say that a preference depends on availability.

### 2. Property-level provider facts

An attributable property statement may establish that soundproofing is listed, that a quieter-room option exists, or that the property documents relevant operating conditions. It cannot establish that every room is quiet, that a specific room has the feature, or that current noise sources are absent. Property facts must retain source, scope, and checked/updated time.

### 3. Licensed, review-derived noise patterns

Aggregated guest-review evidence can describe experienced patterns that provider facts often miss, especially street/nightlife noise and internal-property noise from corridors, lifts, adjoining rooms, bars, events, or building systems. It must identify the licensed source, time window, sample size when available, and the bounded theme. It is guest opinion, not a verified property fact or a prediction for the next stay. A single review, unlicensed text, or unattributed summary does not meet the threshold.

### 4. Location-derived exposure context — weakest positive evidence

With exact address or coordinate-level property location and a licensed, fresh reference source, expaify may state proximity to a named airport, rail line, major road, or nightlife area. Proximity only identifies a possible exposure; it does not prove audible noise, flight-path exposure, operating hours, room orientation, insulation quality, or a specific room outcome. Area-level or search-area location is insufficient for a property proximity claim.

### 5. Unknown, unavailable, stale, or conflicting evidence — always explicit

“Not returned,” “could not be checked,” “out of date,” “location too imprecise,” and “sources differ” are distinct states. None is evidence that a stay is quiet or noisy. Unknown inventory must remain discoverable and must not silently pass or fail a quiet-stay filter.

## Pragmatic Disclosure Recommendation

The minimum viable disclosure is an **evidence ledger, not a quietness score or “quiet hotel” verdict**:

- **Search refinement:** only provider-confirmed, appropriately scoped facts may support a positive filter. Review-derived patterns and nearby context may support transparent evidence-category refinement only if UXR validates coverage and comprehension; unknown hotels must remain reachable with the excluded/unknown count disclosed.
- **Result comparison:** indicate that quiet-stay evidence is available and name its strongest evidence class. Do not compress mixed evidence into “quiet,” “noisy,” a risk percentage, or ranking boost.
- **Hotel detail:** show the classes in strength order—selected room/stay facts, property facts, licensed guest patterns, then nearby context—with source, scope, freshness, conflicts, and one persistent statement that none predicts a specific room.
- **Room selection/provider handoff:** repeat only the evidence applicable to the selected room or stay. Keep “requestable,” “transmitted,” “acknowledged,” and “guaranteed” visibly distinct, and direct the traveller to confirm current room location and conditions with the booking provider when evidence is weaker or absent.

The disclosure should answer four questions without requiring the traveller to interpret provenance metadata: **What is known? Who says so? What does it apply to? What remains uncertain?**

## Constraints

1. **Evidence classes must stay separate.** Provider facts, licensed review-derived patterns, nearby exposure context, and missing evidence cannot be blended into one score or presented with equal certainty. No claim may be inferred from price, star rating, generic guest rating, hotel name, photos, area label, or silence in the data.
2. **No quiet-room guarantee without selected-stay proof.** Property soundproofing, a “quiet room” option, and a request are not room assignment. Environmental context cannot predict temporary works, events, neighbours, aircraft routing, operations, or room orientation. Copy must never guarantee sleep, call quality, concentration, or quiet.
3. **Delivery boundaries hold.** External data must flow through `lib/providers` via `Result<T>` and retain attribution/freshness; reviews and venue data must be licensed rather than scraped; outbound deeplinks retain affiliate markers; and analytics collect no free-text sleep or health needs. At 375px and desktop, the decision signal remains keyboard/assistive-technology readable, does not rely on colour or icon alone, and stays secondary to price, Deal Score, date/occupancy context, and provider handoff.

## Scope Boundary And Prior Work

`docs/pipeline/hotel-noise-fit/01-discovery.md` established the broad quiet-stay trust problem, and `QuietStayEvidenceLedger` subsequently implemented an honest, source-separated UI shell. This ticket does not authorize a second parallel model. It narrows the repair target to the smallest useful evidence hierarchy, validates that the live path still has no data, and identifies where disclosure must support comparison and handoff rather than exist only as a fallback below the primary action.

This discovery does not authorize:

- a noise score, “quiet hotel” label, ranking change, or prediction;
- a new provider, review, map, venue, acoustic, or live-noise integration before UXR proves its rights, coverage, and vocabulary;
- scraping, free-text review display, or a synthetic summary without licensed source evidence;
- room inventory, room assignment, provider messaging, or a claim that a quiet-room request was delivered;
- implementation changes to the existing ledger, search filters, results cards, analytics, or handoff.

## Success Statement

This is solved when a first-time traveller can compare a hotel and reach room selection knowing which quiet-stay signals are selected-room or provider facts, which are licensed guest-reported patterns, which are only nearby exposure context, and which are unavailable—without mistaking any of them for a guarantee that the room will support sleep or remote work.

## Handoff Requirements For UXR

`UXR-HOTEL-NOISE-QUIET-FIT-01` must read this report and produce `docs/pipeline/hotel-noise-quiet-fit/02-research.md`. It must:

1. Audit the live provider, cache, deal-detail, `HotelCard`, `BookingFlow`, and analytics paths to distinguish implemented UI states from evidence that can actually reach production.
2. Validate source rights, raw vocabulary, freshness, geographic precision, and coverage for the four candidate classes: selected room/stay facts, property facts, licensed review themes, and nearby exposure. Include internal-property noise, not only airport/nightlife proximity.
3. Test whether the proposed hierarchy lets users correctly classify evidence without producing a quiet/noisy verdict. Define exact handling for unknown, unavailable, stale, insufficient-location, malformed, and conflicting evidence.
4. Compare one or two established hotel-booking patterns at the interaction level across refinement, result scan, detail disclosure, room choice, and non-guaranteed request handling.
5. Produce 3–5 testable design directives and a bounded analytics specification for detail engagement, post-evidence abandonment, qualified handoff, explicit post-handoff complaint intent, and guarantee-comprehension failures.

## Handoff

Create `UXR-HOTEL-NOISE-QUIET-FIT-01` with this report path and the one-sentence problem statement embedded. The research ticket must preserve the evidence hierarchy, explicit unknown state, licensed-source boundary, and no-guarantee rule.

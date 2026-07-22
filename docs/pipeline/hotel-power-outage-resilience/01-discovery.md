# UXD-HOTEL-POWER-OUTAGE-RESILIENCE-01: Hotel Power and Connectivity Resilience Discovery

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P2  
Method: Static audit of the current hotel discovery, result, detail, evidence, and comparison surfaces. No traveler interviews, production analytics, provider-coverage sample, or destination-risk dataset was available at this stage.

## User pain point

A traveler choosing a hotel in a destination with a credible, current disruption risk cannot distinguish a property with verified continuity measures from one whose backup power, connectivity continuity, and essential-service resilience are undocumented, forcing the traveler to guess or leave expaify before making a confident selection.

## Who is affected and where

The primary affected user is a traveler whose stay would be materially disrupted by a power or connectivity outage: someone who must remain reachable, work remotely, manage medication or powered equipment, care for dependants, or maintain basic communication during a stay. This discovery does **not** assume that every traveler or destination needs resilience information. Relevance is highest only when an independently supportable, time-bounded destination context makes disruption continuity a reasonable decision criterion.

The affected decision path is:

1. **Destination discovery:** the live hotel discovery surfaces are the `/deals` feed, its city/date/price filters and natural-language search, and `/destinations/[city]`. They allow a traveler to narrow by destination and price attributes, but provide no disruption-context or resilience entry point.
2. **Hotel result scan:** the live `DealCard` shows hotel identity, city, stay window, price comparison, discount, price-check freshness, imagery, and OTA links. Its `ApiDeal` input carries no resilience evidence. A traveler cannot use continuity as a selection criterion while scanning.
3. **Hotel detail:** `/deals/[dealId]` adds price history, Deal Score support, stay details, and provider handoff. It has no backup-power, connectivity-continuity, or essential-service evidence, and therefore cannot explain whether a missing claim means “not available,” “not returned,” “stale,” or “not checked.”
4. **Shortlist comparison:** no live shortlist or side-by-side hotel comparison exists. The separate `hotel-compare` pipeline documents that gap. Resilience comparison cannot be measured in production today; UXR may test it in a prototype, but this ticket must not build or redefine the shortlist.

There is a second, currently unwired hotel-card implementation in `app/components/HotelCard.tsx`. It establishes a useful provenance precedent—confirmed/unavailable/not-returned/unknown access facts with source and optional fetch time—but it is not imported by a live product route. Its normalizer in `lib/providers/hotelAmenityEvidence.ts` accepts only elevator, parking, step-free-route, and room-request facts. It does not support resilience claims. Downstream work must design against the live `DealCard` and saved-deal detail first, while deciding whether the evidence pattern should be generalized rather than duplicating it.

## What is established, and what is not

### Established from the current product

- The live hotel feed and saved-deal detail expose no resilience signal or missing-evidence disclosure.
- `HotelOffer` has generic amenity evidence fields, including `status`, `scope`, `sourceLabel`, optional `fetchedAt`, and confidence, but the current whitelist and UI use them only for access evidence.
- The live `ApiDeal`/`DealCard` contract and saved-deal shape do not carry those evidence fields, so even valid provider evidence has no route to the shipped comparison surfaces.
- Wi-Fi presence is not equivalent to internet continuity, and generator presence is not equivalent to continuity for rooms, elevators, water systems, cooling, charging, or other essential services. The product currently has no data structure that can express those limits.
- Existing analytics infrastructure is generic; the audited live hotel surfaces do not expose resilience-impression, disclosure-engagement, shortlist, or selection-confidence events.

### Not established at discovery

- That resilience information is important enough to change hotel selection for a meaningful share of travelers in any specific destination.
- Which destinations and time windows qualify as high relevance without stereotyping a place or presenting stale crisis context.
- Whether hotel providers or properties can supply sufficiently specific, recent, and comparable evidence at useful coverage.
- Whether a compact disclosure improves confidence, causes unnecessary alarm, or is ignored.

This ticket therefore defines a **research hypothesis**, not an approved feature: in high-relevance hotel contexts, a compact disclosure that clearly separates verified resilience evidence from undocumented claims may improve selection confidence without being read as a safety or emergency-service guarantee.

## Measurable signals

### 1. Evidence coverage

Establish coverage before testing presentation. For a sampled set of hotels in destinations that meet a documented relevance rule, report:

- **Any-signal coverage:** properties with at least one qualifying, source-attributed, in-window resilience item divided by all sampled properties.
- **Signal-level coverage:** separate coverage for backup power, connectivity continuity/redundancy, and the explicitly named essential services the evidence says remain supported.
- **Decision-grade coverage:** items that identify source, evidence age, scope, and stated limitation divided by all returned resilience claims.
- **Unknown/stale rate:** properties for which evidence is missing, ambiguous, outside the accepted time window, or conflicts across sources.

The research stage must recommend evidence-age rules by claim type. Discovery should not invent one universal expiry window: property infrastructure evidence and active disruption context decay at different rates.

### 2. Engagement with resilience signals

In a prototype or later instrumented release, measure disclosure impressions, opens/expands, and subsequent hotel-detail, shortlist, and provider-review actions. Segment by destination relevance, evidence state, viewport, and traveler-stated need. Engagement is diagnostic, not success by itself: a high open rate may indicate concern or unclear summary copy.

### 3. Selection confidence

The primary outcome is the change in self-reported confidence after choosing between otherwise comparable hotels with and without the compact disclosure. Pair it with comprehension checks:

- Can the traveler identify which claim is verified and how recent it is?
- Can the traveler distinguish “not documented” from “not available”?
- Can the traveler state what the evidence does **not** guarantee?
- Does the traveler choose the same hotel after opening the full evidence, or reverse a choice based on a corrected interpretation?

Compare confidence movement only within high-relevance contexts. Guard against “confidently wrong” outcomes: confidence does not count as improvement if guarantee/scope comprehension fails.

### Research decision threshold

UXR must recommend an explicit go/no-go threshold after measuring coverage and comprehension. At minimum, the concept should not advance to design as a property-comparison feature if verified, decision-grade evidence is too sparse to distinguish hotels or if users routinely interpret infrastructure claims as guarantees. In that case, the honest outcome is a destination-level confirmation prompt or no disclosure—not fabricated property differentiation.

## Constraints

1. **Verified, time-bounded evidence only.** Every visible property claim must come through `lib/providers`, identify the provider/property source and evidence time, retain its scope, and distinguish confirmed, unavailable, not returned, stale, and conflicting evidence. Do not infer resilience from star class, brand, price, photos, reviews, ordinary Wi-Fi presence, or a destination label.
2. **No emergency or selected-stay guarantee.** Copy must name exactly what the source supports and what remains unverified. “Backup generator” must not become “power guaranteed”; “redundant internet” must not become “always online”; property-level infrastructure must not promise room-, rate-, duration-, capacity-, medical-, security-, evacuation-, or emergency-service continuity.
3. **Hotels-first, high-relevance, compact scope.** Show resilience context only where an auditable relevance rule says it is useful, without alarming all hotel shoppers or adding a blocking search step. Keep Deal Score strictly about price, preserve the primary price/location/handoff hierarchy at 375px and 1280px, and reuse rather than redefine the separate amenity, workspace-fit, access, and shortlist workstreams.

## Success statement

This discovery is successful when research can determine whether, in a hotels-first destination context with a credible current disruption relevance signal, a first-time traveler can use one compact, source- and time-bounded resilience disclosure to choose between hotels with greater confidence **without** mistaking missing evidence for absence or reading the disclosure as a guarantee of power, connectivity, essential services, or emergency support.

## Required UXR focus

The next stage must:

1. Define and validate a non-stereotyping eligibility rule for “high-relevance destination context,” including source and expiry requirements for the context itself.
2. Audit provider/property evidence availability on a representative eligible sample and report the four coverage measures above before recommending UI prominence.
3. Separate ordinary amenity presence from continuity evidence: Wi-Fi versus connection continuity, generator presence versus supported loads/duration, and property infrastructure versus room/selected-stay coverage.
4. Test a compact disclosure against the current live feed/detail hierarchy, plus a prototype comparison context if useful; do not assume the unfinished shortlist exists.
5. Measure selection confidence together with provenance, recency, missing-state, scope, and non-guarantee comprehension.
6. Recommend go, narrow, or stop. “Stop” is valid if evidence is too sparse, stale, incomparable, or easily misread.

## Dependencies, blockers, and out-of-scope findings

- **Measurement blocker:** no production resilience evidence, eligibility classification, shortlist, or feature-specific analytics exists, so current evidence coverage, engagement, and confidence cannot be calculated from this repository.
- **Surface dependency:** `HotelCard` contains an evidence pattern but is not the shipped hotel feed. UXR must reconcile the live `DealCard`/`/deals/[dealId]` surfaces before UXDES specifies placement.
- **Adjacent-scope dependency:** `hotel-workspace-fit` already owns work-grade connectivity and lists power as a lower-tier work signal; `hotel-amenity-provenance` owns generic source/status semantics; `hotel-compare` owns shortlist mechanics. This ticket owns disruption-continuity comprehension and must reuse those contracts without creating a competing “resilience score.”
- **Out of scope:** emergency alerts, destination safety ratings, medical or emergency-service claims, disaster forecasting, operational monitoring of hotel infrastructure, traveler-generated verification, a synthetic resilience score, changes to Deal Score, building the shortlist, or integrating a provider before evidence viability is established.

## Handoff

Create `UXR-HOTEL-POWER-OUTAGE-RESILIENCE-01` with this report path and the pain point above. The research brief must answer whether verified evidence coverage and traveler comprehension justify a compact disclosure at all before specifying a solution.

# UXD-HOTEL-PET-POLICY-01: Pet-Friendly Hotel Policy Fit Discovery

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P1  
Feature slug: `hotel-pet-policy`

## User Pain Point

A traveller with a pet cannot determine whether a hotel is suitable for their specific animal and stay from expaify—because allowed pet types, mandatory fees, size or weight limits, and property-specific restrictions are absent—so they may choose an unsuitable property or must leave the product to investigate every candidate.

## Who Is Affected And Where

This affects travellers whose lodging decision depends on bringing a pet: dog owners affected by weight, breed, count, or room restrictions; cat and other-animal owners affected by species exclusions; and price-sensitive travellers for whom a mandatory pet fee changes the apparent deal value.

The affected decision path starts with hotel search and result filtering, continues through the collapsed result scan and expanded hotel detail, and ends immediately before the provider handoff. The immediate implementation surfaces are:

- `app/api/search/route.ts`, which returns hotel availability after a dated destination search;
- `app/components/HotelCard.tsx`, which is the comparison and expanded-detail surface for each `HotelOffer`;
- `lib/types.ts` and `lib/providers/hotellook.ts`, which define and normalize the data available to those surfaces.

The issue is most harmful when a low nightly rate encourages a traveller to click through or select a hotel before learning that their pet type is excluded, that a non-refundable fee materially changes the cost, or that a size/count rule makes the stay impossible.

## Current, Measurable Signal

This is a verifiable data-and-decision gap, not an assumed preference:

1. `HotelOffer` in `lib/types.ts` has no pet-policy field. It cannot express whether pets are allowed, which types are allowed, a fee, a size/weight limit, a pet-count limit, property restrictions, source, or a policy-data state.
2. `HotellookProvider` has no pet-policy mapping. Its cache-entry shape and live/cached normalization in `lib/providers/hotellook.ts` preserve price, location, hotel class, and rating evidence, but no pet policy. Thus the provider boundary currently carries no normalized policy fact or explicit policy-data absence.
3. `HotelCard` exposes quality, location, Deal Score, price scope, and provider-handoff information, but no pet-policy summary in its collapsed scan or expanded details. A traveller cannot answer the suitability question without leaving expaify.
4. `GET /api/search` can distinguish hotel inventory as available, empty, unavailable, or skipped, but it cannot distinguish *hotel inventory found, pet policy not returned* from *pet policy explicitly prohibits the traveller's pet*. Those are decisionally opposite states.

Instrument these signals once the data and surface exist:

- **Pet filter engagement:** the share of hotel-search sessions that open, apply, change, or clear a pet-suitability filter. Segment by policy coverage and unknown-policy share; an uninformative filter over unknown inventory is not success.
- **Policy-related exits:** from a hotel detail or provider-handoff intent, record an exit/back-out or search refinement without a provider CTA, paired with a policy state where available. This is a proxy for discovering a restriction late. It must not infer a reason when no policy is shown.
- **Validated decision signal (primary):** in a comprehension task or event-backed confirmation, the share of pet travellers who can correctly identify a property as suitable, unsuitable, or unknown for their stated pet before provider handoff. Count an explicit unknown as a correct, safe outcome; do not treat it as a match or exclusion.

Baseline: the code-level coverage of the required policy facts is zero, so expaify currently cannot provide a validated on-platform pet-suitability decision for any hotel.

## Constraints

1. **Normalized, attributed supplier data only.** All pet policy facts must arrive through `lib/providers` and be normalized before components receive them. The UI must not parse supplier prose, infer a policy from a property type, star rating, photo, generic "pet-friendly" tag, or marketing copy, or make a provider request from a component. Preserve source/provenance and any observed-at timestamp when supplied.
2. **Explicit unknown is mandatory.** Missing policy data means `unknown`/`not returned by provider`; it does not mean pets are prohibited, permitted, free, or unrestricted. A supplier-confirmed prohibition is distinct from unknown. Unknown inventory must remain visible rather than being silently treated as a failed pet-friendly filter result.
3. **Pet suitability is multi-part, not a boolean.** The MVP policy shape must be capable of representing: allowed/prohibited/unknown; allowed pet types; fee with its basis when documented; size or weight limits; and property-specific restrictions (for example maximum pet count, room-area restrictions, advance notice, or service-animal distinction when explicitly supplied). Fee values must use `{ priceCents, currency }`; no floats or bare amounts. Unstructured supplier wording must not be compressed into a misleading yes/no state.
4. **Do not overstate stay-level certainty.** A property-level policy cannot be represented as confirmed availability for the selected room or rate unless a supplier explicitly provides that scope. The provider remains the authority for final policy, fees, availability, and terms at handoff.
5. **Keep the comparison hierarchy intact.** At 375px and desktop, a concise pet-decision signal may not displace or obscure nightly price, Deal Score, location, quality evidence, or the review CTA. Status cannot rely on icon or color alone and must be readable by keyboard and assistive technology.

## Scope Boundary

This ticket owns the **pet-policy fit decision**: whether a traveller can decide, for their stated pet, whether to consider, rule out, or verify a property before handoff.

It does not reopen the general hotel-amenity work. `docs/pipeline/hotel-amenity-fit/01-discovery.md` and `docs/pipeline/hotel-amenity-provenance/02-research.md` establish the broader provider-backed amenity evidence approach. This feature should reuse that provenance discipline, but requires pet-specific structure because a generic `pets` boolean cannot faithfully answer pet type, fee, size, or restrictions.

Out of scope for this discovery:

- creating a new hotel supplier integration, scraping policy pages, or treating third-party text as verified data;
- changing Deal Score, ranking, price history, or cash/award provider contracts outside hotel policy evidence;
- booking or collecting pet details within expaify; the app presently hands hotel review to the provider;
- service-animal eligibility or legal/compliance advice. Only supplier-documented property policy may be shown, with final confirmation deferred to the provider;
- filtering implementation itself until UXR validates policy coverage and the rules for retaining unknown results.

## Success Statement

This is solved when a first-time traveller with a stated pet can, before selecting a hotel or leaving expaify, correctly tell whether the property is supplier-confirmed suitable, supplier-confirmed unsuitable, or unknown for that pet—including any documented fee, size limit, permitted pet type, and material property restriction—without mistaking missing policy data for permission or prohibition.

## Handoff Requirements For UXR

`UXR-HOTEL-PET-POLICY-01` must read this report and produce `docs/pipeline/hotel-pet-policy/02-research.md`. It must:

1. Audit the actual `HotelOffer`, `HotellookProvider`, cache normalization, search event, `HotelCard`, and existing amenity-provenance work to identify the smallest compatible provider-neutral policy evidence contract.
2. Validate supplier coverage and raw vocabulary for permitted/prohibited/unknown, pet types, fee/currency/basis, size/weight limits, count limits, and restrictions. If current supply cannot support a field, retain it as unknown; do not design a synthetic fallback.
3. Define a testable pet-suitability evaluation for a stated pet profile, including exact treatment of unknown fields and conflicting supplier statements. It must distinguish provider-confirmed unsuitable from unknown and never silently exclude unknown inventory.
4. Compare one or two established hotel-search interaction patterns at the interaction level: pet filtering, result scan, detail-policy disclosure, fee/restriction hierarchy, and unknown-policy handling—not visual styling.
5. Specify measurement definitions for policy-related exits, filter engagement, coverage, and the primary validated-decision signal, including event boundaries that do not claim an unobserved reason for an exit.
6. Produce 3–5 specific, testable directives for UXDES, covering result scan, detail review, the no-policy-data state, accessibility, and 375px/1280px fit. State whether a pet filter is viable only after coverage research.

## Handoff

Create `UXR-HOTEL-PET-POLICY-01` with this report path and the problem statement embedded. The research ticket must explicitly preserve the unknown state and the normalized-supplier-data boundary.

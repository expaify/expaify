# UXD-HOTEL-PET-POLICY-FIT-01: Pet Policy Fit Discovery

Date: 2026-07-29
Stage: UX Discovery
Priority: P2
Feature slug: `hotel-pet-policy-fit`

## Relationship To Prior Work — Read First

An earlier pipeline already ran under the slug `hotel-pet-policy` (`docs/pipeline/hotel-pet-policy/01-discovery.md`, `02-research.md`, `03-design.md`). This ticket is **not** a re-run of it, and downstream stages must not restate it.

That pipeline defined the pet-policy evidence shape and a stated-pet profile, and shipped two components: `app/components/HotelPetPolicy.tsx` (425 lines) and `app/components/PetProfilePanel.tsx` (308 lines). Its own design spec (§ "Source And Decision Boundary") gated all of it behind a normalized provider contract that does not exist, and it explicitly deferred the mounting question to "a separately authorized integration."

That gate was the correct call at the time. The consequence, verified in this branch today, is that a traveller with a pet receives **nothing**: not a policy, not a fee, not even an honest "we don't know." The prior work solved the *representation* problem. This ticket owns the problem it left open — the *disclosure* problem under permanently incomplete supplier data.

Concretely, this discovery is scoped to the delta:

| Question | Owned by |
|---|---|
| What is a faithful pet-policy evidence shape? | `hotel-pet-policy` (done) |
| How is a stated pet compared against that evidence? | `hotel-pet-policy` (done) |
| What does a pet traveller see when the provider returns little or no policy — which is the real and likely permanent case? | **This ticket** |

## User Pain Point

A traveller with a pet gets no pet signal at all from expaify's hotel results, so they cannot tell an unsuitable property from an unverified one, and any hotel they pick is an unmanaged guess about acceptance, fees, and limits.

## Who Is Affected And Where

Affected: any traveller whose stay is contingent on bringing an animal. Their decision is binary in a way most amenity decisions are not — a wrong pick is not a worse stay, it is a refused check-in or an unbudgeted mandatory charge on arrival.

Where in the flow, in order:

1. **Hotel search** (`app/components/ui/SearchBar.tsx`, the only consumer of `GET /api/search`) — no way to state that a pet is travelling.
2. **Result scan / filtering** — no pet-fit line, no pet filter, no coverage disclosure. Results are ranked and compared as if the pet constraint did not exist.
3. **Detail evaluation** — the expanded card carries funds policy, parking, smoking, access, quality, and price scope. It carries no pet policy in any rendered production surface.
4. **Provider handoff** — the traveller leaves for the provider with the pet question entirely unasked.

The damage peaks when a low nightly rate ranks a property well and the traveller commits before discovering an exclusion or a mandatory per-night pet charge that the Deal Score never saw.

## Current, Measurable Signal

Every item below was read in this branch, not assumed.

1. **`HotelOffer` has no pet field.** `lib/types.ts` defines `fundsPolicy`, `smokingPolicy`, `amenityEvidence`, `rateEligibility`, `documentReadiness` — and zero pet properties. `grep -i pet lib/types.ts` returns nothing.
2. **No provider maps pet policy.** `grep -ri pet lib/providers/` returns nothing. Unlike smoking policy, there is not even a `notProvided…` sentinel, so the provider boundary cannot currently emit *"pet policy not returned"* as a fact. Absence of data and absence of a field are indistinguishable downstream.
3. **The shipped pet components are unreachable.** `PetProfilePanel` is imported by no file but itself. `HotelPetPolicy` is imported only by `HotelCard`, behind an optional `petPolicy?: HotelPetPolicyPresentation` prop that no caller passes.
4. **`HotelCard` is itself mounted by no page.** It is imported by no `page.tsx` in `app/`. Whatever the eventual results surface is, the pet path terminates before reaching a user.
5. **`GET /api/search` emits no pet status.** It streams `hotel-status`, `hotel-access-status`, and `hotel-smoking-policy-status`. There is no `hotel-pet-policy-status`, so the client cannot learn coverage, and cannot decide whether a control would be meaningful.
6. **The precedent for the pragmatic answer already exists in this repo.** Smoking policy solved the same "provider returns nothing" situation without stalling: a typed field, a `notProvidedHotelSmokingPolicy()` sentinel at the adapter (`lib/providers/hotellook.ts:383-385, 535-537`), and a status event carrying `normalizedCoverageCount`, `totalCount`, and `filterEnabled: false` (`app/api/search/route.ts:409-414`). Coverage is currently 0 and the filter is correctly suppressed — but the state is *represented and transmitted* rather than dropped. Pet policy has none of this.

Baseline: normalized pet-policy coverage is 0 of 0 offers, and the number of pet travellers who can reach any pet statement in the product is zero.

Instrument these once a surface exists:

- **False-positive selections (primary).** In scenario testing, the share of pet travellers who advance to provider handoff on a property whose documented policy excludes their stated pet. Target is zero; this is the metric the ticket names and the only one that measures harm rather than engagement.
- **Comprehension of the three-way state.** Given a property, can the traveller correctly sort it into *documented fit*, *documented exclusion*, or *not documented*? Scoring an explicit "not documented" as correct is mandatory — collapsing it into either pole is the failure this ticket exists to prevent.
- **Coverage-honest control exposure.** Share of searches where a pet control is shown, paired with that search's `normalizedCoverageCount / totalCount`. A control offered over inventory with no policy data is a defect, not adoption.
- **Late-discovery proxy.** Back-outs from hotel detail without a handoff CTA among sessions that stated a pet, versus those that did not. Directional only; never attribute a reason the product did not display.

## Constraints The Solution Must Respect

1. **Verified policy and unknown status are different states and must never merge.** A provider-documented permission or exclusion is one thing; silence is another. Silence is not permission, not prohibition, not "free," and not "no restrictions." The three-way state must survive the provider adapter, the API contract, the ranking layer, and the rendered copy — including its accessible name, since status may not be carried by colour or icon alone.

2. **Eligibility may not be inferred from amenities, tags, property type, class, photos, or marketing copy.** A generic `pets` or "pet-friendly" flag does not establish animal type, count, weight, fee, or room restrictions, and must not be upgraded into a fit claim. All facts arrive normalized through `lib/providers`; components never parse supplier prose and never call a vendor. Any fee is `{ priceCents, currency }` with its basis, never a float or bare number. Provenance and observed-at travel with the claim.

3. **The design must degrade to usefulness, not to nothing.** This is the constraint the prior pipeline did not satisfy. Zero coverage is the expected steady state for the current supplier, so an approach whose only behaviours are "full evaluation" or "render nothing" is a non-solution. At minimum-coverage the product must still tell a pet traveller, honestly and in place, that the policy is unverified here and must be confirmed with the provider — the smoking-policy pattern in §6 above is the working in-repo precedent for representing that state end to end. Property-level policy must never be presented as confirmed for the selected room and rate, and this disclosure must not displace price, Deal Score, location, or the review CTA at 375px or desktop.

## Success Statement

This is solved when a first-time user travelling with a pet can, for every hotel in their results, tell whether the property is documented as fitting their pet, documented as excluding it, or simply not documented — and can reach provider handoff without ever having mistaken "we don't know" for "yes."

## Scope Boundary

**In scope:** the eligibility and disclosure model for pet fit under partial or absent provider data; the three-way state and its propagation from adapter to rendered copy; coverage-conditional exposure of any pet control; the honest-unknown surface; and identifying the results surface that must own it.

**Out of scope:**

- Re-deriving the pet evidence shape or the stated-pet profile — those are settled in `docs/pipeline/hotel-pet-policy/`. Reuse them; do not redesign them.
- New supplier integrations, contract negotiation, or scraping policy pages. This ticket may specify what a provider must return; it may not invent a source.
- Deal Score, ranking, price history, snapshots, or cash/award provider contracts.
- Booking or storing pet details on expaify's side, or any change to the booking flow.
- Service-animal eligibility, legal or accessibility-law advice. Only supplier-documented property policy may be shown, with the provider as final authority.
- Reviving `HotelCard`'s mounting story as a general problem. Note it as a dependency; do not solve results-page architecture here.

## Open Question For Research

`HotelCard` is mounted by no page, so the pet-fit surface has no confirmed owner. UXR must identify the intended hotel-results surface, and — if none exists in this branch — state plainly that the disclosure model is specified against `HotelCard` as the designated component, with production exposure blocked on a separately authorized integration. Do not let this question stall the eligibility and disclosure model itself, which is what this pipeline owes downstream.

## Handoff

Next stage: `UXR-HOTEL-PET-POLICY-FIT-01` — UX Research. Read this report, audit the surfaces named in §"Current, Measurable Signal" directly, and compare the disclosure pattern against how Booking.com and Google Hotels present a pet policy when the supplier has not documented one.

# UXR-HOTEL-PET-POLICY-01: Hotel Pet-Policy Fit Research

Date: 2026-07-31
Stage: UX Research
Priority: P0
Feature slug: `hotel-pet-policy`

## Decision Summary

The current product cannot make a truthful pet-fit claim on any production hotel deal. The mounted path is `DealCard` → saved deal detail → attributed affiliate link. That path carries price, dates, hotel identity, and OTA links, but no pet profile, policy, fee, deposit, restriction, evidence state, or fit result. The separate `HotelCard` prototype now contains a well-defended three-state pet-policy presentation and a tested pet-profile editor, but neither component is mounted on a production page; its evidence and profile types are local to React files, no pure evaluator or provider normalization supplies them, and the saved-detail and affiliate handoff discard them.

Current supplier coverage is therefore **0% normalized pet-policy coverage on both reachable hotel paths**:

- the deal feed is generated from nightly snapshot records whose RapidAPI mappings retain price/class/photo only;
- the live `HotellookProvider` maps no pet-policy field and replays no pet evidence from its six-hour cache;
- no production model or database record can carry explicit `returned`, `not_returned`, `error`, or `conflict` policy evidence.

The prototype is not release-ready despite its UI tests. Its current contract represents a non-refundable pet charge but not a refundable pet deposit, and a caller can inject an `unsuitable` evaluation without the component independently verifying that the evidence is applicable and trustworthy. The intended semantic output remains exactly three-way: `eligible`, `ineligible`, or `needs_confirmation`. UI copy may remain `Fits your pet`, `Does not fit your pet`, and `Pet policy needs confirmation`, but those labels require a shared, pure evaluator rather than caller-authored presentation data.

Two release gates are mandatory:

1. **Supplier gate:** a provider integrated through `lib/providers` must return verified, normalized policy evidence with measured production-like coverage. A generic `pets` amenity does not pass.
2. **Reachability gate:** the evidence must survive the mounted `DealCard` → saved detail → affiliate handoff, or an explicitly approved mounted replacement. Passing isolated `HotelCard` tests does not pass.

Until both gates pass, do not expose an enabled pet filter, do not sort or rank by pet fit, and do not show `Fits your pet`. Unknown hotels must remain available with an explicit confirmation state.

## Research Questions

1. What survives the current mounted feed, saved-detail, and affiliate-provider path?
2. What has been implemented in the unmounted `HotelCard` pet-policy prototype, and what remains only simulated?
3. What is the minimum profile and provider-neutral evidence contract required for a safe three-way decision?
4. Which supplier fields actually exist, and where do their coverage and precision stop?
5. How should charges, refundable deposits, limits, unknowns, and conflicts appear before provider handoff?
6. What metrics distinguish genuine eligible-stay accuracy from unsupported provider opens?

## Method And Evidence Boundary

### Current-code evidence audited

- `docs/pipeline/hotel-pet-policy/01-discovery.md` and the pre-existing research/design artifacts
- `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, and `app/deals/[dealId]/page.tsx`
- `app/components/HotelDealCriteria.tsx` and `app/components/ui/CompareRow.tsx`
- `lib/pipeline/snapshot.ts`, `lib/pipeline/dealDetection.ts`, and `lib/pipeline/otaLinks.ts`
- `app/components/HotelCard.tsx`, `app/components/HotelPetPolicy.tsx`, and `app/components/PetProfilePanel.tsx`
- pet-policy and pet-profile component tests
- `lib/types.ts`, `lib/providers/hotellook.ts`, `app/api/search/route.ts`, and provider tests
- `lib/booking/config.ts`, `lib/booking/hotelContextStore.ts`, and `app/book/BookingFlow.tsx`
- repository-wide production references to the pet components and policy vocabulary

### External supplier/reference evidence checked

- [Travelpayouts Hotels Data API](https://travelpayouts.github.io/slate/): a separate static property dataset can expose facilities/short facilities, but this is not the active cached-offer response mapped by expaify.
- [Booking.com PetsPolicy reference](https://developers.booking.com/connectivity/docs/api-reference/petspolicy): distinguishes `Pets Allowed`, `Pets Not Allowed`, and `Pets By Arrangements`, while its current fee field is limited to `free` or `charges_may_apply`.
- [Booking.com policies reference](https://developers.booking.com/connectivity/docs/policies): demonstrates that a non-refundable pet fee and a refundable pet deposit are different obligations, even though the newer PetsPolicy interface deprecates/refuses the older deposit field.
- [Booking.com Demand accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details): pet policies require an explicit property-details request with the `policies` extra; search availability alone is not proof that expaify receives them.
- [Expedia Rapid content reference lists](https://developers.expediagroup.com/rapid/lodging/content/content-reference-lists): property attributes can describe pet policies such as `Pets allowed` and `Dogs only`, with property/room/rate scope distinctions.
- [Expedia Rapid Vrbo integration guide](https://developers.expediagroup.com/rapid/lodging/vacation-rentals/vrbo-integration-guide): Rapid does not generally support filtering Vrbo by pet policy or pet-fee-inclusive prices; hosts may provide policy detail and corresponding charges separately.
- [Google hotel-search help](https://support.google.com/travel/answer/6276008?hl=en): establishes filter → result snapshot → property detail → booking-partner handoff as a reference interaction hierarchy, not as evidence of expaify coverage.

External documentation proves that richer vocabulary exists. It does **not** prove that expaify is entitled to an API, calls the relevant endpoint, receives a field for a given hotel, or has adequate coverage. Only verified payload samples through the approved provider boundary can establish that.

## Current-Code Evidence: Mounted Product Flow

### 1. DealCard has no pet input, filter, status, or evidence

`DealFeed` mounts `DealCard` for the active hotel results. `DealCard` can show hotel name, city, dates, nightly and median price, Deal Score cues, freshness, a quiet-stay cue, and `View deal`. Its `DealCardDeal` contract has no pet-related field. There is no mounted `PetProfilePanel`, no result-level policy state, and no filter or grouping for confirmed fit versus unknown.

The card links to `/deals/[dealId]`. Therefore the user can open an apparently suitable deal without any warning that pet acceptance and charges are unsupported.

### 2. Saved detail preserves stay context but still omits pet fit

The saved-detail page is the active decision surface. Its hierarchy is:

1. property and stay;
2. price and Deal Score;
3. hotel fit;
4. provider handoff;
5. supporting evidence.

`Hotel fit` contains hotel class, guest-rating absence, and quiet-stay evidence, but no pet profile or policy. The handoff says the provider confirms final total, taxes, fees, and terms; it does not name mandatory pet charges or refundable deposits, state that pet acceptance is unknown, or preserve an unresolved policy item.

This page is labelled `Saved hotel deal`, but its `entrySource="saved"` value is analytics metadata, not a persisted pet decision. No pet context is stored in `DealRow`, `ota_links`, or the page query contract.

### 3. Affiliate handoff is reachable but policy continuity is absent

`HotelDealCriteriaHandoff` validates attributed OTA URLs through `eligibleHotelProviderLinks`, then `CompareRow` opens the provider in a new tab with `rel="noopener noreferrer sponsored"`. For real detected deals, `buildOtaLinks` currently creates only a Travelpayouts-attributed Trip.com redirect when `HOTEL_AFFILIATE_ID` is present; Expedia, Booking.com, and Kiwi are intentionally unavailable.

The handoff has good attribution and mismatch gating, but it sends only the destination URL. It neither carries pet evidence nor tells the traveller which dimensions to confirm. `hotel_provider_handoff_clicked` records provider and search-context status but not whether the option was known eligible, known ineligible, or unsupported for the stated pet.

### 4. The deal supply path has no pet-policy coverage

Nightly snapshots call two Booking.com RapidAPI endpoints and a Tripadvisor RapidAPI endpoint from `lib/pipeline/snapshot.ts`, then persist hotel identity, price, class, photo, dates, and mock state. `dealDetection.ts` derives deals from those snapshots. No policy field is requested, normalized, persisted, or returned.

This also exposes a relevant contract conflict: these external hotel calls occur in `lib/pipeline`, not `lib/providers`, contrary to the non-negotiable provider boundary. This UXR ticket does not authorize moving them. No downstream design should treat those calls as an approved pet-policy supplier until the owning DEV work resolves the boundary and validates commercial/API access.

## Current-Code Evidence: Unmounted Prototype

### 5. HotelCard now contains pet-policy scan and detail UI, but only by optional prop

`HotelCard` accepts an optional `petPolicy` presentation prop. When present, it renders `HotelPetPolicyScan` before the Deal Score/action row and `HotelPetPolicyDetails` in expanded content. Tests cover suitable, unsuitable, not returned, error, conflict, by arrangement, stale, malformed fee/limit, loading, absent profile, and attributed confirmation-link states.

The presentation defensively downgrades a positive claim unless it has:

- a saved profile summary and evaluation;
- `availability: returned` and `permission: allowed`;
- selected-stay scope;
- included animal types, maximum count, maximum weight, and `restrictionsComplete`;
- source, checked date, schema version, and no stale/malformed/unresolved evidence.

This is a strong UI guard, but it is not supplier normalization or a fit engine. The caller still supplies `evaluation.explanation`, `reasonCodes`, `scanSupport`, and evidence. `HotelCard` cannot prove those values were derived correctly.

### 6. PetProfilePanel captures a sufficient minimum profile but has no mounted owner

The profile prototype asks for:

- pet type: dog, cat, or a named other animal;
- number of pets, 1–9;
- whether each pet's weight is known;
- each known weight in lb or kg.

This is the minimum viable profile. Selected dates already belong to hotel search and must be evaluation input, not duplicated in the profile. Breed is not a minimum field: if a supplier returns a breed restriction and breed is not known, the result must be `needs_confirmation`. Do not ask for service-animal status in this general flow.

The component validates its form, supports loading/save-error/removal states, restores focus, and avoids `Pet-friendly` filter language. However, repository tracing finds no production import. Persistence, privacy lifetime, search linkage, result re-evaluation, and analytics are not implemented.

### 7. Pet evidence is presentation-local rather than provider-neutral

`HotelPetPolicyEvidence`, `PetFitEvaluation`, and `StatedPetProfile` are declared under `app/components`, not `lib/types` or a hotel-domain module. `HotelOffer`, `BookingHotelContext`, saved `DealRow`, cache normalization, and search output contain no pet fields. There is no pure evaluator and no provider adapter/test fixture that creates a real policy.

This makes the current implementation a prototype contract, not a normalized data contract. UI types must not become the source of truth for provider facts.

### 8. Fee and refundable deposit are not separated

The prototype models `feeStatus`, one `fee`, and one `feeBasis`. It has no refundable pet-deposit status, amount, collection timing, or refund condition. That is insufficient because:

- a non-refundable mandatory charge changes the cost of the stay;
- a refundable deposit changes cash required and carries refund conditions, but is not part of the stay cost if returned;
- an unknown deposit must not be rendered as `$0`, `Free`, or folded into a fee;
- a general booking payment schedule or damage deposit must not be relabelled as a pet deposit without supplier attribution.

Booking.com's documentation explicitly distinguishes non-refundable pet fees from refundable pet deposits. Expedia's current Vrbo guidance likewise separates pet charges from refundable damage deposits and payment schedules. The normalized contract and disclosure must keep these obligations independent.

### 9. The alternate `/book` review path also drops pet context

`BookingHotelContext` can preserve multiple hotel evidence families through inline or Redis-referenced review context, but has no pet profile or pet policy. `BookingFlow` directs users to confirm final fees and several other hotel-policy dimensions, yet does not mention pet acceptance, pet charges, or pet deposits. This is not the mounted saved-deal handoff today, but it confirms that a future `HotelCard` integration would still lose pet continuity.

## Supplier Coverage Validation

### What current expaify suppliers actually support

| Supply path | Current endpoint/data | Pet facts normalized by expaify | Coverage conclusion |
|---|---|---:|---|
| Mounted deal feed | nightly Booking.com/Tripadvisor RapidAPI snapshot mappings | none | 0%; endpoint names do not establish policy entitlement or payload coverage |
| Mounted affiliate handoff | Travelpayouts-attributed Trip.com redirect | none | outbound verification only; not an evidence source |
| Live search API | HotelLook `cache.json` via `HotellookProvider` | none | 0%; live and cached `HotelOffer` shapes omit policy |
| Travelpayouts static hotel data | separate facilities/amenities dataset | not integrated | generic pet facility at most; cannot prove stated-pet eligibility |
| Prototype fixtures | caller-authored component props | synthetic only | useful for UI tests; excluded from coverage metrics |

No production-like raw payload corpus is checked into the repository, and credentials must not be used from UXR to probe unapproved APIs. The defensible coverage claim is therefore code-contract coverage: zero offers can carry normalized evidence. Actual market-level supplier coverage remains **unmeasured**, not presumed zero, until an approved integration samples real responses.

### What plausible suppliers can express

Booking.com's current documentation can express property permission (`allowed`, `not allowed`, `by arrangement`) and coarse charge status (`free`, `charges may apply`). A separate/current policy interface shows why refundable deposits must remain distinct. Booking.com's Demand API requires an explicit details call with policy extras, so a search response alone is insufficient.

Expedia Rapid Content can expose property-level pet attributes, including examples such as pets allowed and dogs only, and maintains scope distinctions for content. Its Vrbo guidance says partners cannot rely on pet-policy filtering or pet-fee-inclusive pricing and should direct users to confirm with the host where needed.

These suppliers demonstrate a useful vocabulary, not a guarantee of complete fields. Neither reference supports assuming exact animal type, count, weight, breed, room/rate applicability, mandatory charge total, or deposit terms for every property.

## Minimum Normalized Evidence Contract

The provider-neutral contract must live outside React and preserve raw evidence separately from derived fit. An optional `petPolicy` omission is not enough; every evaluated offer needs an explicit policy availability state.

| Concept | Minimum normalized shape | Unknown rule |
|---|---|---|
| Evidence state | `returned`, `not_returned`, `error`, `conflict` | absence is never prohibition or permission |
| Permission | `allowed`, `prohibited`, `by_arrangement`, `unknown` | `by_arrangement` evaluates to confirmation |
| Animal types | explicit included/excluded canonical types plus bounded supplier wording | absent type coverage is unresolved |
| Non-refundable charge | status `free`, `mandatory_known`, `mandatory_unknown`, `may_apply`, `unknown`; optional `{ priceCents, currency }`; basis | `free` applies only to the charge, never the deposit |
| Refundable pet deposit | status `none`, `required_known`, `required_unknown`, `may_apply`, `unknown`; optional `{ priceCents, currency }`; collection/refund wording | never merge with charge or general damage deposit |
| Limits | max count; max weight/size with unit; explicit-unrestricted flags where supplied | missing is unknown, not unlimited |
| Restrictions | bounded typed restrictions plus attributed supplier wording; completeness state | unstructured applicability is unresolved |
| Scope | `property`, `room`, `rate`, `selected_stay`, `unknown` plus applicable IDs/dates where available | property-level permission cannot prove selected-stay acceptance |
| Provenance | provider, source record/policy ID, fetched/observed time, schema version, optional effective time | no provenance means no positive claim |
| Conflict | all bounded conflicting statements with source/scope/time | never last-write-wins |

Empty arrays must not stand in for data not returned. Money remains integer minor units. Components must not parse supplier prose, compute precedence, or construct a fit claim.

## Three-Way Fit Evaluation

### Input

- stated profile: type, named other type when relevant, count, weight-known flag, and known weight per pet;
- selected check-in/check-out and, when available, selected room/rate identifiers;
- normalized policy evidence and provenance.

### Output

- `status: 'eligible' | 'ineligible' | 'needs_confirmation'`;
- stable reason codes;
- unresolved dimensions;
- separately derived `chargeStatus` and `depositStatus`;
- evidence reference/version used for the decision.

Presentation maps these to `Fits your pet`, `Does not fit your pet`, and `Pet policy needs confirmation`.

### Deterministic order

1. `not_returned`, `error`, missing provenance, stale evidence, unknown permission, or unresolved conflict → `needs_confirmation`.
2. Applicable supplier-confirmed prohibition → `ineligible`.
3. `by_arrangement` → `needs_confirmation`; never include as a confirmed fit.
4. Explicit exclusion of the stated animal type, or omission from an explicitly complete allowed-type list → `ineligible`. An incomplete/missing list → unresolved.
5. Stated count above a valid explicit maximum → `ineligible`; absent maximum → unresolved unless explicitly unrestricted.
6. Known stated weight above a valid explicit maximum → `ineligible`; unknown traveller weight or absent supplier limit → unresolved unless explicitly unrestricted.
7. A clearly applicable violated restriction → `ineligible`. Missing traveller data, ambiguous prose, or incomplete restrictions → unresolved.
8. Property/room/rate/unknown scope that does not resolve the selected stay → unresolved.
9. `eligible` requires permission plus every material dimension resolved, selected-stay applicability, complete provenance, no conflict, and no malformed evidence.
10. Charges and deposits do not change physical eligibility, but unknown/may-apply monetary obligations must remain prominent. They may block a stronger label such as `Total pet cost known`; they must not silently change nightly price or Deal Score.

If conflicting evidence is credible and every interpretation excludes the pet, return `ineligible`. If any credible interpretation could allow the pet, return `needs_confirmation`. Never synthesize eligibility by combining permissive fragments from different sources.

## Reference Interaction Patterns And Exact Delta

### Google Hotels: filter → result snapshot → property detail → partner

Google exposes amenity filtering, key facts in result snapshots, richer property detail, then partner links. The applicable guidance is progressive disclosure and pre-handoff evidence. The delta is that expaify has no mounted profile/filter, scan cue, policy detail, or evidence continuity. Google also uses multiple data sources; expaify's stronger stated-pet claim therefore needs explicit provenance and conflict handling.

### Booking.com: broad discovery → policy inspection → conditional confirmation

Booking's supplier vocabulary distinguishes allowed, prohibited, and by-arrangement, and separates policy from charge status. The applicable guidance is that broad discovery is not proof of fit and conditional policy requires confirmation. The delta is that expaify's active supply does not expose even the broad policy, while its prototype can imply a specific selected-stay decision only from injected fixtures.

### Expedia Rapid: structured attributes with acknowledged coverage limits

Rapid demonstrates that property pet attributes can support types such as dogs only, while its Vrbo guidance explicitly limits pet filtering and inclusive fee pricing. The applicable guidance is to display structured facts where supplied and preserve host/provider confirmation when coverage is incomplete. The delta is that expaify has no Rapid provider adapter or normalized pet payload and must not use endpoint branding as evidence.

## Disclosure Hierarchy

On the mounted flow, the required hierarchy is:

1. **Result scan:** one textual status near other fit evidence, before `View deal`; show the decisive restriction or monetary uncertainty when known.
2. **Saved detail:** within `Hotel fit`, show outcome first, then animal/type/count/weight/restrictions, non-refundable charge, refundable deposit, scope, source/freshness, and unresolved items.
3. **Provider handoff:** repeat the outcome and a short confirmation checklist immediately before affiliate actions. Never reduce it to generic `taxes and fees`.
4. **Affiliate action:** retain provider attribution; accessible name should mention confirmation when policy is unknown. The external provider remains final authority.

At 375px, status and decisive support text need their own full-width row; facts stack in one column; charge and deposit remain separate labelled rows; no clipped negation, basis, or CTA. At 1280px, facts may use two columns but retain the same reading order. Text—not colour or icons—carries status.

## Measurement Plan

Metrics begin only after both release gates pass. Synthetic fixtures and unmounted `HotelCard` renders are excluded.

### Coverage and accuracy

- **Permission coverage:** offers with explicit permission / all returned hotel offers.
- **Evaluable coverage:** offers producing `eligible` or `ineligible` / offers evaluated against a valid profile.
- **Charge coverage:** allowing offers with explicit non-refundable charge status and, when charged, amount plus basis / allowing offers.
- **Deposit coverage:** allowing offers with explicit refundable pet-deposit status and, when required, amount / allowing offers.
- **Unknown rate:** `needs_confirmation` / all evaluated offers.
- **Eligible-stay precision (primary release metric):** provider/property-verified eligible opens that still accept the stated pet for the selected stay without a newly discovered blocking rule / all sampled opens labelled `eligible`.
- **Critical false-eligible rate:** sampled `eligible` opens where the provider/property says the pet is prohibited or violates a type/count/weight restriction / sampled `eligible` opens. Launch target: 0%; any occurrence pauses the positive label.

Verification can use structured post-open feedback plus adjudicated QA sampling. Browser return alone is not proof of mismatch.

### Unsupported-option opens

- **Unsupported-option open rate:** affiliate opens where status was `needs_confirmation`, `not_returned`, `error`, or `conflict` / all pet-profile affiliate opens.
- **Unsupported silent-open rate:** unsupported-option opens where no explicit unknown disclosure and confirmation checklist were viewed / unsupported-option opens. Launch target: 0%.
- **Known-ineligible open rate:** affiliate opens for an `ineligible` property / all pet-profile affiliate opens; track separately because it may reflect deliberate verification, not UI failure.

Required event chain: `pet_profile_applied` → `hotel_pet_status_impression` → `saved_hotel_opened` → `hotel_pet_policy_viewed` → `hotel_provider_handoff_clicked` → optional explicit `hotel_pet_mismatch_reported`. Include search ID, hotel/deal ID, evidence state/version, fit status, unresolved reason codes, provider, surface, and viewport band. Do not log free-form animal labels, breed, exact weight, or supplier policy prose.

### Comprehension gate

Test confirmed fit, confirmed non-fit, by-arrangement, missing, conflict, fee-known/deposit-unknown, and fee-unknown/deposit-known cases at 375px and 1280px, including keyboard/screen-reader paths.

- at least 90% correctly classify `eligible`, `ineligible`, or `needs confirmation`;
- 100% of explicit prohibition/blocking-limit cases are not answered eligible;
- at least 90% correctly distinguish a non-refundable charge from a refundable deposit;
- no material accuracy loss at 375px or in the assistive path.

## Release Gates

### Supplier gate

Before any enabled pet filter or positive fit label:

- an approved provider adapter under `lib/providers` returns normalized evidence and `Result<T>`;
- production-like payload samples across at least 10 destinations and representative stay lengths establish permission, type, limit, restriction, scope, charge, deposit, and provenance coverage separately;
- live and cached paths preserve identical unknown/conflict semantics;
- at least 80% permission coverage is a minimum experiment threshold, not proof of fit;
- 100% of offers labelled eligible resolve all material fit dimensions and selected-stay scope in contract tests;
- unknown/conflicting offers remain visible in a `Needs confirmation` group rather than being excluded.

### Reachability gate

- pet profile is mounted and applied to the actual `DealCard` feed or an explicitly approved replacement;
- status and evidence survive saved detail and the affiliate handoff;
- no profile/policy version mismatch can produce a stale positive label;
- 375px, 1280px, keyboard, screen-reader, loading, empty, error, stale, and conflict flows pass end to end;
- production analytics can measure the complete event chain.

If either gate fails, ship no filter and no `Fits your pet` claim. An explicit `Pet policy not available from this source` disclosure may ship only if it adds useful pre-handoff warning without implying coverage.

## Five Testable Directives For UXDES

### 1. Design for the mounted DealCard → saved detail → affiliate path

Specify exact placement and copy on all three reachable surfaces; do not treat `HotelCard` as the production result surface. `DealCard` gets a full-width text status before `View deal`; saved detail gets the complete evidence section inside `Hotel fit`; the provider block repeats unresolved items before affiliate links. Test that pet context and evidence version remain consistent across the three steps.

### 2. Keep exactly three eligibility outcomes with a high positive threshold

Use `Fits your pet`, `Does not fit your pet`, and `Pet policy needs confirmation`. Only the shared evaluator may produce the first two. Missing, stale, by-arrangement, partial, malformed, error, and conflict states map to confirmation unless every credible statement independently proves ineligibility. Test every state against fresh and cached fixtures; no unsupported fixture may render a positive claim.

### 3. Separate non-refundable charge and refundable deposit everywhere

Show `Pet charge` and `Refundable pet deposit` as separate labelled facts with independent status, amount/currency, basis/timing, and unknown copy. `No pet charge` must never imply `No deposit`. Do not add either to nightly rate or Deal Score in this ticket. Test known/unknown/may-apply combinations and verify users can distinguish cost from temporarily held funds.

### 4. Use the minimum profile and preserve unresolved restrictions

Capture type, count, weight-known, and known weight per pet; use selected search dates as separate evaluation context. Ask for a named other animal only when `Other` is chosen. Do not require breed or service-animal status. If a breed, room, rate, or other material restriction cannot be evaluated, show which item needs confirmation and retain the hotel in results. Test focus restoration, inline errors, profile loading/save failure/removal, and re-evaluation announcements.

### 5. Gate filter/ranking and instrument unsupported opens

Do not specify an enabled default filter at current 0% normalized coverage. Define the future filter only behind both release gates: eligible first, needs-confirmation retained and counted, ineligible removable only through an explicit choice. Instrument status impression, policy view, and provider click so `eligible-stay precision`, `critical false-eligible rate`, and `unsupported-option open rate` are computable. Test at 375px/1280px and with text expansion; no status may depend on colour or an icon.

## Risks, Blockers, And Out-Of-Scope Findings

- **Supplier blocker:** no approved, active provider mapping returns pet-policy evidence; actual field-level market coverage is unmeasured.
- **Production reachability blocker:** `HotelPetPolicy` and `PetProfilePanel` are unmounted; `HotelCard` is not the active deal result card.
- **Continuity blocker:** neither saved deals nor `BookingHotelContext` can carry pet profile, evidence, or evaluation version.
- **Deposit-contract blocker:** the prototype has no refundable pet-deposit model.
- **Evaluation blocker:** no pure evaluator exists; UI callers can inject result and explanation data.
- **Provider-boundary conflict:** hotel snapshot vendor calls live in `lib/pipeline`, outside the mandated `lib/providers` boundary. Repair requires separately owned DEV work.
- **Analytics blocker:** current events do not measure pet evidence, unsupported opens, or verified post-open outcomes.
- New supplier procurement, scraping, property messaging, ranking/Deal Score changes, pet-fee-inclusive price changes, legal/service-animal guidance, and remediation of unrelated snapshot architecture are outside this UXR ticket.

## Handoff

Create `UXDES-HOTEL-PET-POLICY-01` to refresh the implementation-ready design spec around the actual mounted flow, the three-way evaluator boundary, charge/deposit separation, explicit unknown states, and both release gates. The spec must not authorize a positive fit label or filter until supplier coverage and production reachability are demonstrated.

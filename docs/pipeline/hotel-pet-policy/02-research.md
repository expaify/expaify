# UXR-HOTEL-PET-POLICY-01: Pet-Friendly Hotel Policy Fit Research

Date: 2026-07-22  
Stage: UX Research  
Priority: P0  
Feature slug: `hotel-pet-policy`

## Decision Summary

expaify cannot currently tell a traveller that any hotel fits their pet. The active hotel provider path has **0% pet-policy coverage**: `HotelOffer` has no policy evidence, the Hotellook live and cache normalizers do not preserve it, the search stream has no policy-data status, and `HotelCard` has no policy UI. Missing data and a supplier-confirmed prohibition are therefore indistinguishable to the product.

A generic `Pet-friendly` filter is **not viable on current supply**. Travelpayouts documents a generic `pets` facility token in a separate static hotel dataset, but that token is not present in the endpoint contract expaify maps and cannot answer animal type, fee, weight, count, or restrictions. Even Booking.com's documented pet-policy vocabulary only guarantees `Pets Allowed`, `Pets Not Allowed`, or `Pets By Arrangements`, with fee status limited to `free` or `charges_may_apply`. UXDES must design a truthful three-way decision—`Fits your pet`, `Does not fit your pet`, or `Pet policy needs confirmation`—and may only use the first two when supplier evidence actually resolves the traveller's stated profile.

There is also a reachability gap downstream must acknowledge: `HotelCard` is not mounted by a production page in this branch. `/api/search` can stream hotel offers, but repository search finds `HotelCard` consumers only in component tests; the current landing and deals experiences render a separate deal-card model. The policy spec should cover the assigned search/card surface, but UI/DEV implementation must not claim an end-to-end result experience until a mounted consumer is identified or separately authorized.

## Research Questions

1. What pet-policy evidence survives the current hotel provider, six-hour cache, search stream, result card, and provider-review handoff?
2. What vocabulary can current and plausible supplier contracts support without inference?
3. When may a stated dog, cat, or other animal be classified as suitable, unsuitable, or unknown?
4. Which established hotel-search patterns help users filter, scan, inspect restrictions, and recover from incomplete data?
5. What must UXDES specify so the result remains honest, accessible, measurable, and usable at 375px and 1280px?

## Method And Evidence Boundary

### Repository evidence audited

- `docs/pipeline/hotel-pet-policy/01-discovery.md`
- `docs/pipeline/hotel-amenity-provenance/02-research.md`
- `lib/types.ts`
- `lib/providers/hotellook.ts` and `lib/providers/__tests__/hotellook.test.ts`
- `lib/providers/bookingComRapidApi.ts`
- `lib/cache/redis.ts`
- `app/api/search/route.ts` and its tests
- `app/components/HotelCard.tsx` and its component tests
- `lib/booking/config.ts`, `app/book/page.tsx`, and `app/book/BookingFlow.tsx`
- all app and library references to `HotelOffer`, `HotelCard`, hotel search events, and hotel handoff context

### External guidance checked

- [Travelpayouts Hotels Data API](https://travelpayouts.github.io/slate/): documented static amenity vocabulary and hotel `facilities` / `shortFacilities` fields.
- [Booking.com `PetsPolicies` reference](https://developers.booking.com/connectivity/docs/api-reference/petspolicies) and [Booking.com `PetsPolicy` reference](https://developers.booking.com/connectivity/docs/api-reference/petspolicy): documented policy and fee-status vocabulary.
- [Booking.com pet-friendly search guidance](https://www.booking.com/articles/pet-friendly-holiday-rentals-tips.en-gb.html): filter first, then inspect policy, fees, house rules, and contact the property.
- [Google hotel-search help](https://support.google.com/travel/answer/6276008?hl=en-EN): amenity filtering, result snapshots, and deeper property detail before partner handoff.

External sources establish available supplier vocabulary and interaction patterns. They do **not** prove that expaify receives those fields. Only the repository path and verified payloads can establish expaify coverage.

## Current-Code Evidence: End-To-End Audit

### 1. `HotelOffer` cannot represent policy or provenance

`HotelOffer` carries identity, location, hotel class and guest-rating evidence, nightly money, photo, deeplink, and source (`lib/types.ts:137-153`). It has no field for:

- allowed, prohibited, by-arrangement, conflicting, or not-returned status;
- animal type;
- mandatory fee, currency, or fee basis;
- weight/size, count, breed, room, area, notice, or unattended-animal restrictions;
- property-versus-room/rate scope;
- policy source, observed time, or raw supplier statement.

`HotelProvider.searchHotels` returns `Result<HotelOffer[]>` (`lib/types.ts:178-184`), so the provider-neutral boundary cannot carry a policy even if a supplier returned one. The smallest compatible repair is an optional normalized policy-evidence object on `HotelOffer`; absence must be normalized to an explicit `not_returned` evidence state before the offer reaches UI.

### 2. The active Hotellook response shape has no policy field

The typed `HotelLookCacheEntry` includes hotel identity, class, location, address, distance, price, image, and property type (`lib/providers/hotellook.ts:10-28`). It does not declare `facilities`, `shortFacilities`, `pets`, policy text, or fee/limit fields.

Live mapping returns location, class/rating evidence, integer USD nightly money, affiliate deeplink, image, and source (`lib/providers/hotellook.ts:447-486`). No pet fact is read or normalized. Provider errors correctly return `Result` failures rather than reaching callers as throws (`lib/providers/hotellook.ts:491-493`), but policy absence is not represented as data.

The Booking.com RapidAPI adapter is flight-only and deliberately does not finalize response mapping (`lib/providers/bookingComRapidApi.ts:1-96`). It is not a hotel-policy fallback.

### 3. Cache replay would erase policy fields

The Hotellook search key includes normalized location, check-in, and check-out, and results are cached for 21,600 seconds / six hours (`lib/providers/hotellook.ts:417-425`, `489`). Redis serializes the normalized offer as JSON (`lib/cache/redis.ts:19-28`).

On replay, `normalizeCachedHotelOffer` reconstructs a fixed object from validated known fields (`lib/providers/hotellook.ts:318-380`). Any undeclared pet-policy field in an old or experimentally enriched cache object is dropped. Therefore policy evidence requires both live normalization **and** cache normalization/version handling; adding UI-only fields would produce inconsistent first-fetch versus cache-hit behavior.

Tests assert the exact mapped and cached offer shapes but contain no pet cases (`lib/providers/__tests__/hotellook.test.ts:85-155`, `298-490`). There is no protection against unknown-as-prohibited, malformed money in a fee, or conflict loss.

### 4. Search streaming reports inventory state, not policy state

`GET /api/search` calls Hotellook only when destination plus check-in/check-out dates are present. It emits inventory status `available`, `empty`, `unavailable`, or `skipped`, then streams normalized offers (`app/api/search/route.ts:395-423`).

It cannot distinguish:

- hotels found and policy returned;
- hotels found and policy not returned;
- hotels found with conflicting policy evidence;
- hotel provider unavailable versus a separately sourced policy lookup unavailable.

This is decisionally material. A successful hotel response with no policy is not a successful pet-policy response, and must not produce `No pets allowed` or an empty filtered list.

### 5. `HotelCard` supports evidence disclosure, but no pet decision

The collapsed card uses a dense three-column row for image, name/quality/location, and nightly rate; Deal Score and `Review hotel` follow below (`app/components/HotelCard.tsx:425-510`). Expanded details disclose Deal Score, quality evidence, location precision, price scope, rate check, and provider handoff (`app/components/HotelCard.tsx:523-579`). The `Details` control has `aria-expanded`, `aria-controls`, a 40px minimum target, and a visible focus outline (`app/components/HotelCard.tsx:512-520`).

There is no pet-policy scan line, expanded section, policy source, unknown state, policy-specific CTA, or suitability status in the card or tests. The existing evidence hierarchy is a useful pattern: policy should be a concise decision signal in scan view and a complete, attributed explanation in expanded detail. It must not compete with nightly rate or Deal Score inside the already constrained top grid.

### 6. Policy context would be lost at expaify's review step

`Review hotel` builds `/book` query context from hotel identity, location, price, provider, and provider URL (`lib/booking/config.ts:360-385`). `BookingHotelContext` and `HotelSummary` have no pet profile or policy evidence (`lib/booking/config.ts:18-29`; `app/book/BookingFlow.tsx:235-281`). The review page tells the traveller that the booking partner confirms live rate, taxes, and fees, but does not preserve the pet decision or direct them to confirm pet terms.

The ticket does not authorize redesigning booking. UXDES should flag continuity as required for a trustworthy handoff, and DEV should choose a safe mechanism that does not place unbounded supplier prose in URL query parameters. Until that work is scoped, the result-card disclosure must explicitly say the provider/property confirms final pet acceptance and charges.

### 7. Amenity provenance is a reusable discipline, not a sufficient model

The prior amenity research correctly requires confirmed, unavailable, not-returned, and unknown states; provider attribution; scope; fee uncertainty; and no component-side parsing (`docs/pipeline/hotel-amenity-provenance/02-research.md:97-143`). Pet policy must reuse those principles.

A generic amenity item such as `{ id: 'pets', status: 'confirmed' }` is insufficient. “Pets allowed” may still exclude the traveller's species, weight, count, room, dates, or budget. Pet policy therefore needs structured restrictions and a stated-profile evaluation rather than an amenity chip alone.

### 8. The assigned card is not mounted in the current product UI

Repository-wide reference tracing finds `HotelCard` imported only by `app/components/__tests__/scorePresentation.test.tsx`; no page renders it. `app/page.tsx` is a hotel-deal marketing page backed by `DealCard`, while `/api/search` remains a separate streaming endpoint. This does not change the policy contract, but it changes what can be measured: no production `HotelCard` exposure, filter engagement, or card-to-handoff baseline exists on this branch.

This is an out-of-scope integration blocker, not permission to repair nearby routing. UXDES must label its target surface, and UI/DEV/TEST must verify the actual mounted consumer before claiming the feature complete end to end.

## Supplier Coverage And Vocabulary Validation

### Current Hotellook supply

Travelpayouts' public Hotels Data API documents a **separate static hotels dataset** with `facilities` amenity IDs and a changing `shortFacilities` list that may contain the single token `pets`. It does not document animal type, allowed/prohibited semantics, fees, weight, count, breed, room scope, notice, or other restrictions for that token. The endpoint currently called by expaify is `engine.hotellook.com/api/v2/cache.json`; its locally typed and tested response does not include either facility field.

Consequences:

- Current expaify policy coverage is exactly **0% of returned offers**.
- The documented generic `pets` token is evidence that another HotelLook dataset may say a property has a pet-related facility; it is **not evidence that the active offer permits the stated pet**.
- Joining a separate static dataset would be a provider/data implementation change outside this UXR ticket. Even if approved, it could at most populate a coarse, property-level `allowed` candidate with every detailed dimension unknown. It cannot support `Fits your pet`.
- A missing `pets` token cannot be normalized as `prohibited`; the documented short list is selective and mutable.

### Reference supplier vocabulary: Booking.com

Booking.com's connectivity reference distinguishes:

- `Pets Allowed`
- `Pets Not Allowed`
- `Pets By Arrangements`
- `free`
- `charges_may_apply`

That is a useful normalization baseline because it proves a policy is not safely boolean. It also exposes a coverage ceiling: the documented object does not guarantee an exact fee amount/basis, pet types, weight, count, breed, room restrictions, or selected-stay applicability. `Pets By Arrangements` and `charges_may_apply` are unknown/confirmation states, not successful matches.

### Canonical vocabulary for expaify

The provider-neutral contract should be able to preserve the following without requiring every supplier to populate every field:

| Decision dimension | Canonical values | Missing-value treatment |
|---|---|---|
| Policy availability | `returned`, `not_returned`, `error`, `conflict` | Never infer permission or prohibition |
| Permission | `allowed`, `prohibited`, `by_arrangement`, `unknown` | `by_arrangement` evaluates to unknown until confirmed |
| Pet type | canonical `dog`, `cat`, `other` plus supplier label for an explicitly named other type | No type list means `unknown`, not “all pets” |
| Fee status | `free`, `mandatory`, `may_apply`, `unknown` | `charges_may_apply` maps to `may_apply`, never zero |
| Fee amount | `{ priceCents, currency }` | No amount means unknown; never parse display prose in UI |
| Fee basis | `per_pet_per_night`, `per_pet_per_stay`, `per_night`, `per_stay`, `other`, `unknown` | Do not compute stay total when basis/count is unresolved |
| Weight/size | maximum value + `lb` or `kg`, and/or attributed supplier text | No limit field means unknown, not unlimited |
| Count | positive integer maximum | No count field means unknown, not unlimited |
| Restrictions | canonical kind plus supplier text, e.g. breed, room/area, advance notice, unattended pet, deposit | Preserve text and source; do not derive new restrictions in a component |
| Scope | `property`, `room`, `rate`, `selected_stay`, `unknown` | Property evidence cannot confirm selected-room availability |
| Provenance | provider/source label, source record id if available, `fetchedAt`, optional effective date | Missing provenance prevents a confirmed match claim |

Service-animal rules must not be inferred from a general pet policy. Supplier-documented service-animal wording may be preserved as separately labelled information, but legal eligibility/advice remains out of scope.

## Smallest Compatible Evidence Contract

UXDES and DEV should use an optional `petPolicy` on `HotelOffer` with four separable concepts rather than a single `petFriendly` boolean:

1. **Evidence state:** whether the provider returned usable policy data (`returned`, `not_returned`, `error`, `conflict`).
2. **Normalized facts:** permission, types, fees, limits, restrictions, and scope. Every field may be unknown independently.
3. **Provenance:** source label and observed time at minimum; retain supplier text for restrictions that cannot be safely structured.
4. **Derived fit:** a deterministic evaluation result for a stated profile, computed outside React and never persisted as if it were supplier data.

The contract must preserve unknowns explicitly through live normalization and cache replay. It should not require a supplier to invent empty arrays: an empty explicit list and an absent list have different meanings. Fee money must use `{ priceCents: number; currency: string }`, and no field may contain a float amount.

The derived result should include:

- `status: 'suitable' | 'unsuitable' | 'unknown'`
- machine-readable `reasonCodes`
- a short explanation assembled from normalized facts, not parsed supplier prose
- unresolved dimensions, so UI can say exactly what needs confirmation
- policy provenance reference, so a cached derived result cannot outlive or detach from its evidence

## Stated-Pet Suitability Evaluation

### Stated profile

Evaluation input must include:

- pet type: `dog`, `cat`, or explicitly named `other`;
- count: positive integer;
- each pet's weight in one canonical internal unit when the traveller knows it, otherwise unknown;
- selected stay dates already present in the hotel search.

Breed is not required to use the feature. If a supplier provides a breed restriction and the traveller has not provided a breed, that dimension remains unresolved. Do not ask for service-animal status in this general pet-fit flow.

### Deterministic rules

Apply these rules in order:

1. **No usable policy:** `not_returned`, `error`, no provenance, or unknown permission => `unknown`.
2. **Explicit prohibition:** an applicable, supplier-confirmed `prohibited` policy => `unsuitable`, with reason `pets_prohibited`.
3. **Arrangement required:** `by_arrangement` => `unknown`, with reason `property_confirmation_required`. Never include it in confirmed matches.
4. **Type check:** explicit exclusion of the stated type => `unsuitable`; an explicit allowed-type list that omits it => `unsuitable`; absent/ambiguous type evidence => unresolved.
5. **Count check:** stated count above an explicit maximum => `unsuitable`; missing maximum => unresolved unless the supplier explicitly states no count limit.
6. **Weight check:** any stated pet above an explicit maximum => `unsuitable`; missing traveller weight or missing supplier limit => unresolved unless the supplier explicitly states no size/weight limit.
7. **Other restrictions:** a clearly applicable violated restriction => `unsuitable`. An applicable restriction the profile cannot resolve, or unstructured wording whose applicability is unclear, => unresolved.
8. **Scope check:** property-, unknown-, room-, or rate-scoped evidence cannot prove selected-stay acceptance unless the supplier explicitly says the relevant selected room/rate/stay is covered. This leaves the result unresolved, though the UI may say the property generally allows pets.
9. **Suitable threshold:** return `suitable` only when permission and every supplier-present or explicitly enumerated decision dimension pass, all normally material dimensions are either known or explicitly unrestricted, scope supports the selected stay, provenance is present, and there is no conflict.
10. **Fee is parallel, not silently folded into fit:** a fee never makes an animal physically/policy-ineligible, but the result must carry `costStatus`. `may_apply`, unknown amount, unknown basis, or a mandatory fee whose stay total cannot be computed must be prominent before handoff. Do not add it to the displayed nightly rate or Deal Score without a separately approved total-price change.

This intentionally makes `suitable` a high bar. A supplier's generic “pets allowed” can still be shown as evidence, but evaluates to `unknown` for a specific pet when type, limits, restrictions, or selected-stay scope are unresolved.

### Conflict handling

Conflicts must never be resolved by whichever record was parsed last.

1. Compare source, scope, applicable room/rate/stay, fetched/effective time, and exact dimension.
2. A verified selected-stay statement may supersede an older property-level statement only for that stay, and the UI must retain the narrower scope.
3. For the same source and scope, a newer effective statement may supersede an older one only when chronology is explicit.
4. Otherwise preserve both statements and set evidence state `conflict`.
5. If every conflicting interpretation makes the stated pet ineligible, return `unsuitable`. If any credible interpretation allows the pet, return `unknown`, identify the conflicting dimension, and require provider/property confirmation.
6. Never merge permissive fragments from different sources into a synthetic suitable policy (for example, “dogs allowed” from one source plus “no weight limit” from another).

### Evaluation examples

| Supplier evidence | Stated profile | Result | Explanation intent |
|---|---|---|---|
| No policy returned | one 20 lb dog | `unknown` | Pet policy was not returned by the provider |
| Pets prohibited, property scope | one cat | `unsuitable` | Provider says this property does not allow pets |
| Dogs only, max 25 lb, max 1, selected-stay scope; no conflict | one 20 lb dog | `suitable` | Provider policy fits this dog and stay; show fee state separately |
| Dogs only | one cat | `unsuitable` | Provider policy allows dogs, not the stated cat |
| Pets allowed; charges may apply; no types or limits | one dog | `unknown` | Property generally allows pets, but type/limits/cost need confirmation |
| Pets by arrangement | one dog | `unknown` | Property approval is required before booking |
| Source A says allowed; source B says prohibited, same scope/date | one dog | `unknown` | Provider policy statements conflict; confirmation required |
| Max 50 lb; traveller did not state weight | one dog | `unknown` | Dog weight is needed to evaluate the policy |

## Reference Interaction Patterns And Delta

### Google Hotels: filter → result snapshot → property detail → partner

Google documents amenity filters at the result level, key amenities in each result snapshot, a property detail/placesheet with fuller amenity information, and then partner booking links. It also explicitly notes that hotel data can come from multiple sources.

Useful guidance for expaify:

- stay-fit criteria belong before handoff, not only on the provider page;
- scan view should summarize rather than reproduce the whole policy;
- detail is the place to expose restrictions and provenance;
- source multiplicity makes conflict and unknown states necessary.

Delta: expaify has no pet input/filter, scan status, detail policy, source attribution, or missing-data disclosure. Unlike Google's broad amenity model, expaify also promises a stated-pet decision; it needs stricter evaluation than a generic amenity filter.

### Booking.com: broad filter followed by policy verification

Booking.com's own travel guidance tells users to apply a `Pets allowed` filter, then check the specific policy, possible fees/extra charges, and house rules, and contact the property when needed. Its API vocabulary separately includes “by arrangements” and “charges may apply.”

Useful guidance for expaify:

- a broad filter is discovery, not proof of fit;
- fees and house rules must sit close to permission status;
- the interface needs a clear confirmation path when data is conditional.

Delta: expaify cannot currently support even the broad filter from its active payload. When future coverage exists, `Pet-friendly` is still the wrong promise: the control should be framed around the stated profile, and unknown/conditional properties must remain recoverable rather than disappearing.

## Filter Viability And Result Behaviour

### Current decision

Do **not** ship a pet filter against current Hotellook supply. With zero normalized coverage, the control would either return all hotels, return no hotels, or silently misclassify missing data. All three outcomes erode trust.

UXDES may specify a disabled/withheld future state for completeness, but must not add a non-functional filter to the current interface. The immediate useful design is profile-aware scan/detail evidence with an explicit unknown state once a provider contract exists.

### Launch gate for a future filter

Treat these as product quality gates to validate on production-like payload samples across at least 10 destinations, mobile and desktop result counts, and representative stay lengths—not as claims about current coverage:

- at least 80% of returned offers have explicit permission status (`allowed`, `prohibited`, or `by_arrangement`), measured before any filtering;
- at least 90% of offers labelled `Fits your pet` resolve type, count, weight/size, material restrictions, scope, and provenance for that profile;
- 100% of unknown and conflicting offers remain accessible in a separately labelled `Needs confirmation` group when a fit filter is applied;
- 0 prohibited offers appear in `Fits your pet` in contract tests;
- fewer than 1% of offers have unresolved cross-source conflicts after deterministic precedence, with every remainder labelled unknown rather than matched.

If these gates are not met, offer sorting/grouping by confidence rather than exclusion: confirmed fits first, needs-confirmation next, confirmed non-fits last or hidden only through an explicit user choice.

## Measurement Plan

All metrics require a mounted production surface and a real analytics transport; `lib/analytics.ts` currently only logs in development. Event implementation is downstream work.

### Required event boundaries

Use one stable `searchId`, anonymous `sessionId`, `hotelId`, surface, viewport bucket, provider, policy evidence state, fit status, and policy schema version. Never send free-form restriction text, breed, pet name, or exact weight to analytics. Use coarse type/count/weight-present flags only.

| Event | Fires exactly when | Required properties |
|---|---|---|
| `pet_profile_set` | Traveller saves or changes profile used for evaluation | type category, count bucket, weight-present, surface |
| `pet_filter_opened` | Filter control opens | coverage bucket, unknown share |
| `pet_filter_applied` | Apply changes the active result presentation | prior/new mode, counts of fit/unknown/non-fit |
| `pet_filter_cleared` | Active pet filter returns to unfiltered | prior mode |
| `hotel_pet_policy_impression` | Scan status first enters viewport | evidence state, fit status, unresolved-dimension count |
| `hotel_pet_policy_opened` | Traveller expands policy detail | fit status, source-present, fee status |
| `hotel_pet_confirmation_clicked` | Traveller activates an explicit policy/provider confirmation action | destination type, fit status, reason code |
| `hotel_review_clicked` | Existing hotel review/handoff CTA activates | fit status, evidence state, detail-opened |
| `hotel_results_refined` | Search/profile/filter changes after policy exposure | refinement type; do not store an inferred reason |

### Metric definitions

**Policy coverage**

- Permission coverage = offers with explicit permission / all hotel offers returned.
- Detailed-fit coverage = offers for which the stated profile can be evaluated `suitable` or `unsuitable` / offers evaluated with a profile.
- Fee-detail coverage = pet-allowing offers with explicit fee status + amount + basis, or explicit free / pet-allowing offers.
- Unknown rate = offers with result `unknown` / evaluated offers.
- Conflict rate = offers with evidence state `conflict` / offers with any returned policy evidence.
- Report by provider, destination, stay length, and cache hit/miss. Do not report only an overall average that hides weak markets.

**Filter engagement**

- Open rate = unique searches with `pet_filter_opened` / eligible hotel searches exposed to the control.
- Apply rate = unique searches with `pet_filter_applied` / searches with filter opened.
- Change/clear rate = searches with a later profile/filter change or clear / searches with filter applied.
- Segment every rate by permission coverage and unknown share; high engagement over mostly unknown inventory is not feature success.

**Policy-associated exit/refinement**

- Explicit confirmation exit = `hotel_pet_confirmation_clicked`; this is the only event that can be labelled policy-motivated from behaviour alone.
- Associated abandonment = policy detail impression/open with no review or confirmation click, followed by session end or inactivity threshold. Name it `policy-associated`, not `policy-caused`.
- Associated refinement = `hotel_results_refined` within the same search after a policy impression. It may indicate policy mismatch, but the event must not claim why unless the traveller explicitly chooses a reason.
- Compare these by fit status and unresolved reason. Do not infer policy intent from browser close, back navigation, or a generic provider exit.

**Validated decision signal — primary**

Run a comprehension task using representative cards for confirmed fit, confirmed non-fit, by-arrangement, missing, and conflicting policies. Ask: “Can this stated pet stay here for these dates?” with responses `Yes`, `No`, `Needs confirmation`, plus fee/limit recall.

- Validated-decision accuracy = participants whose suitability answer matches the deterministic evaluator and who do not misstate a mandatory/may-apply fee or known blocking limit / all completed tasks.
- Count `Needs confirmation` as correct for unknown, conditional, or conflicting evidence.
- Gate design success at at least 90% correct classification overall, 100% of critical prohibited-property tasks not answered `Yes`, and no material accuracy difference between 375px and 1280px or keyboard/screen-reader task paths.

## Exact Gap

| Layer | Current code | Reference/required pattern | Delta |
|---|---|---|---|
| Supplier | Active payload maps no pet data | Structured permission plus explicit conditional/unknown vocabulary | Validate a real hotel supplier payload; generic amenity token is insufficient |
| Contract | `HotelOffer` has no policy | Independent evidence, facts, provenance, and derived fit | Add provider-neutral normalized policy evidence |
| Cache | Fixed normalizer drops unknown fields | Same policy state on fresh and cached offers | Normalize/version policy on both paths |
| Search | Inventory status only | Policy coverage and profile-aware evaluation | Keep hotel availability separate from policy availability |
| Scan | No pet signal | One textual fit/unknown/non-fit summary | Add a concise status without displacing price/Deal Score |
| Detail | No policy disclosure | Types, fee, limits, restrictions, scope, source, confirmation | Add a dedicated evidence panel with every state |
| Filter | None; current coverage 0% | Broad discovery only when coverage is measurable | Withhold now; later retain unknowns in `Needs confirmation` |
| Handoff | Pet context disappears | Decision and unresolved items remain visible before provider | Add safe continuity in separately scoped implementation |
| Measurement | Dev-only logger; no mounted card baseline | Exposure, engagement, coverage, decision accuracy | Instrument only after a mounted surface and analytics transport exist |

## UXDES Directives

### 1. Make the result-scan status answer the stated-pet question, not advertise “pet-friendly”

- Place one text status after location/quality and before the Deal Score/action row; do not insert it into the photo/name/price grid.
- Use exactly three semantic outcomes: `Fits your pet`, `Does not fit your pet`, and `Pet policy needs confirmation`.
- A supporting scan line may state the single most decision-critical fact: e.g. `Dogs up to 25 lb · $30 per stay` or `Cats not allowed`. Never truncate away `not`, `may apply`, the fee basis, or a blocking limit.
- Do not show `Fits your pet` from generic `pets`, `Pets Allowed`, `by arrangement`, missing types/limits, property-only scope, or conflicting evidence.
- Test: prohibited and unknown fixtures never render as a positive fit; scan copy is understandable without icon or colour.

### 2. Put complete, attributed policy evidence in expanded detail before provider-handoff copy

- Add a `Pet policy for your stay` section after Location and before Price scope/provider handoff.
- Present, in order: fit outcome and reason; allowed/excluded animal types; mandatory or possible fee with amount/currency/basis when known; count and weight/size limits; other restrictions; scope; provider/source and observed time; unresolved items; confirmation instruction.
- Never compute or imply an all-stay pet total when fee basis, count application, currency, or selected-stay scope is unknown. Keep pet charges separate from Deal Score and nightly rate unless a later approved price-total feature changes that contract.
- Test: a traveller can correctly classify all eight evaluation examples and recall a known blocking restriction before activating `Review hotel`.

### 3. Treat missing, conditional, error, and conflict as actionable unknown states—not empty policy

- Required final state headings: `Pet policy not returned`, `Property approval required`, `Pet policy could not be loaded`, and `Pet policy information conflicts`.
- Each state must explain what is known, what is unresolved, and that the traveller should confirm with the provider/property before booking. Never render `No pets`, `No restrictions`, `Free`, or `All pets allowed` from absence.
- If a future filter is active, unknown/conditional/conflicting hotels remain in a labelled `Needs confirmation` result group with its count. They must not vanish as failed matches.
- Test: fresh fetch, cache hit, partial payload, malformed fee, provider error, and cross-source conflict preserve the same safe semantics.

### 4. Specify accessible interaction and announcements for profile, filter, detail, and status changes

- Profile and filter controls require persistent labels; type cannot be icon-only; count/weight errors must be associated in text. Do not request service-animal status.
- The Details button retains `aria-expanded`/`aria-controls`; expanded policy uses a named region or heading and follows Location in DOM order. Focus stays on the toggle when content opens, with the new result summary announced once through a polite live region when profile/filter changes—not on initial page load.
- Status must include visible text, not colour/paw/check/cross alone. Links/buttons need at least the existing 40px target, visible focus, and unambiguous names such as `Confirm pet policy for [hotel] with provider`.
- Test: keyboard and screen-reader users can set a profile, understand result counts, expand a policy, hear a changed fit state, and reach confirmation/review without duplicate or stale announcements.

### 5. Define separate 375px and 1280px composition rules, and gate the filter on coverage

- At 375px, preserve the existing image/name/price row; put the policy status on its own full-width line below it, allow two text lines without overlap, keep fee basis and negation together, and place expanded facts in one column. No horizontal scrolling or clipped confirmation action.
- At 1280px, keep the same information order. A compact policy line may use available width, but the full evidence remains in Details; do not add decorative policy cards that compete with price or Deal Score.
- Do not include an enabled pet filter in the current default design because active coverage is 0%. Specify its future enabled state only behind the measured launch gates in this brief; below gate, omit it and show honest per-card unknown evidence when available.
- Test at 320/375/1280px with longest headings, `charges may apply`, multi-currency fee copy, two restrictions, 200% zoom, and translated-text expansion assumptions.

## Acceptance Criteria For UXDES

- Covers default profile, no profile, profile loading, policy loading, confirmed fit, confirmed non-fit, by-arrangement, not returned, partial/unknown, provider error, malformed policy, conflict, and stale/cache states.
- Provides final visible and assistive copy for all three fit outcomes and all four named unknown sub-states.
- Defines the exact placement/hierarchy for scan and expanded detail at 375px and 1280px.
- Includes profile type/count/optional weight interaction, validation, keyboard order, focus behaviour, and live-region rules without collecting service-animal status.
- Shows known fee amount/currency/basis honestly, makes `may apply` prominent, and never folds pet fees into nightly rate or Deal Score.
- Makes policy source, scope, and unresolved fields visible before provider handoff.
- Explicitly withholds the filter on current 0% coverage and specifies unknown-preserving behaviour for a future coverage-gated version.
- Identifies DEV work for types, provider mapping, cache normalization/versioning, pure evaluation, tests, search policy status, safe review continuity, and analytics; identifies the unmounted `HotelCard` surface as an integration dependency.

## Risks, Blockers, And Out-Of-Scope Findings

- **Blocking data dependency:** no current provider payload in this repo supports the required policy details. UX/UI can specify unknown states, but a validated match requires a verified supplier contract and sample payload before DEV mapping.
- **Filter blocker:** current normalized permission and detailed-fit coverage are both 0%; enabling a filter would be deceptive.
- **Surface blocker:** `HotelCard` has no production page consumer in this branch, so end-to-end interaction and measurement cannot be validated until the owning integration is identified.
- **Analytics blocker:** `track()` is a development console logger, not a production measurement pipeline.
- A separate static HotelLook facilities integration, new hotel supplier, scraping, property contact workflow, ranking changes, total-price changes, Deal Score changes, booking collection of pet details, and legal/service-animal advice are outside this ticket.
- Existing affiliate, `Result<T>`, integer-money, secret, provider-boundary, and no-component-parsing contracts remain mandatory.

## Handoff

Create `UXDES-HOTEL-PET-POLICY-01` to produce the implementation-ready design spec for the stated-pet profile, scan status, full policy detail, unknown/error/conflict states, coverage-gated filter behaviour, accessibility, and 375px/1280px layouts. The design must explicitly record that current supply supports unknown only and that DEV plus a mounted-surface integration are required before a confirmed fit can ship.

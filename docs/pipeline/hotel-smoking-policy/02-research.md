# UXR-HOTEL-SMOKING-POLICY-01: Hotel Smoking-Policy Fit Research

Date: 2026-07-22  
Stage: UX Research  
Priority: P0  
Discovery input: `docs/pipeline/hotel-smoking-policy/01-discovery.md`

## Research Question

Can a traveller determine whether supplier evidence confirms a smoke-free property, a scoped common-area rule, a property that offers smoking rooms, or a smoking/non-smoking room for the selected stay before provider handoff—without reading missing, ambiguous, or conflicting information as a policy guarantee?

## Executive Finding

No current expaify hotel result can meet the discovery report's smoking-policy evidence threshold. The live Hotellook shape, normalized `HotelOffer`, six-hour cache, search stream, card, booking context, and analytics path carry **zero smoking-policy fields**. The defensible current coverage is therefore **0% of normalized offers with representable room-policy evidence and 0% with representable property/common-area evidence**.

This makes an interactive smoking-policy filter non-viable in the current product. A filter would either return no matches, imply that unrepresented inventory fails the policy, or require inference from names, room copy, photos, reviews, or generic amenities—all prohibited by discovery. The shippable repair is an honest, independently rendered policy-evidence state plus continuity into review/handoff. A positive filter can be reconsidered only after a provider supplies threshold-qualified, scoped evidence and the result set can report confirmed and unconfirmed inventory separately.

The established travel pattern is useful but cannot be copied literally. Booking.com and Expedia distinguish property facilities from bookable-room attributes: a property may list non-smoking rooms or a designated smoking area while individual dated room options state “Smoking” or “Non Smoking.” That separation validates discovery's taxonomy. It also shows why expaify must not promote “designated smoking area,” “non-smoking rooms,” or a property capability into either “smoke-free property” or “smoking room available for this stay.”

## Inputs And Method

### Repository evidence read directly

- `lib/types.ts:119-147,169-187` — current evidence status/scope types, `HotelAmenityEvidence`, and `HotelOffer`.
- `lib/providers/hotelAmenityEvidence.ts:11-177` — access-fact whitelist, normalization, duplicate precedence, and missing/error behavior.
- `lib/providers/hotellook.ts:6-30,320-386,402-503` — provider payload shape, six-hour cache, cache validation, live mapping, affiliate deeplink, and `Result<T>` behavior.
- `lib/providers/__tests__/hotellook.test.ts:22-36,101-172,316-378` — actual expected normalized fixtures and cache fallback.
- `app/api/search/route.ts:172-181,183-188,395-440` — hotel call and NDJSON hotel/access status events.
- `app/components/HotelCard.tsx:12-18,20-319,706-917` — evidence props, collapsed hierarchy, expanded evidence panels, and provider-handoff copy.
- `lib/booking/config.ts:18-29,276-337,360-385` — hotel review context, URL serialization, and validation.
- `app/book/BookingFlow.tsx:86-99,235-283,569-690` — review content and handoff/return analytics.
- `lib/analytics.ts:1-7` — development-only analytics sink.
- `app/page.tsx:94-230` and repository-wide `HotelCard` references — the live root is a deal-alert landing page; `HotelCard` is referenced by tests, not mounted in a live search-results page.

### Reference evidence checked

- Booking.com Demand API separates property detail from room detail: accommodation details can request facilities and rooms, and room details include whether the room is smoking or non-smoking. [Booking.com accommodation-details guide](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details)
- Booking.com's room contract models `SMOKING`, `NONSMOKING`, and `SMOKING_AND_NONSMOKING` at room/unit level; its older room amenity contract defaults an omitted smoking attribute to unknown. [Booking.com Rooms API validation](https://developers.booking.com/connectivity/docs/rooms-api/rooms-api-validations), [Booking.com room-amenity guide](https://developers.booking.com/connectivity/docs/tsk-modify-room-amenities)
- Booking.com's facility vocabulary separately includes `NON_SMOKING_ROOMS` and `ALL_PUBLIC_AND_PRIVATE_SPACES_NONSMOKING`, demonstrating that “some/all rooms non-smoking” and “all spaces non-smoking” are not interchangeable property facts. [Booking.com facilities list](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/property-room-facilities-list), [Booking.com facilities metadata guide](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/facilities-meta-endpoint)
- Expedia exposes “Designated smoking areas” under property amenities while dated room options can independently be named “Smoking” or “Non Smoking.” [Expedia property example with designated areas](https://www.expedia.com/Tokyo-Hotels-Smoking-Without-Meals-Room-For-3-People-TE-With-Shinjuku-Ku-Tokyo.h76505193.Hotel-Information), [Expedia property example with smoking and non-smoking room options](https://www.expedia.com/Berea-Hotels-Econo-Lodge.h19581.Hotel-Information)
- Expedia's supplier vocabulary permits a room type to carry one of two smoking preferences, `Smoking` or `Non-Smoking`; the June 2025 rule disallows applying both to one room type. [Expedia lodging enumerations](https://developers.expediagroup.com/supply/lodging/docs/property_mgmt_apis/product/reference/enumerations/), [Expedia lodging release notes](https://developers.expediagroup.com/supply/lodging/docs/property_mgmt_apis/product/reference/release-notes/)

Reference pages were used to identify interaction and data-scope patterns, not as proof of Hotellook coverage or of any specific hotel's current policy.

## Current-Code Audit

### 1. `HotelOffer` cannot represent the discovery taxonomy

`HotelOffer` contains identity, location, class/rating evidence, price, image, provider deeplink, and access amenity evidence. It has no room-policy object, property/common-area-policy object, raw supplier wording, conflict set, or policy-specific fetch state.

The reusable access evidence contract is insufficient without extension:

| Discovery requirement | Current code | Exact gap |
| --- | --- | --- |
| Evidence states `confirmed`, `ambiguous`, `conflicting`, `not_provided`, `unavailable` | `HotelEvidenceStatus` is `confirmed`, `unavailable`, `not_returned`, `unknown` | Ambiguity and contradiction cannot be represented independently; `not_returned` does not distinguish checked-but-absent from a failed check. |
| Entire-property, indoor-common-area, designated-area, property-room capability, selected room/rate | `HotelEvidenceScope` is `property`, `room`, `rate`, `selected_stay` | `property` is too broad to distinguish entire property from indoor common areas or designated areas; property room capability is not selected-room availability. |
| Supplier wording retained when nuance/scope would be lost | `HotelAmenityEvidence` has `label` and `sourceLabel` only | No verbatim/source-text field exists. A component could only replace or discard ambiguous wording. |
| Traceable observation time | `fetchedAt` is optional | The evidence threshold requires it for a positive claim; current types do not enforce it. |
| Selected-stay room/rate identity plus searched dates | No such fields on `HotelOffer` | A dated `selected_room_smoking` or `selected_room_non_smoking` claim cannot be bound to inventory. |
| Preserve contradictory assertions | One flat evidence array normalized by id | The current access normalizer chooses one duplicate by precedence; it does not preserve both records for review. |

Reusing `amenityEvidence` unchanged would therefore violate discovery. Smoking policy needs a dedicated, provider-neutral policy object or a deliberately extended evidence contract whose scopes and states match the discovery taxonomy exactly.

### 2. Current Hotellook vocabulary supports none of the policy states

The actual `HotelLookCacheEntry` interface maps only:

- hotel identity and name;
- stars/property type;
- location/address/distance;
- property-level `priceFrom`;
- photo URL;
- the repo-added generic `amenityEvidence?: unknown` path.

There is no smoking policy, room inventory, room type, rate identity, common-area rule, designated-area description, or raw policy text. The tested live fixture confirms that the adapter emits access facts as `not_returned`; it emits no additional hotel-detail content.

The generic amenity path cannot rescue the gap. `normalizeHotelAmenityEvidence` whitelists seven access/request ids only (`elevator`, parking, step-free route, and four room requests). A smoking id is discarded. Non-array input becomes an access error, while missing input becomes a ready list of access facts marked `not_returned`. Neither path establishes smoking-policy availability.

#### Taxonomy coverage matrix

| Required normalized state | Current Hotellook payload | Current normalizer/output | Coverage |
| --- | --- | --- | --- |
| `all_rooms_non_smoking` | No all-room inventory assertion | No field | Unsupported |
| `smoking_rooms_offered` | No property room-capability assertion | No field | Unsupported |
| `selected_room_non_smoking` | No room/rate object | No field; no room identity | Unsupported |
| `selected_room_smoking` | No room/rate object | No field; no room identity | Unsupported |
| Room `ambiguous` + supplier wording | No policy text | No raw-wording field | Unsupported |
| Room `not_provided` | Payload absence is observable internally | No smoking object/state emitted | Not representable |
| `smoke_free_property` | No entire-property assertion | No field | Unsupported |
| `indoor_common_areas_smoke_free` | No common-area assertion | No scope | Unsupported |
| `designated_smoking_areas` | No designated-area assertion or name | No field | Unsupported |
| `smoking_permitted_in_stated_areas` | No stated-area text | No raw-wording field | Unsupported |
| Property/common-area `ambiguous` or `conflicting` | No retained source records | Duplicate evidence would be collapsed | Unsupported |
| Policy check `unavailable` | Provider-level failure exists | Only hotel inventory and access status are streamed | Not independently representable |

This is **code-path coverage**, not a claim that Hotellook or its downstream pages never know a hotel's policy. The current expaify endpoint and adapter do not request or carry it.

### 3. Cache behavior would erase or stale policy evidence unless explicitly redesigned

`hotellook.ts` uses `CACHE_TTL = 21600` and a normalized key of destination + check-in + check-out. Cached arrays are validated and remapped through `normalizeCachedHotelOffer`. Because the cache validator does not read a smoking-policy field, any such field inserted into a cached object today would be dropped before return.

A future policy object must survive both live and cached paths with the same validation. It must retain supplier attribution, exact wording where required, `fetchedAt`, and—only for a selected-room claim—check-in/out plus room/rate identity. A cache timestamp proves when expaify observed a supplier assertion; it does not prove current enforcement or smoke conditions.

The current normalizer's duplicate precedence is also unsafe for policy conflict. It reduces multiple records to one id and prefers the lower numeric precedence; it cannot display two current but contradictory scoped assertions. Smoking-policy normalization must emit `conflicting` with the underlying records available for review rather than choose a “winner.”

### 4. The search stream has no independent policy lifecycle

`/api/search` calls hotels only when destination, departure, and return dates exist. It streams:

- `hotel-status` for inventory availability/empty/unavailable;
- `hotels` with normalized offers;
- `hotel-access-status` for access evidence loading/ready/error.

There is no `hotel-smoking-policy-status`, no per-offer policy state, and no result-set coverage summary. Reusing `hotel-access-status` would collapse two independent checks: access evidence may succeed while policy evidence fails, or vice versa. The room-policy threshold also cannot be met because the provider returns only a property-level “from” price, not dated room/rate inventory.

### 5. `HotelCard` has an evidence pattern, but no smoking-policy surface

The collapsed card prioritizes property identity/quality, a possible access fact, location, nightly rate, Deal Score, “Review hotel,” and “Details.” Expanded details contain separate Deal Score, quality, location, access/request, and price/handoff panels. No string, prop, state, or screen-reader label mentions smoking.

The access panel offers useful interaction precedent—explicit loading, provider-not-documented, unclear, unavailable, source, and refreshed states—but its semantics cannot be copied verbatim:

- smoking room and property/common-area policy must appear as two independently labelled dimensions;
- `unavailable` means “policy check failed,” not “smoking is unavailable”;
- ambiguous supplier wording must remain visible verbatim;
- conflicting records must both remain reviewable;
- policy must never share success/warning treatment with Deal Score or imply verified air quality/enforcement;
- positive collapsed copy is safe only for a threshold-qualified state and must name scope (“All rooms non-smoking” is not “Smoke-free property”).

There is also a surface-wiring constraint: `HotelCard` is currently mounted only by tests. The root product is a tracked-deal landing/feed experience, not a live `/api/search` results page. UXDES may specify the component states, but UI/DEV must not claim an end-to-end search/filter repair until the owning live surface is explicitly scoped.

### 6. Booking review drops all policy and selected-stay context

`BookingHotelContext` serializes offer id, provider, hotel name, location, nightly price, currency, price basis, and provider URL. It does not carry check-in/out dates, room/rate identity, room policy, property/common-area policy, raw supplier wording, evidence state, source observation time, or conflict records.

The review tells travellers that the booking partner confirms final total, room availability, and cancellation policy, but it does not say the partner may reveal materially different room and common-area smoking rules. A traveller who saw future card evidence would lose that evidence at the decision boundary. This breaks comparison and makes a provider return hard to interpret.

Policy continuity must use validated structured context, not arbitrary or untrusted free text in query parameters. Until a room-level provider exists, the review must never upgrade property capability to selected-room availability.

### 7. Analytics can observe a return, not explain it

The hotel handoff emits view, continue-click, back-click, and returned events. `hotel_handoff_returned` records only source, partner host, and away-duration bucket. It is a reversal candidate, not evidence that smoking policy caused the return.

`track()` only writes `console.debug` in development, so no production measurement sink exists. There are no filter-open/selection/render events, no policy-detail event, no evidence-state/scope properties, and no explicit return reason. Discovery's filter completion and policy-attributed reversal measures are therefore unobservable today.

## Reference Pattern Comparison

### Booking.com: property detail first, dated room fact at room selection

The reference system holds smoking at multiple layers. Property facilities can state “non-smoking rooms” or all public/private spaces non-smoking, while a room/unit carries a smoking policy. The consumer property page similarly lists “Non-smoking rooms” and “Designated smoking area” as separate amenities, and room rows bind an explicitly named room option to dates/price.

**Transferable interaction rule:** show property/common-area evidence in property detail, then repeat or resolve room-specific smoking status beside the exact bookable room/rate. Do not make users reconcile the two mentally after checkout begins.

**Delta from expaify:** expaify has neither the structured property facility nor the room row. It can implement an honest “not provided” detail state, but it cannot reproduce a confirmed room choice or filter match.

### Expedia: designated areas are property amenities; smoking status belongs to room options

Expedia examples place “Designated smoking areas” in the property-amenities/policy region while individual dated room options distinguish “Smoking” and “Non Smoking.” The supplier contract likewise treats smoking preference as a room-type attribute.

**Transferable interaction rule:** “designated smoking area” answers where smoking may occur on the property; it does not answer whether the selected room permits smoking. Conversely, a non-smoking room does not establish that common areas or the entire property are smoke-free.

**Delta from expaify:** the current deeplink may reveal both only after leaving expaify. The pre-handoff review must preserve what expaify did and did not confirm, then direct the user to compare both scopes at the partner.

### Shared pattern and expaify-specific obligation

Both references depend on dense supplier content and room inventory. They progressively disclose:

1. a scannable property-level facility/policy signal;
2. fuller property/common-area details;
3. a room-level smoking attribute beside an actual room/rate;
4. final confirmation at booking.

expaify should adopt this **scope progression**, not their positive labels or apparent certainty. Sparse-data products need an explicit third classification—“cannot confirm from available evidence”—that mature OTAs often leave implicit. Reviews about smoke smell are anecdotal experience, not policy evidence, and must never be used to infer enforcement, compliance, ventilation, or actual exposure.

## Filter Viability And Unknown Inventory

### Current decision: do not ship an interactive smoking-policy filter

Observed representable coverage is 0/0 dimensions on every current normalized offer. At this coverage:

- “Smoke-free property” would have zero defensible matches;
- “Non-smoking room” would have zero defensible selected-room matches;
- “Smoking room” would have zero defensible selected-room matches;
- excluding unknown offers would silently remove all inventory;
- including unknown offers would make the filter label false.

Therefore UXDES must show no enabled smoking-policy filter in the current default, loading, empty, or provider-error states. A disabled control is also unnecessary clutter at 375px unless it is used as a deliberate explanatory entry point; if shown, its exact text must be “Smoking-policy filter unavailable” and activating its explanation must not mutate results.

### Future enablement gate

An enabled option is authorized only when the current search response can provide all of the following:

1. at least one threshold-qualified `confirmed` match for that exact option and scope;
2. a denominator for displayed hotels and explicit counts for `confirmed`, `ambiguous/conflicting`, `not_provided`, and `unavailable` inventory;
3. confirmed-only filtering implemented from normalized provider evidence, never vendor strings in the component;
4. copy that says the option finds **provider-confirmed** matches and that hidden hotels may have unreported policies;
5. for “Smoking room available,” selected dates plus room/rate identity—the current feed can never satisfy this gate.

No percentage-only coverage threshold is recommended: for a hard health or room-use constraint, even one genuine match may be useful, while 90% ambiguous data is not. Eligibility is evidence-based per option and per search. Counts make the incompleteness visible instead of converting it into a guessed threshold.

When a future confirmed-only filter is active, unknown inventory must not be relabelled as non-matching. The results header must state, for example, “3 provider-confirmed matches · 17 hotels not confirmed,” and offer “Show all hotels.” Clearing the filter restores every hotel without re-running the provider call. An empty confirmed set must read “No provider-confirmed matches in these results,” never “No hotels allow smoking” or “No smoke-free hotels.”

## Comprehension Validation

Prototype-test with first-time hotel travellers, including people seeking smoke avoidance and people seeking a smoking room. Release gate: at least 85% correct on each scope/certainty task; no participant should interpret unknown evidence as confirmed permission or prohibition.

1. **Room vs property:** show “Selected room: Non-smoking” plus “Designated outdoor smoking area.” Ask, “Is the entire property smoke-free?” Correct: no; only the room and stated area rules are known.
2. **Capability vs availability:** show “Property offers smoking rooms” without room inventory. Ask, “Can you book a smoking room for these dates?” Correct: cannot confirm until a dated room/rate says so.
3. **Ambiguous wording:** show supplier wording “Non-smoking hotel” marked scope unclear. Ask which spaces are covered. Correct: cannot determine; wording is preserved but not expanded.
4. **Missing vs failed:** compare `not_provided` with `unavailable`. Ask whether either proves smoking is allowed or forbidden. Correct: neither; one was not supplied, the other could not be checked.
5. **Conflict:** show “All rooms non-smoking” and “Smoking rooms offered” as unresolved current supplier records. Ask for the safe conclusion. Correct: policy conflicts; confirm with provider.
6. **Enforcement boundary:** show a confirmed smoke-free-property assertion. Ask whether expaify guarantees no smoke exposure. Correct: no; it reports supplier policy, not enforcement, compliance, ventilation, or actual conditions.
7. **Future filter:** apply “Smoke-free property — provider confirmed,” then disclose 3 matches and 17 unconfirmed hotels. Ask whether the 17 permit smoking. Correct: cannot tell from expaify's evidence.

## Design Directives For UXDES

### 1. Render two policy dimensions in a dedicated, ordered detail block

Expanded hotel detail and hotel review must use a standalone “Smoking policy” region, ordered:

1. **Room policy** — selected room/rate first when it exists; otherwise property room capability/all-room policy.
2. **Property & common areas** — entire-property rule, indoor common areas, then designated/stated areas.
3. **Evidence** — supplier name, observed time, and verbatim wording when required.

Never merge this block into Deal Score, hotel quality, access, generic amenities, or price. At 375px it is one vertical column; at 1280px the two dimensions may form two equal columns but DOM and screen-reader order remains room → property/common areas → evidence. The collapsed card may show **one** policy line only when it is threshold-qualified, with the scope in the label; otherwise it shows no policy chip and relies on the detail/review state.

**Test:** “All rooms non-smoking,” “Selected room: Non-smoking,” and “Smoke-free property” remain three distinct labels at both widths; a designated-area statement never produces a smoke-free-property line.

### 2. Preserve exact evidence states, wording, conflicts, and enforcement boundary

UXDES must specify all five evidence states independently for each dimension:

- `confirmed`: normalized scoped statement plus “Supplier policy; expaify has not verified enforcement or smoke conditions.”
- `ambiguous`: “Policy wording provided; scope unclear,” followed by the supplier wording verbatim.
- `conflicting`: “Supplier policy details conflict. Confirm before booking,” followed by each current scoped statement and source/observed time.
- `not_provided`: “Smoking policy not provided by this supplier.”
- `unavailable`: “Smoking policy could not be checked.”

The UI must never use “smoke-free,” “smoking allowed,” “non-smoking,” or “available” as a positive assertion outside `confirmed` with its required scope. Do not infer enforcement, air quality, cleaning history, guest compliance, ventilation, or legal guarantees. Do not use color or an icon as the only state cue.

**Test:** every discovery taxonomy state maps to one visible label and one screen-reader sentence; ambiguous wording survives byte-for-byte after safe display normalization; a conflict fixture renders both records and never chooses one.

### 3. Do not enable a policy filter at current coverage; define an evidence-gated future state

The current spec must not include an enabled smoking-policy filter because normalized coverage is 0%. If UXDES needs a discoverable entry point, it may specify a non-filtering “Smoking-policy filter unavailable” explanation that leaves the result set unchanged.

The future enabled design must be confirmed-only, option/scope specific, and show counts for confirmed versus not confirmed. “Smoking room available” remains disabled until a dated selected room/rate is present; `smoking_rooms_offered` can never satisfy it. Empty copy is “No provider-confirmed matches in these results,” with “Show all hotels.”

**Test:** an all-`not_provided` fixture has no enabled option and no result mutation; a mixed future fixture filters only exact confirmed states, displays the unconfirmed count, and restores all results on clear.

### 4. Carry the evidence and uncertainty through hotel review and provider handoff

The `/book` hotel review must repeat the same two-dimension summary and evidence state shown on the selected result. Immediately before the partner CTA, show: “The booking partner confirms the room's smoking status and the property's current smoking rules. Compare both before you book.” When no policy was provided, the review must say so rather than dropping the section.

Property capability copy must be “Supplier says this property offers smoking rooms. Availability for your dates is not confirmed.” Only a selected room/rate record may say “Smoking room available for this stay.” On return from the provider, keep the expaify evidence visible and offer an optional reason action including “Smoking policy or room did not match”; do not infer the reason from return timing.

**Test:** card → review preserves state, scope, source, wording, and observation time; no property-level record is promoted during serialization; the CTA remains reachable and non-overlapping at 375px.

### 5. Define independent loading/error states and exact measurement boundaries

Smoking-policy loading/error must be independent of hotel inventory and access evidence. A policy check can be `loading`, `ready`, or `error` per result/search without overwriting hotel availability. Loading copy is “Checking supplier smoking policy…”; error resolves to `unavailable`, not `not_provided` and never to a positive/negative match.

Specify these production events without hotel name, raw supplier wording, or other free text:

- `hotel_smoking_policy_detail_viewed`: offer id, provider, room evidence state/scope, property evidence state/scope.
- `hotel_smoking_filter_explanation_viewed`: availability reason and confirmed coverage count.
- Future `hotel_smoking_filter_option_selected`: normalized option and pre-filter counts.
- Future `hotel_smoking_filter_results_rendered`: normalized option, confirmed count, unconfirmed count.
- `hotel_smoking_policy_review_viewed`: same normalized state/scope snapshot carried into review.
- `hotel_handoff_return_reason_selected`: enumerated reason, including `smoking_policy_or_room_mismatch`, only after explicit user action.

`hotel_handoff_returned` remains a reversal candidate and must never be counted alone as a smoking-policy failure.

**Test:** a policy-provider error leaves hotel cards/prices usable; each event fires once at its named boundary; no event claims policy attribution without an explicit reason selection.

## Required State Inventory For UXDES

The design stage must cover, for both room and property/common-area dimensions:

- default current state: `not_provided`;
- `confirmed` for every normalized taxonomy value;
- `ambiguous` with retained supplier wording;
- `conflicting` with both/all source records;
- `unavailable` due to provider/check failure;
- loading and refreshing with prior evidence retained;
- combinations such as selected non-smoking room + designated smoking area;
- property offers smoking rooms + no selected-room inventory;
- expired/stale observation shown without converting it to current confirmation;
- mobile 375px, desktop 1280px, keyboard, focus, screen reader, empty results, and provider handoff/return.

## Constraints Carried Forward

- All policy data must enter through `lib/providers`; components never parse supplier vocabulary.
- Provider adapters continue returning `Result<T>` and never throw to callers.
- Money remains integer minor units; affiliate markers remain on outbound deeplinks; secrets remain environment-only.
- Policy fit does not alter Deal Score, hotel ranking, hotel class, guest rating, or price.
- Supplier assertion is not enforcement, compliance, smoke exposure, air quality, cleaning, ventilation, or a legal guarantee.
- No new provider, scraping, review mining, or photo/text inference is authorized by this ticket.

## Blockers And Out-Of-Scope Findings

1. **Provider/data blocker:** current Hotellook search supplies no smoking-policy or room inventory fields. Confirmed states and any enabled filter require a provider with explicit policy vocabulary; research does not authorize adding one.
2. **Contract blocker:** existing evidence types cannot preserve ambiguous/conflicting states, the required spatial scopes, or verbatim supplier wording. DEV work is required before UI can carry the discovery taxonomy.
3. **Review-continuity blocker:** `BookingHotelContext` has no dates, room/rate identity, or policy evidence. A selected-stay smoking claim cannot survive the current handoff path.
4. **Measurement blocker:** analytics is development-only. Production filter/reversal metrics require an approved analytics sink and privacy review.
5. **Surface-wiring gap:** `HotelCard` and `/api/search` are not mounted in the current live root/feed. Wiring or redesigning that surface is outside this UXR ticket.
6. **Not evidence:** hotel reviews that mention smoke smell may motivate user need but cannot establish supplier policy, enforcement, or present conditions.

## UXDES Handoff

Create `UXDES-HOTEL-SMOKING-POLICY-01` for an implementation-ready spec covering the two-dimension policy hierarchy; all discovery taxonomy and evidence states; supplier wording/conflict retention; the enforcement disclaimer; the current no-enabled-filter decision and future evidence-gated confirmed-only filter; card → review → provider-handoff continuity; independent loading/error states; exact analytics boundaries; and default/loading/empty/error/mobile/desktop/focus/keyboard/assistive-tech edge cases.

The design must explicitly identify downstream DEV work for provider-neutral types, Hotellook live/cache behavior, independent search-stream policy status, validated booking-context serialization, analytics instrumentation, and tests. It must not invent positive policy evidence for the current provider.

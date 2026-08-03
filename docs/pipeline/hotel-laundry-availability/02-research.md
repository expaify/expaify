# UXR-HOTEL-LAUNDRY-AVAILABILITY-01 — Hotel Laundry Availability Research Brief

Date: 2026-08-03  
Stage: UX Research  
Priority: P1  
Feature slug: `hotel-laundry-availability`  
Upstream: `docs/pipeline/hotel-laundry-availability/01-discovery.md`

## Decision

**Defer a production laundry-availability UI.** The active hotel search provider does not request or return laundry content, the shared normalizer discards every laundry identifier, and the saved-deal path does not persist amenity evidence. Across every hotel offer that can reach the current deal-detail surface, complete, partial, conflicting, and explicitly unavailable laundry coverage are each **0%**; not returned/unrepresentable coverage is **100%**.

A generic `Laundry` label would fail the discovery problem. It cannot tell a traveler whether the evidence means guest-operated machines, a hotel-managed service, an off-property option, or merely an unclassified provider term. Missing evidence must remain unknown, and unknown must not become either “available” or “unavailable.”

Production work should reopen only after both gates in this brief pass:

1. an approved provider supplies structured, contractually usable mode, scope, state, fee status, and provenance at adequate coverage; and
2. first-time travelers correctly distinguish modes, scope, fee uncertainty, explicit unavailability, and unknown evidence in long-stay scenarios.

UXDES may create a **validation-only prototype** for those gates. It must remain labeled `DEFER — NOT SHIP-READY`; it is not authorization to add a production feature.

## Method And Evidence Limits

This brief combines:

- a static audit of the current hotel search, provider normalization, six-hour cache, snapshot/deal persistence, deal-detail, and hotel-decision analytics paths in this worktree;
- a contract- and interaction-level comparison with current official Booking.com Demand API and Expedia Rapid documentation; and
- an evidence-sufficiency walkthrough for five-night hotel decisions.

No provider credential, live payload export, amenity-coverage dataset, behavioral baseline, or recruited usability session was supplied. `.env.local` is absent in this worktree. Therefore:

- reachable product-path coverage can be stated exactly from code, but external supplier inventory coverage cannot;
- reference documentation establishes available patterns, not expaify's access rights or current coverage;
- the scenario walkthrough identifies the correct decision for controlled evidence states but is not an observed usability result; and
- no claim is made about traveler demand, conversion, confidence lift, or the optimal long-stay threshold.

## Current-Code Evidence

Every finding in this section comes from the assigned worktree. External guidance begins in the next section.

### 1. The active hotel provider returns no laundry content

`app/api/search/route.ts:172–181` sends hotel searches only to `bookingComHotels`. The adapter in `lib/providers/bookingComHotelsRapidApi.ts` calls RapidAPI's `searchDestination` and `searchHotels` endpoints. Its local response contract includes identity, name, coordinates, review score/count, class, photos, area, and gross price (`:23–53`). It contains no facilities or amenity field.

For every accepted result, the adapter explicitly calls:

```ts
normalizeHotelAmenityEvidence(undefined, 'Booking.com')
```

at `lib/providers/bookingComHotelsRapidApi.ts:171`, then caches that normalized offer for six hours (`:19–20`, `:133–138`, `:203`). Thus a successful live search deterministically produces only the normalizer's default not-returned access catalog. It does not perform a property-details/content request and cannot classify any laundry mode.

The other implemented hotel adapters do not close the gap:

- Hotellook accepts an untyped `amenityEvidence` hook, but only its access normalizer can consume it (`lib/providers/hotellook.ts:40`, `:504`, `:534`). Its live and cached search offers are cached for six hours (`:18–19`, `:457–462`, `:545`).
- Hotelbeds ignores amenity content and calls the same normalizer with `undefined` for every accepted hotel (`lib/providers/hotelbeds.ts:253–275`), then caches the result for six hours (`:23`, `:195–204`, `:284`).

No live provider method in this repository retrieves structured property facilities after search. The `HotelProvider` interface offers only `searchHotels` and `checkDocumentReadiness` (`lib/types.ts:748–757`), so there is no provider-neutral laundry-details method to call on deal detail.

### 2. The shared evidence shape cannot safely express the classification

`HotelAmenityEvidence` (`lib/types.ts:120–148`) provides:

- `status`: `confirmed | unavailable | not_returned | unknown`;
- `scope`: `property | room | rate | selected_stay`;
- source label;
- optional fee, fetched time, confidence, and certainty.

It does **not** provide:

- a bounded laundry-mode vocabulary;
- an off-property/nearby scope;
- a way to retain multiple mode records while separating an overall evidence state;
- a conflict envelope or the records that conflict;
- a way to flag an unrecognized generic `laundry` term without assigning it to a mode; or
- provider-supported qualifiers without overloading display copy.

The generic fee enum (`included | paid | unknown`) is sufficient for a fee **status** if the source supports it. It cannot carry an amount or basis, which is appropriate for this ticket because price estimates and returned amounts are out of scope. It also cannot justify treating an omitted fee as included.

### 3. The normalizer actively drops laundry evidence

`lib/providers/hotelAmenityEvidence.ts:18–26` allowlists exactly seven access/parking identifiers: elevator, on-site parking, step-free route, and four room-preference facts. `normalizeItem` returns `undefined` for every identifier outside that catalog (`:109–118`). A hypothetical `self_service_laundry`, `laundry_service`, `nearby_laundry`, or generic `laundry` item is therefore discarded.

The output is always rebuilt from the seven-item access catalog, with absent entries filled as `not_returned` (`:151–176`). It cannot preserve overlapping modes, and it has no laundry-specific explicit-negative or conflict state.

### 4. Coverage is deterministically zero on the normalized product path

The denominator below is **all hotel offers that can be produced by the active Booking.com RapidAPI adapter or survive the implemented Hotellook/Hotelbeds normalizers**. It does not claim to describe data a vendor may hold outside these integrations.

| Candidate classification | Complete | Partial | Conflicting | Explicitly unavailable | Not returned / cannot survive |
|---|---:|---:|---:|---:|---:|
| Self-service on property | 0% | 0% | 0% | 0% | 100% |
| Hotel laundry service | 0% | 0% | 0% | 0% | 100% |
| Provider-identified nearby option | 0% | 0% | 0% | 0% | 100% |
| Fee status attached to a supported mode | 0% | 0% | 0% | 0% | 100% |
| Source + property/nearby scope | 0% | 0% | 0% | 0% | 100% |
| Overall multi-mode classification | 0% | 0% | 0% | 0% | 100% |

There are no explicit negatives or conflicts to count because no laundry record reaches normalization. A missing list item is not evidence that a mode is unavailable. A generic label, if later encountered, must normalize to unknown rather than self-service or hotel service.

### 5. Saved-deal persistence drops amenity evidence before detail

The nightly hotel snapshot job searches through `bookingComHotels` and inserts only hotel id/name, class, photo, check-in date, and money into `price_snapshots` (`scripts/snapshot-job.ts:70–94`; `lib/db/schema.sql:104–119`).

Deal detection subsequently reads those price fields and upserts identity, price, class, dates, snapshot count, OTA links, and status into `deals` (`lib/pipeline/dealDetection.ts:41–115`). The `deals` schema has no amenity or laundry column (`lib/db/schema.sql:125–148`). Even if a search adapter began producing laundry evidence, this path would discard it before `/deals/[dealId]`.

The separate generic `DealDetail` mapper accepts only scalar metadata values and has no laundry field (`lib/deals/dealDetail.ts:113–131`; `lib/deals/dealDetailTypes.ts:6–24`). It cannot safely hide a structured, multi-mode evidence object inside metadata.

### 6. Deal detail has no laundry state before provider handoff

`app/deals/[dealId]/page.tsx` shows stay dates and night count in decision position 1 (`:362–386`), price and Deal Score in position 2 (`:388–412`), and `Hotel fit` in position 3 (`:416–435`). `Hotel fit` currently contains hotel class, an explicit unknown guest-rating state, disruption evidence, and quiet-stay evidence. There is no laundry block, state, loading/error path, or source.

The provider handoff follows immediately at decision position 4 (`:437–456`). Therefore a traveler can leave expaify without encountering any laundry evidence or an explicit “not provided” state. Supporting evidence appears only after the handoff (`:458–481`) and cannot repair pre-handoff comprehension.

The reusable `HotelCard` can receive generic amenity evidence, but its access logic recognizes only the same six non-parking access identifiers. Laundry has no summary or detail rendering. More importantly, the live saved-deal detail page does not construct a `HotelOffer` with amenity evidence; a card-only design would not reach the assigned surface.

### 7. Current analytics cannot attribute laundry uncertainty or decisions

`HotelDecisionAnalytics` records hotel-detail view, section reach after at least 50% visibility for one second, provider-handoff start, and back-to-results (`app/components/HotelDecisionAnalytics.tsx:20–35`, `:49–144`). The server allowlist admits only those defined properties (`app/api/analytics/route.ts:19–21`).

Missing measurement includes:

- laundry evidence state/modes at exposure;
- whether the laundry block or supporting details were reached/opened;
- fee/scope comprehension;
- a stated `keep | rule_out | verify` decision;
- whether uncertainty changed; and
- an explicit laundry-related return or exit reason.

Existing back and handoff events are guardrails only. They cannot establish laundry need or causally attribute an exit.

## Reference-Pattern Guidance

These patterns guide evidence modeling and placement. They do not prove that expaify's current RapidAPI integration can use the same endpoints or fields.

### Booking.com Demand API: fetch structured facilities for property detail

Booking.com separates search/availability from static property content. Its official documentation says `accommodations/details` is typically used after search so travelers can learn more on the accommodation page before proceeding with booking. Callers must request the `facilities` extra. The response returns facility identifiers and can attach attributes such as `paid` or `offsite`; facility names come from a separate constants endpoint. [Booking.com accommodation details guide](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details), [Booking.com Demand API overview](https://developers.booking.com/demand/docs/accommodations/about-accommodation)

Transferable interaction/data rules:

- retrieve detail content after a property has been selected rather than pretending the lighter search result contains it;
- resolve stable facility ids through provider reference data, not UI string matching;
- preserve `paid` and `offsite` as qualifiers of a specific facility record; and
- show the resulting evidence on property detail before the outbound booking action.

Limits for this ticket:

- the documented `facilities` list contains **available** facilities. Omission is not an explicit negative;
- `offsite` can establish off-property scope only when attached to a recognized laundry facility; it does not establish distance, hours, endorsement, or current availability;
- `paid` establishes only that payment may be required, not an amount or turnaround; and
- the docs do not show that one generic laundry facility id necessarily distinguishes guest-operated machines from hotel-managed service. The actual contracted constants/payload must prove that distinction.

Delta from expaify: the active adapter calls a third-party search endpoint only, has no details method, never requests facilities, and cannot preserve facility ids or attributes.

### Expedia Rapid: keep amenity identity and scope separate

Expedia's official Rapid content model represents each amenity with a stable id, localized name, optional value, and categories. Amenities can be property-, room-, or rate-level. Its example explicitly names `Dry cleaning/laundry service`, while its category vocabulary separately includes `dry_cleaning_laundry`, `washer`, and `dryer`. [Expedia Rapid content reference lists](https://developers.expediagroup.com/rapid/lodging/content/content-reference-lists)

Expedia's official integration flow also separates static property content from date/occupancy shopping, and notes that property content requires refreshes. [Expedia Rapid lodging overview](https://developers.expediagroup.com/rapid/lodging)

Transferable interaction/data rules:

- do not collapse service, washer, and dryer records into one “laundry” boolean;
- retain the narrowest supplied scope: a room-level washer is not a shared on-property laundry room, and a property-level service is not an in-room machine;
- allow overlapping records because a property can offer more than one mode; and
- keep static content provenance/freshness separate from the selected-stay price check.

Limits for this ticket:

- a `washer` or `dryer` category alone does not prove guest-operated shared machines; the underlying amenity id/name and scope must do so;
- `Dry cleaning/laundry service` is evidence of a managed service, not self-service;
- Expedia's general content convention says amenities are complimentary unless a surcharge/restriction is specified, but expaify's stricter evidence boundary must treat an unreturned laundry fee as **unknown**, not included; and
- these docs do not establish a structured nearby-laundry relationship or a property-level explicit negative in the demand content response.

Delta from expaify: Expedia Rapid is a reference pattern, not an implemented or approved `HotelProvider` in this repository. It cannot be used as production evidence without a separately approved provider integration.

## Exact Gap

| Decision dimension | Current code | Reference capability | Required delta before production |
|---|---|---|---|
| Self-service on property | Unrepresentable; unknown ids dropped | Scoped washer/dryer or facility ids can be distinct in mature content contracts | Accept only a provider id explicitly defined as guest-operated on-property machines; never infer from `washer`, room copy, or a generic label |
| Hotel-managed service | Unrepresentable | Expedia identifies dry-cleaning/laundry service separately | Preserve as a separate mode; do not imply self-service, turnaround, collection method, or availability for the selected stay |
| Nearby option | No `nearby`/off-property scope | Booking.com facilities can carry `offsite` | Require recognized laundry facility + explicit offsite/nearby relationship; never infer distance or endorsement |
| Multiple modes | Generic array exists, but no laundry vocabulary or overall state | Reference APIs return collections of scoped facility/amenity records | Preserve all non-conflicting supported modes; do not choose one “best” label |
| Explicit unavailable | Generic status exists, but no provider can emit it for laundry | Reference demand facility lists mainly describe presence | Accept only an explicit negative from an approved contract; omission remains not returned |
| Unknown/conflict | Generic `unknown` exists; no conflict envelope | Reference ids/attributes can still be incomplete or contradictory across sources/scopes | Add explicit not-returned, unrecognized-generic, and conflicting outcomes that lead to `verify` |
| Fee | Generic status exists, but no laundry record | `paid`/surcharge attributes can qualify a facility | Preserve `paid` only when attached to the mode; otherwise `unknown`; no amounts in this ticket |
| Price/turnaround | No fields | Neither reference establishes a laundry price or turnaround in the cited facility record | Do not estimate, copy from reviews, or imply either |
| Provenance/freshness | Generic source/fetched time exists but is lost from deals | Both references identify a property-content source separate from shopping | Persist source, provider record id, scope, and observation time when returned through the saved-deal path |
| Placement | No state before provider handoff | Booking explicitly positions property details after search and before booking | If gates pass, place one compact evidence summary inside `Hotel fit` before handoff; details may disclose source/qualifiers without moving price or Deal Score |
| Measurement | Generic section/handoff events only | Not a provider concern | Add bounded exposure, details-open, and stated-decision data only for an approved prototype/implementation |

## Minimum-Evidence Sufficiency Walkthrough

The walkthrough uses five-night stays to match the discovery analysis cohort. Five nights is a research sampling threshold here, **not** a visibility rule: trustworthy evidence should not be hidden from a shorter-stay traveler.

### Scenario A — self-service required

Traveler is staying five nights and needs to wash clothes personally once during the stay.

| Evidence combination | Correct decision | Reason |
|---|---|---|
| `Self-service on property — provider reported`; fee unknown | `keep` if fee is not a constraint; otherwise `verify` | The mode and scope are answered; cost is not |
| `Hotel laundry service — fee may apply` only | `verify` or `rule_out` | A managed service does not satisfy a self-service requirement |
| Generic `Laundry` only | `verify` | Mode and scope are unresolved |
| `Self-service on property — explicitly unavailable` plus managed service reported | `rule_out` when self-service is a hard requirement | The negative applies to the required mode; the positive service does not cancel it |
| No laundry evidence returned | `verify` | Missing is not unavailable |
| Conflicting self-service records | `verify` | A conflict blocks a safe positive or negative conclusion |

### Scenario B — any workable laundry mode

Traveler is staying seven nights and will use either machines or a managed service.

| Evidence combination | Correct decision | Reason |
|---|---|---|
| Self-service and managed service both reported | `keep`, subject to fee sensitivity | Multi-mode evidence is useful and must not be collapsed |
| Managed service reported; `paid` returned; no amount | `keep` if an unknown amount is acceptable, otherwise `verify` | Paid is known; price is not |
| Nearby option reported off property, with no distance/hours | `verify` | Mode/scope are known, but practical usability is not |
| Nearby and self-service both reported | `keep` based on self-service; nearby remains secondary | One supported mode can answer the plan without suppressing overlap |
| All three modes not returned | `verify` | Absence of evidence cannot support `rule_out` |

### Scenario C — explicit unavailability versus unknown

Traveler compares two otherwise similar five-night properties. Property A has an explicit provider negative for self-service and no evidence for other modes. Property B has no laundry evidence.

The correct reading is not “neither has laundry.” Property A supports `rule_out` only if self-service is required; other modes remain unknown. Property B supports `verify` only. This distinction is the highest-risk comprehension test because a terse absent badge or gray state can make unknown look negative.

### Walkthrough result

The smallest useful model is a set of mode-specific records plus an overall evidence state. Mode, scope, source, explicit-negative status, and conflict handling are decision-critical. Fee status matters to value but can remain unknown. Price, turnaround, hours, distance, machine count, detergent, capacity, and service quality are not required to classify a mode and must not be invented.

The walkthrough supports prototyping the model. It does **not** support shipping it because current normalized coverage is zero and no observed participant has yet demonstrated comprehension.

## Ship/Defer Gates

### Current outcome: DEFER

Both gates fail today.

### Gate 1 — provider supply and normalization

Audit at least 500 contractually usable hotel-detail payloads across at least 10 markets, including at least 150 offers searched for stays of five or more nights. De-duplicate by provider property id and report short- and long-stay cohorts separately. Pass only if:

- at least 40% of audited offers contain one or more recognized, safely scoped laundry modes that survive `lib/providers` normalization with source and observation time when supplied;
- self-service, managed service, and nearby are measured separately, with overlap reported rather than forced into mutually exclusive buckets;
- complete, partial, conflicting, explicitly unavailable, generic/unrecognized, and not-returned outcomes are independently counted;
- a manual audit of at least 100 stratified records achieves at least 95% exact agreement on mode + scope + state, with **zero** false-positive availability claims;
- missing facilities never normalize to explicitly unavailable, and a generic `laundry` label never normalizes to a specific mode;
- `paid` appears only when attached to the relevant provider record, while omitted fees normalize to unknown; and
- the saved-deal persistence path retains the same evidence revision shown on detail rather than re-fetching or strengthening the claim at render time.

The 40% coverage threshold is an internal research launch gate, not an industry benchmark. It prevents a persistent evidence block from being dominated by unknowns while leaving room to test whether honest unknown states remain useful. Product should revisit placement and persistence if the observed distribution is materially different.

### Gate 2 — comprehension and decision value

Run a moderated prototype study with 10–12 first-time or infrequent hotel-comparison users. At least eight participants must evaluate a five-or-more-night stay; at least two must evaluate a shorter stay to test whether five nights is a useful analysis segment rather than a visibility cutoff. Include travelers who require self-service, travelers open to any mode, and fee-sensitive travelers.

Each participant sees balanced examples of:

- self-service only;
- managed service only, with `paid` and unknown-fee variants;
- nearby only;
- overlapping modes;
- mode-specific explicit unavailability;
- generic/unrecognized evidence;
- not returned; and
- conflicting records.

After each example, ask the participant to state:

1. which mode or modes are reported;
2. whether each is on property, hotel-managed, or nearby;
3. whether a fee is reported, possible, or unknown;
4. what remains unconfirmed; and
5. whether they would `keep`, `rule_out`, or `verify` the property, and why.

Pass only if:

- at least 85% of all mode + scope answers are correct;
- at least 90% of unknown/not-returned examples are not mistaken for unavailable;
- at least 90% of paid-without-amount examples are not interpreted as a known price;
- no more than one participant interprets provider evidence as a reservation or guarantee;
- at least 80% select the safe expected decision for each evidence state; and
- compared with a no-laundry-evidence control, the prototype reduces “I cannot tell what laundry option this hotel supports” by at least 20 percentage points without increasing incorrect confident answers.

Record factual answers before asking for confidence. A confident incorrect interpretation is a trust failure, not success. Compare the short- and long-stay participants descriptively; do not hide evidence based on night count without a separately powered study and explicit product decision.

## Conditional Placement And Hierarchy

Only after both gates pass:

1. Place one compact `Laundry options` block within **Hotel fit**, after the existing fit evidence and before `Check rooms with provider`. It is secondary to price/Deal Score and primary handoff, but must be encountered before leaving expaify.
2. Show every supported mode in one group. Keep the reading order `mode → on-property/hotel-managed/nearby scope → fee state → verification boundary`. At 375px use one vertical column; at 1280px a denser layout is allowed only if DOM and assistive-technology order stays the same.
3. Keep source, observed time, and provider-supported qualifiers in an accessible disclosure. Unknown, explicit unavailability, nearby, and paid meanings must be stated in text, not color or icon alone.
4. Do not add a collapsed result badge, filter, rank signal, Deal Score input, or provider-contact action in MVP. Reconsider a result-level cue only after coverage and task-frequency evidence show it improves comparison without making omission look negative.

Loading and provider-check failure must remain distinct from a successful not-returned result. A validation prototype must include both even though current production has no laundry lookup.

## Conditional Provider-Neutral Contract

This is a research recommendation for prototype and provider-supply validation, not implementation authorization.

```ts
type HotelLaundryMode =
  | 'self_service_on_property'
  | 'hotel_laundry_service'
  | 'nearby_option'

type HotelLaundryModeState =
  | 'reported'
  | 'explicitly_unavailable'
  | 'not_returned'
  | 'conflicting'

type HotelLaundryEvidenceState =
  | 'reported'
  | 'not_returned'
  | 'unrecognized'
  | 'conflicting'

interface HotelLaundryModeEvidence {
  mode: HotelLaundryMode
  state: HotelLaundryModeState
  scope: 'property' | 'nearby'
  fee: 'included' | 'paid' | 'unknown'
  sourceLabel: string
  providerRecordId: string
  fetchedAt?: string
  qualifiers?: readonly string[]
}

interface HotelLaundryEvidence {
  loadState: 'loading' | 'ready' | 'error'
  evidenceState: HotelLaundryEvidenceState
  modes: readonly HotelLaundryModeEvidence[]
  unrecognizedProviderTerms?: readonly string[]
  evidenceRevision: string
}
```

Contract rules:

- more than one mode may be `reported`;
- `evidenceState: reported` requires at least one recognized reported or explicitly unavailable mode record;
- missing provider data becomes `not_returned`, never explicit unavailability;
- a generic or unmapped laundry term becomes `unrecognized` and produces a `verify` outcome;
- conflicting records remain available for audit but never produce a positive or negative summary claim;
- `nearby_option` requires an explicit off-property relationship from the provider; a generic map result is not evidence;
- a managed service never implies self-service, and a room-level washer never becomes shared on-property machines;
- `paid` without an amount stays `paid`; omitted fee stays `unknown`; this ticket adds no price field;
- provider-supported qualifiers must be bounded and normalized in `lib/providers`; components do not parse free-form descriptions or reviews; and
- no state asserts hours, price, turnaround, machine count, capacity, detergent, distance, endorsement, service quality, or selected-stay guarantee.

## No Production Design Directives Yet

The discovery authorizes production directives only if supply and comprehension support safe implementation. They do not: reachable coverage is 0%, the current provider contract cannot distinguish any mode, and no traveler study has been run.

The following are validation directives, not feature directives:

1. UXDES must label every artifact `DEFER — VALIDATION ONLY` and cover reported single-mode, overlapping modes, mode-specific explicit unavailable, not returned, unrecognized, conflicting, loading, and error states.
2. Provider/DEV must produce the contracted payload audit and normalization accuracy report before any production component or schema migration is approved.
3. Research must test the three scenarios above, record factual comprehension before confidence, and treat `verify` as the correct action for unknown/unrecognized/conflicting evidence.
4. Product must explicitly approve reopening after both gates pass. A generic laundry boolean, free-form description, review mention, or undocumented provider field does not reopen the feature.

## Measurement Definitions After A Gate-Passing Prototype

Use bounded values only:

- `hotel_laundry_evidence_viewed`: surface, evidence state, reported mode set, fee-state set, stay-length cohort;
- `hotel_laundry_details_opened`: the same evidence dimensions;
- `hotel_laundry_decision_recorded`: `keep | rule_out | verify`, evidence state, explicit requirement (`self_service | any_mode | none_stated`); and
- a deliberate laundry-related return/exit reason only when the traveler explicitly selects it.

Match the existing section-reach convention: at least 50% visible for one second. Do not infer laundry need from stay length, baggage, property type, dwell time, back navigation, or provider handoff. Five nights is an analysis segment, not an intent signal.

## Constraints And Out-Of-Scope Findings

- No laundry filter, ranking, recommendation, Deal Score input, booking request, property contact, map search, directions, or nearby-laundry affiliate belongs in this ticket.
- Do not infer a mode from hotel name, brand, property type, room name, photos, descriptions, reviews, or common practice.
- Do not estimate or crowdsource fee amounts, turnaround, hours, capacity, machine count, detergent, distance, or quality.
- Every future external lookup must remain behind `lib/providers`, return `Result<T>`, and retain provider provenance.
- If a future provider returns a money amount, a separate approved contract must use `{ priceCents: number; currency: string }`; this ticket intentionally includes no amount.
- The active `bookingComHotelsRapidApi` integration uses `RAPIDAPI_KEY`, which is outside the secrets list in the ticket briefing. This is pre-existing adjacent architecture and was not changed. It should be reconciled by the provider-owning stage before any new provider work, but it does not alter this ticket's defer decision.
- The current deal pipeline hard-codes two-night snapshots/deals (`lib/pipeline/dealDetection.ts:80–98`), while the discovery defines five-or-more nights as the long-stay research cohort. This makes current saved-deal analytics unsuitable for validating that cohort. Changing snapshot logic is out of scope; the prototype study and future supply audit must deliberately include long-stay queries.
- No product code, API route, provider, analytics schema, database schema, or design-system file was changed by this UXR ticket.

## Handoff To UXDES

Create `UXDES-HOTEL-LAUNDRY-AVAILABILITY-01` as a **validation-only design** handoff. It should specify the conditional `Hotel fit` hierarchy and every evidence/load state needed for Gate 2, while explicitly recording `DEFER — NOT SHIP-READY` until an approved provider payload passes Gate 1 and observed comprehension passes Gate 2. It must preserve structured provider evidence, multi-mode classification, explicit unknown/unrecognized/conflicting states, mode-specific explicit unavailability, no price or turnaround estimates, and the five-night threshold as analysis-only rather than a visibility rule.

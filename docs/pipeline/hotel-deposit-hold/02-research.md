# UXR-HOTEL-DEPOSIT-HOLD-01 — Deposit and Incidental-Hold Clarity at Result Selection

**Stage:** UX Research · **Priority:** P0  
**Date:** 2026-07-31 · **Feature slug:** `hotel-deposit-hold`  
**Upstream:** `docs/pipeline/hotel-deposit-hold/01-discovery.md`  
**Downstream:** `UXDES-HOTEL-DEPOSIT-HOLD-01`

## Research question

When no provider in a hotel result set can supply deposit or incidental-hold evidence, is a repeated
per-result signal useful enough to justify its attention cost, or should expaify explain the limitation
once for the result set and retain the full unknown state only in hotel detail and before handoff?

## Decision

**At 0% provider capability, do not show a deposit or hold signal on every result.** Show one neutral,
set-level statement before the result grid. Keep the existing full evidence state in expanded detail and
at outbound review, where a traveler evaluates a chosen property and can act on the uncertainty.

A card-level signal becomes worthwhile only when it can discriminate between results: the provider has
returned `complete`, `partial`, `conflicting`, or valid `explicit_none` evidence for that result. In a
mixed-coverage set, a single legend must explain that an unlabeled result is unknown, not deposit-free.
This rule reduces repeated policy chrome without hiding confirmed evidence or converting silence into a
reassuring claim.

This finding does not change the disclosure contract shipped by
`docs/pipeline/hotel-deposit-holds/`. It changes only where the already-modeled states compete for
attention during result comparison. Rate-payment timing remains owned by
`docs/pipeline/hotel-payment-timing/` and is not restated here.

## Inputs and method

### Current-code evidence audited

- `docs/pipeline/hotel-deposit-hold/01-discovery.md`
- `docs/pipeline/hotel-deposit-holds/01-discovery.md`
- `docs/pipeline/hotel-deposit-holds/02-research.md`
- `docs/pipeline/hotel-deposit-holds/03-design.md`
- `lib/types.ts`
- `lib/hotels/fundsPolicy.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/bookingComRapidApi.ts`
- `app/components/HotelFundsPolicyPanel.tsx`
- `app/components/HotelCard.tsx`
- `app/components/hotelFundsPolicyAnalytics.ts`
- `app/book/BookingFlow.tsx`
- `app/deals/DealFeed.tsx`
- `app/components/ui/DealCard.tsx`
- `app/deals/[dealId]/page.tsx`

This was a source audit, not a production analytics read. No event dataset is available in the
worktree, so banner blindness and deposit-attributed exit reduction remain hypotheses to test rather
than measured outcomes.

### Reference-pattern evidence

Reference material is interaction-pattern guidance only. It is not evidence that any expaify property
has or does not have a deposit or hold.

- Google Hotels describes each result as a comparison snapshot containing facts such as rating, key
  amenities, and lowest partner price, then directs travelers to a property's placesheet for fuller
  information. Its documented result-card pattern does not name deposits as a repeated list-tier fact.
  [Google Travel Help: Search for hotels on Google](https://support.google.com/travel/answer/6276008?hl=en)
- Booking.com's documented search response centers each accommodation's best available product, price,
  selected product policies, and booking URLs. Its separately documented damage-policy object was added
  to `/accommodations/details`, where amount/currency, collection/refund dates, and payment method can be
  returned as structured property detail. The documented split is useful: search carries comparable
  offer facts; property-level damage evidence belongs to detail unless it becomes a reliable comparison
  dimension. [Booking.com: Search for accommodation](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties)
  and [Booking.com: Damage policy changelog](https://developers.booking.com/demand/docs/whats-new/archive-2024)

Neither reference establishes that a missing deposit field means no deposit. The applicable pattern is
progressive disclosure with explicit semantics, not visual imitation.

## Current implementation audit

### 1. The provider limitation is set-level, but the data model can express only an offer-level unknown

`HotelFundsPolicyEvidence` has five states and preserves obligations, source, scope, freshness, missing
fields, and conflicts (`lib/types.ts:314–322`). It has no capability declaration. By contrast,
`HotelRateEligibilityCapability` explicitly declares whether an adapter can return meaningful values
(`lib/types.ts:466–472`), and `HotelOffer` carries both rate-eligibility and admission-policy capability
alongside their evidence (`lib/types.ts:575–578`).

Both Hotellook normalization paths create the same `not_returned` policy
(`lib/providers/hotellook.ts:407` and `:536`) while explicitly attaching unsupported capability objects
for the adjacent eligibility and admission dimensions (`:409–410`, `:540–541`). The only other file named
as a Booking.com provider is a flight-only, unmapped RapidAPI adapter; it has no hotel funds-policy path
(`lib/providers/bookingComRapidApi.ts:39–115`).

Therefore current normalized hotel coverage is:

| Measure | Current value | What it means |
|---|---:|---|
| Provider capability | 0% | No reachable hotel adapter contract can return this dimension. |
| Complete | 0% | No returned obligation can be complete. |
| Partial | 0% | No returned obligation can be partial. |
| Explicit none | 0% | No provider can explicitly confirm neither a deposit nor hold applies. |
| Conflicting | 0% observable | Conflict cannot enter the normalized offer. |
| Not returned | 100% | This is synthetic adapter fallback, not property-specific evidence. |

The exact contract gap is the inability to distinguish **provider cannot supply this dimension** from
**capable provider supplied nothing for this offer**. Until that distinction exists, placement logic
cannot safely aggregate the first condition or interpret the second.

### 2. The summary turns a non-discriminating fallback into the strongest repeated policy treatment

`HotelFundsPolicyPanel` maps `not_returned` to “Deposit and hold policy not provided. Additional
available funds may still be required” (`app/components/HotelFundsPolicyPanel.tsx:133–149`). It then
groups `not_returned` with partial, conflicting, and error states and gives all four the warning-soft
background and strong border (`:274–280`).

Every bookable `HotelCard` renders that summary between parking and the pet/smoking policy signals
(`app/components/HotelCard.tsx:925–957`). A traveler scanning ten cards receives ten visually prominent
instances of one provider limitation and no new property information after the first. This violates the
comparison purpose of the card: the signal cannot change selection, but consumes vertical space and
competes with facts that can.

This is a signal-detection failure, not a wording failure. Shortening the sentence, changing the icon,
or finding a different warning color would leave the information gain at zero.

### 3. The full disclosure remains necessary after a traveler selects a property

Expanded `HotelCard` detail renders the full policy after price scope and before provider handoff
(`app/components/HotelCard.tsx:1067–1090`). The outbound review repeats it before the partner CTA
(`app/book/BookingFlow.tsx:1243–1255`). Those placements answer a different question from the card:
“What uncertainty must I resolve for this chosen stay?” Even at 0% coverage, a neutral `not_returned`
state is actionable there because the traveler can confirm it with the property or partner.

The existing structured disclosure should therefore be retained at detail and handoff. The repair is
not permission to suppress the unknown everywhere, estimate an amount, or relabel `not_returned` as
“no deposit.” It is permission to stop repeating the same unknown in the comparison tier.

### 4. The repository's live result grid is not the audited `HotelCard` surface

No production file imports or renders `HotelCard`; repository search finds only the component and its
tests. The live hotel deal grid in `app/deals/DealFeed.tsx:1777–1929` maps deal rows to
`app/components/ui/DealCard.tsx`, whose contract carries no funds-policy evidence. The deal detail page
constructs a synthetic `HotelOffer` with `not_returned` only for Deal Score calculation
(`app/deals/[dealId]/page.tsx:212–223`) and does not render the funds-policy panel.

Consequently, the repeated-warning defect exists in the implemented `HotelCard` result component, but
its production exposure cannot be measured on the current deal grid. UXDES must name the intended
result-set owner and avoid specifying a notice that has no reachable host. Wiring the live deal feed to
hotel-provider funds evidence is a downstream product/data dependency, not research work for this
ticket.

### 5. Existing analytics are offer-level and cannot evaluate the proposed aggregation by themselves

`hotelFundsPolicyAnalytics.ts` records summary exposure, details-open, and confirmation actions with
policy state and provider. With the current single reachable state, these events have no evidence-state
contrast group. They also do not record the result set's provider capability, number of visible repeated
warnings, or whether a traveler saw a set-level explanation.

Removing card-level unknowns would intentionally reduce `hotel_funds_policy_viewed` events; that decline
must not be misread as reduced awareness. Evaluation needs a set-level exposure event plus a comprehension
task. Deposit-attributed exits remain correlation unless travelers explicitly identify deposit
uncertainty as their reason.

## Exact gap: current behavior versus reference guidance

| Layer | Current expaify behavior | Reference-pattern guidance | Delta |
|---|---|---|---|
| Result set | No aggregate capability statement. | Result lists prioritize facts that support cross-property comparison. | State a provider-wide limitation once when it is common to the set. |
| Result card | Repeats an amber `not_returned` block on every bookable `HotelCard`. | Google documents concise snapshots; Booking.com's detailed damage object is property detail, not a default repeated search field. | Show a card signal only when returned evidence differentiates that result. |
| Property detail | Full five-state evidence panel is available in expanded `HotelCard`. | Structured property policy detail preserves typed facts and provenance. | Retain; make provider incapability visually neutral, not an urgent offer warning. |
| Handoff | Full evidence persists before outbound continuation. | Material uncertainty remains visible at the decision/booking boundary. | Retain unchanged in purpose; do not merge with rate-payment timing. |
| Semantics | `not_returned` collapses unsupported provider and missing offer evidence. | Explicit null/none and absent data require different semantics. | Add capability before changing placement logic. |

## Design directives

These five directives are specific and testable. They supersede only the prior design's requirement to
show `not_returned` on every collapsed card; they do not supersede its evidence, detail, or handoff rules.

### 1. Add a provider-capability discriminator before suppressing any card state

Add a provider-neutral `fundsPolicyCapability` to `HotelOffer`, following the adjacent capability pattern.
The minimum sufficient contract is `{ policy: boolean }`: `false` means the adapter contract cannot
return deposit/hold evidence; `true` means it can, even if one offer returns `not_returned`. A missing
capability degrades to `false`, never to supported.

Acceptance checks:

- Both Hotellook construction paths attach `{ policy: false }`.
- A fixture for a capable provider can attach `{ policy: true }` with any of the five evidence states.
- `policy: false` plus `explicit_none`, `complete`, `partial`, or `conflicting` is treated as malformed
  provider data, not displayed as confirmed evidence.
- `policy: true` plus `not_returned` remains unknown for that offer; it never becomes `explicit_none`.
- The result-set summary is derived from normalized visible offers after deduplication, not from provider
  name checks in a component.

### 2. Replace uniform card warnings with one neutral result-set statement

When every visible bookable offer has `fundsPolicyCapability.policy === false`, render one statement after
the result count/status and before the first card:

> **Deposit and hold details unavailable**  
> The providers in these results do not supply deposit or incidental-hold details. A property may still
> require additional available funds. Confirm before booking.

Render zero card-level `HotelFundsPolicyPanel` summaries for that set. The statement is informational,
not an alert: use a named `<aside>` or section, no `role="alert"`, no amber/error treatment, and no live
announcement after the result count has settled. At 375px it occupies one column, wraps without
horizontal scrolling, and introduces no control or extra tab stop.

Loading and provider failure also aggregate once rather than creating one live region per card. Loading
copy is “Checking whether deposit and hold details are available…”; failure copy is “We couldn’t check
whether these providers supply deposit and hold details. A property may still require additional
available funds.” Empty result sets render no deposit statement because there is no selectable stay.

### 3. Restore a card-level signal only for evidence that changes comparison

For a set containing at least one capable provider, place this legend once above the grid:

> Deposit and hold details are shown only when a provider returns them. No label means the policy is
> unknown, not that no deposit applies.

Then show a single compact text summary on a card only for valid `complete`, `partial`, `conflicting`, or
`explicit_none` evidence. Use the existing exact amount/range/percentage and scope rules; never estimate,
average, or infer a value. `Explicit_none` is card-worthy because it is a provider-confirmed difference.
`Not_returned` receives no per-card row because the set legend already defines the absence safely.

Acceptance checks:

- An all-unsupported 20-result set produces one set statement and zero card summaries.
- A mixed four-result fixture containing complete, explicit-none, supported/not-returned, and
  unsupported/not-returned produces one legend, two returned-evidence summaries, and no unknown banners.
- Removing the legend from that mixed fixture fails the test; an unlabeled card must never be left open
  to a “no deposit” interpretation.
- Card order, filtering, pagination, and loading more recompute the aggregate without duplicating the
  statement or moving focus.
- At 375px, the longest returned monetary summary wraps fully and does not overlap Deal Score or the
  primary action.

### 4. Keep full evidence in detail and handoff, but make provider-wide absence neutral

Expanded hotel detail and outbound review continue to render exactly one full
`HotelFundsPolicyEvidence` state, including source, scope, freshness, missing fields, conflicts, and the
existing confirmation path. On those surfaces, provider incapability uses the heading “Deposit and hold
details unavailable from this provider” and neutral surface/border tokens. It must still say that the
property may require additional available funds and must never say “No deposit.” Offer-level
`not_returned` from a capable provider uses “Policy not provided for this offer,” preserving the distinct
cause.

Keep deposit/hold content separate from price, taxes/fees, Deal Score, and rate-payment timing. Preserve
keyboard reading order, visible focus on confirmation links, accurate accessible names, and a minimum
44px interactive target at both 375px and 1280px. The policy object must remain semantically identical
through provider normalization, cache replay, selected-hotel context, detail, and handoff.

### 5. Measure comprehension and attention cost at the set level

Add one deduplicated set-level exposure event carrying only categorical/count data: capability state
(`none`, `mixed`, `all`), visible bookable result count, supported-offer count, and counts of each evidence
state. Keep existing detail-open and confirmation events for selected properties; do not fire the old
card exposure event for suppressed unknown rows.

Before claiming improvement, test the current repeated-warning treatment against the proposed aggregate
treatment at 375px and 1280px. Pass only when:

- at least 90% of first-time participants correctly answer whether deposit/hold information is available
  anywhere in the set after one scan;
- at least 90% correctly interpret an unlabeled mixed-set result as unknown rather than deposit-free;
- no more than 5% interpret provider incapability or `not_returned` as confirmed no deposit;
- participants can locate full evidence for a chosen property and at handoff without revisiting every
  card; and
- the all-unsupported fixture contains exactly one visible unavailability statement at every pagination
  depth.

Track deposit-attributed handoff exits only from an explicit traveler reason or policy-confirmation
action. Do not infer causation from dwell time, scroll depth, or a lower count of card exposure events.

## Risks and out-of-scope findings

- **Live-surface dependency:** `HotelCard` is not currently rendered by the production deal grid. UXDES
  can specify the result-set owner, but implementation and measurement require a downstream decision
  about which live hotel-results path receives provider-normalized offers.
- **No analytics baseline in the worktree:** current event definitions exist, but no event data was
  available to quantify banner decay or exits. The study thresholds above are validation gates, not
  reported performance.
- **Provider procurement remains out of scope:** this brief does not select or add a hotel provider and
  does not treat Booking.com reference data as expaify supply.
- **Payment timing remains out of scope:** no directive changes or repeats when the room rate is charged.

## Handoff

Create `UXDES-HOTEL-DEPOSIT-HOLD-01`. UXDES should specify the aggregate placement and every set state
(all unsupported, mixed, all capable, loading, error, empty, pagination update), then specify the
conditional card states and retained detail/handoff states at 375px and 1280px. It must identify the
actual result-set owner rather than assuming `HotelCard` is live.

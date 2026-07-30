# UXR-HOTEL-RATE-INCLUSIONS-01: Hotel Rate Inclusions Research Brief

Date: 2026-07-30
Stage: UX Research (UXR)
Priority: P0
Persona: Senior UX Researcher
Upstream: `docs/pipeline/hotel-rate-inclusions/01-discovery.md`
Surface: hotel result card → expanded details → expaify review (`/book`) → provider room list

---

## 1. What This Brief Decides

1. Confirms or corrects the discovery evidence against the actual source (§2).
2. Compares expaify's rate surface to Booking.com and Google Hotels at
   interaction-pattern level (§3).
3. **Resolves discovery §8**: rate-scoped fact family in `hotelAmenityEvidence.ts`
   vs. a dedicated field on `HotelOffer`. One recommendation, with the reasons
   that make the alternative unworkable (§4).
4. Issues five testable directives for UXDES (§5).

Out of scope, unchanged from discovery §7: pricing model, total-stay maths, taxes
and fees presentation, cancellation/refundability, Deal Score weighting, room
identity, loyalty-discretion benefits, and any new results filter.

---

## 2. Current-Code Audit

Every claim below was read in this worktree. Line numbers are current.

### 2a. Discovery findings that hold

| Discovery claim | Verified |
|---|---|
| `HotelEvidenceFee = 'included' \| 'paid' \| 'unknown'` exists and is the right primitive | Yes — `lib/types.ts:132` |
| `HotelEvidenceScope` includes `'rate'` and no amenity fact ever uses it | Yes — `lib/types.ts:126-130`; the only `'rate'` consumer is `HotelDocumentScope` (`lib/types.ts:217`) |
| `fee` survives normalization for one fact only | Yes — `lib/providers/hotelAmenityEvidence.ts:144`, `if (fact.id === 'on_site_parking' && isFee(value.fee))` |
| `HotelEvidenceFee` is imported into the card and never used | Yes — `app/components/HotelCard.tsx:4`. `grep -rn "\.fee" app lib` returns **zero** render-side reads. The primitive has no consumer anywhere in the app |
| No inclusion vocabulary exists | Yes — `ACCESS_FACTS` at `lib/providers/hotelAmenityEvidence.ts:18-26` and `app/components/HotelCard.tsx:63-74`; no `breakfast`, `wifi`, or credit id. `grep -rni "breakfast"` across `app` and `lib` returns exactly one hit, `app/components/HotelLoyaltyEligibility.tsx:90`, which is loyalty-discretion copy and explicitly out of scope |
| An inclusion fact would be discarded twice | Yes — adapter `FACT_BY_ID.get(id)` miss returns `undefined` (`hotelAmenityEvidence.ts:116-117`); card `if (!isAccessFactId(item.id)) continue` (`HotelCard.tsx:123`) |
| Price scope panel states exclusions only | Yes — `HotelCard.tsx:1045-1051`, literal copy `per night before taxes and fees` |
| Hotellook cannot supply rate-scoped facts | Yes — `rateEligibilityCapability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` at `lib/providers/hotellook.ts:408` and `:538`; `priceFrom` is a per-property cache floor, not a bookable rate |
| Provider-confirms sentence omits inclusions | Yes — `app/book/BookingFlow.tsx:1093-1095` |
| Saved-deal "Hotel fit" carries class + guest rating only | Yes — `app/deals/[dealId]/page.tsx:398-411` |

### 2b. Corrections and additions to discovery

**(i) The card's `ACCESS_FACTS` no longer contains `on_site_parking`.** Discovery
§3b lists it in both copies of the vocabulary. The adapter copy still has it
(`hotelAmenityEvidence.ts:20`); the card copy does not
(`HotelCard.tsx:63-74` — six ids, parking absent). Parking moved to its own
component (`ParkingSummary` / `ParkingSection`, `HotelCard.tsx:908-913, 1018-1024`).
Consequence for this ticket: **the surviving `fee` field on
`on_site_parking` is normalized by the adapter and then read by nobody.** The
inclusion primitive is dead on both ends, not just the render end. Any directive
that "reuses `HotelAmenityEvidence.fee`" would be building on an orphan.

**(ii) `HotelCard.tsx` has no live render site.** `grep -rn "HotelCard" app lib`
outside the component and its tests returns only
`app/components/HotelRateRestrictions.tsx:118`, which is the unrelated
`HotelCardEligibilityLine` export. The deals feed renders `DealCard`
(`app/deals/DealFeed.tsx:1797, 1814`), and `app/page.tsx` renders no hotel offer
component at all. The two hotel decision surfaces a user can actually reach today
are **`app/deals/[dealId]/page.tsx`** and **`app/book/BookingFlow.tsx`**.

This does not remove `HotelCard` from scope — it is the contracted results-card
component, it is test-covered, and the ticket names it. It does change
**sequencing**: a disclosure that ships only in `HotelCard` ships to nobody.
Directive D4 therefore requires the two live surfaces, not just the card.
Re-mounting `HotelCard` is a separate concern and is **not** in this ticket.

**(iii) The `/book` context passthrough is an unavoidable second edit.**
`BookingHotelContext` (`lib/booking/config.ts:53-77`) is a fixed field list;
`buildBookingHotelContext` (`:945-975`) copies fields explicitly; the inline href
builder serializes each one by hand (`:1027-1029` for the eligibility pair). Any
new rate-scoped evidence that must survive the results → `/book` hop needs three
coordinated additions there plus a validator, exactly as `rateEligibility` and
`rateEligibilityCapability` did. UXDES must budget for this; it is not free.

**(iv) There is an exact, working precedent for the shape this ticket needs.**
`lib/hotels/rateEligibility.ts` is a pure derivation module that:
- binds evidence to the offer — `evidence.offerId !== offerId || evidence.supplier !== supplier` → whole payload degrades to `not_provided` (`:111-113`);
- separates **evidence** (what the supplier said) from **capability** (what the supplier's contract can say), and refuses to render the positive "clear" state unless capability declares support for every family (`:132-136`);
- exports a single frozen `*_UNSUPPORTED` constant with the comment "No current adapter may declare support without a documented supplier contract behind it" (`:15-21`);
- has one adapter-side consumer (`hotellook.ts:408, 538`) and one presentation module (`app/components/HotelRateRestrictions.tsx`) that re-validates the derived value before render (`normalizePresentation`, `:33-79`).

Every property this ticket's P0 constraint demands — no inference, mandatory
source, honest capability gating, provenance binding — already exists in that
module. Rate inclusions should copy it, not the amenity-fact pipeline.

**(v) Analytics primitives exist and are reusable.** `app/components/hotelFundsPolicyAnalytics.ts`
already implements the exposure pattern this ticket needs: an
`IntersectionObserver` at 0.5 threshold with a 1s dwell, a bounded dedupe set
(`MAX_DEDUPE_KEYS = 1_000`), a hashed offer+provider+surface key, and a
`try/catch` around `track()` with the comment "Analytics is observational and must
never block policy review or handoff." Handoff and reversal events already fire
from `HotelDecisionAnalytics.tsx:120-136` via `[data-hotel-provider]` and
`[data-hotel-back]` delegation, and section exposure is driven by
`data-hotel-decision-section` attributes (`HotelDecisionAnalytics.tsx:65-110`,
consumed on `app/deals/[dealId]/page.tsx:373, 398, 412`). Directive D5 is
therefore additive property work plus one new exposure hook — not new plumbing.

---

## 3. Reference Pattern Comparison

Compared at interaction-pattern level only; no visual borrowing.

### 3a. Booking.com — the rate-row inclusion line

**Pattern.** Inclusions are attached to the *rate row*, printed in the same block
as that row's price, before any selection. Each row carries a short list of what
that row's price buys ("Breakfast included", "Free cancellation"). Two rows for
the same room, priced differently, are visually distinguishable *by their
inclusion lines* rather than by price alone. Positive statements only: a
room-only rate prints no "breakfast not included" line — absence is the signal.

**Delta vs. expaify.** expaify prints price and Deal Score on the card and states
only what is excluded upward (`per night before taxes and fees`,
`HotelCard.tsx:1047`). Nothing is attached to the rate.

**What transfers.** Colocation. The inclusion statement belongs in the same
scanned block as the price, not in a ninth expandable panel.

**What must not transfer.** Booking.com's silence-means-not-included convention.
It is safe only with complete supplier data. expaify's live supplier returns
nothing at rate level, so silence in expaify means "we don't know", and rendering
Booking.com's convention would turn every unknown into an implied "not included".
This is the single most important pattern rejection in this brief.

### 3b. Google Hotels — rate options with per-option inclusions

**Pattern.** The "All options" list shows one row per booking source, each with
its own price, its own source label, and its own inclusion notes. Source
attribution sits *on the row*, so the traveler reads price, inclusions, and who
said so as one unit. Google also keeps property amenities ("Free Wi-Fi" as a
hotel facility) in a visually separate block from rate-option inclusions.

**Delta vs. expaify.** expaify already does the source-label half well — the card
prints `Rate from ${providerName}` (`HotelCard.tsx:746`) and the aria label
repeats it (`:763`). What is missing is the inclusion half beside it. And
expaify's one inclusion-shaped fact today, parking, sits in a property-scoped
block, so the property/rate separation Google maintains does not yet exist here.

**What transfers.** Source-on-the-row, and the hard visual separation between
"this property has X" and "your rate includes X".

### 3c. The synthesized gap

Both references (a) attach inclusions to the rate, (b) show them before the
outbound click, and (c) never render a blank matrix. expaify does none of the
three. But both references can be positive-only because their suppliers answer;
expaify's cannot, so expaify needs a fourth state neither reference has — an
explicit, source-attributed **not returned** — and a capability gate that
collapses it to one line rather than a column of blanks.

---

## 4. Resolution of Discovery §8 — The Contract

### Recommendation

**Add a dedicated `rateInclusions` + `rateInclusionsCapability` pair to
`HotelOffer`, derived by a new pure module `lib/hotels/rateInclusions.ts` modelled
on `lib/hotels/rateEligibility.ts`. Do not extend the `ACCESS_FACTS` family in
`lib/providers/hotelAmenityEvidence.ts`.**

### Why the fact-family option fails

1. **`validScope` structurally forbids `scope: 'rate'`.**
   `hotelAmenityEvidence.ts:64-68` returns `scope === 'property'` for property
   facts and `scope === 'room' || scope === 'selected_stay'` for room-request
   facts. `'rate'` validates for **no** `kind`. Supporting rate inclusions means a
   third `kind`, a third branch in `validScope`, and a third branch in
   `validConfirmedCombination` (`:70-83`) — inside a function whose existing
   branches hard-code `elevator`, `step_free_route`, and `on_site_parking` by id.
2. **The certainty model does not apply.** `HotelEvidenceCertainty =
   'guaranteed' | 'requestable'` encodes *can you ask the hotel for this room
   preference*. "Requestable breakfast" is meaningless: breakfast is either priced
   into the rate or it is not. The `confirmed` status would carry a field that
   must be permanently `undefined` for every inclusion fact.
3. **Per-fact exceptions would multiply.** The single line
   `if (fact.id === 'on_site_parking' && isFee(value.fee))` (`:144`) is already a
   special case. Four inclusions, each needing an amount, a charge basis, and a
   condition string, would turn `normalizeItem` into a per-id switch.
4. **`HotelAmenityEvidence` cannot carry the payload.** It has no `Money` field.
   A paid breakfast at £18 per person per night, or a $50 property credit, needs
   `{ priceCents, currency }` plus a basis — the shape
   `HotelParkingOptionEvidence.cost` already uses (`lib/types.ts:182-186`). Adding
   money to the amenity type pollutes six accessibility facts that will never use it.
5. **No provenance binding exists.** The amenity array is normalized off an
   untrusted passthrough (`hotellook.ts` reads `value.amenityEvidence`) with no
   offer/supplier check. A rate-scoped, money-bearing claim rendered against the
   wrong offer is precisely the trust failure this ticket exists to prevent;
   `rateEligibility`'s `offerId`/`supplier` guard (`rateEligibility.ts:111-113`)
   is the existing answer.
6. **Capability gating has no home in the fact array.** The array's shape forces
   one row per fact (`normalizeHotelAmenityEvidence` returns
   `ACCESS_FACTS.map(...)`, `:174`). That is exactly the "four repeated unknowns"
   output discovery §5 P1 rules out. A separate capability object is the only way
   to collapse to one honest line.

### Why the dedicated field wins

It inherits a shipped, tested pattern (`lib/hotels/__tests__/rateEligibility.test.ts`),
it satisfies the discovery constraint "reuse `HotelEvidenceFee` and
`HotelEvidenceScope` rather than inventing a parallel enum" at the *value* level
while keeping the *container* separate, it gives money a natural home, and it
leaves the accessibility pipeline untouched — no regression risk to
`HotelCard.accessEvidence.test.tsx`.

### The contract UXDES should specify

```ts
// lib/types.ts — additions only; no existing field changes.

/** Reuses HotelEvidenceFee's members; excludes 'unknown', which conflates
 *  "the property does not offer this" with "the provider did not say". */
export type HotelRateInclusionState =
  | Extract<HotelEvidenceFee, 'included' | 'paid'>
  | 'not_available'
  | 'not_returned';

export type HotelRateInclusionId = 'breakfast' | 'wifi' | 'parking' | 'property_credit';

export type HotelRateInclusionBasis =
  | 'per_night' | 'per_stay' | 'per_person_per_night' | 'per_person_per_stay' | 'unknown';

export interface HotelRateInclusionRecord {
  id: HotelRateInclusionId;
  state: HotelRateInclusionState;
  /** Only 'rate' or 'selected_stay' may back a non-'not_returned' state. */
  scope: Extract<HotelEvidenceScope, 'rate' | 'selected_stay'>;
  /** Mandatory and non-empty for every state except 'not_returned'. */
  sourceLabel: string;
  /** Permitted only when state === 'paid'. */
  amount?: Money;
  basis?: HotelRateInclusionBasis;
  /** Permitted only when state === 'included'; a raw supplier condition string. */
  condition?: string;
  fetchedAt?: string;
}

export interface HotelRateInclusionsEvidence {
  /** Must match the offer this evidence is attached to; mismatch degrades all rows. */
  offerId: string;
  /** Must match HotelOffer.source; mismatch degrades all rows. */
  supplier: string;
  fetchedAt?: string;
  records: HotelRateInclusionRecord[];
}

/** Declares which inclusions an adapter's contract can explicitly answer. */
export type HotelRateInclusionsCapability = Record<HotelRateInclusionId, boolean>;

// HotelOffer gains exactly two optional fields:
//   rateInclusions?: HotelRateInclusionsEvidence;
//   rateInclusionsCapability?: HotelRateInclusionsCapability;
```

Wire `'unknown'` from any supplier maps to `'not_returned'`, never to
`'not_available'`. `'not_available'` requires an explicit supplier negative.

---

## 5. Directives

Five directives. Each is stated so a QA engineer can fail it.

---

### D1 — One rate-scoped inclusion contract, four states, never inferred

**Directive.** Implement the §4 contract in `lib/types.ts` plus a pure derivation
module `lib/hotels/rateInclusions.ts` exporting
`deriveHotelRateInclusionsPresentation({ offerId, supplier, evidence, capability })`.
No inclusion state may be produced from property-scoped data.

**Required copy, per state** (`{Source}` = resolved provider display name via
`providerDisplayName`; `{Item}` = the inclusion label):

| State | Visible copy | Source line |
|---|---|---|
| `included` | `Included in this rate` | `Source: {Source}.` |
| `paid` | `Available, charged extra — {amount} {basis}` — or `Available, charged extra — price not provided` when `amount` is absent | `Source: {Source}.` |
| `not_available` | `Not available at this property` | `Source: {Source}.` |
| `not_returned` | `{Source} did not say` | *(no separate source line)* |

**Testable.**
1. `deriveHotelRateInclusionsPresentation` returns every record as
   `not_returned` when `evidence.offerId !== offerId` or
   `evidence.supplier !== supplier`.
2. A record with `state: 'included'` and `scope: 'property'` degrades to
   `not_returned`. Only `'rate'` and `'selected_stay'` survive.
3. A record with `state: 'included' | 'paid' | 'not_available'` and an empty or
   whitespace `sourceLabel` degrades to `not_returned`.
4. A record with `state: 'included'` carrying an `amount` drops the `amount`;
   a record with `state: 'paid'` and an invalid `Money` (fails `isValidMoney`)
   renders `price not provided` and never `NaN`, `undefined`, or `$0.00`.
5. Grep assertion: no template literal in any component concatenates the string
   `Included` from a `HotelAmenityEvidence` or `HotelParkingOptionEvidence` value
   outside the parking component.

---

### D2 — Minimum inclusion set of four, with parking as a single source of truth

**Directive.** The surface names exactly four inclusions, in this fixed order:
**Breakfast, Wi-Fi, Parking, Property credit**. Labels are literal:
`Breakfast`, `Wi-Fi`, `Parking`, `Property credit`.

**Parking rule.** Parking's state is **derived from the existing parking
evidence, never from the inclusions payload.** Mapping:
`HotelParkingOptionEvidence.cost.state === 'included'` → `included`;
`=== 'paid'` → `paid` (carrying `cost.amount` and `cost.basis` through the same
formatter the parking section uses); `=== 'unknown'` or no parking evidence →
`not_returned`. When more than one parking option is returned and their
`cost.state` values disagree, the inclusion row reads
`Varies by parking option — see Parking` and defers.

**Testable.**
1. A `parking` record present in `rateInclusions.records` is ignored by the
   derivation; the rendered parking row is byte-identical whether or not it is present.
2. With parking evidence stating `cost.state: 'paid'` **and** an inclusions
   payload stating `parking: included`, the surface renders one parking answer —
   `paid` — and no second contradictory line anywhere in the DOM.
3. All four rows render in the fixed order; no fifth inclusion appears even if
   the payload contains additional ids.
4. Rendering never widens past 375px: at a 375px viewport, no inclusion row
   overflows its container and the `Review hotel` action remains reachable.

---

### D3 — Honest capability gating: one line, not four blanks

**Directive.** When `capability` is absent, or when every entry in it is `false`,
the surface renders a **single line** and no per-inclusion rows:

> `{Source} does not return what this rate includes. Check breakfast, Wi-Fi, parking, and any property credit on the partner's room list.`

Accessible summary, same condition:

> `Rate inclusions: {Source} does not return rate inclusions. Confirm on the partner's room list.`

When capability is partial (some `true`, some `false`), render rows **only** for
the supported ids, and append one line naming the rest:
`{Source} does not return: {comma-separated unsupported labels}.`

`lib/hotels/rateInclusions.ts` exports
`export const HOTEL_RATE_INCLUSIONS_UNSUPPORTED: HotelRateInclusionsCapability =
{ breakfast: false, wifi: false, parking: false, property_credit: false };`
with the same "no adapter may declare support without a documented supplier
contract" comment as `rateEligibility.ts:15`. `lib/providers/hotellook.ts` sets it
at both offer-construction sites (`:408` and `:538`) and supplies **no**
`rateInclusions`.

**Testable.**
1. Given a Hotellook offer, the rendered inclusion block contains exactly one
   sentence and zero rows; a DOM query for inclusion row elements returns 0.
2. The string `did not say` appears at most once in the block for any single
   offer under the all-false capability.
3. An offer declaring `{ breakfast: true, wifi: true, parking: false,
   property_credit: false }` with a `breakfast: included` record renders the
   breakfast and Wi-Fi rows plus the line
   `{Source} does not return: Parking, Property credit.`
4. An offer with a fully-true capability but zero records renders four
   `{Source} did not say` rows — never a claim.
5. `HOTEL_RATE_INCLUSIONS_UNSUPPORTED` is the only capability value any adapter
   in `lib/providers/` sets, verified by grep.

---

### D4 — Inclusions readable on every expaify surface before the handoff click

**Directive.** The inclusion state must appear on all three surfaces below. The
two live ones are mandatory for this ticket; `HotelCard` is mandatory because it
is the contracted results card (see §2b(ii) — it currently has no render site,
which is a sequencing note, not a reason to skip it).

1. **`app/book/BookingFlow.tsx` — required.** Add an inclusions block to the
   `Supporting evidence` section (`:1126-1145`), directly after
   `HotelRateRestrictionsSection` and before `ParkingSection`, so the parking row
   and the parking detail read as one continuous answer. **And** amend the
   provider-confirms sentence at `:1093-1094` to name inclusions:
   > `The provider confirms room details, what each rate includes, live availability, final total, taxes and fees, cancellation policy, and terms.`
2. **`app/deals/[dealId]/page.tsx` — required.** Add a `Rate inclusions`
   sub-block inside the existing `Hotel fit` section (`:398-411`), carrying the
   same `data-hotel-decision-section` instrumentation convention as its siblings.
3. **`app/components/HotelCard.tsx` — required.** One collapsed-card line placed
   with the other rate-scoped lines (after `HotelCardEligibilityLine`, `:906`),
   and a full panel in the expanded details placed **immediately after the
   `Price scope` panel** (`:1045-1051`) — inclusions answer "what does this price
   buy", which is the same question the price-scope panel half-answers. Also
   delete the now-genuinely-dead `HotelEvidenceFee` import (`:4`) or put it to use.

**Context passthrough.** `rateInclusions` and `rateInclusionsCapability` are added
to `BookingHotelContext` (`lib/booking/config.ts:53-77`), copied in
`buildBookingHotelContext` (`:945-975`) using the same conditional-spread form as
`rateEligibility`, serialized in `buildInlineHotelBookingHref` (`:1027-1029`),
parsed in the query-param reader (`:871`), and validated on the way in — an
invalid or oversized payload degrades to absent, never to a claim.

**Testable.**
1. Traversing results → `Review hotel` → `/book`, the inclusion statement is
   readable on the review screen without scrolling past the primary
   `Check rooms with provider` action on a 375px viewport.
2. The provider-confirms sentence contains the phrase `what each rate includes`.
3. A hand-built URL with `rateInclusions` set to malformed JSON, an
   offerId-mismatched payload, or a payload over the length bound renders the
   capability-gated line — never a claim, never a crash.
4. The inclusion block is reachable in tab order, exposes an accessible summary
   in the same style as `getRateRestrictionsAccessibleSummary`, and distinguishes
   `included` from `paid` by **text**, verified by reading the accessible name
   with colour and icons suppressed.
5. No adjacent surface regresses: existing `HotelCard.accessEvidence`,
   `HotelRateRestrictions`, `HotelFundsPolicyPanel`, and `HotelDecisionAnalytics`
   tests pass unchanged.

---

### D5 — Instrumentation that can measure exposure, exits, and reversals

**Directive.** Add one derivation helper
`getHotelRateInclusionsAnalyticsDimensions(presentation)` returning a flat,
low-cardinality property set, and emit it on four events. All properties are
enum-valued strings or booleans; no free text, no supplier strings beyond the
already-tracked `provider`, no `Money` values.

**Shared properties**

| Property | Values |
|---|---|
| `inclusions_state` | `gated` (capability all-false) \| `partial` \| `answered` |
| `breakfast_state` / `wifi_state` / `parking_state` / `credit_state` | `included` \| `paid` \| `not_available` \| `not_returned` \| `unsupported` |
| `inclusions_answered_count` | `0`–`4` |

**Events**

1. `hotel_rate_inclusions_viewed` — new. Fires on 0.5-threshold, 1s-dwell
   exposure of the inclusion block, deduped per offer+provider+surface. Reuses the
   `useHotelFundsPolicyExposure` mechanics in
   `app/components/hotelFundsPolicyAnalytics.ts` — same bounded dedupe set, same
   `try/catch` around `track()`. Property `surface`:
   `hotel_card` \| `book_handoff` \| `saved_deal`.
2. `hotel_rate_inclusions_expanded` — new. Fires when the card's details toggle
   opens (`HotelCard.tsx:791-801`), carrying the shared properties. This makes
   inclusion-motivated expansion attributable, which discovery §3d records as
   currently impossible. Deduped per offer.
3. `hotel_room_handoff_started` — **extend**, do not replace
   (`HotelDecisionAnalytics.tsx:120-126`). Add the shared properties so an exit
   taken while inclusions were unanswered is separable from one taken while they
   were answered.
4. `hotel_detail_back_to_results` — **extend** (`:130-136`). Add the shared
   properties plus `inclusions_seen: boolean`, true when
   `hotel_rate_inclusions_viewed` already fired for that offer in this session.
   This is the reversal signal discovery §3d says is invisible today.

**Testable.**
1. Every new event name matches `/^[a-z][a-z0-9_]{1,79}$/` (`lib/analytics.ts:5`).
2. A `track()` that throws does not prevent the handoff navigation or the details
   toggle — asserted with a throwing mock.
3. `hotel_rate_inclusions_viewed` fires at most once per offer per surface across
   repeated scrolls into and out of view.
4. With a Hotellook offer, the event carries `inclusions_state: 'gated'` and all
   four per-item properties as `unsupported`.
5. No property value contains a price, a raw supplier string, or a user
   identifier.

---

## 6. Priority and Cut Line

Implement D1 → D3 → D2 → D4 → D5. D1 and D3 together are the minimum honest
ship: with today's only live provider, the entire visible output is D3's single
capability-gated line, and D1 is the contract that makes it a gate rather than a
guess. D5 may be cut to events 1, 3, and 4 if the layout work overruns; it may
not be cut entirely, because discovery §3d establishes the success metric is
unmeasurable without it.

---

## 7. Open Items Handed to UXDES

- **Property credit label wording.** `Property credit` is the recommended neutral
  label; suppliers call it resort credit, hotel credit, or F&B credit. UXDES fixes
  one visible string and one accessible string — do not pass supplier wording
  through untrimmed.
- **Paid-amount basis strings.** `HotelRateInclusionBasis` includes
  `per_person_per_night`, which parking's `ParkingCostBasis` does not have.
  UXDES writes the four visible basis strings; do not reuse
  `HotelParking.tsx:46-52` verbatim, since its vocabulary is narrower.
- **Collapsed-card density.** The collapsed card already carries eligibility,
  parking, funds policy, pet, and smoking lines (`HotelCard.tsx:906-937`) before
  the score row. UXDES must specify what the single collapsed inclusion line says
  when the state is `gated` — one candidate is to suppress it entirely on the
  collapsed card and keep the gated line in the expanded panel only. Decide
  explicitly; do not leave it to the UI stage.

---

## 8. Handoff

Created `UXDES-HOTEL-RATE-INCLUSIONS-01`. UXDES reads this brief and
`01-discovery.md`, specifies every state named in D1–D3 at 375px and 1280px
including loading, error, keyboard focus, and the gated case, writes final copy
for every visible string, and produces
`docs/pipeline/hotel-rate-inclusions/03-design.md`.

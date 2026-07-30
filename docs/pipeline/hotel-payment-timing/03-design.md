# UXDES-HOTEL-PAYMENT-TIMING-01 — Hotel Payment Timing Clarity — Design Spec

**Stage:** UX Design · **Ticket:** UXDES-HOTEL-PAYMENT-TIMING-01 · **Priority:** P1
**Date:** 2026-07-30 · **Feature slug:** `hotel-payment-timing`
**Upstream:** `docs/pipeline/hotel-payment-timing/02-research.md` (discovery: `01-discovery.md`)
**Downstream:** `UI-HOTEL-PAYMENT-TIMING-01`

This is an implementation-ready spec. Every visible string in it is final copy. There are no placeholders and
no "TODO". Where this spec deviates from the research brief, the deviation is stated with its reason.

---

## 0. What is being built, in one paragraph

One provider-neutral payment-timing evidence object, one copy module that is the single source of every
timing string, and one shared React component rendered in three positions: as a clause merged into the
existing collapsed-card rate-terms row, as a disclosure panel on the expanded card, and as a disclosure panel
on the hotel booking review surface. The dominant real state today is `not_returned` (100% of inventory, by
contract — research §4.0), so the primary deliverable is that **"the provider did not state when you are
charged" reads as an open question, never as reassurance, and never as "pay at the property."** No filter, no
sort, no Deal Score input.

---

## 1. Decisions on the four open questions handed to this stage (research §6)

| # | Question | Decision | Reason |
|---|---|---|---|
| 1 | Type placement | **Separate `HotelPaymentTimingEvidence` object.** `priceBasis` is not widened, and its union stays single-member. | Research §1.1 is correct: a string literal cannot carry five-state provenance, `sourceLabel`, `fetchedAt` or ordered `missingFields`, and `priceBasis` is a *required* literal on `BookingHotelContext` (`lib/booking/config.ts:59`) so widening it edits a neighbouring dimension's URL contract. |
| 2 | Serialization budget | **Six flat scalar keys inline; the full object travels on the existing reference path.** Exact keys and degradation rules in §4. | `hotelBookingHrefRequiresReference` (`config.ts:1065`) already exists and `resolveBookingHotelContext` (`lib/booking/hotelContextStore.ts:32`) already round-trips a *structured* context through Redis. Verbatim wording and conflicting statements therefore do not have to be dropped — they have to be routed. |
| 3 | Scope granularity | **Offer-level for MVP, and the scope is stated on every surface in words** using the existing `HotelFundsEvidenceScope` vocabulary. No new scope member. | `HotelOffer` has no rate concept. Silence about scope would let an offer-level fact read as a rate-level guarantee — the same manufactured-certainty failure the feature exists to prevent. |
| 4 | Harness deviation | **Accepted.** Sibling `HotelPaymentTimingPrototype` + `hotelPaymentTimingFixtures`, not an overload of `HotelContinuityPrototype`. | Verified in code: `HotelContinuityPrototype` is typed on `ContinuitySignal`, `impactType: 'electricity' | 'connectivity' | …`, `PrototypeDestinationContext`, `RESEARCH_MAX_AGE_DAYS` and `SCOPE_LIMITATIONS`, with states `missing | partial | confirmed | stale | conflict | error` — a different vocabulary from the five funds states. Overloading it would invent the "fourth dialect" the constraints forbid. The *mechanism* (allowlist `parse…Fixture()` with a `control` default, research-origin guard, fixed disclaimer, `track()`) is reused verbatim. |

### 1.1 One further decision this stage owns: the UI / DEV split

The evidence contract does not exist in `lib/types.ts` today, so the UI stage cannot render it without a type.
The split is fixed here so neither stage guesses:

- **DEV owns:** `lib/types.ts` additions, `lib/hotels/paymentTiming.ts` (normalizer + degradation rules +
  analytics dimensions), the `HotelPaymentTimingCapability` constant on `lib/providers/hotellook.ts`,
  and the six serialization keys in `lib/booking/config.ts`.
- **UI owns:** the copy module's rendering, `HotelPaymentTimingPanel.tsx`, the merged rate-terms row, the
  composed `aria-label` amendment, the enumeration amendment at `HotelCard.tsx:747`, the analytics hook module,
  and the prototype + fixtures.

**Sequencing:** the copy constants and the pure formatting helpers (§3) live in `lib/hotels/paymentTiming.ts`
and are the shared boundary. UI may land against the types with an offer-level `undefined` evidence value
degrading to `not_returned` (§4.4) before a provider ever populates it — that is the honest MVP render, not a
stub.

---

## 2. Information architecture

### 2.1 The dimension's fixed sub-question hierarchy

Identical on all three surfaces, and never re-ordered:

1. **When** is the stay price charged — at booking / at the property / on a stated date before arrival
2. **Who** collects it — the booking partner or the property
3. **Is a card required now**
4. **The deferred date**, when and only when (1) is `deferred_before_arrival`

### 2.2 Where it sits, relative to the neighbouring money dimensions

| Position | Surface | Treatment | Priority |
|---|---|---|---|
| 1 | Collapsed `HotelCard` | Clause merged into the existing rate-terms row (`HotelCard.tsx:906`) | **Secondary** — it qualifies the price, it does not compete with it |
| 2 | Expanded `HotelCard` | Disclosure panel, placed immediately after the `Price scope` panel and immediately before `HotelFundsPolicyPanel variant="full"` | **Secondary** |
| 3 | `BookingFlow` hotel review | Disclosure panel inside the price section, after `DealScorePanel`, before the funds-policy panel | **Primary** on that surface — this is the last controllable moment |

Explicit hierarchy on every surface: the **nightly amount is primary**, the **Deal Score is secondary**,
payment timing is **tertiary on the collapsed card** and **secondary on review**. Payment timing never
outranks the price, and never renders in a size or weight larger than the funds-policy summary.

### 2.3 Deal-detail page: deliberately not a production render point this phase

`app/deals/[dealId]/page.tsx` renders saved deal rows, not a `HotelOffer` — there is no evidence object on
that surface to render, and fabricating one from the deal row would be exactly the inference the evidence
constraint forbids. This phase mounts **only the research prototype** there (§9), alongside
`HotelContinuityPrototype` at `:433`. When a DEV-stage adapter persists timing onto deals, the same shared
component mounts with zero copy change. This is a narrowing of the research brief's "three surfaces" and is
stated rather than silent.

### 2.4 Not built, by directive

No timing filter, no timing sort, no timing ranking input, no Deal Score contribution (research §3.4). A
filter over 100%-`not_returned` inventory either empties the list or buckets unknown timing as pay-at-property,
which is the precise false-comfort error this feature repairs.

---

## 3. The lexicon module — `lib/hotels/paymentTiming.ts`

This module is the **only** source of payment-timing strings anywhere in the product. No component may inline
one. This is what prevents a fifth divergent caption alongside `HotelCard.tsx:359`, `:1047`,
`BookingFlow.tsx:242`, `app/deals/[dealId]/page.tsx:379`.

### 3.1 Fixed headings and labels

| Element | Final copy |
|---|---|
| Panel heading (expanded card, review) | `When you are charged` |
| Disclosure button label | `When am I charged?` |
| Conflicting-statements sub-heading | `Provider statements` |
| Conflicting statement attribution | `Statement {n} — {sourceLabel}` |
| Prototype disclaimer (verbatim, from the continuity harness) | `Research prototype — this information is not part of hotel ranking or Deal Score.` |

### 3.2 Collapsed-card clause — one line, ≤48 characters, hard cap

| Load / evidence state | Clause | Length |
|---|---|---|
| `loading` | `Checking charge timing…` | 23 |
| `error` | `Charge timing could not be checked` | 34 |
| `complete` · `at_booking` | `Charged at booking` | 18 |
| `complete` · `at_property` | `Charged at the property` | 23 |
| `complete` · `deferred_before_arrival` | `Charged {Mon D}` e.g. `Charged Sep 4` | ≤17 |
| `explicit_none` | `Nothing charged before arrival` | 30 |
| `partial` | `Charge timing partly stated` | 27 |
| `not_returned` | `Charge timing not stated` | 24 |
| `conflicting` | `Charge timing statements conflict` | 33 |

The clause never carries the collector, the card requirement, provenance, or a cross-reference. Those live in
the disclosure. A unit test asserts every clause is ≤48 characters.

### 3.3 Panel status line + body — final copy, every state

`{Provider}` = the evidence `sourceLabel` (who stated it). `{Partner}` = the resolved handoff label from
`getHotelPartnerIdentity` (`BookingFlow.tsx:107+`), falling back to `booking partner` when `named === false`.
**They are never interchanged**: `sourceLabel` attributes the *statement*; the partner label names *where to
confirm*. `getHotelPartnerIdentity` resolves a label from a URL host and is safe only as a "where to confirm"
label — it must never populate `collector`.

| State | Status line (`--text-1`, medium) | Body (`--text-2`) |
|---|---|---|
| `loading` | `Checking charge timing…` | `We are checking when the stay price is charged for this offer.` |
| `error` | `Charge timing could not be checked` | `Charge timing could not be checked. This does not mean you will not be charged at booking. Confirm with {partner} before you pay.` |
| `complete` · `at_booking` | `Charged at booking` | `{Partner} charges the stay price when you book.` |
| `complete` · `at_property` | `Charged at the property` | `The property charges the stay price at your stay, not at booking.` |
| `complete` · `deferred_before_arrival` | `Charged {Month D, YYYY}` | `{Partner} charges the stay price on {Month D, YYYY}, before you arrive.` |
| `explicit_none` | `Nothing charged before arrival` | `{Provider} states nothing is collected and no card is charged before you arrive.` |
| `partial` | `Charge timing partly stated` | `{Provider} stated part of the charge timing. Not stated: {missing fields}. Confirm with {partner} before you pay.` |
| `not_returned` | `Charge timing not stated` | `{Provider} did not state when the stay price is charged, or who collects it. This is not the same as paying at the property. Confirm with {partner} before you pay.` |
| `conflicting` (exactly 2 statements) | `Charge timing statements conflict` | `Two statements from {Provider} disagree about when the stay price is charged. Both are shown; expaify is not choosing one.` |
| `conflicting` (3 or more) | `Charge timing statements conflict` | `{n} statements from {Provider} disagree about when the stay price is charged. All are shown; expaify is not choosing one.` |

**Deviation from research D1, stated:** the brief authored a single `conflicting` sentence beginning "Two
statements". `conflictingStatements` is an array with no documented cap of two, so a fixed "Two" would be a
false statement at n=3. The count-aware pair above is the fix. `{n}` is spelled as a numeral for n ≥ 3.

### 3.4 Card clause — appended to the body, `complete` states only

| Condition | Appended sentence |
|---|---|
| `cardRequiredAtBooking === true` | `A card is required at booking.` |
| `cardRequiredAtBooking === false` **and** `chargeEvent === 'at_property'` | not rendered — this combination *is* `explicit_none` (§4.3) |
| `cardRequiredAtBooking === false` **and** `chargeEvent === 'deferred_before_arrival'` | `No card charge before you arrive.` |
| `cardRequiredAtBooking === undefined` | nothing is appended, and the state is `partial` per §4.3 |

`cardRequiredAtBooking === false` with `chargeEvent === 'at_booking'` is incoherent (money moves at booking,
so a card is involved). It degrades to `partial` with `card_at_booking` in `missingFields` (§4.3) — expaify
never renders a self-contradicting provider claim as a fact.

### 3.5 Missing-field phrases — fixed order

Ordered exactly as `MISSING_FIELD_ORDER` in `lib/hotels/fundsPolicy.ts:25-28` is ordered for its own dimension:
`charge_event`, `collector`, `card_at_booking`, `deferred_date`, `scope`, `source`.

| Field | Phrase |
|---|---|
| `charge_event` | `when the stay price is charged` |
| `collector` | `who collects it` |
| `card_at_booking` | `whether a card is required at booking` |
| `deferred_date` | `the date of the charge` |
| `scope` | `which room and rate this applies to` |
| `source` | `which source stated this` |

Joined by the existing `joinList` grammar (`HotelFundsPolicyPanel.tsx:152-156`): `a and b`, `a, b, and c`.

### 3.6 Collector sentence — rendered on its own line in `complete` and `partial`, when stated

| `collector` | Sentence |
|---|---|
| `booking_partner` | `{Partner} collects the payment.` |
| `property` | `The property collects the payment.` |
| absent | not rendered; `collector` appears in `missingFields` instead |

### 3.7 Scope sentence — rendered in every state except `loading`

Uses the existing `HotelFundsEvidenceScope` vocabulary; no new member.

| `scope` | Sentence |
|---|---|
| `rate` | `This applies to the rate shown.` |
| `room` | `This applies to the room shown, not to a specific rate.` |
| `property` | `This applies to the property, not to a specific room or rate.` |
| `selected_stay` | `This applies to your selected stay.` |
| `not_returned` | `{Provider} did not state which room or rate this applies to.` |

MVP note: the only wired adapter emits `not_returned` for both state and scope, so the `not_returned` scope
sentence is the one that ships. A future adapter may emit `rate` **only** where its response documents
per-rate granularity; otherwise `property`.

### 3.8 Cross-references — one direction only, fixed strings

Rendered inside the `When you are charged` panel only. The funds-policy, total-cost and cancellation panels
are **not** edited to point back — one-directional referencing is what keeps four dimensions from becoming
four overlapping panels.

| Reference | Condition | Final copy |
|---|---|---|
| to total-stay-cost | always, all states except `loading` | `This is when the price is charged, not what it covers.` |
| to deposit-holds | funds-policy state is anything other than `explicit_none` | `Deposits and card holds are shown separately under “Additional funds at the property.”` |
| to cancellation | rate eligibility renders `Non-refundable` | `Non-refundable describes whether you can get money back, not when it is taken.` |
| expaify's own position | `book_handoff` surface only, all five states | `expaify does not collect payment. Any charge happens with {partner}.` |

The deposit-holds string quotes `HotelFundsPolicyPanel.tsx:329`'s heading verbatim, with typographic quotes.
The cancellation string is **required** whenever `Non-refundable` renders, in every timing state — it is the
direct countermeasure to the §1.4 contamination path and is scored as its own error class in research §5.2.

### 3.9 Handoff enumeration amendment — one edit, three surfaces

`HotelCard.tsx:747` becomes:

```
Provider confirms final total, taxes, fees, when you are charged, room availability, cancellation policy, and terms.
```

Insertion point is fixed: after `fees`, before `room availability`. The constant is reused as
`reviewDisclosure` (`:1067`) and folded into the review action's composed `aria-label` (`:763`), so one edit
covers the expanded-card `Provider handoff` panel and the screen-reader path with no divergence. An
enumeration reads as exhaustive; leaving timing out implicitly excludes it.

### 3.10 Forbidden-word rules — assertable as unit tests

1. The tokens `free`, `no charge`, `nothing`, `pay later`, and `pay at the property` may appear **only** in
   the `complete · at_property` and `explicit_none` strings. A test asserts their absence from every
   `not_returned`, `partial`, `conflicting`, and `error` string.
2. The `not_returned` body must contain the exact substring `This is not the same as paying at the property.`
3. No timing string may name an amount, a currency, a deposit, a hold, a penalty, a refund amount, or a
   cancellation deadline (research §2.1 boundaries). Test: no `$`, no digit-followed-by-`%`, and none of
   `deposit`, `hold`, `penalty`, `refundable` outside the two authored cross-reference strings in §3.8.
4. No string interpolates a hostname, and no string derives a collector from `getHotelPartnerIdentity`.
5. Reassuring copy is permitted in exactly two states: `complete · at_property` and `explicit_none`.

### 3.11 Date formatting

`deferredChargeOn` is an ISO calendar date (`YYYY-MM-DD`). Format with
`Intl.DateTimeFormat('en-US', { timeZone: 'UTC', … })` — UTC is required so a date does not shift a day for a
traveler west of Greenwich.

- Collapsed clause: `{ month: 'short', day: 'numeric' }` → `Sep 4`
- Panel and review: `{ month: 'long', day: 'numeric', year: 'numeric' }` → `September 4, 2026`

A date renders only after passing the §4.3 validation. An unvalidated or unparseable date is never rendered.

---

## 4. Data contract, as designed

### 4.1 Types (DEV implements in `lib/types.ts`)

Adopted from research §2 unchanged, because it already satisfies the no-money / no-obligation-type /
no-refundability boundaries:

```ts
export type HotelPaymentTimingState =
  | 'complete' | 'partial' | 'explicit_none' | 'not_returned' | 'conflicting';

export type HotelChargeEvent = 'at_booking' | 'at_property' | 'deferred_before_arrival';
export type HotelChargeCollector = 'booking_partner' | 'property';

export type HotelPaymentTimingMissingField =
  | 'charge_event' | 'collector' | 'card_at_booking' | 'deferred_date' | 'scope' | 'source';

export interface HotelPaymentTimingStatement {
  chargeEvent?: HotelChargeEvent;
  collector?: HotelChargeCollector;
  /** Provider-stated only. `false` is an assertion; absent is not. */
  cardRequiredAtBooking?: boolean;
  /** ISO calendar date. Valid only with chargeEvent === 'deferred_before_arrival'. */
  deferredChargeOn?: string;
  /** Verbatim supplier sentence, bounded to 1,000 chars. Rendered, never parsed. */
  providerWording?: string;
}

export interface HotelPaymentTimingEvidence {
  state: HotelPaymentTimingState;
  statement?: HotelPaymentTimingStatement;
  conflictingStatements?: HotelPaymentTimingStatement[]; // only when state === 'conflicting'
  sourceLabel: string;
  scope: HotelFundsEvidenceScope;
  fetchedAt?: string;
  missingFields?: HotelPaymentTimingMissingField[]; // ordered per §3.5
}

export interface HotelPaymentTimingCapability {
  chargeEvent: boolean;
  collector: boolean;
  cardRequiredAtBooking: boolean;
  deferredChargeDate: boolean;
}
```

Both members are optional on `HotelOffer` (`paymentTiming?`, `paymentTimingCapability?`) and absent is a legal
state that renders as `not_returned` (§4.4). `HOTEL_PAYMENT_TIMING_UNSUPPORTED` — all four capability flags
`false` — is exported and wired on both Hotellook normalization paths (`lib/providers/hotellook.ts:406,534`),
exactly as `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` is, so "we cannot express this" never renders as "nothing to
worry about."

### 4.2 Serialization — six inline keys, full object on the reference path

`BookingHotelContext` gains `paymentTiming?: HotelPaymentTimingEvidence`. The flat query encoding
(`HotelContextInput`, `config.ts:83+`) spends exactly **six** scalar keys:

| # | Key | Values |
|---|---|---|
| 1 | `timingState` | `complete \| partial \| explicit_none \| not_returned \| conflicting` |
| 2 | `timingEvent` | `at_booking \| at_property \| deferred_before_arrival` |
| 3 | `timingCollector` | `booking_partner \| property` |
| 4 | `timingCard` | `true \| false` |
| 5 | `timingDate` | `YYYY-MM-DD` |
| 6 | `timingScope` | a `HotelFundsEvidenceScope` member |

Keys 2–5 are omitted when the corresponding fact is absent. Two rules make that lossless enough to render:

1. **`missingFields` is not serialized; it is re-derived** at the review surface from which of keys 2–5 are
   absent, in the §3.5 order. This is exact for `partial`, which is the only state that renders it.
2. **`sourceLabel` is not serialized.** The review surface uses `providerDisplayName(context.provider)`. If an
   adapter ever emits a `sourceLabel` that differs from that label, the offer takes the reference path below —
   the statement's attribution is never silently reassigned to a different name.

**The reference path carries the full object.** `hotelBookingHrefRequiresReference` (`config.ts:1065`) and
`resolveBookingHotelContext` (`lib/booking/hotelContextStore.ts:32`) already round-trip a structured
`BookingHotelContext` through Redis. The following force it, and DEV must not attempt to squeeze them into the
href:

- `state === 'conflicting'` (needs `conflictingStatements`)
- any retained `providerWording`
- `sourceLabel` differing from `providerDisplayName(provider)`

This supersedes research §6.2's fallback of dropping verbatim wording at the boundary: nothing needs to be
dropped, because a lossless route already exists. If the reference store itself fails, the review surface
renders the panel's `error` load state (§5.7) — it never renders a partially-reconstructed statement as fact.

### 4.3 Degradation rules (normalizer, `lib/hotels/paymentTiming.ts`)

Applied in order. Every rule degrades toward less certainty, never toward more.

1. **Provenance mismatch** — the statement's offer or supplier does not match the displayed offer / `source`:
   the whole object degrades to `not_returned` (precedent: `rateEligibility.ts:110-112`).
2. **Capability all-false** — the adapter may emit `not_returned` only. `complete` and `explicit_none` are
   unreachable, exactly as `capabilitySupportsClear` gates `clear` (`rateEligibility.ts:136`).
3. **`explicit_none` requires both facts** — `chargeEvent === 'at_property'` **and**
   `cardRequiredAtBooking === false`. A missing `cardRequiredAtBooking` degrades `at_property` to `partial`
   with `card_at_booking` in `missingFields`, **never** to `explicit_none`. Suppliers routinely say "pay at the
   property" while still requiring a card to hold the room; those are different claims.
4. **Deferred date validation** — `deferredChargeOn` present without
   `chargeEvent === 'deferred_before_arrival'`, unparseable, or not strictly before check-in: drop the date,
   add `deferred_date` to `missingFields`, state becomes `partial`.
5. **Incoherent card assertion** — `cardRequiredAtBooking === false` with `chargeEvent === 'at_booking'`:
   drop the card fact, add `card_at_booking` to `missingFields`, state becomes `partial` (§3.4).
6. **`conflicting` requires ≥2 retained statements that disagree.** It is never synthesized from one statement
   plus a neighbouring field. A non-refundable rate with `not_returned` timing is `not_returned`, not
   `conflicting`.
7. **Never inferred, ever** — timing may not be derived from `refundability`, from `fundsPolicy`, from the
   partner domain, from industry practice, or from Duffel Stays' payment-method characteristic. That Duffel
   field is documented as not customer-facing and carries no timing semantics; it maps to `not_returned`.
   Mapping it to `at_property` is a defect. DEV must leave a comment to that effect beside
   `getHotelPartnerIdentity` so a later contributor does not wire it into `collector`.
8. **`Result<T>`, never throws.** A fetch failure is the component's `error` **load state**, which is distinct
   from all five evidence states.

### 4.4 Absent evidence

`offer.paymentTiming === undefined` renders as `not_returned` with
`sourceLabel = providerDisplayName(offer.source)` and `scope = 'not_returned'`. There is no fifth visual
treatment for "field not present", because to the traveler it means exactly what `not_returned` means.

---

## 5. Component spec

### 5.1 Public surface (UI stage implements)

```tsx
// app/components/HotelPaymentTimingPanel.tsx
export type HotelPaymentTimingLoadState = 'loading' | 'ready' | 'error'

type Props = {
  evidence: HotelPaymentTimingEvidence | undefined
  loadState?: HotelPaymentTimingLoadState        // default 'ready'
  surface: 'hotel_card' | 'hotel_detail' | 'book_handoff'
  sourceLabel: string                            // providerDisplayName(offer.source)
  partner: { label: string; named: boolean }     // from getHotelPartnerIdentity
  fundsPolicyState: HotelFundsPolicyState | 'error'
  showNonRefundableCrossReference: boolean       // true iff `Non-refundable` renders on this offer
  offerId: string
  provider: string
  initiallyExpanded?: boolean                    // prototype/testing only, default false
  rootRef?: Ref<HTMLElement>
  onOpen?: () => void                            // fires once, first closed → open
}
```

Pure helpers in `lib/hotels/paymentTiming.ts`, so the collapsed row and the `aria-label` never re-implement
copy:

```ts
getHotelPaymentTimingClause(evidence, loadState): string          // §3.2, ≤48 chars
getHotelPaymentTimingAccessibleSummary(evidence, loadState, sourceLabel, partnerLabel): string  // §7.2
getHotelPaymentTimingAnalyticsDimensions(input): HotelPaymentTimingAnalyticsDimensions          // §8
normalizeHotelPaymentTimingEvidence(value, fallbackSourceLabel): HotelPaymentTimingEvidence     // §4.3
```

### 5.2 Collapsed card — the merged rate-terms row (D2, zero new rows)

`HotelCardEligibilityLine` (`app/components/HotelRateRestrictions.tsx:118-152`, rendered at
`HotelCard.tsx:906`) becomes a **combined rate-terms row**. Net new always-on rows on an 11-row card: **zero**.
It also places the correction adjacent to the string that causes the false inference, which no expandable
panel can do.

**Content and order — fixed:** existing `RESTRICTION_ORDER` conditions first, timing clause last, joined by
` · `.

```
Non-refundable · Charge timing not stated
Restrictions not provided · Charge timing not stated
Restricted rate · 2 conditions · Charged at booking
```

The row **always renders**, in every combination — the timing dimension is present for every bookable offer in
one of its five states, so the previous "eligibility absent ⇒ no row" branch no longer exists.

**Tone resolution — this stage's ruling on a real conflict in the brief.** D1.5 forbids `--warning` as the
*text* colour of the collapsed timing clause; the existing restricted row sets `text-[color:var(--warning)]`
on the whole row. Recolouring the row would be an unrequested visual regression on the eligibility dimension.
**Resolution: colour is applied per span, not per row.**

| Part | Class |
|---|---|
| Row container, when eligibility is `restricted` **or** timing state ∈ {`partial`, `not_returned`, `conflicting`} or load state is `error` | `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]` |
| Row container, otherwise | `border-[color:var(--border)] bg-[color:var(--bg-raised)]` |
| Restriction conditions span | `text-[color:var(--warning)]` when `restricted`, else `text-[color:var(--text-2)]` — unchanged from today |
| Separator ` · ` | `text-[color:var(--text-3)]` |
| **Timing clause span** | `text-[color:var(--text-2)]` **always**, in every state. `--warning` and `--error-text` are forbidden here. |

Rationale: a permanent `Last-checked time unavailable` line renders in `--warning` directly above this row on
every offer (`HotelCard.tsx:361`, `:379`) — out of scope to fix, owned by `hotel-price-freshness`. A second
amber *text* line beneath it would read as one alarm block the evidence does not support. The container tone
carries the caution; the text stays calm.

**Full row markup:**

```tsx
<div
  className={`mt-3 min-w-0 rounded-[var(--radius-control)] border px-3 py-2 text-xs font-medium leading-5 ${rowTone}`}
  role={isLive ? 'status' : undefined}
  aria-live={isLive ? 'polite' : undefined}
  aria-atomic={isLive ? 'true' : undefined}
>
  <span className="block line-clamp-2 break-words">
    {conditionsText ? (
      <>
        <span className={conditionsTone}>{conditionsText}</span>
        <span className="text-[color:var(--text-3)]"> · </span>
      </>
    ) : null}
    <span className="text-[color:var(--text-2)]">{timingClause}</span>
  </span>
</div>
```

`isLive` is true only when the eligibility presentation is `loading`/`error` **or** the timing load state is
`loading`/`error`. A settled `not_returned` is not live (§7.3).

Constraints: the row is **text only, never a control** — the full sentence, provenance and cross-references
live in the disclosure. `line-clamp-2` at 375px; the 48-char clause cap guarantees
`Non-refundable · Charge timing not stated` (41 chars) fits two lines at 375px. `break-words` prevents
mid-word truncation. Deferred dates use `{Mon D}` here and `{Month D, YYYY}` everywhere else.

### 5.3 Expanded card and review — the disclosure panel

Structure, in fixed order:

```
[ button: "When am I charged?"  aria-expanded aria-controls  ▾ ]
  └─ (open) section aria-labelledby=<headingId>
       h3  "When you are charged"                      --text-1, text-base/sm:text-lg, medium
       p   status line                                 --text-1, text-sm, medium
       p   body                                        --text-2, text-sm, leading-6
       p   collector sentence          (§3.6, when stated)
       p   card clause                 (§3.4, complete only)
       p   scope sentence              (§3.7)
       [ conflicting only ] h4 "Provider statements" + one <p> per statement
       hr / divider
       p   cross-reference: total-stay-cost           (always)
       p   cross-reference: deposits and holds        (conditional)
       p   cross-reference: non-refundable            (conditional)
       p   expaify position                           (book_handoff only)
       p   provenance line                            (when fetchedAt present)
```

Provenance line, when `fetchedAt` is a valid ISO instant:
`Stated by {Provider}, checked {Mon D, YYYY}.` When `fetchedAt` is absent or invalid, the line is omitted
entirely — no "unknown" placeholder, and no new amber line beside the freshness warning.

The disclosure is **closed by default on every surface**, including review. Rationale: the collapsed clause
already carries the fact and it already reaches screen readers via the composed `aria-label` (§7.2); forcing
the panel open on review would add a fifth always-open money panel to a surface that already stacks price,
Deal Score, funds policy and handoff.

Panel container classes:

| Displayed state | Container |
|---|---|
| `error` | `rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--error-soft)] p-3.5 sm:p-5` |
| `partial`, `not_returned`, `conflicting` | `rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-3.5 sm:p-5` |
| `complete`, `explicit_none` | `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-5` |
| `loading` | `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-5` |

This mirrors `HotelFundsPolicyPanel`'s `warningState` treatment (`:276-280`, `:296-301`) so the two panels read
as one system. **Only existing tokens.** No new colour, radius, shadow or font-size token is introduced.

Disclosure button, copied from the verified pattern at `HotelBookingOwnership.tsx:57-76`:

```tsx
<button
  type="button"
  aria-expanded={open}
  aria-controls={panelId}
  onClick={handleToggle}
  className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] py-2 text-left text-sm font-medium leading-6 text-[color:var(--brand)] hover:text-[color:var(--brand-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
>
  <span>When am I charged?</span>
  <svg aria-hidden="true" focusable="false"
       className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
       viewBox="0 0 16 16" fill="none">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
</button>
```

`panelId` is `hotel-payment-timing-${surface}-${offerId-slug}` and must be unique per offer per surface —
several `HotelCard`s render on one page, so a constant id would break `aria-controls`.

---

## 6. Every state, rendered

Worked examples use `{Provider}` = `Hotellook`, `{Partner}` = `Booking.com` (or `booking partner` when
unresolved).

### 6.1 `not_returned` — today's universal state, and the primary gate

- Collapsed row: `Restrictions not provided · Charge timing not stated`, container `--warning-soft`, timing
  span `--text-2`.
- Panel: status `Charge timing not stated`; body `Hotellook did not state when the stay price is charged, or
  who collects it. This is not the same as paying at the property. Confirm with Booking.com before you pay.`;
  scope `Hotellook did not state which room or rate this applies to.`; cross-references per §3.8.
- No collector line, no card clause, no missing-fields list (`missingFields` renders in `partial` only —
  `not_returned` means nothing was stated, so enumerating six absences is noise).
- **Not styled as reassurance and not styled as an alarm:** `--warning-soft` container, `--text-2` body, no
  icon, no `aria-live`.

### 6.2 `partial`

Status `Charge timing partly stated`; body `Hotellook stated part of the charge timing. Not stated: who
collects it and whether a card is required at booking. Confirm with Booking.com before you pay.` Any fact that
*was* stated still renders (collector line, card clause) — partial means partly known, not unknown.

### 6.3 `explicit_none` — the only reassurance-permitted state

Status `Nothing charged before arrival`; body `Hotellook states nothing is collected and no card is charged
before you arrive.` Calm container (`--bg-raised`, `--border`). Reachable only when the adapter's capability
declares both `chargeEvent` and `cardRequiredAtBooking` true **and** both facts are asserted (§4.3 rule 3).
Unreachable in production today; reachable in the fixture set.

### 6.4 `complete`, three charge events

| Event | Status | Body | Extra lines |
|---|---|---|---|
| `at_booking` | `Charged at booking` | `Booking.com charges the stay price when you book.` | collector, card clause, scope |
| `at_property` | `Charged at the property` | `The property charges the stay price at your stay, not at booking.` | collector, card clause, scope |
| `deferred_before_arrival` | `Charged September 4, 2026` | `Booking.com charges the stay price on September 4, 2026, before you arrive.` | collector, card clause, scope |

### 6.5 `conflicting`

Status `Charge timing statements conflict`; body per §3.3; then `h4` `Provider statements` and one `<p>` per
statement, each attributed `Statement {n} — {sourceLabel}` with the verbatim `providerWording` beneath it, as
sibling elements under one heading with **no visual ranking** — mirroring
`HotelFundsPolicyPanel.tsx:357-370`. Both are `--text-2` at the same size; neither is bolded, ordered by
plausibility, or marked "likely". If a statement has no `providerWording`, its structured facts render in the
§3.3/§3.6 sentence forms instead, and the attribution line stays.

### 6.6 `loading`

Status `Checking charge timing…`; body `We are checking when the stay price is charged for this offer.`;
then the existing skeleton treatment from `HotelFundsPolicyPanel.tsx:335-341`:

```tsx
<div className="mt-4 space-y-3" aria-hidden="true">
  <div className="skeleton h-3 w-2/3 rounded-full" />
  <div className="skeleton h-3 w-full rounded-full" />
</div>
```

Container carries `role="status"`, `aria-live="polite"`, `aria-busy="true"`. No cross-references and no scope
sentence render while loading — an unknown fact gets no qualifiers.

### 6.7 `error`

Status `Charge timing could not be checked`; body `Charge timing could not be checked. This does not mean you
will not be charged at booking. Confirm with Booking.com before you pay.` Container `--error-soft` with
`--border-strong`; body text `--text-2`, **not** `--error-text` (that token is reserved for error copy on
surfaces without an adjacent permanent amber line; §5.2's interference rule applies here too).
`role="status"`, `aria-live="polite"`. The error load state is distinct from all five evidence states and is
never collapsed into `not_returned` — "we could not ask" and "they did not say" are different facts.

### 6.8 Empty

There is no separate empty state. Absent evidence is `not_returned` (§4.4). An offer with no valid price
(`PriceUnavailable`, `HotelCard.tsx:367`) renders **no** timing clause and **no** panel: an offer with no
charge amount has no charge event to describe.

---

## 7. Responsive, keyboard, screen reader

### 7.1 Breakpoints

**375px** (container query `@max-[351px]` is active on the price block):

- Single column throughout. The merged row is full-width, `line-clamp-2`, `break-words`.
- The nightly amount never wraps and never truncates — the timing row sits **below** the price block and never
  shares its grid row, so it cannot collide with the `@max-[351px]:col-span-2` full-width price variant.
- Any partner label in the panel carries `min-w-0 [overflow-wrap:anywhere]` (the existing
  `partnerLabelWrapCls` convention, `BookingFlow.tsx:81`). `Booking.com` and long unresolved hosts must not
  overflow.
- The disclosure button is full width, `min-h-11` — a 44px target.
- Panel padding `p-3.5`; sentences stack with `mt-2`.

**1280px:**

- The panel sits in the **same single-column evidence stack** as `HotelFundsPolicyPanel variant="full"`. It
  does not become a third column and does not sit beside the funds panel.
- Panel padding `sm:p-5`; heading `sm:text-lg`.
- The merged row's clamp is inactive at this width; the combined string fits one line.

**Verified at both widths for TEST:** no overlap with the permanent `Last-checked time unavailable` line, and
the two must not read as a single warning block — a screenshot check at 375px is a named TEST item.

### 7.2 The fact reaches screen readers on the collapsed card without expansion

The timing sentence is appended to the review action's composed `aria-label` (`HotelCard.tsx:763`) in fixed
position: **after `eligibilityAriaSummary`, before `providerConfirmationCopy`**.

| State | Appended sentence |
|---|---|
| `not_returned` | `{Provider} did not state when the stay price is charged.` |
| `partial` | `{Provider} stated part of the charge timing.` |
| `explicit_none` | `{Provider} states nothing is charged before you arrive.` |
| `complete` · `at_booking` | `{Partner} charges the stay price when you book.` |
| `complete` · `at_property` | `The property charges the stay price at your stay.` |
| `complete` · `deferred_before_arrival` | `{Partner} charges the stay price on {Month D, YYYY}.` |
| `conflicting` | `Provider statements about charge timing conflict.` |
| `loading` | `Charge timing is being checked.` |
| `error` | `Charge timing could not be checked.` |

`PriceUnavailable`'s `aria-label` (`:379`) is **not** extended (§6.8).

### 7.3 Live regions

`role="status"` / `aria-live="polite"` / `aria-busy` apply **only** to the `loading` and `error` load states,
matching `HotelFundsPolicyPanel.tsx:285-287`. A settled `not_returned` is a fact, not an alert, and must not
interrupt a screen-reader user scanning a list of offers.

### 7.4 Tab order

- **Collapsed card:** unchanged. The merged row is not focusable.
- **Expanded card:** … `Show details` → (panel content) → `When am I charged?` disclosure → funds-policy
  content → review action.
- **Review surface (fixed):** price → Deal Score → **timing disclosure** → funds policy → confirm/handoff
  action.

Keyboard behaviour: `Enter` and `Space` toggle the disclosure (native `<button>` semantics — no custom key
handling). Focus never moves on toggle; the panel opens directly after the button in DOM order, so the next
`Tab` lands inside it. Focus ring is `focus-visible:shadow-[var(--focus-ring)]` with
`focus-visible:outline-none`, matching the ownership disclosure. `motion-reduce:transition-none` on the
chevron. The chevron is `aria-hidden` and `focusable="false"`.

---

## 8. Instrumentation — `app/components/hotelPaymentTimingAnalytics.ts`

A sibling module to `hotelFundsPolicyAnalytics.ts`, reusing its mechanics verbatim: `IntersectionObserver` at
`threshold: 0.5`, 1,000 ms dwell, FNV-1a `boundedHash` dedupe keyed `provider:offerId:surface`,
`MAX_DEDUPE_KEYS = 1_000`, and the swallow-all `emit` wrapper. `lib/analytics.ts` is a live Postgres-backed
sink (`track()` → `sendBeacon` → `/api/analytics`, `:25-47`); `console.debug` is the development branch only
(`:62-65`). No new sink is required, and the stale "console.debug stub" claim in
`hotel-total-stay-cost/01-discovery.md:111` is **not** inherited.

| Event | Fires when | Dedupe |
|---|---|---|
| `hotel_payment_timing_summary_viewed` | timing row or panel ≥50% visible for ≥1 s, load state not `loading` | once per offer × provider × surface |
| `hotel_payment_timing_details_opened` | first closed → open transition of the disclosure | once per offer × provider × surface |
| `hotel_payment_timing_confirm_clicked` | activation of the handoff action on the review surface | not deduped |

Dimensions from `getHotelPaymentTimingAnalyticsDimensions`, shaped like
`getHotelFundsAnalyticsDimensions` (`fundsPolicy.ts:253-283`):

`timingState` (five states + `error`) · `chargeEvent` (`at_booking | at_property | deferred_before_arrival |
unknown`) · `collector` (`booking_partner | property | unknown`) · `cardAtBooking` (`true | false | unknown` —
**three-valued, never coerced to boolean**) · `missingFields` (ordered, comma-joined, `none` when empty) ·
`scope` · `provider` (lowercased, non-alphanumerics → `_`) · `surface` (`hotel_card | hotel_detail |
book_handoff`) · `eligibilityRefundability` (`restricted | clear | not_provided`), which makes the
contamination cohort segmentable in the live funnel.

`timingState` is additionally added as a dimension to the **existing** handoff-confirm event rather than
duplicating it. Analytics must never block or alter the handoff (`BookingFlow.tsx:157-163`) — the `emit`
wrapper swallows everything. **Never emitted:** raw `providerWording`, any date, any offer identifier beyond
the existing bounded hash.

**Interpretation boundaries, inherited and binding:** unexplained abandonment is never labelled
payment-timing-related; no per-session diagnosis and no dashboard tile implying causation. A missing
`_summary_viewed` means *not observed*, not *not seen*. Cohort comparison requires ≥2 populated `timingState`
values in the window; with today's 100% `not_returned` distribution it is **structurally unavailable** and must
be reported as such rather than computed against an n of one.

---

## 9. Research prototype

`app/components/research/hotelPaymentTimingFixtures.ts` + `HotelPaymentTimingPrototype.tsx`, mounted as a
sibling of `HotelContinuityPrototype` at `app/deals/[dealId]/page.tsx:433`, behind its own URL param
`timingFixture` (plus `timingDisclosure=expanded`), parsed by an allowlist `parsePaymentTimingFixture()` that
defaults to `control` — the exact shape of `parseContinuityFixture` (`hotelContinuityFixtures.ts:114-119`).
Reused conventions: the `https://example.com` research-origin guard for any source URL, the verbatim
disclaimer string (§3.1), and `track()` for prototype events. **No production code path reads these fixtures.**

| Fixture id | Evidence state | Purpose |
|---|---|---|
| `timing-control` | — | current build, no timing disclosure; the baseline arm |
| `timing-pay-now` | `complete` · `at_booking` · `booking_partner` · card required | can a participant identify money leaving today |
| `timing-at-property` | `complete` · `at_property` · `property` | correct at-property recognition when it *is* stated |
| `timing-deferred` | `complete` · `deferred_before_arrival`, dated 14 days pre-arrival, `booking_partner` | date comprehension; the expense-cutoff sub-segment |
| `timing-explicit-none` | `explicit_none` | the only reassurance-permitted state; must not be confused with `not_returned` |
| `timing-partial` | `partial`, `missingFields: ['collector','card_at_booking']` | does partial read as an open question rather than at-property |
| `timing-not-returned` | `not_returned` | **primary gate** — correct answer on all three items is "the provider didn't say" |
| `timing-conflicting` | `conflicting`, two verbatim disagreeing statements | does the traveler withhold a conclusion |
| `timing-nonrefundable-unknown` | `not_returned` **+** eligibility `Non-refundable` | **contamination case**, isolates the §1.4 inference |
| `timing-loading` | load state `loading` | load states are distinct from evidence states |
| `timing-error` | load state `error` | as above |

`timing-not-returned` and `timing-nonrefundable-unknown` differ in exactly one variable, so any comprehension
delta between them is attributable to the eligibility line alone.

The comprehension instrument, error classes and ship gate are specified in research §5.2 and are not restated
here. The gate that governs this design: **zero false-comfort errors on `timing-nonrefundable-unknown`.**

---

## 10. Acceptance criteria

### 10.1 Copy and lexicon (unit-testable)

1. Every collapsed clause in §3.2 is ≤48 characters.
2. `free`, `no charge`, `nothing`, `pay later`, `pay at the property` appear in no `not_returned`, `partial`,
   `conflicting`, or `error` string.
3. The `not_returned` body contains `This is not the same as paying at the property.` verbatim.
4. No timing string contains `$`, a percentage, or the words `deposit`, `hold`, `penalty`, `refundable`
   outside the two authored cross-reference strings in §3.8.
5. `Non-refundable describes whether you can get money back, not when it is taken.` renders whenever
   `Non-refundable` renders, in every timing state.
6. `providerConfirmationCopy` equals the §3.9 string exactly, and `reviewDisclosure` and the review
   `aria-label` both contain `when you are charged`.
7. All strings resolve from `lib/hotels/paymentTiming.ts`; no timing string is inlined in a component.

### 10.2 Normalizer (unit-testable)

8. `at_property` without `cardRequiredAtBooking` → `partial`, never `explicit_none`.
9. Capability all-false → `not_returned`; `complete` and `explicit_none` unreachable.
10. `deferredChargeOn` without the matching charge event, unparseable, or not before check-in → date dropped,
    `deferred_date` in `missingFields`, state `partial`.
11. `cardRequiredAtBooking === false` with `at_booking` → `partial` with `card_at_booking` missing.
12. One statement + a `Non-refundable` eligibility → `not_returned`, **not** `conflicting`.
13. Provenance mismatch → whole object `not_returned`.
14. `undefined` evidence → `not_returned` with `scope: 'not_returned'`.
15. No path throws; adapters return `Result<T>`.

### 10.3 Rendering

16. Collapsed card row count is unchanged at 11; the merged row renders in every combination, including
    eligibility `not_provided`.
17. The timing clause span is never `--warning` or `--error-text`.
18. Restricted-eligibility rows look unchanged from today (conditions still `--warning` text on
    `--warning-soft`).
19. All five evidence states plus `loading` and `error` render distinctly on card, expanded card and review.
20. `PriceUnavailable` offers render no clause and no panel.
21. Only existing tokens; no new colour, radius, shadow or font-size token.

### 10.4 Accessibility

22. Disclosure has `aria-expanded`, `aria-controls`, a unique `panelId` per offer per surface, `min-h-11`, and
    `focus-visible:shadow-[var(--focus-ring)]`.
23. `role="status"` / `aria-live` / `aria-busy` appear only in `loading` and `error`.
24. The §7.2 sentence is present in the review action's `aria-label`, in the specified position.
25. Review tab order is price → Deal Score → timing disclosure → funds policy → handoff.
26. 375px: no overlap, no truncated amount, `line-clamp-2` on the merged row, 44px targets.

### 10.5 Non-regression

27. No timing filter, sort, ranking input, or Deal Score contribution exists.
28. `priceBasis` remains a single-member union on both `HotelOffer` and `BookingHotelContext`.
29. Inline hotel booking hrefs gain at most six query keys; `conflicting`, retained `providerWording`, or a
    divergent `sourceLabel` force the reference path.
30. `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests` both exit 0.

---

## 11. Out-of-scope findings (recorded, not fixed)

- `Last-checked time unavailable` hardcoded in `--warning` on every offer (`HotelCard.tsx:361`, `:379`,
  `BookingFlow.tsx:356`). Owned by `hotel-price-freshness` / `provider-freshness-timestamp-clarity`.
  Interference only; §5.2's per-span colour rule works around it.
- Four divergent copies of the price-basis caption (`HotelCard.tsx:359`, `:1047`, `BookingFlow.tsx:242`,
  `app/deals/[dealId]/page.tsx:379`). The §3 copy module prevents a fifth; consolidating the four remains the
  total-stay-cost pipeline's directive.
- `HotelDecisionSummary`'s unconditional negatives — `Stay dates not provided` (`BookingFlow.tsx:339`),
  `Hotel class not provided` (`:373`), `Guest rating not provided` (`:377`). Pre-existing and app-wide on that
  surface. Consequence for TEST: **the review page cannot demonstrate that any conditional disclosure is truly
  conditional.** Timing states must be verified on the prototype surface and by unit test, not by eyeballing
  `/book`.
- The hotel search form is unreachable from `app/page.tsx`; `HotelCard` and the `BookingFlow` hotel path are
  entered only via the deal feed and deal detail. No live hotel-search traffic is available for validation.
- `getHotelPartnerIdentity` resolves a partner label from a URL host — safe as "where to confirm", unsafe as a
  collecting-party fact. DEV must leave a comment so it is never wired into `collector`.

---

**Quality bar check:** every one of the five evidence states plus both load states has final status-line copy,
final body copy, a container class, an accessible-name sentence and a fixture. 375px and 1280px behaviour,
keyboard behaviour, focus, live-region rules and tab order are specified. Cross-reference wording to all three
neighbouring dimensions is authored and conditioned. Every open decision from research §6 is answered with a
reason. No placeholder copy, no TODO, no new design token.

**Handoff:** `UI-HOTEL-PAYMENT-TIMING-01`, carrying this path. The UI ticket must create
`DEV-HOTEL-PAYMENT-TIMING-01` for the §4 contract work per the §1.1 split.

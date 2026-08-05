# UXR-HOTEL-PAYMENT-METHOD-01 — Payment-Method Acceptance Confidence — Research Brief

**Stage:** UX Research · **Ticket:** UXR-HOTEL-PAYMENT-METHOD-01 · **Priority:** P1
**Date:** 2026-08-05 · **Feature slug:** `hotel-payment-method`
**Upstream:** `docs/pipeline/hotel-payment-method/01-discovery.md`
**Downstream:** `UXDES-HOTEL-PAYMENT-METHOD-01`

---

## 1. Audit of the current implementation

Read at the worktree HEAD for this ticket (`agent/UXD-HOTEL-PAYMENT-METHOD-01`).

### 1.1 `HotelOffer` — no acceptance-shaped field exists

`lib/types.ts:751-778`. Fourteen evidence fields cover rating, amenities, access, transport, funds,
smoking, rate eligibility, admission, tax, and mandatory charges. None carries per-gate payment-method
acceptance. This confirms discovery §3.1: the gap is structural, not a missing value.

### 1.2 `HotelFundsPolicyEvidence.obligations[].paymentMethodWording` — mislabeled today

`lib/types.ts:430-435` defines `paymentMethodWording?: string` on `HotelFundsEvidenceRecord`. It is
normalized verbatim (bounded to 1,000 chars, no semantic parsing) at `lib/hotels/fundsPolicy.ts:139,172`
and rendered at `app/components/HotelFundsPolicyPanel.tsx:232`:

```tsx
{record.paymentMethodWording ? <Fact label="Payment method" value={record.paymentMethodWording} /> : null}
```

This `Fact` sits inside `ObligationCard`, whose heading is the deposit/hold mechanism
(`mechanismLabels[record.type]`, e.g. "Temporary card hold") and whose body opens with `impactCopy`
describing the *hold*, not the stay price. A traveler reading the grid has no structural cue that
"Payment method" describes the hold's applicable instrument rather than which cards the stay itself
accepts — the field sits beside "Amount" and "Authorization release" as if it were one more fact about
the same transaction the traveler is about to make. Confirms discovery §3.3 exactly as cited.

The missing-field vocabulary compounds this: `HotelFundsMissingField` includes `payment_method`
(`lib/types.ts:425`) with phrase `'which payment methods it applies to'`
(`HotelFundsPolicyPanel.tsx:67`) — grammatically ambiguous between "applies to [the hold]" and "applies
to [the stay]." No code change is required to this phrase under the relabeling directive below; the fix
is scoped to the `Fact` label and its immediate visual grouping, not the missing-field copy, which already
says "applies to" rather than "accepted."

### 1.3 Supply audit — confirmed 0% across every reachable provider, not only Hotellook

Discovery §3.4 cites Hotellook. Reading the other two reachable adapters confirms the same is true
everywhere reachable:

| Provider | File | Funds-policy call | Payment-acceptance field |
|---|---|---|---|
| Hotellook | `lib/providers/hotellook.ts:407,536` | `createNotReturnedHotelFundsPolicy('Hotellook')` (unconditional) | none |
| Booking.com (RapidAPI) | `lib/providers/bookingComHotelsRapidApi.ts:195` | `createNotReturnedHotelFundsPolicy('Booking.com')` (unconditional) | none |
| Hotelbeds | `lib/providers/hotelbeds.ts:276` | `createNotReturnedHotelFundsPolicy('Hotelbeds')` (unconditional) | none |

`grep` for `payment|creditCard|debit|prepaid|cash|deposit` across all three adapter files returns zero
hits outside the funds-policy import itself. All three set `fundsPolicy` unconditionally, not
conditionally on a real API response field — there is no branch anywhere in this codebase that could
produce a populated funds-policy record today, let alone a payment-acceptance one. This resolves the
research directive from discovery §7: **no reachable provider supplies acceptance evidence for any
gate.** §6.1 of the discovery is therefore a capability-and-honest-absence spec, not a disclosure spec —
every fact this feature introduces will render `not_confirmed` under current supply, everywhere, for
every offer.

### 1.4 `BookingHotelContext` — nineteen evidence fields, same gap

`lib/booking/config.ts:77-105` mirrors `HotelOffer`: `rateEligibility`/`rateEligibilityCapability`,
`admissionPolicy`/`admissionPolicyCapability` are threaded through as an evidence+capability pair, each
serialized as a flat JSON-in-query-param blob (`config.ts:1331-1334`) and reconstructed at
`buildBookingHotelContext` (`config.ts:1256-1263`). This is the load-bearing precedent for how this
feature's evidence should travel from offer to review page: **evidence and capability as a matched pair**,
never evidence alone, so the review surface can distinguish "no adapter can answer this" from "this
adapter can answer it and didn't."

### 1.5 Surface audit — two render points, two variants, established precedent

`app/components/HotelCard.tsx` (results list, one card per offer) renders `HotelFundsPolicyPanel`
variant=`"summary"` (`HotelCard.tsx:1011`) and `HotelAdmissionPolicyCardBlock` (`HotelCard.tsx:1124`).
`app/book/BookingFlow.tsx` (single-offer review/handoff page) renders `HotelFundsPolicyPanel`
variant=`"full"` (`BookingFlow.tsx:1313`) and `HotelAdmissionPolicySection` (`BookingFlow.tsx:426`), both
computed from a `deriveXPresentation({ evidence, capability, ... })` call local to the surface
(`BookingFlow.tsx:352-358` for admission). This establishes the codebase's two-tier disclosure pattern:
a terse per-card summary at browse time, a full panel at the single highest-stakes decision point.

### 1.6 `HOTEL_RETURN_REASONS` — confirms discovery §3.5

`app/book/BookingFlow.tsx:55-76`. Nine reasons, none naming a payment-method or card-type rejection. The
nearest is `pay_at_property_amount_unexpected` — an amount complaint, not an acceptance complaint. A
traveler who is refused at check-in because their card was not accepted has no reason value that
describes what happened to them; they must pick `other_hotel_details_mismatch` or say nothing. Confirmed
as designed, not a coincidence: every other reason in the list maps to a specific evidence dimension this
codebase already discloses (smoking, tax, mandatory charge, pay-at-property amount, availability, points).
Payment-method acceptance is the one dimension with no evidence *and* no return reason — the gap is total
in both directions.

---

## 2. Reference pattern comparison

Compared at the level of interaction pattern and information hierarchy, not visual style, per discovery
scope.

**Booking.com property page** separates "how you pay" from "what you'll need at the property" into two
distinct disclosure blocks even though both ultimately describe money leaving the traveler's account:
a payment-options block (cards/PayPal/pay-at-property accepted for the booking itself) and a separate,
often collapsed "Important information" / "You need to know" block that states, in plain sentences, when
a property requires a credit card in the guest's name for incidentals, or does not accept cash for the
deposit. The two blocks are never merged, and the second is written as a warning-toned callout that
appears **once per property page**, not once per rate.

**Google Hotels** goes further on the seam this ticket targets: individual rate cards in the price
comparison list carry no payment-instrument copy at all (avoiding discovery's habituation failure), but
the property's "About this property" panel — reached once, not per rate — has a dedicated line item under
"Guest requirements" that states card-at-check-in requirements as a fact separate from price and separate
from deposit amount.

**The interaction-pattern delta, stated precisely:**

| Dimension | Reference pattern | expaify today |
|---|---|---|
| Where the property-requirement fact lives | Its own labeled block, once per property, not attached to price or deposit amount | Nowhere — no field exists |
| Repetition | Once per property/offer review, never once per list row | The one method-shaped string that exists (`paymentMethodWording`) is only ever attached to a deposit obligation, which *would* repeat per card summary if surfaced there |
| Labeling | Explicit: "what you'll need at the property" vs. "how you pay for the booking" | Ambiguous: a single "Payment method" fact label inside a deposit card, with no obligation/acceptance distinction |
| Absence handling | Absent means the block does not render at all for that property (references never disclose "we don't know") | expaify's convention elsewhere (admission, rate eligibility) is to render an explicit not-confirmed state rather than hide — the stricter, more honest pattern, and the one this feature should keep |

The directive this comparison produces is **not** "hide the fact when absent" (that would regress
expaify's existing honesty convention relative to the references) — it is "give the fact its own block,
place it once per review, and never let it share a label or a card with the deposit disclosure." That is
consistent with, and slightly stricter than, both references.

---

## 3. Composition against the two unimplemented sibling specs

Both `hotel-payment-timing` and `hotel-payment-options` terminate at UXDES (discovery §3.2, confirmed:
`git log --oneline -- docs/pipeline/hotel-payment-timing docs/pipeline/hotel-payment-options` shows UXD →
UXR → UXDES only, no UI/DEV commits for either slug). Reading both `03-design.md` files in full:

### 3.1 `hotel-payment-timing/03-design.md` §4.1 — types this feature must not fork

```ts
export type HotelChargeEvent = 'at_booking' | 'at_property' | 'deferred_before_arrival';
export type HotelChargeCollector = 'booking_partner' | 'property';
export interface HotelPaymentTimingStatement {
  chargeEvent?: HotelChargeEvent;
  collector?: HotelChargeCollector;
  cardRequiredAtBooking?: boolean;   // G1 only — "is a card required to hold/pay at booking"
  deferredChargeOn?: string;
  providerWording?: string;
}
```

`cardRequiredAtBooking` is explicitly a **G1** fact ("Provider-stated only... valid only with
chargeEvent"). This ticket's cue 1, "credit card required at the property," is a **G3/G2** fact about a
different instrument-presentation event (the desk, not the booking). These are not the same field under
two names — they can legitimately disagree (a stay with no card required at booking can still require one
at the property) — and discovery §2 makes that disagreement the entire subject of the ticket. **This
feature does not extend or reuse `cardRequiredAtBooking`.** It does reuse the `HotelChargeCollector`
vocabulary (`booking_partner` / `property`) as the natural type for "which gate" wherever this feature
needs to name a gate's collector, so a later merge of the two specs does not have to reconcile two
different two-value enums meaning the same thing.

### 3.2 `hotel-payment-options/03-design.md` §2 — the type this feature is closest to, and why it still doesn't cover the gap

```ts
export type HotelStayPaymentMethodCategory =
  'credit_card' | 'debit_card' | 'cash' | 'digital_wallet' | 'bank_transfer' | 'other';
export interface HotelStayPaymentMethodEvidence {
  state: 'complete' | 'partial' | 'not_returned' | 'conflicting';
  accepted: readonly HotelStayPaymentMethod[];
  notAccepted?: readonly HotelStayPaymentMethod[];
  purpose: 'stay_price';   // <- fixed literal, by design
  collector?: HotelChargeCollector;
  ...
}
```

§2.1 rule 4 of that spec is explicit: *"Method evidence always has `purpose: 'stay_price'`; guarantee,
deposit, authorization, cancellation, and no-show methods are excluded."* That is a deliberate scope
fence drawn by that spec's own designer, and it places G3 (the incidental/deposit hold, tested against
whatever instrument is physically presented at the desk, independent of how the stay price itself was
paid) entirely outside `HotelStayPaymentMethodEvidence`'s purpose. It also excludes G2-as-tested-alongside-G3
where they share one desk (discovery §2, final paragraph). **This feature composes over
`HotelStayPaymentMethodCategory`'s vocabulary** — `credit_card` / `debit_card` / `cash` are reused
verbatim as three of this feature's four instrument classes — **but does not reuse
`HotelStayPaymentMethodEvidence` itself**, because that type's `purpose: 'stay_price'` literal makes it
structurally incapable of expressing a G3 fact. `digital_wallet` and `bank_transfer` are correctly excluded
per discovery §6.1's cut list (no acceptance data exists for either; an unknown-state row per class is
attention cost with no decision value). `prepaid_card` is **not** in the sibling enum and must be added by
this feature — sibling's category list was drawn for stay-price payment plurality, where prepaid behaves
like debit; this ticket's decision (§6.1 cue 2) treats prepaid as its own class precisely because it is the
instrument most likely to diverge from debit at G3.

### 3.3 Net composition decision

This feature is **greenfield** at the type level (confirmed by §1.1/§1.3 above) but **must**:
- reuse `HotelChargeCollector` (`booking_partner` | `property`) wherever a gate's collector needs naming,
- reuse `credit_card` / `debit_card` / `cash` as three of its four instrument-class literal values, adding
  a fourth, `prepaid_card`,
- reuse `HotelFundsEvidenceScope` for its own `scope` field, matching the existing `property | room | rate
  | selected_stay | not_returned` vocabulary used by funds policy, rate eligibility, and (via
  `HotelDocumentScope`'s narrower cousin) document readiness,
- follow the `HotelAdmissionPolicyEvidence` / `HotelAdmissionPolicyCapability` pairing shape (§1.4 above)
  rather than the funds-policy shape, because this feature's three facts (card-required, four instrument
  classes, gate-divergence) are fixed-cardinality per-offer facts like admission's four families, not an
  open list of obligations like funds policy's `obligations[]`.

Neither sibling spec needs to be implemented for this feature to ship. Neither is superseded — both remain
valid, unimplemented, and this feature's vocabulary choices are made so that implementing either later does
not require renaming anything introduced here.

---

## 4. The exact gap, stated once

| | Current code | Reference pattern | Delta |
|---|---|---|---|
| G1 (booking) card requirement | Not disclosed (0% supply; `hotel-payment-timing` spec exists, unimplemented) | Disclosed once per property, separate block | No change owned by this ticket |
| G2/G3 (property) card requirement | Not disclosed. No type exists to hold it. | Disclosed once per property, separate block, warning-toned | This ticket introduces cue 1 |
| G2/G3 instrument classes accepted | Not disclosed for the stay; the one method-shaped string that exists is mislabeled as if it were this | Disclosed once per property as a short list | This ticket introduces cue 2, and fixes the mislabel (§1.2) |
| G1-vs-property divergence | Not nameable — no field distinguishes the two gates at all | Implicit in reference sites via separate blocks; not an explicit fact there | This ticket introduces cue 3 as an explicit fact, stricter than either reference |
| Return-reason attribution | Payment rejection is unattributable (§1.6) | N/A (references do not expose return-reason taxonomies) | This ticket adds one `HotelReturnReason` value |

---

## 5. Directives for UX Design (UXDES)

1. **Introduce the fact pair, never the string.** `HotelPaymentAcceptanceEvidence` /
   `HotelPaymentAcceptanceCapability`, shaped like `HotelAdmissionPolicyEvidence` /
   `HotelAdmissionPolicyCapability` (§3.3), carrying exactly three fixed-cardinality facts: card-required-
   at-property (tri-state), four instrument classes each tri-state (`credit_card`, `debit_card`,
   `prepaid_card`, `cash`), and gate-divergence (tri-state, vocabulary `same | differs | not_confirmed`).
   `not_confirmed` is a rendered value, not an omitted row — unlike the admission-family precedent (which
   drops a family row entirely when absent), every one of the six facts must always render something,
   because a first-time traveler cannot distinguish "not asked" from "asked, no restriction" unless the
   product says so explicitly (discovery §5, constraint 2).

2. **One panel, one mount point, never per-card.** Design the full panel for `BookingFlow.tsx` only,
   directly adjacent to (immediately after) the existing `HotelFundsPolicyPanel` full-variant mount
   (`BookingFlow.tsx:1313-1326`), so the G1/G3 seam and the deposit disclosure sit next to each other
   instead of on separate pages. Do **not** design a per-card summary chip for `HotelCard.tsx` — constraint
   3 (discovery §5) forbids a per-result warning-toned addition at 0% supply, and §1.5's two-tier pattern
   only requires a summary chip when the summary would say something the full panel doesn't; at universal
   `not_confirmed`, it would not.

3. **Relabel `paymentMethodWording` in place, scoped narrowly.** In `HotelFundsPolicyPanel.tsx`'s
   `ObligationCard` (`:219-244`), change the `Fact` label at line 232 from `"Payment method"` to a label
   that binds the fact to the obligation, e.g. `"Applies to this {mechanism}"` (resolved per record type —
   "Applies to this hold" / "Applies to this deposit" / "Applies to this refundable amount" — reusing the
   existing `mechanismLabels` lowercase forms already in scope at that call site). Do not change the
   `paymentMethodWording` field name, its normalizer, or its tests — this is a display-layer fix only, and
   changing the field name would break the `missingFields: 'payment_method'` contract for no benefit.

4. **New `HotelReturnReason` value**, inserted immediately after `pay_at_property_amount_unexpected`
   (`BookingFlow.tsx:60-61`) so the two amount/method siblings sit together: value
   `pay_at_property_method_not_accepted`, label `"My card or payment method was not accepted at the
   property"`. This is the cheapest instrument in the pipeline (discovery §3.5) and has no dependency on
   the evidence work — it should ship even if the evidence panel is deferred.

5. **Capability-gated, all-false today, wired through all three adapters.** Export
   `HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED` (all three capability flags `false`) from
   `lib/hotels/paymentAcceptance.ts`, and wire it into `hotellook.ts`, `bookingComHotelsRapidApi.ts`, and
   `hotelbeds.ts` exactly where `HOTEL_ADMISSION_POLICY_UNSUPPORTED` is wired today (§1.3), so "we cannot
   check this" is a real, testable, per-provider declaration from day one rather than an implicit
   consequence of an absent field.

Design must cover, at minimum: `loading`, `error`, `ready` (all six facts `not_confirmed` — today's
universal render), `ready` (mixed — some facts confirmed, illustrating what the panel looks like once any
future provider reports something), and `conflicting` (two adapters, or one adapter's own repeated fetch,
disagreeing on the same fact) for at least the card-required fact. Mobile 375px and desktop 1280px for
each. Keyboard and screen-reader pass for the panel and its confirm-with-partner link, matching the
existing `HotelFundsPolicyPanel`/`HotelAdmissionPolicy` accessibility contract (`aria-live`, `aria-busy`,
`role="status"` on loading/error only).

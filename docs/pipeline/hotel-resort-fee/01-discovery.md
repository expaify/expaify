# UXD-HOTEL-RESORT-FEE-01: Mandatory Property-Fee Visibility Discovery

Date: 2026-07-31
Stage: UX Discovery (UXD)
Priority: P0
Persona: Senior UX Strategist
Ticket: UXD-HOTEL-RESORT-FEE-01
Surfaces: hotel result comparison (`HotelCard` collapsed) → detail review (`HotelCard` expanded, `app/deals/[dealId]`) → booking handoff (`app/book/BookingFlow.tsx`)
Output of this stage: this document. Handoff: `UXR-HOTEL-RESORT-FEE-01`.

---

## 0. Scope Boundary — Read Before Anything Else

Three pipelines have already touched hotel price disclosure. This ticket is not a
re-run of any of them, and the boundary is the most important thing this document
establishes.

| Pipeline | What it owns | Status here |
|---|---|---|
| `total-stay-cost/` (2026-07-21) | `nightly × nights` subtotal, shared fallback copy, **explicit refusal to publish a generic resort-fee range** (directive 5) | Inherited. **Directive 5 is upheld and not reopened.** |
| `hotel-total-stay-cost/` (2026-07-29) | Four-class cost-knowledge model, occupancy sentence, provider-attribution rule | Inherited. This ticket adds no fifth class to `HotelStayCostState`. |
| `hotel-rate-inclusions/` (2026-07-30) | What the rate price *already buys* (breakfast, Wi-Fi, parking) — inclusion, rate-scoped | Adjacent. Inclusions answer "what do I get." This ticket answers "what am I still forced to pay." |

**The delta owned here:** the prior work ruled out estimating a fee *amount* and
correctly stopped there. It never addressed the **obligation** — that a charge
exists at all, that it is not optional, and that it is collected at a different
time by a different party than the price expaify displays. Existence and
mandatoriness are separable from amount, and are disclosable without any amount
data. That separation is this ticket's entire contribution.

**Hard line for every downstream stage:** nothing in this pipeline may produce,
estimate, interpolate, or benchmark a fee amount. If a provider returns an
amount, it is passed through with attribution. If it does not, the disclosure is
qualitative. Any directive that reintroduces a market-average resort fee figure
violates inherited directive 5 and must be rejected at review.

---

## 1. Problem Statement

**A traveler comparing expaify hotel results is shown a nightly rate, a Deal
Score computed from that rate, and a panel headed "Additional funds at the
property" that can state the provider reports none — while a mandatory,
non-refundable destination or resort fee charged at check-in remains
structurally invisible to expaify, so the traveler ranks and selects on a number
that is not the number they will pay and cannot tell whether expaify checked.**

The failure is not that expaify lacks fee amounts. It is that expaify has no
representation for *non-refundable mandatory charges collected by the property*
anywhere in its type system, so the absence of that data is indistinguishable
from its absence in reality — and on one surface it is actively rendered as
reassurance.

---

## 2. Who Is Affected, And Where

**Who:** any traveler comparing hotels in a market where mandatory property fees
are common — U.S. resort destinations, Las Vegas, Orlando, Hawaii, and a growing
set of urban "destination fee" properties. The traveler is not a specialist;
they read the largest number on the card as the price and the Deal Score as a
verdict on it.

Sharpest exposure is the **price-sensitive comparison shopper**, because the
harm scales with how carefully they compare. A shopper who sorts by price and
picks the cheapest of two rates $20/night apart is exactly the shopper a
$45/night resort fee inverts. Diligence is punished.

**Where it breaks, step by step:**

### 2.1 Result comparison — `HotelCard.tsx:355-371` (collapsed card)

`Price` renders three lines under the rate: `per night before taxes and fees`,
`Rate from {providerName}`, `Last-checked time unavailable`. The fee disclosure
is the single word "fees," folded into a phrase whose other term ("taxes")
carries no expectation of a separate collection event. Nothing distinguishes
*percentage taxes added to the rate at booking* from *a flat mandatory charge
collected by a different party at check-in*. These are different obligations with
different payees and different timing, and they share one word.

Two cards side by side are ranked on `pricePerNight` alone
(`lib/types.ts:562`). The comparison is therefore valid only if the fee is
identical at both properties — which is precisely the assumption that fails in
markets where fees exist at all.

### 2.2 Detail review — `HotelCard.tsx:1067-1073` ("Price scope") and the funds panel

Expanding the card yields a `Price scope` block that repeats the same string
verbatim: `per night before taxes and fees`. Deliberate review returns zero new
information about fees. The expand gesture is a request for detail and it is
answered with the collapsed copy.

**The active defect is below it.** `HotelFundsPolicyPanel`
(`HotelCard.tsx:1075+`) renders under the heading **"Additional funds at the
property"** (`HotelFundsPolicyPanel.tsx:328`). Its obligation model
(`lib/types.ts:262-265`) is:

```
HotelFundsObligationType =
  | 'authorization_hold'
  | 'refundable_deposit'
  | 'other_refundable_obligation'
```

All three members are refundable. Every summary string reinforces it — *"Not
part of the stay price"*, *"may be refundable under the provider's stated
conditions"* (`HotelFundsPolicyPanel.tsx:128-130, 176-178`). A mandatory
non-refundable resort fee is not expressible in this model.

Yet in the `explicit_none` state the panel renders:

> **Additional funds at the property**
> The provider reports no deposit or incidental hold for this property.

A traveler reads a heading that names their exact question — money owed at the
property — and a body that answers "none reported." The scoping qualifier
("deposit or incidental hold") is doing load-bearing work that no shopper will
parse. **This is not a gap. It is false reassurance produced by a heading whose
scope is wider than its model.** It is the most defensible entry point for this
work and the reason the ticket is P0.

### 2.3 Booking handoff — `BookingFlow.tsx:1061`

The accessible name on the outbound CTA reads: *"The selected nightly rate is
$X, per night before taxes and fees. **The final total may differ.**"* This is
the last thing expaify says before the traveler leaves. "May differ" is
symmetric and non-committal — it does not distinguish a rounding difference from
a mandatory $50/night charge, and it does not tell the traveler *what to go look
for* on the partner site. The handoff is where a one-line, specific instruction
would convert a vague disclaimer into a check the traveler can actually perform.

### 2.4 The precedent that proves the gap is an oversight, not a decision

`HotelPetPolicy.tsx:9` already models exactly the missing concept, scoped to one
charge type:

```
PetPolicyFeeStatus = 'free' | 'mandatory_known' | 'mandatory_unknown'
                   | 'may_apply' | 'unknown' | 'unconfirmed'
```

and renders, at `:247`: *"A mandatory pet charge applies; amount was not
provided."* — a mandatory, non-refundable, amount-free disclosure that ships
today. The `mandatory_unknown` member is the precise shape this ticket needs,
already proven in this codebase, already accepted by review. expaify can say
"mandatory charge, amount unknown" about a dog and cannot say it about a $50/night
resort fee. Downstream stages should treat this as strong evidence that the
disclosure is buildable and stylistically settled, not as license to copy the
enum wholesale — property-scoped fees have different scope and timing semantics
than a per-pet charge.

---

## 3. Measurable Signals That The Problem Exists

Grouped by whether they are observable in the repo today or require
instrumentation. The instrumented set is the ticket's requested measurement of
"fee-related abandonment and unexpected-cost concerns."

### 3.1 Observable now — static, verifiable, no instrumentation

| # | Signal | Evidence |
|---|---|---|
| S1 | No mandatory-property-fee field exists in any shared type | `lib/types.ts` — `HotelOffer` (`:556-579`) carries `pricePerNight` and `priceBasis` only; no `resortFee`, `destinationFee`, `mandatoryFees`, or `payAtProperty` member exists in the file |
| S2 | The only fee vocabulary is one literal token | `priceBasis?: 'per_night_before_taxes_fees'` (`lib/types.ts:563`) — one enum member for two distinct obligation classes |
| S3 | The disclosure string is duplicated across 4 render sites and 3 tests | `HotelCard.tsx:365`, `:782`, `:1069`; `deals/[dealId]/page.tsx:379`; `BookingFlow.tsx:248`; `DealFeed.tsx:1747` |
| S4 | The funds model cannot express a non-refundable charge | `lib/types.ts:262-265` — all three obligation types are refundable |
| S5 | `explicit_none` renders a scope-mismatched all-clear | `HotelFundsPolicyPanel.tsx:328` heading vs. `:140` body |
| S6 | No provider adapter returns fee data | `lib/providers/hotellook.ts` — reads `priceFrom` only (`:414-421`, `:499`); the adapter is documented dead-API and returns empty |
| S7 | Expanding the card adds zero fee information | `HotelCard.tsx:1067-1069` repeats `:365` verbatim |
| S8 | Deal Score scores an incomplete price | `lib/scoring/scoreDeal.ts` consumes the nightly figure only; a "Great" verdict on a fee-bearing property compares a partial price to a baseline of partial prices |

### 3.2 Requires instrumentation — the measurement UXR must specify

The repo already has the analytics convention to extend: `emit(event, props)`
with `hotel_*` names and offer/provider/surface dimensions
(`hotelFundsPolicyAnalytics.ts:13, 40, 72`; `hotelAdmissionPolicyAnalytics.ts:76`).
Four measures, in priority order:

- **M1 — Handoff-stage abandonment delta.** Handoff→return-without-progress
  rate for offers in high-fee markets vs. matched offers in low-fee markets.
  Isolates cost discovered after leaving expaify.
- **M2 — Detail-expand-then-exit.** Rate of expand → no handoff on the same
  offer. Today the expand yields no new fee information (S7); if this cohort is
  elevated, the expand is failing a question it visibly invites.
- **M3 — Funds-panel `explicit_none` handoff rate.** Compare handoff and return
  behaviour for offers rendering the false-reassurance state (S5) against
  `not_returned`. A *higher* handoff rate on `explicit_none` followed by a
  *higher* abandonment rate is the direct fingerprint of misplaced confidence,
  and is the single most decision-relevant number in this list.
- **M4 — Re-search after handoff.** Return to expaify and re-run the same
  criteria within one session; a proxy for "the price wasn't what I was told."

**Constraint on M1–M4:** none of these individually proves fees are the cause;
they are correlational. UXR must state that the disclosure hypothesis is
justified by the static signals S1–S8 — which are certain — and that M1–M4
size the problem and validate the fix. Do not let a design decision block on
instrumentation that does not exist yet.

---

## 4. Constraints The Solution Must Respect

### C1 — Explicit provider evidence only. No estimation, ever.
No market averages, no per-market defaults, no "resort fees are typically
$30–50," no inference from star rating, property name, or destination. If a
provider returns an amount, display it with source attribution and scope. If it
does not, the disclosure is qualitative and says so. This upholds inherited
directive 5 (`total-stay-cost/02-research.md:134`) and the repo's evidence
contract, under which every hotel policy surface carries `sourceLabel` and
`scope` (`lib/types.ts:299-322`). *Data integrity.*

### C2 — Mandatory and optional are never merged.
A resort fee a guest cannot decline and a parking charge they can is not the
same fact and must not share a container, a heading, or a tone. Existing
optional-charge surfaces — `HotelParking`, `HotelRateRestrictions`, and rate
inclusions — are not extended to carry mandatory fees, and mandatory fees do not
absorb optional ones. The unknown case gets its own explicit state: *not
provided* is distinct from both *none* and *charged*, exactly as
`HotelFundsPolicyState` already distinguishes `explicit_none` from
`not_returned` (`lib/types.ts:255-260`). *Data integrity, trust.*

### C3 — Do not duplicate total-stay-cost treatment.
No fifth member on `HotelStayCostState`. No second stay-total number. No
recomputation of `nightly × nights`. Mandatory property fees are an **obligation
disclosure**, not a cost calculation — they are owed to a different payee at a
different time than the rate expaify shows, and folding them into a total would
assert a precision expaify does not have. If a fee amount ever arrives from a
provider, whether it may enter the stay total is a decision for the
`hotel-total-stay-cost` pipeline, not this one. *Scope, data integrity.*

### C4 — Accessible and usable at 375px.
The disclosure competes for space on a card that already renders price, Deal
Score, rating, amenities, parking, pet policy, smoking policy, access evidence,
price scope, and funds policy. It must not overlap, must not push the price or
CTA below the fold on mobile, must be reachable in tab order, must carry a focus
ring, and must be announced by screen readers in the same `aria-label` sentence
that already describes the rate (`HotelCard.tsx:782`) — not as a separate
orphaned region. *Accessibility, brand.*

### C5 — No new blocking network work on the results path.
Results render must not wait on a fee lookup. If evidence arrives
asynchronously, it follows the established loading/ready/error pattern
(`HotelAccessEvidenceState`, `HotelFundsPolicyLoadState`) with a non-committal
loading state — never an optimistic "no fees" default. *Performance.*

---

## 5. Success Statement

**This is solved when a first-time user comparing two hotel results can tell,
before leaving expaify, whether each property charges a mandatory fee at
check-in — or whether expaify does not know — without seeing an estimated
amount, without mistaking a refundable deposit statement for an all-clear on
mandatory fees, and without the rate they compared on being contradicted at the
property.**

Concretely, all five must hold:

1. Every hotel result carries one of three states for mandatory property fees:
   **charged** (provider-stated), **none** (provider-stated), or **not
   confirmed** (default). "Not confirmed" is the honest default and is never
   silently rendered as "none."
2. The funds panel's `explicit_none` state no longer reads as a blanket all-clear
   on money owed at the property. Its heading, body, or both are rescoped so a
   non-specialist cannot read "no deposit or incidental hold" as "no mandatory
   fee." **This alone is a shippable trust fix and does not depend on any new
   provider data.**
3. Comparing two results, the traveler can see which of them expaify has fee
   evidence for. A confirmed-fee property and an unconfirmed one are visibly
   different.
4. The booking handoff replaces "the final total may differ" with a specific,
   actionable check naming mandatory property fees.
5. No surface displays a fee amount expaify did not receive from a provider.

**Explicit non-goals:** a fee amount on any surface without provider evidence; a
fee-inclusive total; a fee filter or sort control; adjusting the Deal Score for
fees. S8 is recorded as a real consequence of the data gap and referred to the
scoring pipeline — it is out of scope here and UXR must not open it.

---

## 6. The Shippable Disclosure Hypothesis

Stated as one testable claim for UXR to validate against reference patterns and
the current implementation:

> **Hypothesis.** Disclosing the *existence and mandatoriness* of property-charged
> fees — as a three-state, amount-free, provider-attributed fact — will reduce
> post-handoff abandonment and unexpected-cost complaints more than any
> improvement to amount precision would, because the traveler's decision-breaking
> surprise is *that a charge exists at all*, not that it was mis-sized. The
> highest-value single change requires no new provider data: it is rescoping the
> `explicit_none` funds-panel state so it stops answering a question it was never
> scoped to answer.

**Why this is shippable rather than blocked.** The hypothesis decomposes into two
tiers, and tier 1 has no external dependency:

- **Tier 1 — UI-only, no provider data required.** Rescope the `explicit_none`
  copy (S5); differentiate the fee statement from the tax statement in the
  `Price scope` block so the expand earns the gesture (S7); make the handoff
  instruction specific (§2.3). Every one of these is a copy and scoping change
  to code that exists. This is what makes the ticket shippable today.
- **Tier 2 — DEV-gated, specified but not reachable.** A three-state
  property-fee evidence shape on `HotelOffer`, populated by whichever adapter
  lands real rate data. `lib/providers/hotellook.ts` is a dead API returning
  empty (S6), so no offer can currently reach a `charged` or `none` state.

UXDES must specify all three states in full — the model is only correct as a
set, and the `hotel-total-stay-cost` spec sets the precedent for specifying
DEV-gated branches completely while naming them unreachable (`03-design.md` §0).
TEST must not fail the unreachable states. UXR must carry this reachability
table forward explicitly so the boundary survives the handoff.

---

## 7. Open Questions For UXR

1. What do Booking.com and Google Hotels do at the **result-comparison** level —
   not detail level — when a mandatory fee is known versus unknown? Specifically:
   is the unknown case disclosed at all, or silently omitted? expaify's default
   state is unknown, so the unknown treatment is the one that matters most and
   is the one competitive teardowns usually skip.
2. Does the funds-panel heading get rescoped ("Deposits and holds") or does the
   panel's model widen to carry a non-refundable member? The first is a
   contained copy change; the second changes `HotelFundsObligationType` and is a
   DEV contract change. Recommend the narrower one unless evidence says
   otherwise — but state the recommendation, do not leave it open.
3. Does `PetPolicyFeeStatus` generalize into a shared mandatory-charge status
   type, or does a property-fee status stay separate? Note the scope difference:
   pet fees are conditional on the guest bringing a pet; property fees apply to
   every guest unconditionally.
4. Is there a defensible **market-level** disclosure — "properties in this area
   commonly charge a resort fee" — that respects C1 because it makes no
   per-property claim? Answer this explicitly. It sits at the boundary of
   inherited directive 5 and will otherwise be reinvented downstream. UXD's
   position: likely **no**, because a card-level claim reads as a property-level
   claim regardless of its wording, but UXR owns the final call and must record
   the reasoning either way.

---

## 8. Handoff

Per the pipeline contract, `UXR-HOTEL-RESORT-FEE-01` is created before this
stage finishes. UXR must read, in order:

1. This document.
2. `docs/pipeline/total-stay-cost/02-research.md` — directive 5 is settled.
3. `docs/pipeline/hotel-total-stay-cost/03-design.md` — the four-class cost model
   and its DEV-gated-branch precedent.
4. `docs/pipeline/hotel-rate-inclusions/02-research.md` — the adjacent inclusion
   boundary.

UXR must not re-audit ground those documents cover, must not reopen the fee-range
question, and must produce 3–5 testable directives that separate Tier 1 (UI-only,
shippable now) from Tier 2 (DEV-gated).

This stage produced documentation only. No source files were modified.

# UXD-HOTEL-PAYMENT-TIMING-01 — Hotel Payment Timing Clarity

**Stage:** UX Discovery · **Ticket:** UXD-HOTEL-PAYMENT-TIMING-01 · **Priority:** P1
**Date:** 2026-07-29 · **Feature slug:** `hotel-payment-timing`
**Downstream:** `UXR-HOTEL-PAYMENT-TIMING-01`

---

## Scope Boundary: What This Feature Is And Is Not

Three hotel money dimensions already have pipelines. This one is the fourth, and it is the only one that
asks **when the stay price leaves the traveler's account, and who takes it**.

| Dimension | Question | Owner |
|---|---|---|
| Total stay cost | *How much*, for how many nights, including what | `docs/pipeline/hotel-total-stay-cost/` |
| Deposits & holds | Is money *temporarily restricted* on my card, and released when | `docs/pipeline/hotel-deposit-holds/` |
| Cancellation | What does it cost to *change my mind*, and by when | `docs/pipeline/hotel-cancellation-clarity/` |
| **Payment timing (this ticket)** | **When am I charged the stay price — now, at the property, or on a later date — and by whom** | this doc |

These are not the same question and the current product answers none of them by conflating all of them
into one caption. Payment timing is separable and testable on its own: a traveler can know the exact total
(`$840`), know the deposit rules, know cancellation is free, and *still* not know whether $840 leaves their
account today or at checkout in five weeks. That gap is what this ticket scopes.

Explicitly **out of scope**: the amount and its composition (total-stay-cost), incidental/authorization
holds (deposit-holds), penalty amounts and deadlines (cancellation-clarity), currency of settlement
(`docs/pipeline/local-currency-payment/`), and rate booking restrictions (`docs/pipeline/rate-eligibility/`).
Payment timing must *reference* those neighbours without absorbing them.

---

## User Pain Point

**A traveler comparing hotel offers on expaify cannot tell whether an offer charges the full stay price at
booking, at the property, or on a deferred date before arrival — so at the moment of provider handoff they
are being asked to commit without knowing whether they are about to spend money or merely reserve a room.**

This is a trust defect, not a feature gap. Payment timing changes the decision itself: it determines cash-flow
timing, which card earns the points, whether a travel budget is hit this month or next, and how reversible the
click feels. Two offers at an identical nightly rate are materially different products if one debits today and
one debits at checkout — and expaify currently renders them identically.

---

## Who Is Affected, And At What Step

Affected user: **a first-time, price-led traveler**, comparing 3–10 hotel offers with no prior relationship
with the booking partner. Highest-severity sub-segments are travelers on a tight monthly cash position
(pay-now is a real constraint, not a preference) and business travelers who must know whether a charge lands
before or after an expense-report cutoff.

Three surfaces, in decision order:

1. **Offer card — collapsed** (`app/components/HotelCard.tsx`, `Price`, lines 349–365). This is where offers
   are compared. It renders `Nightly rate`, the amount, `per night before taxes and fees`,
   `Rate from {provider}`, and `Last-checked time unavailable`. Nothing about charge timing. A traveler
   scanning a list has no signal on which to prefer or discount a pay-now offer.
2. **Offer card — expanded / hotel detail** (`HotelCard.tsx` lines 1045–1051, the `Price scope` panel; deal
   detail `app/deals/[dealId]/page.tsx:379`). This is where a hesitant traveler goes for the answer. The
   `Price scope` panel restates the same caption — `per night before taxes and fees` — then `Rate check`.
   The traveler asked "when am I charged?" and received a restatement of what the number covers.
3. **Booking review, immediately before handoff** (`app/book/BookingFlow.tsx`, `HotelDecisionSummary`,
   lines 319–385, plus the `Provider handoff` block at `HotelCard.tsx:1067-1068`). Last controllable moment.
   The disclosure here is `Provider confirms final total, taxes, fees, room availability, cancellation policy,
   and terms.` (`HotelCard.tsx:747`) — a six-item enumeration that **omits payment timing entirely**. The
   product does not disclose it, and does not promise the partner will either.

---

## Current Implementation Signal

Every claim below is from source read in this worktree.

### 1. The data layer has no representation of payment timing at all

`HotelOffer` (`lib/types.ts:474-495`) carries `pricePerNight: Money`, `priceBasis?:
'per_night_before_taxes_fees'`, `fundsPolicy`, `rateEligibility`, `documentReadiness`, `smokingPolicy`,
`amenityEvidence`, `accessEvidenceState`. There is no `paymentTiming`, no `prepaid`, no `payAtProperty`, no
`chargeAt`, no `cardRequiredAtBooking`. A repo-wide grep for
`payNow|payAt|prepay|prepaid|paymentTiming` returns only deposit-policy and rate-eligibility files —
i.e. the neighbouring dimensions, never this one.

`BookingHotelContext` (`lib/booking/config.ts:52-77`) — the payload that survives the card → review → handoff
transition — mirrors that absence exactly. It carries `fundsPolicy` and `rateEligibility` across the boundary
and has no field in which a payment-timing fact could travel even if a provider returned one.

`HotelProvider` (`lib/types.ts:532-541`) exposes `searchHotels` and `checkDocumentReadiness`. There is no
method, and no field in `HotelSearchPage`, through which timing could be sourced. **The absence is structural,
not a rendering oversight** — which fixes the stage boundary: the contract change is DEV work, not UI work.

### 2. The one money-timing string in the product means something else

`lib/hotels/rateEligibility.ts:82` returns the label `'Non-refundable'` for a restricted `refundability`
family, surfaced on the card via `HotelCardEligibilityLine` (`HotelCard.tsx:906`) and at handoff via
`HotelRateRestrictionsSection`. This is the product's only visible string in the neighbourhood of "when does
my money move," and it is about **reversibility, not timing**.

This is the sharpest measurable risk in the feature, because the conflation runs both ways:

- `Non-refundable` is widely read as *"they charge me now"* — often true in the market, but expaify has no
  evidence for it and never asserted it.
- Silence, or a `clear` refundability state, is read as *"I'll pay at the property"* — the more damaging
  direction, because it manufactures reassurance from missing data.

So the product's current effective disclosure of payment timing is an **inference the traveler draws from an
adjacent field**, with no evidence behind it. UXR must treat "does the eligibility line leak a false timing
belief?" as a comprehension item, not a copy nit.

### 3. Every price caption describes scope and is silent on timing

The string `per night before taxes and fees` appears in four places — `HotelCard.tsx:359` (collapsed),
`HotelCard.tsx:1047` (`Price scope` panel), `BookingFlow.tsx:242` (`getHotelPriceBasisLabel`), and
`app/deals/[dealId]/page.tsx:379`. It answers *what the number covers*. Nothing on any surface answers
*when the number is collected*. The `priceBasis` union has exactly one member, so the type system cannot
currently express a prepaid-vs-at-property basis even as a variant of price scope.

### 4. The handoff disclosure enumerates six things and excludes this one

`providerConfirmationCopy` (`HotelCard.tsx:747`) — "final total, taxes, fees, room availability,
cancellation policy, and terms" — is also folded into the review action's `aria-label`
(`HotelCard.tsx:763`). An enumeration is read as exhaustive. Payment timing is therefore not just
undisclosed; it is implicitly excluded from what the traveler is told to expect at the partner.

Relatedly, `BookingFlow.tsx:82-86` defines `trustClaims` including `'No payment details are collected on
this page'` — but that block belongs to the flight/Duffel verify path (`'Required by Duffel for this booking
request'`). The **hotel** review path has no equivalent statement. The one place in the codebase that says
plainly where payment does and does not happen is unavailable on the surface that needs it most.

### 5. The correct evidence pattern already exists twice in this repo

`HotelFundsPolicyEvidence` (`lib/types.ts:314-322`) models a provider money obligation the provider may or
may not document: `state: 'complete' | 'partial' | 'explicit_none' | 'not_returned' | 'conflicting'`, plus a
typed amount union, a basis, a `scope`, a `sourceLabel`, `fetchedAt`, and ordered `missingFields`
(`lib/hotels/fundsPolicy.ts:13-28`). `HotelRateEligibilityEvidence` (`lib/types.ts:454-464`) does the same
for booking restrictions with a `capability` declaration
(`HotelRateEligibilityCapability`, `:467-472`) stating whether an adapter can even express a given family —
so `unsupported` is never rendered as `clear`. `hotellook.ts:406,534` wires both to
`createNotReturnedHotelFundsPolicy('Hotellook')` and `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED`.

Payment timing is the same problem shape — a fact the provider may state, partially state, contradict itself
on, or omit — and it reuses none of that vocabulary. The design must not invent a fourth dialect for it.

### 6. Provider reality: this will mostly be a not-returned state, and that is the finding

`lib/providers/hotellook.ts` is the only hotel provider, and per the briefing its API is dead — it returns
empty results, and where it does normalize an offer it hardcodes the not-returned/unsupported constants above.
So the honest expected distribution today is *not_returned for nearly every offer*.

This does not weaken the ticket, it defines it: the primary deliverable is a disclosure requirement that makes
**"the provider did not state when you are charged"** a legible, non-reassuring, non-alarming fact — and that
does not collapse into "pay at property" the moment data is missing. The pay-now / at-property / deferred
branches must still be fully specified so the model is correct rather than a description of the current gap,
but UXR must mark them provider-gated.

### 7. Instrumentation is available, and one upstream doc is stale on this point

`lib/analytics.ts:25-70` is a real sink: `track()` posts to `/api/analytics` (via `sendBeacon` with a `fetch`
+ `keepalive` fallback) which persists to Postgres (`app/api/analytics/route.ts`), with an optional
production-only external collector. It is **not** a `console.debug` stub — `console.debug` is the development
branch only (`:62-65`). `docs/pipeline/hotel-total-stay-cost/01-discovery.md:111` states otherwise; that claim
is out of date and UXR should not inherit it.

The naming and shape precedent to follow is the `hotel_funds_policy_*` family in
`app/components/hotelFundsPolicyAnalytics.ts` — `hotel_funds_policy_summary_viewed` (exposure via
`useHotelFundsPolicyExposure`), `hotel_funds_policy_details_opened` (once per offer/provider/surface, keyed
at `:91`), `hotel_funds_policy_confirm_clicked` — with a `surface: 'hotel_card' | 'book_handoff'` dimension
and analytics that "must never block or alter the booking handoff" (`BookingFlow.tsx:158`).

---

## Measurable Signal That The Problem Exists

Two of the three ticket metrics need a prototype; one is instrumentable now. State the protocol, do not
promise a dashboard.

**A. Payment-related hesitation — prototype-measured (primary).**
Moderated task, 8–12 first-time participants, hotel offer list → detail → review, stopping at handoff.
Instrument: time-to-first-action on the review action; count of expand/collapse cycles on the price and
policy panels; verbatim capture of any participant question containing charge/pay/card/deposit/now/later.
Baseline the current build, then the prototype. Hesitation is only attributed to payment timing when the
participant's own words name the charge event — never inferred from dwell time alone.

**B. Comprehension — prototype-measured (the pass/fail gate).**
After viewing an offer and before handoff, ask three forced-choice items with an explicit
*"the provider didn't say"* option available on every item:
1. When is the stay price charged? (at booking / at the property / on a stated date before arrival / provider didn't say)
2. Does anyone take money from your card before you arrive? (yes / no / provider didn't say)
3. Who charges you? (expaify / the booking partner / the hotel / provider didn't say)

Score correctness against the fixture's actual evidence state. The gate that matters: on a `not_returned`
fixture, a participant must select *"provider didn't say"* — selecting *"at the property"* is a **false-comfort
error** and must be counted and reported separately from ordinary incorrect answers. Also score the
cross-contamination item: given a non-refundable, timing-not-stated fixture, does the participant claim they
will be charged now?

**C. Handoff abandonment — instrumentable now, interpret narrowly.**
Add a payment-timing event family alongside `hotel_funds_policy_*` (exposure, details-opened, and the
timing-evidence state as a dimension on the existing handoff-confirm event) so the rate of
*review-viewed without handoff* can be segmented by timing-evidence state. Hard rule inherited from
`docs/pipeline/hotel-deposit-holds/01-discovery.md`: **unexplained abandonment must never be labelled
payment-timing-related.** Abandonment is a directional cohort comparison across evidence states, not a
per-session diagnosis.

**Prototype mechanism already exists.** `app/components/research/HotelContinuityPrototype.tsx` with typed
fixtures in `app/components/research/hotelContinuityFixtures.ts`, mounted on the deal detail page behind a
fixture id and URL param (`app/deals/[dealId]/page.tsx:433`). Reuse this harness. Do not build a new one, and
do not gate the study on provider data landing.

---

## Constraints The Solution Must Respect

1. **Evidence integrity — never infer timing from industry practice.** Payment timing is a financial claim.
   If the provider did not state it, the product says so. It must not be derived from `refundability`, from
   `fundsPolicy`, from the partner's domain, or from what is typical for that rate type. `not_returned` must
   be visually and semantically distinct from `explicit_none` and from any pay-at-property assertion, and must
   never be styled as reassurance. Adapter capability must be declarable, following
   `HotelRateEligibilityCapability`, so "we can't express this" never renders as "nothing to worry about."

2. **No new vocabulary, no new money primitives, no boundary bleed.** Reuse the
   `complete | partial | explicit_none | not_returned | conflicting` state vocabulary, `sourceLabel`,
   `scope`, `fetchedAt`, and ordered `missingFields`. Any amount stays `{ priceCents, currency }` in integer
   minor units. Every provider path returns `Result<T>` and never throws. Payment timing must not restate the
   total (total-stay-cost), the hold (deposit-holds), or the penalty (cancellation-clarity) — it may
   cross-reference them, and the design must define the cross-reference wording so the four dimensions read as
   one system rather than four overlapping panels.

3. **Density and accessibility on an already-crowded card.** `HotelCard` collapsed already carries price,
   provider, freshness warning, class, guest rating, eligibility line, parking, funds-policy summary, pet
   policy, smoking policy, and score chip. A new dimension cannot ship as a twelfth always-on line. Existing
   tokens only (`--text-1/2/3`, `--warning`, `--brand`, `--bg-raised`, `--border`, `--radius-card`); usable at
   375px with no overlap or truncation of the amount; keyboard-reachable disclosure with `aria-expanded` /
   `aria-controls` following `HotelBookingOwnershipDisclosure`; the fact must reach screen readers on the
   collapsed card without requiring expansion, consistent with the existing composed `aria-label` approach at
   `HotelCard.tsx:763`.

---

## Success Statement

**This is solved when a first-time user can answer "is money taken from my card now, at the property, or on a
date before I arrive — and by whom?" before clicking through to the booking partner, without hitting the need
to infer it from the cancellation or non-refundable wording, and without mistaking the provider's silence for
"I pay when I get there."**

In practice:

- Payment timing is a **named, first-class dimension** on card, detail, and review — separate from total cost,
  deposits, and cancellation, with a stated hierarchy across its sub-questions (**when → who collects → is a
  card required now**).
- All five evidence states are distinguishable to a traveler, and `not_returned` reads as an open question
  rather than a favourable answer.
- A single fixed lexicon for pay-now, pay-at-property, and deferred-charge replaces inference from the lone
  hardcoded `'Non-refundable'` label, and is identical across all three surfaces.
- The handoff enumeration at `HotelCard.tsx:747` either includes payment timing or explicitly states that the
  partner is where it is confirmed — the traveler is never left to assume it was covered.
- In the moderated task, participants correctly report the charge event, or correctly report that the provider
  did not state it, and **no participant reads a non-refundable, timing-not-stated offer as "I pay at the
  property."**

---

## Handoff Requirements For UXR

`UXR-HOTEL-PAYMENT-TIMING-01` must read this report and produce
`docs/pipeline/hotel-payment-timing/02-research.md`. It must:

1. **Audit, do not assume.** Read `HotelOffer` (`lib/types.ts:474-495`), `HotelProvider` (`:532-541`),
   `HotelFundsPolicyEvidence` (`:314-322`), `HotelRateEligibilityEvidence` (`:454-464`),
   `BookingHotelContext` (`lib/booking/config.ts:52-77`), `lib/providers/hotellook.ts`,
   `app/components/HotelCard.tsx`, `app/book/BookingFlow.tsx`, `app/deals/[dealId]/page.tsx`, and
   `app/components/hotelFundsPolicyAnalytics.ts`. Locate the **smallest provider-neutral evidence contract**
   that expresses timing without duplicating funds-policy or eligibility fields.
2. **Quantify what a provider can actually source** — which response fields, if any, could supply charge
   event, collecting party, card-required-at-booking, and deferred-charge date. Report the honest
   complete / partial / explicit-none / not-returned / conflicting distribution. Industry practice is not
   property evidence.
3. **Compare two references at the interaction level** — Booking.com's pay-now / pay-at-property rate
   grouping and one of Expedia or Hotels.com — specifically on *where in the funnel* timing is disclosed, how
   it is kept separate from cancellation, and whether it is filterable or sortable. Interaction pattern only,
   not visual style.
4. **Produce 3–5 testable directives** covering all five evidence states, the collapsed-card treatment inside
   the density constraint of item 3 above, the cross-reference wording to the three neighbouring dimensions,
   375px and 1280px, and keyboard/screen-reader behaviour. Exact copy rules and exact hierarchy — no
   "consider" or "should probably."
5. **Operationalize the measurement plan**: fixture set for `HotelContinuityPrototype` covering all five
   states plus the non-refundable-but-timing-unknown contamination case; the comprehension instrument from
   section B with its false-comfort error counted separately; event boundaries that never attribute
   unexplained abandonment to payment timing.
6. **Do not inherit** `hotel-total-stay-cost/01-discovery.md:111`'s claim that `lib/analytics.ts` is a
   `console.debug` stub. It is a live Postgres-backed sink; see section 7.

---

## Out Of Scope Findings

Recorded, not fixed — this stage produces docs only.

- **`Last-checked time unavailable` is hardcoded** at `HotelCard.tsx:361`, `:379` and
  `BookingFlow.tsx:356`, rendered in `var(--warning)` for every offer regardless of real freshness. Owned by
  `docs/pipeline/hotel-price-freshness/` and `docs/pipeline/provider-freshness-timestamp-clarity/`. It matters
  here only as interference: a permanent staleness warning sitting directly above a new payment-timing
  disclosure will make the timing statement read as equally unreliable. UXR should note the interaction and
  not attempt the fix.
- **Four divergent copies of the price-basis caption** (`HotelCard.tsx:359`, `:1047`, `BookingFlow.tsx:242`,
  `app/deals/[dealId]/page.tsx:379`). Consolidation is an open directive inherited from the total-stay-cost
  pipeline. Any timing string must not become a fifth divergent copy — one shared source or one shared
  component from the outset.
- **`priceBasis` has a single-member union** (`lib/types.ts:481`). Whether payment timing belongs as a
  separate evidence object or a widening of price basis is a DEV-stage type decision. This doc's position:
  separate evidence object, because timing has its own five-state provenance and cannot be squeezed into a
  string literal — but the decision is UXR/DEV's to confirm.
- **The hotel search form is not reachable from `app/page.tsx`**, which is a marketing landing page, so
  `HotelCard` and the `BookingFlow` hotel path are reached only via the deal feed and deal detail. Fixes here
  cannot be validated against live hotel-search traffic; the prototype harness is the measurement path.
- **`HotelDecisionSummary` hardcodes negative states** — `Stay dates not provided` (`BookingFlow.tsx:339`),
  `Hotel class not provided` (`:373`), `Guest rating not provided` (`:377`) are unconditional, not derived from
  the context object. Pre-existing, app-wide on that surface, and outside this ticket — but it means the hotel
  review page is currently a poor place to *validate* any new conditional disclosure. Flagged for UXR's test
  planning.

---

## Handoff Ticket

`UXR-HOTEL-PAYMENT-TIMING-01` — created on the board via the pipeline API, carrying the path to this report
and the problem statement above.

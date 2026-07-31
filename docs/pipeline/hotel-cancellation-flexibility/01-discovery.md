# UXD-HOTEL-CANCELLATION-FLEXIBILITY-01 — Hotel Cancellation Flexibility Clarity

**Stage:** UX Discovery · **Priority:** P0 · **Flow:** hotel results → deal detail → booking handoff  
**Scope:** comparable cancellation choices, using provider-supported facts only

## Problem statement

**A traveler cannot judge whether a cheaper hotel rate is worth giving up cancellation flexibility because expaify shows one observed property price—not comparable room-rate choices—and carries no provider-supported cancellation deadline, cancellation charge, or refund outcome that could make the tradeoff explicit before handoff.**

This is a decision-confidence failure, not a request for legal interpretation. The traveler needs to compare the price premium for flexibility with the provider-stated consequence of cancelling; expaify currently supplies neither side of that comparison at the rate level.

## Who is affected and where

The primary affected user is a traveler whose plans may change: a family coordinating schedules, a traveler waiting on leave approval, or anyone booking far enough ahead that a non-refundable discount has real downside. The failure occurs after a hotel looks attractive but before the traveler commits to a specific rate.

1. **Search results.** The active deals experience presents an observed nightly hotel price and opens a hotel detail, but it does not present two selectable rates for the same stay. The richer `HotelCard` path has only a generic rate-restrictions line; the live Hotellook adapter declares refundability unsupported and returns no selected-rate cancellation evidence.
2. **Deal detail.** `app/deals/[dealId]/page.tsx` shows the observed nightly rate, Deal Score, hotel fit, and provider handoff. It contains no cancellation deadline, penalty, refund amount, or flexible-versus-restricted rate comparison. The traveler can assess whether the price is unusual, but not what flexibility that price buys.
3. **Booking handoff.** `app/book/BookingFlow.tsx` says the provider will show room options and confirm the cancellation policy. This moves the first meaningful flexibility assessment outside expaify, after the traveler has already selected a hotel and invested in the handoff.

The exact decision moment this ticket owns is: **“Should I pay more for the flexible option, or accept the cheaper restriction?”** General cancellation-policy disclosure is already owned by `docs/pipeline/hotel-cancellation-clarity/`; this ticket does not duplicate its broader deadline/penalty/no-show work.

## Measurable signal that the problem exists

### Current product signal

- `HotelOffer` has no cancellation-policy evidence shape. Its only adjacent field is `rateEligibility.refundability`, a three-state family (`restricted | clear | not_provided`) with no deadline, charge, refund amount, currency, or provider wording.
- `HotelRateRestrictions` can render `Non-refundable` or an absence state, but cannot express “free until [date], then [provider-stated charge]” and cannot associate two policy outcomes with two prices.
- `HotellookProvider` supplies a property-level `priceFrom` and sets `rateEligibilityCapability.refundability` to `false`. It does not return bookable room-rate alternatives. A comparable cancellation choice therefore does not exist in the current provider contract.
- The saved-deal detail page has no cancellation content. The handoff copy explicitly leaves room selection and cancellation policy to the provider.

These are source-verifiable missing states: a traveler cannot complete a cancellation-flexibility comparison anywhere in the expaify flow today.

### Outcome measurement

The requested outcomes are not directly measurable with the current analytics allowlist. Existing events can establish the surrounding funnel (`hotel_detail_viewed`, `hotel_provider_handoff_clicked`, `hotel_handoff_returned`, and `hotel_handoff_back_clicked`), but none records policy exposure, which rate/policy option was considered, a clarification action, or confidence in the choice.

UXR should validate the presentation hypothesis with a controlled comprehension task and establish a behavioral baseline:

- **Rate-selection confidence:** after comparing two same-room rates, the share of participants who can select one and correctly explain the price/flexibility tradeoff without opening external policy help; collect a 1–5 confidence rating only as supporting evidence.
- **Policy comprehension:** the share who correctly identify the provider-stated free-cancellation deadline and post-deadline consequence, or correctly state that a fact was not provided. A confident but incorrect answer is a failure.
- **Cancellation-policy clarification exit rate:** among users who reach a comparable rate choice, the share who leave the decision surface to search for, re-check, or clarify cancellation terms before selecting a rate. The product cannot instrument this denominator until comparable rate choices and policy-specific events exist, so UXR must define the event contract rather than claim an existing baseline.

## Presentation hypothesis to validate

**When two rates for the same hotel, room basis, stay dates, occupancy, currency, and price basis are genuinely comparable, placing the price difference beside three concise provider-supported facts—refundability outcome, cancellation deadline, and post-deadline charge—will let travelers choose between “lower price with restriction” and “higher price with flexibility” more confidently and with fewer policy-clarification exits than the current provider-deferential handoff.**

The hypothesis must fail closed:

- If the rates differ in room, inclusions, dates, occupancy, currency, or price basis, they are not presented as a pure cancellation tradeoff.
- If a provider does not supply one of the three facts, the missing fact is named as not provided; it is never inferred from silence or from a generic refundable/non-refundable flag.
- If only one observed property price is available—as today—expaify does not fabricate a second rate or claim that a flexibility comparison is available.

## Constraints

1. **Provider-supported facts only.** Display a deadline, cancellation charge, or refundability outcome only when it is attached to the same selected rate by a provider adapter. Preserve provider wording where structured meaning is incomplete. Do not calculate refunds, paraphrase legal terms, or turn an absent non-refundable flag into “free cancellation.”
2. **Comparable means like-for-like.** A flexibility tradeoff is valid only when stay dates, occupancy, room basis, inclusions, currency, taxes/fees basis, and price freshness align. Money remains `{ priceCents: number; currency: string }`; a price difference must not hide a different product.
3. **Trust and accessibility before density.** Keep the result-level signal concise, place complete facts before the outbound handoff, distinguish favorable, restricted, partial, unavailable, stale, and conflicting evidence without color alone, and keep the decision usable with keyboard/screen reader and at 375px and 1280px. Provider calls remain behind `lib/providers` and return `Result<T>`.

## Success statement

**This is solved when a first-time user can compare two genuinely like-for-like hotel rates and choose whether the price premium for flexibility is worthwhile without leaving expaify to clarify the cancellation deadline, provider-stated charge, or non-refundable consequence—and can correctly recognize when expaify does not have enough provider evidence to make that comparison.**

## Scope boundary and dependency

This discovery does not approve a new rate-comparison feature or provider integration. The current product has neither multiple bookable hotel rates nor the evidence required to populate the hypothesis. UXR must first determine whether any approved provider can return, per rate:

- a stable rate/room identifier and like-for-like comparison fields;
- the total or consistently based price in integer minor units;
- an explicit refundability outcome;
- an absolute cancellation deadline with timezone/locale provenance; and
- the provider-stated post-deadline or no-show charge text/amount.

If that evidence is unavailable, the validated near-term direction is limited to honest absence and provider-deferential handoff; UXDES must not specify populated comparison states as if they can ship. The broader cancellation-fact taxonomy should be inherited from `hotel-cancellation-clarity`, not independently reinvented here.

## Handoff

**Next ticket:** `UXR-HOTEL-CANCELLATION-FLEXIBILITY-01`

UXR should audit the active hotel provider and actual rendered surfaces, inherit rather than repeat the findings in `hotel-cancellation-clarity`, test the presentation hypothesis with like-for-like and non-comparable rate pairs, and produce 3–5 directives covering comparison eligibility, fact hierarchy, honest missing-data states, and the measurement event contract.

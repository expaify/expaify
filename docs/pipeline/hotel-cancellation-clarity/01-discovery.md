# UXD-HOTEL-CANCELLATION-CLARITY-01 — Hotel Cancellation Clarity

**Stage:** UX Discovery · **Priority:** P0 · **Flow:** hotel offer card → hotel detail → booking handoff

> **Relationship to prior work:** `docs/pipeline/cancellation-policy/` (UXD/UXR) is now stale. It was written when *no* cancellation signal existed anywhere in the codebase. A refundability signal has since shipped — inside the rate-eligibility system. This discovery supersedes it and scopes the problem that the shipped implementation actually created.

---

## Pain Point

**A traveler cannot learn when free cancellation ends, what a late cancellation costs, or what happens if they never arrive — because expaify models cancellation as a single binary eligibility flag ("Non-refundable" / "No reported rate restrictions") that carries no deadline, no amount, and no no-show term, and files it under a heading travelers don't read for refund risk.**

The failure is not silence. It is a confident-sounding answer to a question the traveler did not ask, standing in for the three they did.

---

## Who Is Affected, And Where

All hotel bookers, but the cost concentrates on travelers with uncertain plans — the exact segment for whom cancellation terms are the deciding variable.

| # | Flow step | Source | What the traveler sees today |
|---|---|---|---|
| 1 | **Offer card (collapsed)** | `HotelCard.tsx:906` → `HotelCardEligibilityLine` (`HotelRateRestrictions.tsx:118`) | One chip: `Non-refundable`, `No reported rate restrictions`, `Restricted rate · N conditions`, `Checking rate restrictions…`, or `Restrictions not provided`. Cancellation is not a named dimension. |
| 2 | **Offer card (expanded "Details")** | `HotelCard.tsx:987–1079` | Deal Score, Quality evidence, Location, Parking, Pet policy, Smoking policy. **No cancellation section exists at all.** The one place a traveler deliberately opens for more detail says nothing about refunds. |
| 3 | **Hotel detail** | `app/deals/[dealId]/page.tsx` | Zero cancellation, refund, or no-show copy anywhere on the page (grep-verified). The middle step of the flow is entirely silent. |
| 4 | **Booking handoff** | `BookingFlow.tsx:1079`, `:1109` | Prose sentence lists "cancellation policy" as item five of six things *the provider* confirms, plus the `Rate restrictions` panel (`HotelRateRestrictions.tsx:154`). This is the first and last substantive mention — on the final screen before the traveler leaves. |

The traveler's decision to click through happens at step 1 or 2. The policy information, such as it is, arrives at step 4.

---

## Measurable Signal (source-verified)

### 1. The type system cannot express a cancellation deadline, a refund amount, or a no-show consequence

`HotelOffer` (`lib/types.ts:474–495`) has no cancellation field. The only refund-adjacent field is `rateEligibility.refundability: HotelRateFamilyEvidence` (`lib/types.ts:463`), whose full shape is:

```ts
interface HotelRateFamilyEvidence {
  state: 'restricted' | 'clear' | 'not_provided';
  membershipLabel?: string;   // membership only
  residencyPlace?: string;    // residency only
  minAge?: number;            // age only
  maxAge?: number;            // age only
}
```

Every qualifier field belongs to another family. **Refundability is the only family with no way to carry a detail.** Even if a provider returned "free cancellation until Aug 3, then one night's charge," there is no field to put it in.

### 2. Refundability detail is explicitly discarded in code

`lib/hotels/rateEligibility.ts:57`:

```ts
if (family === 'refundability') return { state: 'restricted' };
```

Membership, residency, and age all preserve their supplier qualifier through normalization. Refundability alone returns bare state — a deliberate early return that drops anything a supplier attached. The downstream label (`rateEligibility.ts:82`) is a hardcoded constant: `'Non-refundable'`. That string is the entire cancellation vocabulary of the product.

### 3. "No-show" does not exist in the codebase

`grep -rniE "no.?show" app lib` (excluding tests) returns **zero matches**. A traveler who misses a flight and never checks in has no way to learn from expaify whether they are charged the first night or the full stay. This is the highest-consequence cancellation outcome and it is entirely unrepresented.

### 4. The `clear` state manufactures reassurance the data does not support

`HotelRateRestrictions.tsx:131`, `:108`, `:202` render, respectively:

- `No reported rate restrictions`
- `{provider} reports no membership, residency, age, or non-refundable restriction for this rate.`

`clear` means only *"no non-refundable flag was returned."* It is rendered in calm/neutral tone alongside genuinely positive-sounding language. A traveler reading "no restrictions" concludes free cancellation — a claim expaify never fetched, cannot verify, and is prohibited by this ticket's constraints from implying. **Absence of a flag is being presented as presence of a benefit.**

### 5. Cancellation is filed under the wrong mental model

`RateRestrictionFamily = 'residency' | 'age' | 'membership' | 'refundability'` (`lib/types.ts:426`), rendered under the heading **"Rate restrictions"** (`HotelRateRestrictions.tsx:177`).

The first three answer *"am I allowed to book this rate?"* Refundability answers *"what happens to my money if my plans change?"* These are different questions asked at different moments. A traveler scanning for cancellation terms has no reason to open a box labelled "Rate restrictions," and the panel's own summary copy — "Confirm you meet every listed condition before continuing" (`:200`) — is eligibility language that does not parse for a refund deadline.

### 6. The measurement the ticket asks for cannot be taken today

The ticket requires measuring policy-detail expansion and booking-handoff abandonment. Instrumentation exists for the *adjacent* dimension only: `hotel_funds_policy_summary_viewed`, `hotel_funds_policy_details_opened`, `hotel_funds_policy_confirm_clicked` (`hotelFundsPolicyAnalytics.ts:72, 94, 104`) cover deposits and card holds. `HotelDecisionAnalytics.tsx` provides `hotel_detail_viewed` plus a `[data-hotel-decision-section]` visibility observer. **No cancellation-specific event exists**, and because there is no cancellation section, there is nothing for the section observer to attach to. Baseline is currently unmeasurable.

---

## The Reusable Precedent (do not invent a new shape)

`HotelFundsPolicyEvidence` (`lib/types.ts:299–322`) already solves this exact class of problem for deposits and holds, and its vocabulary maps cleanly onto cancellation:

- `HotelFundsAmount` — `exact | range | percentage | variable | not_returned` → the shape a refund/penalty amount needs, including the honest `variable: { providerWording }` escape hatch.
- `HotelFundsPolicyState` — `complete | partial | explicit_none | not_returned | conflicting` → the five-way distinction that separates *"provider says free cancellation"* from *"provider said nothing."*
- `missingFields`, `sourceLabel`, `scope`, `fetchedAt` — per-field provenance, so partial data can be shown as partial.

The gap is not that expaify lacks a way to express uncertain policy data. It is that cancellation was routed through the eligibility system instead of the evidence system.

---

## Constraints The Solution Must Respect

1. **Provider text only; never compute a refund.** Deadlines and penalties must originate from provider-supplied policy text or structured fields, surfaced verbatim or in a bounded normalized form with the raw wording retained. No derived arithmetic (e.g. "you'd get $340 back") without both a reliable amount and a reliable basis from the provider. The `HotelFundsAmount.variable` precedent — show the provider's wording rather than a number — is the required fallback.
2. **Never imply a guarantee, and never let absence read as a benefit.** "No non-refundable flag returned" must not render as "free cancellation," "no restrictions," or any calm-toned reassurance. `explicit_none` (provider affirmatively states free cancellation) and `not_returned` (nothing fetched) must be visually and verbally distinct. expaify is a metasearch surface; the booking partner owns the binding terms.
3. **Accessibility and 375px viability.** Any new section follows the shipped pattern: `aria-labelledby` section heading, `role="status"` + `aria-live="polite"` on loading/error only (`HotelRateRestrictions.tsx:166–175`), ≥44px touch targets, `break-words` on provider strings, and a card-surface accessible summary equivalent to `getRateRestrictionsAccessibleSummary` so screen-reader users get the same hierarchy without expanding.
4. *(Supporting)* **No new tokens, no new provider calls from components.** Use `app/globals.css` tokens and the existing `--warning` / `--warning-soft` / `--error-text` conventions. Any policy fetch goes through `lib/providers` returning `Result<T>`; money stays `{ priceCents, currency }`.

---

## Success Statement

**This is solved when a first-time user can answer "when does free cancellation end, what does a late cancellation cost, and what happens if I don't show up?" — or see plainly that the provider did not say — before clicking through to the booking partner, without mistaking a missing answer for a favorable one.**

Solved in practice means:

- Cancellation is a **named, first-class dimension** on the hotel surface, separated from booking-eligibility restrictions, with an explicit hierarchy across its three sub-questions (deadline → penalty amount → no-show).
- The **five evidence states are distinguishable** to a traveler: provider states free cancellation / provider states non-refundable / provider gave partial terms / provider gave nothing / provider sources conflict. No state is styled as reassurance unless it is affirmatively favorable *and* provider-stated.
- **Terminology is fixed and consistent** across card, detail, and handoff — a single recommended lexicon for "free cancellation," "cancellation deadline," "cancellation charge," and "no-show charge," replacing the lone hardcoded `'Non-refundable'`.
- **Instrumentation exists** to measure cancellation-section exposure, expansion, and handoff abandonment, mirroring the `hotel_funds_policy_*` event family.
- In moderated tasks, users correctly report the deadline and the no-show consequence — or correctly report that the provider did not state them — and do not describe a `not_returned` offer as refundable.

---

## Open Question For Research (UXR)

**Does any provider adapter in this repo actually return cancellation deadline, penalty amount, or no-show terms?** `HotellookProvider` (`lib/providers/hotellook.ts`) is documented as a dead API returning empty; `bookingComRapidApi.ts` is unaudited for policy fields. If no adapter can supply structured policy data, the honest scope collapses to constraint 2 alone — making `not_returned` unmistakable and removing the false-reassurance copy — and the deadline/amount/no-show hierarchy becomes a forward-looking contract. UXR must resolve this from the source before UXDES specifies states, because it determines whether this is a presentation problem or a data-acquisition problem.

---

## Handoff

`UXR-HOTEL-CANCELLATION-CLARITY-01` — UX Research: audit provider policy coverage, compare against Booking.com / Expedia cancellation-disclosure patterns, and produce testable directives for policy hierarchy and terminology.

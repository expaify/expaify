# UXR-HOTEL-CANCELLATION-CLARITY-01 — Hotel Cancellation Clarity

**Stage:** UX Research · **Priority:** P0 · **Upstream:** `docs/pipeline/hotel-cancellation-clarity/01-discovery.md`
**Method:** source audit of every hotel-path adapter and renderer in this repo + interaction-pattern comparison against Booking.com and Expedia cancellation disclosure.

---

## 0. Answer to the blocking question

> **UXD asked:** Does any provider adapter in this repo actually return cancellation deadline, penalty amount, or no-show terms?

**No. Zero adapters supply any cancellation field, and one of the two candidates is not a hotel provider at all.**

This is **not** a data-acquisition problem that UXDES can specify around. It is a **presentation-honesty problem with a forward-looking data contract.** Evidence:

| Candidate | Verdict | Source evidence |
|---|---|---|
| `hotellook.ts` — the only `HotelProvider` wired into search (`app/api/search/route.ts:178`) | **Supplies nothing.** Hardcodes eligibility capability to all-false and never constructs `rateEligibility` at all. | `hotellook.ts:408`, `:538` set `rateEligibilityCapability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED`. `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED = { membership: false, residency: false, age: false, refundability: false }` (`rateEligibility.ts:16–21`). No assignment to `rateEligibility` exists anywhere in the file. |
| `bookingComRapidApi.ts` — flagged by UXD as "unaudited for policy fields" | **Not a hotel provider.** It `implements FlightProvider` (`:39`) and exposes only `priceTrends` and `searchFares`. It has no `searchHotels`, no `HotelOffer` import, and no cancellation/refund/policy token anywhere in its 118 lines. Its `searchFares` also always terminates at `{ ok: false, reason: 'Booking.com RapidAPI response mapping not finalized…' }` (`:108`) — it returns no user-facing data of any kind today. | `bookingComRapidApi.ts:1`, `:39`, `:58–115` |
| Everything else | `amadeus.ts`, `kiwi.ts`, `duffel.ts`, `travelpayouts.ts` are flight providers. Repo-wide grep for `cancel|refund|no.?show|penalt|deadline` across `lib/providers/` returns **no cancellation-policy hits** — only the unrelated `refundable_deposit` obligation type in `lib/hotels/fundsPolicy.ts`. | grep, `fundsPolicy.ts:17` |

**Consequence for UXDES:** every state in the spec must be designed for a product where the true and permanent-for-now runtime answer is *"the provider did not say."* A deadline/penalty/no-show hierarchy is still required — but as a **contract that renders correctly when empty**, not as a layout that assumes data arrives. Any design that looks acceptable only when populated will ship as a lie.

---

## 1. What the current code actually does (three corrections to the shipped picture)

### 1.1 The chip every real traveler sees today is `Restrictions not provided` — not the five states UXD enumerated

`deriveRateEligibilityPresentation` (`rateEligibility.ts:104–139`) short-circuits at `:111–113`: if `evidence` is undefined, it returns `{ state: 'not_provided' }` before touching any family. Because `hotellook` never sets `rateEligibility`, **every offer from live search resolves to `not_provided`**, rendering `Restrictions not provided` (`HotelRateRestrictions.tsx:134`).

So the shipped defect is narrower and worse than "a binary flag with no detail": there is **no refundability signal in production at all**, and the one line that exists tells the traveler nothing while occupying the slot where cancellation terms should be. `'Non-refundable'` (`rateEligibility.ts:82`) is currently unreachable dead copy.

### 1.2 The false-reassurance `clear` state is unreachable from search — but reachable from a URL

`clear` requires **both** `allExplicitlyClear` and `capabilitySupportsClear` (`rateEligibility.ts:132–136`). With `hotellook`'s all-false capability, the second condition can never hold from the search path.

It *can* hold on `/book`. `lib/booking/config.ts:870–871` parses `rateEligibility` and `rateEligibilityCapability` from **client-supplied query-string JSON**, validated for shape (`:618–654`) but not for provenance against a trusted adapter. A crafted or stale handoff URL can therefore make `HotelRateRestrictionsSection` (rendered at `BookingFlow.tsx:1109`) print:

> *"Hotellook reports no membership, residency, age, or non-refundable restriction for this rate."* (`HotelRateRestrictions.tsx:202`)

— a refund claim expaify never fetched, on the last screen before the traveler pays. UXD's finding #4 stands, and its severity is higher than "calm tone": the copy attributes an affirmative negative to a named provider that said nothing. **This is the single highest-trust-risk line in the hotel flow and it is one URL away.**

### 1.3 The `refundability` family cannot carry detail *by construction*, and its slot is structurally wrong

- `rateEligibility.ts:57` — `if (family === 'refundability') return { state: 'restricted' };` — a deliberate early return before any qualifier parsing. Membership (`:59`), residency (`:64`), and age (`:69`) all preserve supplier detail. Refundability alone is stripped.
- `HotelRateFamilyEvidence` (`lib/types.ts:443–453`) has exactly four optional qualifier fields — `membershipLabel`, `residencyPlace`, `minAge`, `maxAge`. **None belong to refundability.** A deadline, an amount, and a no-show term have nowhere to live.
- `RESTRICTION_ORDER` places `refundability` **last** of four (`rateEligibility.ts:13`, mirrored `HotelRateRestrictions.tsx:21–26`), so on a multi-condition rate the refund term sorts *below* residency and age, and at ≥2 conditions collapses entirely into `Restricted rate · N conditions` (`:129`) — the refund term disappears from the card.
- The section heading is `Rate restrictions` (`:177`) with summary copy *"Confirm you meet every listed condition before continuing"* (`:200`) — eligibility framing throughout.

### 1.4 The precedent UXD identified is real, shipped, and correctly shaped — and it also ships empty

`HotelFundsPolicyEvidence` (`lib/types.ts:314–322`) with `HotelFundsAmount` (`exact|range|percentage|variable|not_returned`) and the five-way `HotelFundsPolicyState` is the right shape. Critically, `HotelFundsPolicyPanel.tsx:346–350` already ships the exact honest-absence pattern this ticket needs:

> **Policy not provided** / "The provider did not supply a deposit or incidental-hold policy for this offer." / "Confirm whether this property requires additional available funds before booking."

…and it is warning-toned, not calm (`:276` puts `not_returned` in the warning set). `hotellook.ts:406` populates it via `createNotReturnedHotelFundsPolicy('Hotellook')` — i.e. **the codebase already has a shipped, tested, accessible answer to "provider said nothing" on exactly the surface in question.** Cancellation must copy it, not re-solve it.

### 1.5 Coverage and instrumentation gaps confirmed

- No cancellation section in the HotelCard expanded panel (`HotelCard.tsx:986–1075` — Deal Score, Quality, Location, Parking, Pet, Smoking, Access, Price scope, Funds policy, Handoff; no cancellation).
- Zero cancellation copy on `app/deals/[dealId]/page.tsx`; the only mention in the whole flow is the six-item prose list at `BookingFlow.tsx:1079`.
- Repo-wide `no-show` grep across `app/` and `lib/`: **zero matches** (confirmed).
- `app/api/analytics/route.ts:12–48` is a strict server-side allowlist — an unregistered event name is rejected. No cancellation event exists in either `EVENT_PROPERTIES` or `REQUIRED_PROPERTIES`. Instrumentation requires a route change, not just a client call.

---

## 2. Reference patterns (interaction level, not visual)

Compared against **Booking.com** and **Expedia** hotel result → rate-select → checkout flows.

| Dimension | Booking.com | Expedia | expaify today |
|---|---|---|---|
| **Primary unit of the disclosure** | An **absolute date**: "Free cancellation before 3 January". The deadline *is* the headline; the penalty is secondary. | An **absolute date**: "Fully refundable before Sat, Jan 3". Same primacy. | No date exists in the type system. |
| **Where it first appears** | Result card, per rate, above the fold. | Result card, per rate, plus a `Fully refundable` filter facet. | Nowhere until `/book` — after the click-through decision. |
| **Polarity as an affirmative claim** | "Free cancellation" and "Non-refundable" are **two positive assertions**, each sourced from the rate. Absence of a flag renders nothing, never a reassurance. | Same. Silence is silence. | `clear` renders *"no non-refundable restriction"* — absence rendered as a benefit (§1.2). |
| **Penalty detail** | Escalation ladder on demand: card chip → room-row policy link → tiered terms ("free until X; after X, 1 night; after Y, non-refundable"). Progressive, never on the card. | Same ladder in a cancellation-policy modal off the rate row. | No amount field, no ladder, no modal. |
| **No-show** | Stated as its **own line**, separate from cancellation, in property policies. | Same — "No-show: charged for the full stay." | Concept absent from the codebase. |
| **Repetition at commitment** | Deadline restated at checkout with the date. | Deadline + charge restated at checkout. | One clause, fifth of six, in a prose sentence (`BookingFlow.tsx:1079`). |

**The three deltas that matter:**

1. **Unit delta.** Both references answer *"until when?"* first. expaify has no representation of *when* — only *whether*. Fixing the tone of a boolean does not close this.
2. **Position delta.** Both references disclose on the surface where the click-through decision is made. expaify discloses after it.
3. **Polarity delta.** Both references only ever make claims the rate asserted. expaify is the only one of the three that converts *no data* into *good news* — and it does so under a provider's name.

**The one pattern expaify must *not* copy:** Booking.com and Expedia are booking surfaces holding the rate contract. expaify is metasearch. Their affirmative "Free cancellation before 3 January" is a promise they can keep. expaify may only ever attribute such a statement to the provider, and only from provider-supplied text (constraint 1).

---

## 3. Design directives

Five directives. Each is testable against source or against a moderated task. **D1–D3 are shippable today with zero provider data. D4–D5 are the contract that makes future data land correctly.**

---

### D1 — Cancellation becomes its own evidence dimension, modeled on `HotelFundsPolicyEvidence`; it leaves the eligibility system

Add `HotelCancellationPolicyEvidence` to `lib/types.ts` reusing the shipped funds-policy vocabulary verbatim — do not invent a new shape (UXD directive, upheld):

```ts
type HotelCancellationPolicyState =
  | 'complete' | 'partial' | 'explicit_none' | 'not_returned' | 'conflicting';
//  explicit_none = provider affirmatively states the rate is fully refundable / no charge applies.

type HotelCancellationMissingField =
  | 'deadline' | 'penalty_amount' | 'penalty_basis' | 'no_show' | 'scope' | 'source';

interface HotelCancellationPolicyEvidence {
  state: HotelCancellationPolicyState;
  freeUntil?: { kind: 'absolute'; iso: string; providerWording: string }
            | { kind: 'relative'; providerWording: string }   // "48 hours before check-in"
            | { kind: 'variable'; providerWording: string };  // unparseable — show verbatim
  penalty?: { amount: HotelFundsAmount; basis?: HotelFundsBasis; providerWording?: string };
  noShow?:   { amount: HotelFundsAmount; providerWording?: string };
  sourceLabel: string;
  scope: HotelFundsEvidenceScope;
  fetchedAt?: string;
  missingFields?: HotelCancellationMissingField[];
  conflictingRecords?: /* same-shape records */;
}
```

`HotelFundsAmount.variable` is the **required fallback** for any penalty expaify cannot parse: show the provider's wording, never a computed number (constraint 1).

Concurrently, **`refundability` is removed from `RateRestrictionFamily`** (`lib/types.ts:426`), from `RESTRICTION_ORDER` (`rateEligibility.ts:13`, `HotelRateRestrictions.tsx:21–26`), from `HotelRateEligibilityCapability`, and from the `clear`-state copy at `:108` and `:202`. The `Rate restrictions` panel returns to answering one question — *am I allowed to book this rate?* — and drops the words "non-refundable" and "refund terms" from `:108`, `:202`, `:204`, `:205`.

**Testable:** `grep -n "refundability" lib/hotels/rateEligibility.ts app/components/HotelRateRestrictions.tsx lib/types.ts` returns no `RateRestrictionFamily` member; `rateEligibility.ts:57`'s detail-discarding early return no longer exists; `HotelCancellationPolicyEvidence` exists and `HotelOffer` carries a required `cancellationPolicy` field; `hotellook.ts` populates it via a `createNotReturnedHotelCancellationPolicy('Hotellook')` helper mirroring `fundsPolicy.ts:181`.

---

### D2 — Absence renders as an unmistakable warning-toned "not provided", never as a neutral or favorable line; the client-supplied `clear` path is closed

Because `not_returned` is the **only state any traveler will see today** (§0), it is the primary design target, not the fallback.

Required copy, mirroring the shipped funds-policy pattern (`HotelFundsPolicyPanel.tsx:346–350`) and its warning tone (`:276`):

- **Heading:** `Cancellation terms not provided`
- **Body:** `{Provider} did not supply a cancellation deadline, cancellation charge, or no-show charge for this rate.`
- **Action:** `Check the booking partner's cancellation terms before paying.`

Forbidden in every state: `No reported…`, `No restrictions`, `Free cancellation` (unless `explicit_none` **and** provider-stated **and** attributed), and any calm/neutral styling for `not_returned`, `partial`, or `conflicting`.

`explicit_none` must be visually and verbally distinct from `not_returned` and must always name its source: `{Provider} reports free cancellation until {date}.` — never expaify's own voice.

Separately, **close the trust hole in §1.2**: `lib/booking/config.ts:870–871` accepts eligibility state from query-string JSON. Either drop `rateEligibilityCapability` from client-parsable params so a `clear` verdict cannot be asserted by URL, or gate the `clear` render on a server-verified capability. Cancellation evidence must not repeat this — it must never reach a favorable state from a client-supplied parameter.

**Testable:** grep of `HotelRateRestrictions.tsx` + any new cancellation component for `No reported`, `no restrictions`, `Free cancellation` returns only provider-attributed `explicit_none` strings; a `/book` URL carrying hand-written `rateEligibility`/`rateEligibilityCapability` JSON cannot render a "no non-refundable restriction" claim; `not_returned` uses `--warning` / `--warning-soft`, not `--bg-muted`.

---

### D3 — Cancellation appears on the card and the detail page, before the click-through decision — not only at handoff

Three placements, matching the reference position pattern (§2 delta 2) and the shipped disclosure ladder:

1. **Collapsed card** (`HotelCard.tsx:906`, beside `HotelCardEligibilityLine`): one line, its own chip, never merged into the eligibility chip and never absorbed into `Restricted rate · N conditions`. Today's text: `Cancellation terms not provided`.
2. **Expanded Details panel** (`HotelCard.tsx:986–1075`): a `HotelCancellationPolicyPanel` placed **immediately before** `HotelFundsPolicyPanel` — both answer "what happens to my money", and cancellation is the earlier-consequence question.
3. **`/book` handoff** (`BookingFlow.tsx`): full panel, replacing the buried "cancellation policy" clause at `:1079`, which must be edited to stop implying the item is covered elsewhere.

`app/deals/[dealId]/page.tsx` gets the same panel in its decision-section sequence so the middle step is no longer silent.

Accessibility parity with the shipped pattern is mandatory (constraint 3): `aria-labelledby` section heading; `role="status"` + `aria-live="polite"` **on loading and error only** (`HotelRateRestrictions.tsx:166–175`, not on static states); `break-words` on every provider string; ≥44px targets; and a card-level accessible summary function mirroring `getRateRestrictionsAccessibleSummary` (`:89`) so screen-reader users get the same hierarchy without expanding. At 375px the card line is one wrapped row and never truncates the deadline.

**Testable:** cancellation copy is present in `HotelCard.tsx`, `app/deals/[dealId]/page.tsx`, and `BookingFlow.tsx`; the card chip renders independently of `rateEligibility` state; 375px screenshot shows no overlap or truncation; keyboard tab reaches the panel disclosure with a visible `--border-focus` ring.

---

### D4 — One fixed lexicon, deadline-first hierarchy, three sub-questions in fixed order

Replace the lone hardcoded `'Non-refundable'` (`rateEligibility.ts:82`) with a single exported constant map used by card, detail, and handoff. No surface may coin its own phrasing.

| Concept | Approved term | Never |
|---|---|---|
| Provider-stated free-cancel window | **Free cancellation until {absolute date}** | "Refundable", "Flexible", "Free cancellation" without a date or a source |
| The cutoff itself | **Cancellation deadline** | "Cancel-by", "Grace period" |
| Charge for cancelling after the deadline | **Cancellation charge** | "Penalty", "Fee", "Forfeit" |
| Charge for never arriving | **No-show charge** | folding it into "cancellation charge" |
| Rate the provider states is never refundable | **Non-refundable** | "Final sale", "No cancellations" |
| Nothing fetched | **Cancellation terms not provided** | "No restrictions", "None reported" |

Hierarchy within the panel is fixed and matches both references (§2 delta 1): **deadline (primary) → cancellation charge (secondary) → no-show charge (tertiary)**. Each sub-question renders its own `missingFields` state independently — a rate with a deadline but no penalty amount shows the deadline and says the charge was not provided. `partial` must never be rounded up to `complete`.

Dates render absolute and unambiguous (`Fri, 3 Jan 2026`), never "in 5 days"; when the provider gives only relative wording, show that wording verbatim rather than computing a date.

**Testable:** every user-visible cancellation string in the app resolves from the shared constant map (grep for stray literals); a fixture with `freeUntil` set and `penalty.amount.kind === 'not_returned'` renders the date **and** an explicit "cancellation charge not provided" line; no fixture produces a relative-date string.

---

### D5 — Instrumentation registered server-side, mirroring `hotel_funds_policy_*`

`app/api/analytics/route.ts` rejects unregistered events, so the events must be added to **both** `EVENT_PROPERTIES` and `REQUIRED_PROPERTIES` (`:12–48`, `:57+`), then emitted through the exposure/dedupe pattern already proven in `hotelFundsPolicyAnalytics.ts` (IntersectionObserver at 0.5 threshold + 1s dwell, bounded dedupe set, `try/catch` so analytics never blocks handoff).

- `hotel_cancellation_policy_summary_viewed` — `policyState`, `deadlineState` (`absolute|relative|variable|not_provided`), `penaltyState`, `noShowState`, `provider`, `surface`
- `hotel_cancellation_policy_details_opened` — same dimensions, `surface: hotel_card`
- `hotel_cancellation_policy_handoff_continued` — same dimensions plus `partnerNamed`

This makes the baseline UXD called unmeasurable measurable, and — given §0 — its first job is to prove empirically what share of offers are `not_returned`, which is the evidence needed to justify (or drop) any future policy-data acquisition work.

**Testable:** the three event names appear in both allowlist maps; a jsdom test asserts one `summary_viewed` emission per offer per surface after dwell; a `not_returned` fixture still emits (absence is the measurement).

---

## 4. Scope call for UXDES

UXD offered a conditional: *"if no adapter can supply structured policy data, the honest scope collapses to constraint 2 alone."*

**Do not collapse that far.** The audit supports a middle scope:

- **Ship now (D1–D3, D5):** the type contract, the honest-absence presentation, the three placements, the instrumentation. All are fully implementable with `state: 'not_returned'` as the only live value, and all are user-visible improvements today — the traveler stops being told nothing in the eligibility slot and starts being told plainly that the terms were not provided, at the moment they decide.
- **Specify now, render when data arrives (D4's populated states):** deadline/charge/no-show layouts must be specified and unit-tested against fixtures, because the panel's correctness under partial data is the whole risk. They will render on fixtures and in tests before they render in production.

UXDES must produce fixture-driven specs for all five states with `not_returned` as the **default and most-detailed** case, not the afterthought.

---

## 5. Out-of-scope findings (reported, not fixed)

1. **`lib/booking/config.ts:870–871` trusts client-supplied `rateEligibility`/`rateEligibilityCapability` JSON**, which is the only live path to the false-reassurance `clear` render (§1.2). D2 requires closing it for the cancellation dimension; closing it for the *eligibility* dimension is arguably a separate P0 trust ticket.
2. **`bookingComRapidApi.ts` is dead code in the user path** — `searchFares` always returns `{ ok: false }` (`:108`) and `priceTrends` always returns `[]` (`:59`). It is registered as a flight provider but can never contribute a fare.
3. **`rateEligibility.ts:82` `'Non-refundable'` is currently unreachable** — no adapter produces `refundability: { state: 'restricted' }`. D1 removes it.

---

## Handoff

`UXDES-HOTEL-CANCELLATION-CLARITY-01` — design spec for the cancellation policy dimension: all five evidence states with `not_returned` as the default live case, three placements (card chip, expanded panel, handoff panel), the fixed lexicon and deadline→charge→no-show hierarchy, 375px and 1280px, focus/keyboard, and the `explicit_none` vs `not_returned` visual separation. Output: `docs/pipeline/hotel-cancellation-clarity/03-design.md`.

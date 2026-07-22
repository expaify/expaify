# UXR-LOCAL-CURRENCY-PAYMENT-01: Local Currency & Payment Clarity — Research Brief

Date: 2026-07-22
Stage: UX Research (UXR)
Persona: Senior UX Researcher
Ticket: UXR-LOCAL-CURRENCY-PAYMENT-01 (P1)
Upstream: docs/pipeline/local-currency-payment/01-discovery.md — **not present on disk** (see Blocker B1); problem statement reconstructed from the ticket body.

---

## 0. Problem statement (from ticket)

International hotel shoppers see a single USD figure that expaify silently converted, with **no disclosure of** (a) the currency they will actually be charged in, (b) whether the figure is an estimate, or (c) when payment is taken (pay-now vs pay-at-property). The result is post-click price surprise at OTA checkout and on the card statement.

**Surfaces:** deal feed card (`DealCard`), hotel result card (`HotelCard`), outbound booking handoff (`BookingFlow` → `HotelHandoffReview` / `HotelSummary`).

**Scope guardrail:** presentation and guidance **only**. No payment-processing, no FX math, no currency-selection UI. Preserve the `{ priceCents, currency }` contract. This is **not** a duplicate of `results-currency-localization` (that ticket is about *internal* same-currency coherence between fare, score, and booking review; this ticket is about *external* charge-currency and payment-timing disclosure).

---

## 1. What the current implementation actually does (code audit)

### 1.1 The USD figure is a provider-side conversion, presented as if native
`lib/providers/hotellook.ts` requests the provider in USD and stamps every offer USD:

- Line 434: `...&currency=USD...` — expaify asks HotelLook to convert.
- Lines 469–472 / 372–375: `pricePerNight: { priceCents, currency: 'USD' }` — hard-coded `'USD'` on both the live and cached paths.
- Lines 390–393 comment: *"HotelLook cache.json returns priceFrom in the requested currency's major units (currency=USD above)."*

So the number the user sees is **already a conversion performed upstream for a property that may transact in its own local currency.** Nothing downstream signals this.

### 1.2 The data model carries no charge-currency and no payment-timing field
- `lib/types.ts:1` — `Money = { priceCents: number; currency: string }`. The `currency` here is the *display/quote* currency, not the merchant charge currency.
- `lib/types.ts:137` — `HotelOffer` has `pricePerNight`, `priceBasis?: 'per_night_before_taxes_fees'`, `deeplink`, `source`. **No** `chargeCurrency`, **no** `isEstimate`, **no** `paymentTiming`.
- `lib/booking/config.ts:18` — `BookingHotelContext` has `currency`, `priceBasis: 'per_night_before_taxes_fees'`, `providerUrl`. Same absence.

**Consequence for this ticket:** we cannot truthfully name a *specific* foreign currency (e.g. "you'll pay €X") or a *specific* payment moment ("pay at property"), because that data does not exist in the pipeline. The honest solution is **generic, expectation-setting disclosure**, not a fabricated specific. Naming a specific charge currency or timing is a data dependency, out of this presentation-only scope (see Out-of-scope O1).

### 1.3 Surface-by-surface: what is disclosed vs. what is missing

**DealCard** (`app/components/ui/DealCard.tsx`)
- Shows `formatMoney(deal.dealPrice)` (renders e.g. `$212 USD`), `/ night`, `usually {median}`, savings, and the trust line *"Based on N price checks over 60 days · expaify never adds fees."*
- **Missing:** any signal the amount is a conversion; any signal the OTA may charge in another currency; any payment-timing cue. The "expaify never adds fees" line can even read as "this is the final USD price," reinforcing the wrong mental model.

**HotelCard** (`app/components/HotelCard.tsx`)
- `Price` (lines 34–50): nightly rate + *"per night before taxes and fees"* + *"Rate from {provider}"* + *"Last-checked time unavailable."*
- Expanded "Price scope" panel (lines 571–579): repeats price basis, rate check, and a provider-handoff line (*"Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms."*).
- **Missing:** the disclosure names taxes/fees/availability/terms but **omits currency conversion and payment timing entirely.** A user reading this panel would reasonably conclude USD is the charge currency.

**HotelHandoffReview / HotelSummary** (`app/book/BookingFlow.tsx:159`, `:481`)
- Highest-stakes surface (the pre-payment handoff). Shows selected nightly rate via a **second, local** `formatMoney(cents, currency)` (lines 33–42) that prints USD as `$212.00` (no ISO suffix), plus a **`Currency` fact rendering the bare code `USD`** (line 189).
- Copy: *"Confirm the location, taxes, fees, cancellation policy, room details, and live availability with the provider before payment"* and *"Compare the hotel name, location, provider, selected rate, currency, and price basis on the provider page before entering payment details."*
- **Missing / actively misleading:** the `Currency: USD` fact presents USD as a settled attribute of the booking, when it is only expaify's quote currency. Payment timing is gestured at ("before payment") but never disclosed as now-vs-at-property. Conversion is never mentioned. This is the single strongest driver of the statement-shock the ticket describes.

### 1.4 Summary of the gap
Across all three surfaces, expaify presents a **converted USD quote with the confidence of a native, final, pay-now price**, while disclosing everything *except* the two things that cause the surprise: **charge currency** and **payment timing.**

---

## 2. Reference-pattern comparison (interaction pattern, not visual style)

Compared against **Booking.com** and **Google Hotels**, at the level of *what is disclosed and when*.

| Dimension | Booking.com / Google Hotels pattern | expaify today | Delta |
|---|---|---|---|
| **Estimate marker** | Converted amounts carry an explicit "approximate" cue (Booking: "Prices are approximate…"; a currency selector implies the shown amount is a conversion). | Bare `$212 USD`, no approximation cue. | expaify presents a conversion as an exact native price. |
| **Charge-currency disclosure** | Booking states near price/at checkout: *"This property will charge you in [EUR]. The price shown is an approximate conversion."* | None. | expaify never warns the merchant currency may differ. |
| **Payment timing** | Booking surfaces timing as a first-class tag on the card and in review: *"No prepayment needed – pay at the property"* vs. *"Pay in advance."* | None; only an implicit "before payment." | expaify gives no pay-now/pay-at-property expectation. |
| **Progressive disclosure** | Light cue on the list card → fuller explanation at the room/checkout step (the highest-stakes moment). | Flat: same absence at every stage. | expaify has no escalation of disclosure toward the handoff. |

**Key reference insight:** the mature pattern is *honest expectation-setting proportional to stakes* — a short cue in the feed, an unmissable statement at handoff — **not** a precise foreign figure at every step (Booking itself often shows only an approximate converted amount plus a "charged in local currency" note). This is directly compatible with expaify's data reality (§1.2), which makes a **minimum-disclosure** approach the right and achievable target.

---

## 3. Design directives (specific, testable)

Each directive is scoped to presentation/copy only, preserves `{ priceCents, currency }`, and is verifiable in code review or manual trace. A single shared copy token set should back all three surfaces so wording stays consistent.

### D1 — Mark every converted amount as approximate (all three surfaces)
Wherever a hotel USD figure derived from HotelLook is rendered (`DealCard` price, `HotelCard` `Price`, `HotelSummary` selected nightly rate), attach a lightweight estimate cue tied to the amount — a leading "about" / "≈" or a linked marker resolving to the disclosure in D2. **Do not** alter the numeric value or the `formatMoney` contract.
- *Testable:* every hotel price node has an adjacent, screen-reader-exposed estimate cue; no bare `$X USD` for hotel prices remains.

### D2 — One-line charge-currency disclosure adjacent to price (all three surfaces)
Add a single, generic line near each price: the property/OTA may charge in its **local currency**, and the final amount and currency are confirmed on the provider's checkout page. **Must not name a specific currency** (data unavailable — §1.2). Minimum-viable copy direction, e.g.: *"Shown in USD, converted for comparison. The property may bill in its local currency — final amount and currency are confirmed at checkout."*
- *Testable:* the line appears on `DealCard`, in `HotelCard`'s collapsed or Price-scope area, and in `HotelHandoffReview`; it never asserts a specific foreign currency or a guaranteed rate.

### D3 — Disclose payment timing honestly, without fabricating specifics
Because no pay-now/pay-at-property field exists, disclose that **payment timing and any currency conversion are set by the provider and confirmed at checkout** — do **not** render a "Pay now" or "Pay at property" badge that we cannot substantiate. Design the copy slot so it can later upgrade to explicit tags **if/when** a `paymentTiming` field is added upstream (gated on O1).
- *Testable:* handoff review contains a payment-timing disclosure line; no surface displays a definitive pay-now/pay-at-property claim.

### D4 — Fix the misleading `Currency: USD` fact in `HotelSummary`
Reframe the bare `Currency` fact (`BookingFlow.tsx:189`) so it reads as expaify's *quote/display* currency, not the settled charge currency — e.g. label it "Shown in" with a value like "USD (converted)" and let D2 carry the caveat. Removing the false-certainty framing here is the highest-leverage single change for the statement-shock signal.
- *Testable:* the handoff no longer presents `USD` as an unqualified booking attribute.

### D5 — Escalate disclosure with stakes (progressive disclosure hierarchy)
Define one disclosure system with two densities: a **compact** cue at scan surfaces (`DealCard`, collapsed `HotelCard`) and an **expanded** statement at the highest-stakes surface (`HotelHandoffReview`, and `HotelCard` "Price scope" panel). Wording is shared/tokenized so the three surfaces cannot drift. The handoff statement must be visible without expanding anything.
- *Testable:* the same disclosure token appears at both densities; the handoff version is above the fold at 375px and not hidden behind a toggle.

### State coverage the directives must respect
- **Price unavailable** (`PriceUnavailable`, `Booking unavailable`): suppress currency/payment disclosure — there is no amount to qualify.
- **Low-confidence / limited-history score:** disclosure is independent of Deal Score; both may show together without contradiction or visual collision.
- **Mobile 375px:** disclosure is a single wrapping line, never overlapping price, badge, or CTA.
- **Loading / mock ("Example") cards:** mock/sample cards ("not bookable") should not imply a real charge; keep disclosure out of the mock state.
- **Keyboard / SR:** estimate marker and disclosure are in the accessible name/description for the price and the CTA (the `aria-label`s on the "Review hotel" and "Continue to provider" links already concatenate rate context — extend them, don't break them).

---

## 4. Minimum-disclosure clarity hypothesis

**Hypothesis:** If expaify adds a *minimum, generic* disclosure — (1) the shown amount is an approximate USD conversion, (2) the property may charge in its local currency with final amount/currency confirmed at checkout, and (3) payment timing is set by the provider — attached to hotel prices across `DealCard`, `HotelCard`, and `HotelHandoffReview`, then international hotel shoppers will form an accurate expectation of the charge **before** clicking out, reducing post-click price/currency surprise **without** requiring FX math, a currency picker, or a specific foreign figure.

**Measured by:**
- **Comprehension** — after viewing a card, a user can correctly state that the amount is an estimate and that the provider may bill in a different currency at a different time. Target: majority correct, up from a near-zero baseline (no cue exists today).
- **CTA confidence** — self-reported confidence to proceed to the provider does **not** drop (and ideally rises) once expectations are set honestly; the disclosure must read as trust-building, not alarming.
- **Reported price/currency mismatch** — fewer post-handoff reports of "charged a different amount / different currency than shown." This is the primary trust signal the ticket targets.

**Why "minimum":** the data (§1.2) cannot support a precise "you'll pay €X at the property" claim. Over-promising specificity would be a new, worse trust bug. The winning move is honest, generic expectation-setting proportional to stakes (§2).

---

## 5. Blockers, out-of-scope, and contract notes

- **B1 — Discovery doc absent.** `docs/pipeline/local-currency-payment/01-discovery.md` does not exist on disk; only `02-research.md` (this file) is present. I reconstructed the problem statement, surfaces, scope, and success measure from the ticket body, which carries them explicitly. This did not block the audit (all three surfaces and the data layer were read directly from source). Flagging for pipeline integrity — UXDES should confirm no discovery constraints were lost.

- **O1 — Naming a specific charge currency or payment timing is out of scope.** It requires new upstream fields (`chargeCurrency`, `paymentTiming`, `isEstimate`) on `HotelOffer` / `BookingHotelContext`, sourced from the provider/adapter. That is DEV/data work, not presentation. If UXDES wants specificity, it should spawn a separate DEV ticket; the design spec must remain shippable with generic copy alone.

- **O2 — `BookingFlow` has a local `formatMoney` duplicate** (lines 33–42) diverging from `lib/money.ts` (USD without ISO suffix). This overlaps with `results-currency-localization`; **do not** fix it under this ticket. Noted so UXDES does not accidentally couple the two.

- **Contract preserved:** all directives keep `{ priceCents, currency }` intact, add no floats, add no FX conversion, add no currency selector, and touch presentation/copy only. Affiliate markers and provider handoff behavior are untouched.

---

## 6. Handoff

Next stage: **UXDES-LOCAL-CURRENCY-PAYMENT-01** — produce an implementation-ready design spec covering D1–D5 across `DealCard`, `HotelCard`, and `HotelHandoffReview`, every state in §3, final copy for the shared disclosure token (compact + expanded densities), and mobile 375px / desktop 1280px layouts. Keep it shippable with generic copy (O1); do not introduce FX or currency-selection UI.


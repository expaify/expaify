# UXDES-LOCAL-CURRENCY-PAYMENT-01: Local Currency and Payment Clarity — Design Specification

Date: 2026-07-22  
Stage: UX Design (UXDES)  
Ticket: UXDES-LOCAL-CURRENCY-PAYMENT-01 (P1)  
Upstream: `01-discovery.md`, `02-research.md` (directives D1–D5)

## 0. Outcome and scope

Ship one minimum-disclosure system for real hotel prices:

1. Prefix every displayed converted hotel amount with the visible word **“About”**.
2. Place one compact currency cue beside prices on scan surfaces.
3. Expand the same truth at the provider handoff to state that expaify does not know whether payment is due now or at the property.
4. Relabel the handoff fact `Currency: USD` as the display basis, not the merchant charge currency.

This is presentation and copy only. Do not change the amount, perform FX math, add a currency picker, add payment processing, infer a specific charge currency, infer payment timing, or change `{ priceCents: number; currency: string }`. Existing component props, exports, links, affiliate markers, and provider behavior remain unchanged.

The implementation treats every non-mock hotel price currently shown by these surfaces as an approximate comparison amount because the pipeline does not carry a native/converted discriminator. Mock/example prices are explicitly excluded because they are not offers.

### Directive traceability

| Research directive | Design decision | Acceptance reference |
|---|---|---|
| D1 — estimate marker | Visible word “About” is attached to every real hotel amount; no symbol-only treatment | AC1–AC3 |
| D2 — generic charge-currency line | Shared compact copy appears on `DealCard` and collapsed `HotelCard`; no specific local currency is named | AC4 |
| D3 — honest payment timing | Expanded copy says the provider confirms timing and expaify does not know now vs. property | AC5 |
| D4 — misleading Currency fact | `Currency` becomes `Shown in`; value becomes `{currency} (converted)` | AC6 |
| D5 — progressive disclosure | Compact paragraph at scan; expanded status before handoff summary and in expanded hotel details | AC7 |

## 1. Shared copy contract

Create a presentation-only module at `app/components/hotelPaymentCopy.ts`. Components import these tokens; they must not duplicate literal variants.

```ts
export const HOTEL_PRICE_ESTIMATE_PREFIX = 'About'

export const HOTEL_CURRENCY_DISCLOSURE_COMPACT =
  'Converted for comparison. The property may bill in local currency; final amount and currency are confirmed at checkout.'

export const HOTEL_CURRENCY_PAYMENT_TITLE = 'Currency and payment details'

export const HOTEL_CURRENCY_PAYMENT_EXPANDED =
  'This rate is an approximate conversion for comparison. The property may bill in its local currency. At checkout, the provider confirms the final amount, currency, and when payment is due; expaify does not know whether you’ll pay now or at the property.'

export const HOTEL_PROVIDER_CONFIRMATION =
  'The provider confirms the final total, taxes, fees, room availability, cancellation policy, payment timing, currency, and terms.'
```

### Copy rules

- “About” is text, not `≈`, an icon, tooltip, superscript, or footnote. It remains perceivable without hover and is spoken by assistive technology.
- “Local currency” is always generic. Never interpolate EUR, MXN, GBP, or another guessed charge currency.
- `currency` may be interpolated only as the display/quote code in `Shown in: {currency} (converted)`.
- Say “confirmed at checkout,” not “charged at checkout.” The latter would falsely imply pay-now.
- Do not add “Pay now,” “Pay at property,” “No prepayment,” “Guaranteed rate,” “Exact total,” “No conversion fee,” or “No foreign transaction fee.”
- Keep the existing “expaify never adds fees” trust line, but position the compact disclosure before it so the line cannot be read as a no-FX-cost promise.
- Do not introduce DCC or bank-fee copy in this slice. The current provider data cannot say whether either applies, and the minimum-disclosure statement already sets the correct expectation.

## 2. Information hierarchy

### 2.1 Scan surfaces: `DealCard` and collapsed `HotelCard`

1. **Primary:** hotel identity and approximate current nightly amount.
2. **Secondary:** deal comparison/score, price basis, source, and CTA.
3. **Tertiary but persistent:** compact conversion/charge-currency disclosure.

The disclosure is visually quiet but never hidden, truncated, tooltip-only, or gated behind “Details.” It is a single semantic paragraph. “Single wrapping line” means one uninterrupted paragraph that wraps naturally at 375px; it does not mean forcing one visual line with `whitespace-nowrap`.

### 2.2 Expanded `HotelCard`

1. **Primary:** deal evidence and hotel details.
2. **Secondary:** price scope plus expanded currency/payment truth.
3. **Tertiary:** provider/freshness caveats.

### 2.3 `HotelHandoffReview`

1. **Primary:** selected hotel, approximate nightly rate, and “Continue to provider.”
2. **Secondary:** expanded currency/payment statement, encountered before the hotel summary and CTA.
3. **Tertiary:** supporting facts and offer reference.

The expanded statement is never placed in a disclosure toggle. At 375px it appears in document order immediately after the page introduction and before `HotelSummary`, so it is in the first review sequence and above the outbound action.

## 3. Surface specification — `DealCard`

Affected file: `app/components/ui/DealCard.tsx`

### 3.1 Default real card

Keep the existing price hierarchy and add the qualifier to every monetary claim:

- Primary: **“About {formatted deal price}”**
- Comparison: **“usually about {formatted median price}”**
- Savings, when the existing threshold passes: **“Save about {formatted savings}/night”**
- Compact disclosure: use `HOTEL_CURRENCY_DISCLOSURE_COMPACT` verbatim.

Placement:

1. Price row
2. Savings line, when present
3. Compact disclosure
4. OTA comparison row
5. Existing trust line

This order explicitly qualifies the money before the user encounters provider links or “expaify never adds fees.”

Suggested price structure:

```tsx
<span className="inline-flex items-baseline gap-1">
  <span className="text-[11px] font-semibold leading-none text-[color:var(--text-2)]">
    {HOTEL_PRICE_ESTIMATE_PREFIX}
  </span>
  <span className="font-display text-[26px] font-bold leading-none text-[color:var(--primary)]">
    {formatMoney(deal.dealPrice)}
  </span>
</span>
```

Compact paragraph class:

```
mt-2 text-[11px] font-medium leading-4 text-[color:var(--text-3)]
```

It must not use `truncate`, `line-clamp-*`, `whitespace-nowrap`, a fixed height, or absolute positioning.

### 3.2 Example/mock card

When `deal.isMock === true`:

- Preserve “Example” and “Sample hotel — not bookable.”
- Preserve the sample numbers already shown.
- Suppress every “About” prefix and the compact/expanded disclosure.
- Keep the card non-bookable and do not add payment or charge implications to its accessible name.

The “Example” and “not bookable” labels are the controlling truth in this state.

### 3.3 Link and screen-reader name

For a linked real card, replace the current short label with:

```
View deal: {hotelName}. Approximate nightly rate {formatted deal price}. Converted for comparison. The property may bill in local currency; final amount and currency are confirmed at checkout.
```

For a mock card or a card without `href`, do not add this bookable-offer label. Visible “About” and disclosure text must not be `aria-hidden`.

No new interactive element is introduced. Existing whole-card focus behavior remains. The global `:focus-visible` outline and ring must remain unobscured.

### 3.4 Deal Score and edge behavior

- `DealCard` has no low-confidence score state; do not invent one.
- The existing DealChip, checked-time pill, headline, median, savings threshold, and link behavior do not change.
- There is no current price-unavailable contract on `DealCardDeal`. Do not add one in this UI ticket. Invalid/missing deal money remains an upstream concern.

## 4. Surface specification — `HotelCard`

Affected file: `app/components/HotelCard.tsx`

### 4.1 Default valid-price card

In `Price`, render:

- Label: **“Nightly rate”** (unchanged)
- Qualifier: **“About”**
- Amount: **“{formatMoney(price)}”**
- Basis: **“per night before taxes and fees”** (unchanged)
- Source: **“Rate from {providerName}”** (unchanged)
- Freshness: **“Last-checked time unavailable”** (unchanged)

Because the existing right price column is only `6.75rem–9.5rem`, do not place the full compact disclosure inside it. Place one full-width compact paragraph immediately after the three-column identity/price grid and before the score/CTA row. This preserves adjacency while preventing 375px collision.

Suggested qualifier class:

```
mt-1 text-[11px] font-semibold leading-4 text-[color:var(--text-2)]
```

Keep the amount class and tabular numerals. Compact paragraph class:

```
mt-3 break-words text-[11px] font-medium leading-4 text-[color:var(--text-3)]
```

### 4.2 Expanded details

Keep the current “Price scope” panel. Its final structure and copy are:

- Heading: **“Price scope”**
- Body: **“per night before taxes and fees”**
- Heading: **“Rate check”**
- Body: **“Rate from {providerName}. Last-checked time unavailable.”**
- Heading: **“Currency and payment details”**
- Body: `HOTEL_CURRENCY_PAYMENT_EXPANDED`
- Heading: **“Provider handoff”**
- Body when bookable: `HOTEL_PROVIDER_CONFIRMATION`
- Body when unavailable: the existing exact `unavailableReason`

Replace the prior provider-confirmation literal with the shared token. Do not repeat the compact line inside the expanded panel; the expanded copy supersedes it.

Panel classes remain tokenized:

```
rounded-[var(--radius-card)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3.5 py-3
text-xs font-medium leading-5 text-[color:var(--text-2)]
```

Each section heading after the first uses:

```
mt-3 font-bold text-[color:var(--text-1)]
```

### 4.3 Price unavailable and booking unavailable

When `hasValidPrice === false`:

- Preserve `PriceUnavailable`, its reason, provider line when known, freshness line, and “Booking unavailable.”
- Suppress “About,” compact disclosure, expanded currency/payment copy, `Shown in`, and all payment-timing guidance. There is no amount to qualify.
- In expanded details, keep the current unavailable reason under “Provider handoff”; omit the entire “Currency and payment details” section.
- Preserve the existing `role="status"` and unavailable aria-label.

When `hasValidPrice === true` but the booking URL is invalid:

- The price still receives “About” and the compact disclosure because an amount is visible.
- Preserve “Booking unavailable” and its existing provider-link reason.
- The expanded currency/payment section remains because it qualifies the visible amount; provider handoff shows the unavailable reason.
- Do not mention checkout or payment timing in the disabled CTA aria-label. The disclosure remains ordinary readable text.

### 4.4 Score states

Currency disclosure is independent of Deal Score:

- `loading === true`: preserve “Score pending”; show “About” and disclosure immediately when the price is valid. Do not skeletonize or defer disclosure.
- `score === null`: preserve “Score unavailable”; show disclosure.
- `score.confidence === 'low'`: preserve “Limited history” and “Limited hotel history. Treat this as a rough comparison, not a confirmed deal.” Show disclosure as a separate paragraph.
- High-confidence Great/Good/Typical: no change beyond disclosure.

Do not merge “approximate conversion” with “rough comparison.” One describes the displayed currency amount; the other describes historical Deal Score confidence.

The expanded hotel `DealScorePanel` also renders a monetary “Usual” fact. For `scope="hotel"` only, its valid value becomes **“About {formatted usual amount}”** so a converted hotel baseline is not left as an exact claim. The route/flight variant remains unchanged. If the median is invalid, preserve **“Usual unavailable”** with no qualifier. This is a presentation branch on the existing `scope` prop, not a new data contract.

### 4.5 CTA accessible name

For a valid, bookable card, set the exact dynamic pattern:

```
Review {hotel.name}. Approximate nightly rate {formattedPrice}, before taxes and fees. Converted for comparison. The property may bill in local currency; final amount and currency are confirmed at checkout. Rate from {providerName}. Last-checked time unavailable. Opens expaify review before provider handoff. {HOTEL_PROVIDER_CONFIRMATION}
```

Visible CTA remains **“Review hotel.”**

The Details button remains a native button with existing `aria-expanded` and `aria-controls`. Enter and Space toggle it; focus stays on the button after expansion/collapse. No new focusable disclosure control is added.

## 5. Surface specification — `HotelHandoffReview` / `HotelSummary`

Affected file: `app/book/BookingFlow.tsx`

### 5.1 Page introduction

Final visible copy:

- Eyebrow: **“Hotel handoff”**
- H1: **“Review selected hotel”**
- Intro: **“Review the selected hotel offer before leaving expaify. The provider confirms the final price, currency, payment timing, room details, and availability at checkout.”**

Replace the existing status content with:

- Status title: `HOTEL_CURRENCY_PAYMENT_TITLE`
- Status message: `HOTEL_CURRENCY_PAYMENT_EXPANDED`

Use the existing `StatusPanel` and amber token treatment. It appears after the introduction and before `HotelSummary`; no accordion or dismiss action.

### 5.2 HotelSummary price

Final visible copy:

- Eyebrow: **“Hotel review”** (unchanged)
- Price label: **“Selected nightly rate”** (unchanged)
- Price: **“About {local formatMoney output}”**
- Basis: existing `getHotelPriceBasisLabel` output.

“About” and the formatted amount must share one semantic price group and must be read in that order. Do not change the local `formatMoney` implementation in this ticket.

Suggested group classes:

```
mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1
```

“About”:

```
text-xs font-semibold leading-none text-[color:var(--text-2)]
```

Amount retains:

```
text-2xl font-bold leading-none text-[color:var(--text-1)] tabular-nums
```

### 5.3 Facts

Keep Hotel, Location, Location precision, Provider, and Price basis facts unchanged.

Replace:

- Label **“Currency”**
- Value **“{hotelContext.currency}”**

with:

- Label **“Shown in”**
- Value **“{hotelContext.currency} (converted)”**

This fact identifies expaify’s display basis only. Do not label it “Charge currency,” “Payment currency,” or “You’ll pay in.”

### 5.4 Before-you-continue panel and CTA

Final visible copy:

- Label: **“Before you continue”**
- Body: **“On the provider page, compare the hotel, location, nightly rate, price basis, final amount and currency, and when payment is due before entering payment details.”**
- Supporting line: `HOTEL_PROVIDER_CONFIRMATION`
- Primary CTA: **“Continue to provider”**
- Secondary CTA: **“Back to search”**

The primary CTA accessible name is:

```
Continue to provider for {hotelContext.name}. Approximate selected nightly rate {formatted price}, {price basis}. This rate is converted for comparison. The property may bill in local currency. The provider confirms the final amount, currency, and when payment is due at checkout; expaify does not know whether you’ll pay now or at the property. Opens provider site in a new tab. {HOTEL_PROVIDER_CONFIRMATION}
```

Do not change `target="_blank"`, `rel="noopener noreferrer sponsored"`, the provider URL, or affiliate handling.

### 5.5 Handoff unavailable/error states

- A malformed or missing hotel context continues to route to the existing invalid-selection/recovery state. Do not show any hotel currency/payment disclosure there because no trustworthy price context exists.
- A provider-side failure after outbound navigation is outside this component and this ticket.
- No loading state exists for hotel handoff. Do not add one.
- Flight booking states and all Duffel copy remain untouched.

## 6. Responsive behavior

### 6.1 Mobile — 375px

`DealCard`:

- Keep one column and existing card padding.
- Allow “About {amount},” “usually about {amount},” and savings to wrap using `flex-wrap`.
- Keep “About” attached to its amount with `inline-flex`.
- Compact disclosure occupies the card’s full content width and wraps as one paragraph. No truncation.

`HotelCard`:

- Preserve the three-column top grid; do not widen the price column or reduce the existing amount size.
- Render “About” above the amount inside the price column.
- Render compact disclosure full width below the top grid.
- Score and CTA remain in their existing second row. The disclosure must not share that grid row.
- Long translated/provider strings use `break-words`; the card must not exceed viewport width.

`HotelHandoffReview`:

- Preserve single-column `ReviewShell` order: introduction → currency/payment status → hotel summary → action panel.
- The status is visible before the user reaches “Continue to provider.”
- “About” and price may wrap within the rate panel; neither is clipped.
- Facts remain one column until the existing `sm` breakpoint.

### 6.2 Desktop — 1280px

- Preserve current DealCard grid behavior.
- Preserve HotelCard’s top grid and right-aligned price.
- Preserve `ReviewShell`’s content + 380px sticky action column.
- Currency/payment status remains in the left review column; the action panel remains sticky.
- Do not promote disclosure to a modal, popover, floating badge, or separate sidebar.

### 6.3 Minimum dimensions and overflow

- Validate at viewport widths 375px and 1280px.
- No horizontal page scroll at 320px or above.
- No copy may overlap image, score chip, checked-time pill, or CTA.
- Do not use smaller text than 11px for new copy.

## 7. Loading, empty, error, and edge-state matrix

| Surface/state | Estimate marker | Compact copy | Expanded copy | CTA behavior |
|---|---:|---:|---:|---|
| DealCard, real | Yes, all visible money claims | Yes | N/A | Existing link |
| DealCard, Example/mock | No | No | N/A | Non-bookable behavior unchanged |
| DealCard, no `href` but real data | Yes | Yes | N/A | No link added |
| HotelCard, valid price + valid URL | Yes | Yes | In Details | “Review hotel” |
| HotelCard, valid price + invalid URL | Yes | Yes | In Details | “Booking unavailable” |
| HotelCard, invalid/missing price | No | No | No | “Booking unavailable” |
| HotelCard, score loading/unavailable | Yes if price valid | Yes if price valid | In Details if price valid | Existing behavior |
| HotelCard, low-confidence score | Yes | Yes | In Details | Existing behavior |
| Hotel handoff, valid context | Yes | N/A | Always visible before summary | “Continue to provider” |
| Hotel handoff, invalid context | No | No | No | Existing recovery |
| Flight booking, every state | No change | No change | No change | No change |

## 8. Accessibility and interaction requirements

- New disclosure content is static text and creates no tab stop.
- Use visible “About”; never hide it from accessibility APIs.
- Do not use `title` as the sole explanation.
- Keep DOM order equal to reading order.
- Extend existing CTA `aria-label` strings with the exact patterns in §§4.5 and 5.4.
- The whole-card DealCard label uses §3.3 only for real linked cards.
- Do not apply `aria-live` to static disclosure. Existing score and unavailable status semantics remain.
- Details stays operable with Enter and Space. Outbound and back links stay operable with Enter.
- Existing global focus outline/ring must have at least 3px visual clearance and must not be clipped by newly added wrappers.
- At 200% zoom, compact and expanded copy reflow without loss, overlap, or horizontal scroll.
- Screen-reader order at handoff: page title → expanded currency/payment statement → hotel identity/location → approximate selected rate → facts including “Shown in” → before-you-continue guidance → primary CTA.

## 9. Implementation file map

UI stage changes only:

1. Add `app/components/hotelPaymentCopy.ts` for shared literal tokens.
2. Update `app/components/ui/DealCard.tsx` for real-card qualifiers, compact disclosure, and accessible link name.
3. Update `app/components/HotelCard.tsx` for qualifier, full-width compact line, expanded panel copy, state gating, and CTA name.
4. Update `app/components/DealScorePanel.tsx` so the valid “Usual” amount is prefixed by “About” for `scope="hotel"` only.
5. Update `app/book/BookingFlow.tsx` for handoff status copy, approximate price label, `Shown in` fact, guidance, and CTA name.
6. Add or update presentation tests for copy visibility, suppression, and accessible names.

Do not touch `lib/types.ts`, provider adapters, API routes, `lib/money.ts`, `lib/booking/config.ts`, FX utilities, or database code.

## 10. Acceptance criteria

1. **AC1 — DealCard amounts:** every real card displays “About” for current price, “usually about” for median, and “Save about” when savings renders.
2. **AC2 — HotelCard amounts:** every valid HotelCard price and valid hotel-scope “Usual” amount is visibly and accessibly introduced as approximate; route-scope Deal Score values do not change.
3. **AC3 — Handoff amount:** the selected nightly rate is “About {amount}”; local `formatMoney` remains unchanged.
4. **AC4 — Compact disclosure:** the exact shared compact token appears on real DealCard and valid-price collapsed HotelCard, before outbound/review CTAs; it never names a specific charge currency.
5. **AC5 — Payment timing:** handoff and expanded HotelCard state that the provider confirms timing and expaify does not know pay-now vs. pay-at-property. No definitive badge or claim exists.
6. **AC6 — Display basis:** no hotel handoff renders bare `Currency: USD`; it renders `Shown in: USD (converted)` for USD context.
7. **AC7 — Progressive disclosure:** handoff expanded copy is visible before `HotelSummary` and CTA, without interaction; HotelCard expanded copy remains behind its existing Details control.
8. **AC8 — Suppression:** invalid-price HotelCard, invalid hotel handoff, and Example/mock DealCard contain no estimate/currency/payment disclosure.
9. **AC9 — Confidence independence:** score pending, unavailable, low-confidence, and high-confidence states do not alter disclosure when a valid price exists.
10. **AC10 — Accessibility:** visible qualifier and disclosure are screen-reader-exposed; real-card, Review hotel, and Continue to provider accessible names communicate approximate price and charge-currency uncertainty.
11. **AC11 — Responsive:** 375px and 1280px layouts have no overlap, clipping, truncation, or horizontal scroll; compact copy is one naturally wrapping paragraph.
12. **AC12 — Contract:** no new money fields, floats, FX math, currency selection, provider logic, or payment behavior.

## 11. QA scenarios

1. Real DealCard with savings and href: verify all three monetary claims are approximate, compact copy precedes provider links, and link name includes the caveat.
2. Example DealCard: verify sample labels remain and all new disclosure is absent.
3. HotelCard with valid price/high-confidence score: verify compact and expanded densities, source/freshness copy, and CTA name.
4. HotelCard with valid price/low confidence: verify “Limited history” and conversion disclosure remain distinct, the valid “Usual” amount says “About,” and nothing collides at 375px.
5. HotelCard with invalid price: verify all disclosure is suppressed and existing status copy is unchanged.
6. HotelCard with valid price/invalid deeplink: verify amount qualification remains, CTA is unavailable, and no payment claim is injected into the unavailable CTA name.
7. Valid HotelHandoffReview: verify expanded status precedes summary, price says “About,” fact says “Shown in: USD (converted),” and the CTA label includes timing uncertainty.
8. Invalid hotel selection and every flight-booking state: verify no regression and no hotel disclosure leakage.
9. Keyboard-only: traverse linked DealCard, Review hotel, Details, Continue to provider, and Back to search; verify visible focus and expected activation.
10. Screen reader: confirm the sequence in §8 and that “About” is not announced as a symbol or omitted.

## 12. Measurement

- **Comprehension:** after scan and again at handoff, ask which currency will be charged, whether the shown number is exact, and when payment is due. Correct response: the number is approximate; the property may bill in local currency; final currency/amount/timing are confirmed by the provider.
- **CTA confidence:** compare confidence before “Review hotel” and “Continue to provider” against the current surface; disclosure should not reduce median confidence.
- **Reported mismatch:** track reports that checkout/card-statement amount or currency differed from expaify’s display.

No analytics event changes are part of this UI ticket; measurement instrumentation requires separate authorization.

## 13. Out of scope and future data dependency

- Specific charge currency, native-currency amount, conversion timestamp/rate, `isEstimate`, and pay-now/pay-at-property values require provider-sourced fields and a separate DEV/data ticket.
- The future data design may add explicit badges only when a provider adapter returns verified values through `Result<T>`; unknown values must continue to use this generic disclosure.
- `BookingFlow`’s local `formatMoney` duplicate belongs to `results-currency-localization` and must not be changed here.
- Award travel, flight disclosure, taxes/fee calculation, DCC controls, bank-fee prediction, payment collection, cancellation policy, and currency preferences remain out of scope.

## 14. UI handoff

Implement as a UI-only slice. After implementation, run TypeScript and tests, then hand directly to `TEST-LOCAL-CURRENCY-PAYMENT-01`. A DEV stage is not required for this generic disclosure. Specific charge currency or payment timing remains a separate future data ticket.


# UXR-HOTEL-PRICE-VISIBILITY-01: Hotel Price Visibility Research

Date: 2026-07-02
Stage: UX Research
Persona: Senior UX Researcher

## Source Inputs

- Discovery report: `docs/pipeline/hotel-price-visibility/01-discovery.md`
- Current implementation audited:
  - `lib/types.ts`
  - `lib/providers/hotellook.ts`
  - `app/api/search/route.ts`
  - `app/page.tsx`
  - `app/components/HotelCard.tsx`
  - `lib/money.ts`
- Reference patterns checked:
  - Booking.com Demand API pricing guidance: `https://developers.booking.com/demand/docs/accommodations/display-prices`
  - Booking.com accommodation price model: `https://developers.booking.com/demand/docs/accommodations/prices-accommodations`
  - Google Hotel price tax and fee policy: `https://support.google.com/hotelprices/answer/6064432`
  - Google Hotel Prices pricing overview: `https://developers.google.com/hotels/hotel-prices/dev-guide/updating-prices`

## Research Summary

Hotel results currently make the nightly rate visible but do not expose the stay basis that makes the rate financially comparable. A user searching a selected date range sees `Nightly rate`, `per night before taxes and fees`, and provider handoff copy, but not the number of nights or a selected-stay subtotal. The issue is not that expaify should invent a final hotel total. The issue is that expaify has enough selected-date context to show stay length, but the hotel card contract does not receive it, and the `HotelOffer` contract cannot represent a provider-confirmed stay total if one becomes available later.

This leaves users comparing multi-night hotel cards on a one-night mental model. For a paid travel product, that weakens trust because the result card foregrounds a price while withholding the multiplier and total-availability boundary.

## Current Implementation Findings

### 1. `HotelOffer` only carries nightly price

`HotelOffer` defines `pricePerNight: Money` and an optional `priceBasis?: 'per_night_before_taxes_fees'`, but no `checkin`, `checkout`, `nights`, `staySubtotal`, `totalPrice`, taxes, fees, or total-price availability state (`lib/types.ts:137`). The money shape is correct because `Money` is integer minor units, but the hotel offer cannot describe the selected stay's economics beyond a nightly amount.

Impact: the UI has no authoritative field for a total stay price and no explicit contract for saying a total is unavailable.

### 2. Hotellook search receives dates but returns only nightly `priceFrom`

The search route calls `searchHotelAvailability(destIATA, { checkin: depart, checkout: ret })` and streams the provider's hotel offers directly to the client (`app/api/search/route.ts:393`). The Hotellook adapter sends `checkIn` and `checkOut` to the provider (`lib/providers/hotellook.ts:429`) but normalizes only `priceFrom` into `pricePerNight` (`lib/providers/hotellook.ts:451`, `lib/providers/hotellook.ts:469`).

Impact: the provider request is date-aware, but the normalized result loses the selected stay basis. Even if Hotellook's returned rate is date-specific, expaify does not carry enough metadata to explain whether the visible rate applies to one night, the full stay, or only a provider teaser rate.

### 3. `HotelCard` cannot receive stay context

`HotelCard` props are only `hotel`, `score`, and `loading` (`app/components/HotelCard.tsx:400`). `app/page.tsx` renders the card from both loading and settled hotel result branches without passing `submittedCriteria.depart`, `submittedCriteria.returnDate`, or a computed night count (`app/page.tsx:2076`, `app/page.tsx:2157`).

Impact: a UI-only implementation can compute nights in `app/page.tsx` and pass them down, but the card cannot render stay length until the prop contract changes. A complete provider-confirmed total still requires a data-contract change.

### 4. The current price block is clear about exclusions but incomplete for comparison

The collapsed price block labels the amount as `Nightly rate`, formats valid money, and states `per night before taxes and fees`, `Rate from {providerName}`, and `Last-checked time unavailable` (`app/components/HotelCard.tsx:34`). The unavailable state has similarly explicit copy (`app/components/HotelCard.tsx:52`).

Impact: the exclusion copy is directionally honest, but the hierarchy still makes the single-night amount the only visible economic fact. Users need the selected night count beside the nightly amount to compare real trip cost.

### 5. Expanded details repeat price scope but do not resolve it

The details panel includes `Price scope`, `per night before taxes and fees`, `Rate check`, and `Provider handoff` (`app/components/HotelCard.tsx:571`). This repeats the boundary after expansion, but the discovery success statement requires the results list to show stay length and total availability without opening details.

Impact: important price-basis context is secondary, while the collapsed card remains insufficient for fast scanning.

### 6. Hotel score uses nightly rate, not stay cost

The hotel score request passes `pricePerNightCents` and `currency` only (`app/page.tsx:1019`). That may be acceptable if hotel Deal Score is explicitly a nightly-rate comparison, but the UI must not let users confuse the score with full-trip affordability.

Impact: the design should keep Deal Score attached to the nightly rate unless a future scoring contract supports stay totals.

### 7. Empty, unavailable, and skipped states are already present

The search page differentiates hotel not-checked, checking, unavailable, empty, and available statuses (`app/page.tsx:1460`). Empty and unavailable panels already explain provider absence and date changes (`app/page.tsx:1493`).

Impact: the implementation surface already has state infrastructure. The missing work is specifically the hotel-card price basis and total-availability display, not a new inventory-state system.

## Reference Pattern Comparison

### Booking.com

Booking.com's Demand API pricing guidance separates order total, book price, and extra charges. Its display guidance says to use the order's total price when displaying the order and to clearly state whether taxes and charges are included or whether additional charges may apply. It also warns not to collapse extra charges into invented categories.

Pattern takeaway: when a total is known, show it as the primary booking economic fact. When it is not known, name the missing pieces and avoid implying finality.

Current expaify delta: expaify shows a nightly pre-tax rate and provider handoff disclosure, but it does not show the selected stay length or a total-unavailable state. It also lacks a data field where a provider-confirmed total could be displayed later.

### Google Hotels

Google's hotel price policy requires complete and correct tax, fee, and pricing information from partners. Google's hotel price documentation distinguishes all-inclusive pricing from itemized base-rate/tax/fee pricing.

Pattern takeaway: hotel price UIs need an explicit basis: per-night base rate, itemized base/taxes/fees, or all-in total. The UI should not blur those scopes.

Current expaify delta: expaify has a truthful per-night label, but the result card does not explicitly say `X nights selected` or `Total unavailable from provider`. That missing basis makes the card less transparent than the reference pattern even though it avoids false totals.

## Exact Gap

Current code does this:

- Requests hotel availability with check-in and checkout dates.
- Normalizes provider data into `pricePerNight` only.
- Renders `Nightly rate` as the dominant hotel price.
- States `per night before taxes and fees`.
- Defers final total, taxes, fees, availability, and terms to provider handoff copy.
- Does not show selected stay length in the collapsed hotel card.
- Does not expose a provider-confirmed total or explicit total-unavailable state.

Reference patterns do this:

- Identify whether the shown price is a total, a book price, a base rate, or an itemized amount.
- Prefer total payable when available.
- Clearly disclose included/excluded taxes and fees.
- Avoid inventing totals or charge categories when provider data is missing.

The delta:

- expaify needs a stay-price basis layer. It should show the selected night count from the user's dates on every hotel card, show a provider-confirmed total only when the data contract carries one, and otherwise state that the provider has not returned a total stay price.

## Design Directives For UXDES

1. Make selected stay length visible on every hotel card.
   - Collapsed card must show `N-night stay` derived from selected check-in and checkout dates.
   - Use `1-night stay` for one night and `N-night stay` for all other positive counts.
   - If dates are missing or invalid, show `Stay length unavailable` and keep the existing provider handoff boundary.

2. Keep nightly rate as primary only when no total is available.
   - Current Hotellook data should render the money as `Nightly rate`.
   - Directly below or beside it, show `N-night stay` and `Total not returned by provider`.
   - Do not multiply `pricePerNight` by nights and present it as a confirmed total.

3. Define the future total-price state without inventing data now.
   - If a future `stayTotal` exists, it must use `{ priceCents: number; currency: string }`.
   - The visible label should be `Stay total` only for provider-returned totals.
   - The supporting copy must say whether taxes and fees are included, excluded, or unknown.

4. Add explicit unavailable states for price basis.
   - Valid nightly price plus no total: show nightly rate, selected nights, and `Total not returned by provider`.
   - Invalid nightly price: keep `Price unavailable`; also show selected nights if dates are valid.
   - Valid booking link missing: keep `Booking unavailable`; do not hide the price-basis disclosure.
   - Provider unavailable or empty states should continue using existing result panels, with no fake card totals.

5. Preserve scanability at 375px and 1280px.
   - At 375px, the price block must not squeeze hotel name, class/rating chips, location, Deal Score, or CTA into overlap.
   - If necessary, stack the economic facts as: money, rate basis, night count, total status.
   - Desktop cards may use a compact right-aligned block, but the same facts must remain visible without opening details.

6. Align Deal Score language with nightly-rate scoring.
   - If the score still uses `pricePerNightCents`, the design must label the score as based on the nightly rate or avoid implying full-stay affordability.
   - Do not compare a nightly score against a provider-returned stay total unless DEV changes the scoring contract.

7. Include accessible price-basis text.
   - The hotel review CTA aria-label must include nightly rate, stay length, total-availability state, and provider final-total boundary.
   - The price block should expose one coherent screen-reader sentence, not separate fragments that omit the stay length.

## Acceptance Criteria For UXDES

- The design spec covers default, loading, empty, error/unavailable, price unavailable, booking-link unavailable, total unavailable, future total available, mobile 375px, desktop 1280px, focus/keyboard, and assistive-tech text.
- The collapsed hotel card always shows selected stay length when check-in and checkout dates are valid.
- The design never displays a computed `nightly rate * nights` value as a confirmed total.
- The design provides final copy for: `Nightly rate`, `N-night stay`, `Total not returned by provider`, provider-returned `Stay total`, tax/fee included/excluded/unknown states, and provider confirmation boundary.
- The design identifies UI-only versus DEV needs. Current evidence supports a UI change for selected night count, but a complete provider-confirmed total requires DEV changes to `HotelOffer`, provider adapters, and tests.
- At 375px, the user can read hotel name, nightly rate, stay length, total status, Deal Score state, and CTA without overlapping text or opening details.

## Out Of Scope Findings

- This ticket should not change hotel provider choice, hotel search availability logic, or the booking handoff flow.
- Hotel Deal Score currently uses nightly price; changing it to score total stay cost is a separate DEV/scoring contract decision.
- The worktree contains unrelated modified files before this UXR stage. This research brief does not evaluate those changes beyond the audited hotel-price surface.

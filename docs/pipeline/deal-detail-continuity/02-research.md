# UXR-DEAL-DETAIL-CONTINUITY-01: Deal Detail Continuity

## Source Inputs

- Discovery: `docs/pipeline/deal-detail-continuity/01-discovery.md`
- Current surfaces audited:
  - `app/deals/[dealId]/page.tsx`
  - `lib/deals/dealDetail.ts`
  - `lib/deals/dealDetailTypes.ts`
  - `app/components/FlightCard.tsx`
  - `app/components/HotelCard.tsx`
  - `app/components/DealBadge.tsx`
  - `app/components/DealScorePanel.tsx`
  - `lib/types.ts`
  - `lib/money.ts`
- Next.js local docs checked before app surface analysis:
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
- Reference patterns:
  - Google Flights and Google Travel Help price tracking patterns: route/date-specific tracking, price movement, and confidence around estimates.
  - Booking.com pricing and availability patterns: price descriptions, taxes/fees boundaries, availability volatility, and final provider confirmation.

## Research Summary

The deal detail page gives users a visually complete destination, but it does not preserve the same structured decision context that result cards expose before the click. Flight and hotel result cards treat route or stay facts, price basis, provider action eligibility, and Deal Score confidence as explicit state. The detail page treats most of that continuity as optional metadata and local fallback copy.

The core UX gap is not that the detail page is empty. The gap is evidence continuity. A paid user can see a price, title, provider, updated timestamp, and a score block, but the page can still fail to answer: "Is this the exact fare or stay I clicked, what normal price was it compared against, and can I still act on it?"

## Current Implementation Audit

### Deal Detail Page

`app/deals/[dealId]/page.tsx` is a server component using the Next 15 async `params` pattern correctly (`app/deals/[dealId]/page.tsx:5` to `app/deals/[dealId]/page.tsx:7`, `app/deals/[dealId]/page.tsx:140` to `app/deals/[dealId]/page.tsx:142`). The route convention itself is not the issue.

The page formats detail price from `deal.price` and `deal.currency` (`app/deals/[dealId]/page.tsx:9` to `app/deals/[dealId]/page.tsx:15`, `app/deals/[dealId]/page.tsx:146`) and labels it only `Price` (`app/deals/[dealId]/page.tsx:194` to `app/deals/[dealId]/page.tsx:201`). It does not show whether the amount is a traveler fare, party total, nightly rate, or includes taxes/fees.

The primary identity uses `title` and `subtitle` (`app/deals/[dealId]/page.tsx:187` to `app/deals/[dealId]/page.tsx:191`), while route and stay facts come from filtered arbitrary metadata (`app/deals/[dealId]/page.tsx:76` to `app/deals/[dealId]/page.tsx:97`, `app/deals/[dealId]/page.tsx:238` to `app/deals/[dealId]/page.tsx:250`). If metadata is empty, malformed, truncated, or uses an unsupported key, the detail page still renders without an explicit missing-context state.

Deal Score presentation is duplicated locally instead of using the shared badge or panel. The page computes local score classes, labels, summary text, and evidence details (`app/deals/[dealId]/page.tsx:99` to `app/deals/[dealId]/page.tsx:137`) and renders them in a bespoke block (`app/deals/[dealId]/page.tsx:204` to `app/deals/[dealId]/page.tsx:225`). That creates drift from `DealBadge` and `DealScorePanel`, which are already used by result surfaces.

The score fallback is ambiguous. If `scoreVerdict` and `dealScore` exist without confidence or evidence fields, the page can render confident copy like a deal score summary (`app/deals/[dealId]/page.tsx:116` to `app/deals/[dealId]/page.tsx:121`). If explanation is missing, it falls back to "Not enough pricing history to explain this price yet" (`app/deals/[dealId]/page.tsx:223` to `app/deals/[dealId]/page.tsx:225`) without distinguishing score unavailable, low confidence, incomplete persisted evidence, or missing baseline lineage.

Missing booking links get a visible unavailable panel (`app/deals/[dealId]/page.tsx:267` to `app/deals/[dealId]/page.tsx:273`), which is good. However, expired deals are only shown as an `Expires` pill when `expiresAt` exists (`app/deals/[dealId]/page.tsx:180` to `app/deals/[dealId]/page.tsx:183`); the page does not define a post-expiration action state.

### Deal Detail Data Model

`DealDetail` models price as `price: number` plus `currency: string` (`lib/deals/dealDetailTypes.ts:12` to `lib/deals/dealDetailTypes.ts:13`). That diverges from the shared money contract in `lib/types.ts`, where money is `{ priceCents: number; currency: string }`.

`dealRowToDetail` accepts either `price_cents` or `price`, maps it into `price`, and returns the detail when required scalar fields exist (`lib/deals/dealDetail.ts:133` to `lib/deals/dealDetail.ts:175`). It does not require structured flight fields such as origin, destination, dates, cabin, stops, passenger count, or price scope. It also does not require structured hotel fields such as area, check-in, check-out, nights, guests, room type, or price basis.

Score evidence fields are independently optional (`lib/deals/dealDetail.ts:164` to `lib/deals/dealDetail.ts:169`). The data layer can produce partial score state that the UI turns into confident-looking copy.

`getDealDetail` returns `null` for invalid IDs, missing rows, invalid rows, and a missing `deals` table (`lib/deals/dealDetail.ts:178` to `lib/deals/dealDetail.ts:203`). The page maps all of those to `notFound()` (`app/deals/[dealId]/page.tsx:142` to `app/deals/[dealId]/page.tsx:144`). A user cannot distinguish a stale saved deal, a bad link, unavailable storage, or a truly nonexistent deal.

### Entry Result Cards

Flight result cards preserve structured decision context in first-class fields: origin, destination, carrier, stops, trip type, current price, price scope, provider handoff eligibility, CTA aria labels, and schedule details (`app/components/FlightCard.tsx:262` to `app/components/FlightCard.tsx:303`, `app/components/FlightCard.tsx:313` to `app/components/FlightCard.tsx:334`, `app/components/FlightCard.tsx:397` to `app/components/FlightCard.tsx:411`). This context is not guaranteed on the detail page.

Flight result cards also label unavailable provider or price states before the user acts (`app/components/FlightCard.tsx:268` to `app/components/FlightCard.tsx:284`, `app/components/FlightCard.tsx:341` to `app/components/FlightCard.tsx:367`). The detail page has a provider-link unavailable state, but not a price-basis or expired-deal action state.

Hotel cards preserve nightly-rate basis, before-tax/fee copy, provider confirmation, and invalid booking URL handling (`app/components/HotelCard.tsx:110` to `app/components/HotelCard.tsx:115`, `app/components/HotelCard.tsx:164` to `app/components/HotelCard.tsx:204`). The detail page can show hotel metadata such as room type or guests, but only if arbitrary metadata happens to contain those keys.

Shared score presentation now exists in `DealScorePanel`. It includes unavailable, loading, high confidence, low confidence, usual price, vs usual, and `Last 90 days` evidence (`app/components/DealScorePanel.tsx:90` to `app/components/DealScorePanel.tsx:187`). It also uses `DealBadge` to ensure low-confidence scores render as `Limited history` (`app/components/DealScorePanel.tsx:164` to `app/components/DealScorePanel.tsx:166`; `app/components/DealBadge.tsx:14`). Detail does not use that shared pattern.

## Reference Pattern Comparison

### Google Flights

Google Flights keeps price insight tied to the trip scope: route, dates, selected flight, tracking state, and price movement. Google Travel Help describes tracking by specific flights, routes, and dates, and separates price changes from confidence in estimates. Source: https://support.google.com/travel/answer/6235879

Interaction pattern implication: when users move from a result into a detail or review state, the price insight should stay attached to the exact route/date context and should disclose confidence separately from the current price.

Delta for expaify: the result card has exact route/date/price-scope context, but the detail page may only have title, subtitle, optional metadata, and partial score fields. Deal Score evidence can become less specific after the click.

### Booking.com

Booking.com's public pricing guidance says taxes and fees can vary by provider, room, and guest count, and that price descriptions indicate what is included or excluded. Source: https://www.booking.com/content/how_we_work.html

Booking.com's Demand API pricing guide also treats availability and pricing as volatile and says price discrepancies can happen because inventory, restrictions, country-based pricing, and regulatory requirements can change between availability and later order preview. Source: https://developers.booking.com/demand/docs/accommodations/prices-accommodations

Interaction pattern implication: detail pages should keep dates, guests, room/rate basis, availability state, and final provider confirmation boundaries visible near price and CTA. Missing availability or stale booking links should not be collapsed into a generic not-found path when a trust-preserving unavailable state can explain what changed.

Delta for expaify: hotel result cards already say the nightly rate is before taxes and fees and that the provider confirms final total, room availability, cancellation policy, and terms. Saved detail can lose that basis unless metadata carries it, and can present arbitrary metadata as confirmed facts.

## Exact Gap

Current code does this:

- Stores deal detail price as a bare integer plus currency.
- Requires title, subtitle, provider, kind, price, currency, and updated time.
- Treats route and stay facts as optional metadata.
- Treats score verdict, score confidence, explanation, percentile, and percent-versus-median as optional independent fields.
- Recreates Deal Score badge and panel behavior locally.
- Maps missing deals, invalid rows, and missing `deals` table to `notFound()`.
- Shows provider-link unavailable, but does not define expired, stale, incomplete-score, or missing-context states.

Reference patterns do this:

- Keep the selected itinerary or stay context attached to the price.
- Label price basis, taxes/fees boundaries, and provider confirmation.
- Separate historical price confidence from current availability.
- Preserve unavailable states in-product instead of making every missing detail look like a wrong URL.

The delta:

- expaify needs a typed continuity model and detail hierarchy that preserves the same decision facts from result to detail: exact price money, route or stay context, price basis, score evidence, freshness, and provider action state.

## Design Directives for UXDES

1. Define a required visible identity block by deal kind. Flight detail must visibly reserve fields for `origin`, `destination`, `depart`, optional `return`, `carrier`, `stops`, `cabin`, passenger count, and price scope. Hotel detail must visibly reserve fields for hotel name, area, check-in, check-out, nights, guests, room/rate basis when known, and nightly price basis. If a required continuity field is absent, show a labeled unavailable row such as `Route unavailable` or `Stay dates unavailable`; do not silently omit the slot.

2. Replace generic price presentation with a Money-aligned price fact. The design must specify price as `{ priceCents, currency }` and display the price label by basis: `Traveler fare`, `Passenger total`, or `Nightly rate before taxes and fees`. If basis is unknown, use `Current price` plus conservative helper copy: `Provider confirms final price and availability.`

3. Align detail Deal Score with the shared evidence pattern. Detail must use the same verdict language as `DealBadge`: high-confidence `Great`, `Good`, `Typical`; low-confidence `Limited history`; unavailable `Deal Score unavailable`. The detail score section must show `Usual`, `Vs usual`, `Window`, confidence rule, and explanation only when a complete score evidence object exists. Partial persisted score fields must render as unavailable or incomplete evidence, not as a confident verdict.

4. Define explicit unavailable states for missing data. UXDES must cover missing metadata, missing score evidence, missing booking URL, expired deal, stale updated timestamp, invalid/missing deal row, and missing `deals` table/data. A missing booking URL should keep the detail visible with action disabled. A missing or unavailable deal store should use a recoverable page state with copy like `Deal details unavailable right now`, a back-to-search action, and no inferred price or score facts.

5. Preserve action freshness at the CTA. The primary CTA area must always answer whether the user can act now: `Check availability with {provider}` when `bookingUrl` exists and the deal is not expired; `Provider link unavailable` when no valid link exists; `Deal expired` when `expiresAt` is in the past. The helper copy must state that provider prices and availability can change, and must not promise bookability.

6. Keep mobile and desktop hierarchy scan-first. At 375px, price, route/stay identity, Deal Score badge or unavailable state, updated time, and action state must fit before long metadata or imagery. At 1280px, media may support the page, but it must not be the primary carrier of context, and missing imagery must not look like loading.

## Acceptance Criteria for UXDES

- The spec defines separate flight and hotel detail information architecture with required visible slots and explicit unavailable copy.
- The spec uses the shared money contract and does not allow a bare `price` number in UI copy or state naming.
- The spec defines complete, low-confidence, partial, missing, and loading score states using shared `DealBadge`/`DealScorePanel` semantics.
- The spec covers valid booking link, missing booking link, expired deal, stale deal, invalid deal ID, missing deal row, invalid row, and missing data-store states.
- At 375px, a user can confirm price, route or stay context, score state, updated time, and CTA state without opening metadata expansion or relying on image text.
- At 1280px, detail content remains aligned with result-card hierarchy: identity and price first, Deal Score evidence second, provider action third.
- Keyboard users can reach back navigation and CTA/unavailable action state in a logical order, and unavailable states are readable without color.

## Out-of-Scope Findings

- `app/deals/[dealId]/page.tsx` uses hardcoded dark colors and a decorative radial gradient rather than only tokenized surfaces (`app/deals/[dealId]/page.tsx:150`, `app/deals/[dealId]/page.tsx:158` to `app/deals/[dealId]/page.tsx:169`). This affects visual consistency but should be handled in UI implementation after the design spec.
- Detail image `alt` is empty even when an image exists (`app/deals/[dealId]/page.tsx:161` to `app/deals/[dealId]/page.tsx:164`). UXDES should decide whether detail imagery is decorative or informational.
- Existing worktree changes touch result cards and score presentation files. This research did not modify product code or inspect those changes as authored work.

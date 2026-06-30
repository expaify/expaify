# AUDIT-UX-01: UX and Functionality Audit

Date: 2026-06-30
Role: Senior QA Engineer

## Scope

Audited the current app surface from code and tests for search, results, deal score, hotels, baggage, booking, and deal-detail flows. This was intentionally an audit only; no product or backend fixes were implemented.

Files inspected first: `app/page.tsx`, `app/components/AirportInput.tsx`, `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/DealBadge.tsx`, `app/api/search/route.ts`, `app/api/score/route.ts`, `app/api/book/route.ts`, `app/book/page.tsx`, `app/book/BookingFlow.tsx`, `components/search/SearchPanel.tsx`, `components/search/TripInspirationRail.tsx`, `components/flights/FlightResults.tsx`, `components/baggage/BaggageFeeEstimator.tsx`, `app/deals/[dealId]/page.tsx`, `lib/types.ts`, and `lib/providers/index.ts`.

## Executive Decision

Stop broad feature work until the P0 repair tickets below are complete. Continue only narrowly scoped repairs for search trust, score presentation, booking gating, and hotel tab behavior. The site currently presents unsupported or weakly supported flows as complete product paths, which directly harms trust.

## Findings

### 1. P0: Booking flow can attempt real Duffel order creation from an unqualified UI

Evidence: Flight cards link every Duffel offer to `/book?offerId=...` through provider deeplinks and render that as "Book flight" (`lib/providers/duffel.ts`, `app/components/FlightCard.tsx:286`). The booking form then posts passenger data to `/api/book` (`app/book/BookingFlow.tsx:32`) and the API creates an instant Duffel order with balance payment (`app/api/book/route.ts:106`).

Repro:
1. Get a Duffel-backed search result.
2. Click "Book flight".
3. Enter passenger details.
4. Submit "Confirm booking".

Impact: The MVP has not established confirmed credentials, terms, payment readiness, price revalidation, passenger count handling, cancellation disclosures, or checkout review. A user can enter sensitive information into a flow that may fail, or worse, create an order without the expected booking safeguards.

### 2. P0: Booking page loses all fare context and shows raw offer ID instead of a review step

Evidence: `BookingFlow` reads only `offerId` from the URL (`app/book/BookingFlow.tsx:13`) and displays it as raw metadata (`app/book/BookingFlow.tsx:95`). It never shows route, dates, carrier, price, passengers, baggage assumptions, refund/cancel terms, or score context before confirmation.

Repro:
1. Open `/book?offerId=off_anything`.
2. Observe the page shows "Complete your booking" and an offer ID, with no trip review.

Impact: This is not a trustworthy booking experience. Users cannot verify what they are buying before submitting personal data.

### 3. P0: Hotel tab is exposed even when hotel supply is effectively unavailable

Evidence: Search always renders Flights/Hotels tabs (`app/page.tsx:800`) and hotels are fetched only after flight providers finish and only for destination + depart + return (`app/api/search/route.ts:144`). The provider is HotelLook and depends on `TP_TOKEN` plus a Travelpayouts hotel endpoint (`lib/providers/hotellook.ts:41`). The product briefing calls this a dead API; the UI still presents hotel search as a live first-class path and renders "Book hotel" via HotelLook (`app/components/HotelCard.tsx:126`).

Repro:
1. Run a normal round-trip search with destination and return date.
2. Switch to Hotels.
3. Expect either zero results or a generic "No hotels found" state with no provider availability explanation.

Impact: The homepage promises "Flights + Hotels ranked by real deal quality" while the hotel supply path is unreliable. This is a fake-data/fake-flow risk even if no fabricated hotels are rendered.

### 4. P1: Deal Score is not consistently visible or explanatory, weakening the trust anchor

Evidence: Flight cards render no score UI for `Typical` verdicts because `DealBanner` returns null (`app/components/FlightCard.tsx:171`). For Great/Good, it shows a generated sparkline from sine-wave noise (`app/components/FlightCard.tsx:176`) rather than real history. Hotel cards show only `DealBadge` with verdict/confidence (`app/components/HotelCard.tsx:100`, `app/components/DealBadge.tsx:27`) and omit percentile, median, pct vs median, and the required plain-language explanation.

Repro:
1. Search a route where scores resolve to Typical or low confidence.
2. Observe many cards have no visible score or explanation.
3. For Great/Good, observe "30-day trend" is decorative, not a real trend.

Impact: The app's differentiator becomes decorative and inconsistent. Users cannot answer "is this actually a good price, and what would I normally pay?"

### 5. P1: "Best deal" sort does not sort by deal quality

Evidence: `displayFlights` only sorts when `sortBy === 'price'`; the default `deal` option leaves provider/arrival order unchanged (`app/page.tsx:438`). The UI labels the control "Best deal" (`components/flights/FlightResults.tsx:74`) even though it does not use score, percentile, verdict, confidence, or price.

Repro:
1. Run a search returning multiple fares.
2. Toggle "Lowest price" and "Best deal".
3. Observe "Best deal" reverts to stream/dedupe order, not score order.

Impact: Users are told results are ranked by deal quality when ranking is not implemented. This is a core trust regression.

### 6. P1: Provider notices are streamed but discarded by the main UI

Evidence: `/api/search` sends `notice` messages for Travelpayouts failures and hotel failures (`app/api/search/route.ts:123`, `app/api/search/route.ts:149`). The client parser handles `flights`, `hotels`, `suggestion`, and `done`, but ignores `notice` (`app/page.tsx:365`).

Repro:
1. Search with missing or failing provider credentials.
2. API streams a `notice`.
3. UI shows only empty results or a generic error/empty state.

Impact: Users cannot distinguish "no deals exist" from "provider unavailable." This makes empty states misleading.

### 7. P1: Search allows incomplete date combinations that silently disable live providers

Evidence: The main form does not require departure or return dates (`app/page.tsx:547`, `app/page.tsx:563`). Duffel intentionally returns no data without a valid future depart date (`lib/providers/duffel.ts:56`). Hotels require destination + depart + return (`app/api/search/route.ts:144`). The result empty state suggests changing dates, but the form does not set expectations before submitting (`components/flights/FlightResults.tsx:116`).

Repro:
1. Search with origin and destination but no depart date.
2. Observe the results page can show no live booking fares without explaining that date is required for live providers.

Impact: The user experiences a broken search even though the problem is missing input. This is avoidable UX debt.

### 8. P1: Mobile search form is cramped and risk-prone at 375px

Evidence: The primary search row is hard-coded to three columns on all viewport widths (`app/page.tsx:501`): origin, 40px swap button, destination. Long airport display values must fit into half-width fields. Date inputs are also two columns for round trip (`app/page.tsx:540`).

Repro:
1. Open the homepage at 375px.
2. Select long city/airport names such as "New York (JFK)" and "Los Angeles (LAX)".
3. Observe the primary inputs remain side-by-side instead of stacking.

Impact: The most important interaction is crowded on mobile. It raises the chance of clipped text, mistaps, and low-quality first impression.

### 9. P1: Alert signup can silently fail

Evidence: `handleAlertSubmit` only sets success on `response.ok` and does nothing visible on failure (`app/page.tsx:399`). The API can fail validation or DB insert (`app/api/alerts/route.ts:41`, `app/api/alerts/route.ts:93`).

Repro:
1. Submit alert signup when DB is unavailable or validation fails.
2. Observe no user-facing failure state.

Impact: Users think the app ignored them. This damages trust after they provide an email address.

### 10. P2: Duplicate search surfaces are drifting

Evidence: The home page has its own full search UI (`app/page.tsx:448`) while `components/search/SearchPanel.tsx` implements another search panel with trip inspiration (`components/search/SearchPanel.tsx:46`). The tested SearchPanel is not the homepage surface, and its inspiration selection formats displays as `IATA (IATA)` (`components/search/SearchPanel.tsx:192`) rather than city names.

Impact: Tests can pass on a component that users do not see, while the real homepage remains untested. Future changes may repair the wrong surface.

## Prioritized Repair Sequence

### Ticket 1: REPAIR-BOOK-01: Gate or remove unsafe booking flow

Files: `app/components/FlightCard.tsx`, `app/book/BookingFlow.tsx`, `app/api/book/route.ts`, `lib/providers/duffel.ts`

Goal: Prevent users from entering passenger data or creating Duffel orders unless booking is explicitly enabled and the UI has a trustworthy review step.

Out of scope: Full checkout redesign, payment integration, order management, cancellations.

Acceptance criteria:
- If booking is not enabled by env/config, Duffel fares show an external/provider-safe action or disabled state, not "Confirm booking."
- `/book` without a valid enabled booking context shows a clear unavailable state.
- `/api/book` refuses order creation unless booking is explicitly enabled.
- No raw offer ID is the primary booking context shown to users.

### Ticket 2: REPAIR-SCORE-01: Make Deal Score visible, honest, and useful on every result

Files: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/DealBadge.tsx`, `components/flights/FlightResults.tsx`

Goal: Show verdict, confidence, median/usual price, percent vs median, and explanation consistently. Remove fake/generated trend visuals unless backed by real data.

Out of scope: Changing `scoreDeal` math or provider contracts.

Acceptance criteria:
- Every scored flight displays a score state, including Typical and low confidence.
- Great is never visually implied for low-confidence data.
- Score explanation from `DealScore.explanation` is visible or reachable.
- No fake "30-day trend" is rendered from generated data.

### Ticket 3: REPAIR-SEARCH-01: Fix search ranking, notices, and required-input states

Files: `app/page.tsx`, `components/flights/FlightResults.tsx`, `app/api/search/route.ts`

Goal: Make search states honest and actionable.

Out of scope: Adding new providers or changing provider response shapes.

Acceptance criteria:
- "Best deal" sorts by score quality once scores arrive, with deterministic fallbacks.
- Provider `notice` messages are surfaced in a restrained results-level status area.
- Missing departure date and missing return date states are explained before empty results look like "no deals."
- Empty state distinguishes no inventory, provider unavailable, and incomplete search.

### Ticket 4: REPAIR-HOTEL-01: Stop presenting dead hotel supply as a complete product path

Files: `app/page.tsx`, `app/api/search/route.ts`, `app/components/HotelCard.tsx`, `lib/providers/hotellook.ts`

Goal: Make the hotel tab honest until a working HotelProvider is available.

Out of scope: Integrating a new hotel provider.

Acceptance criteria:
- Hotel tab is hidden, disabled, or clearly marked unavailable when provider is not configured/healthy.
- Hotel empty states explain availability instead of implying no hotels exist.
- Hotel cards do not render "Book hotel" unless a valid deeplink with affiliate marker exists.

### Ticket 5: REPAIR-MOBILE-01: Repair the 375px homepage search layout

Files: `app/page.tsx`, `app/components/AirportInput.tsx`, `app/globals.css`

Goal: Make the primary search form usable and readable at 375px.

Out of scope: Brand redesign or new marketing content.

Acceptance criteria:
- Origin/destination stack or otherwise fit without clipping at 375px.
- Date fields are usable without horizontal crowding.
- Swap control remains reachable and does not obscure inputs.
- Long airport names do not overlap adjacent controls.

## Stop/Continue Recommendation

Stop: Any current feature ticket that adds awards, trip inspiration, booking expansion, hotel expansion, calendar expansion, or additional decorative UI.

Continue: Narrow repair tickets above, provider contract tests, score presentation tests, booking safety tests, and mobile layout regression checks.

## Non-Functioning and Fake-Data Risk Callouts

- Booking is a non-functioning or unsafe flow unless Duffel order creation is explicitly production-ready.
- Hotels are presented as live product scope while the current provider path is unreliable/dead per briefing.
- "Best deal" is a fake ranking label until it actually sorts by Deal Score.
- Flight trend sparkline is fake/generated data and should not be labeled as a 30-day trend.
- Provider failure notices are hidden, causing provider outages to masquerade as no inventory.


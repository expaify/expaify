# AUDIT-POSTREPAIR-01: Post-Repair UX and Functionality Audit

Date: 2026-06-30  
Role: Senior QA Engineer

## Scope

Strict audit only. No product code was changed.

Inspected current code paths for homepage search, result cards, alerts, booking, deals, hotels, score, baggage, and provider errors:

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/components/AlertSignup.tsx`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `app/api/book/route.ts`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/alerts/route.ts`
- `app/api/baggage/route.ts`
- `components/baggage/BaggageFeeEstimator.tsx`
- `app/deals/[dealId]/page.tsx`
- `lib/booking/config.ts`
- `lib/search/sortFlights.ts`
- `lib/scoring/scoreDeal.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/amadeus.ts`
- `lib/providers/kiwi.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`
- `lib/db/schema.sql`
- `scripts/snapshot-job.ts`

Product briefing assumptions were taken from the assigned ticket and repo-accessible material. I searched the workspace for `safe-space`, `safe space`, `briefing`, `product briefing`, and `assumptions`; no separate `admin/safe-space` material was accessible in this worktree.

## Executive Decision

No P0 issues remain from the first repair wave based on the inspected code.

The major unsafe booking issue is gated: `BOOKING_ENABLED` must be exactly `true` before `/api/book` creates a Duffel order (`app/api/book/route.ts:40`), booking now requires fare context (`app/api/book/route.ts:56`), and `/book` shows a paused recovery state when booking is disabled (`app/book/BookingFlow.tsx:198`). Provider notices, alert errors, mobile search stacking, basic score honesty, and baggage unavailable states also have visible repairs.

Remaining issues are P1/P2 data trust and consistency defects.

## Closed Prior Findings With Current Evidence

- Booking order creation is no longer reachable by default. `/api/book` returns 503 unless `BOOKING_ENABLED === 'true'` (`app/api/book/route.ts:40`).
- Booking page no longer relies on raw `offerId` only. It parses fare context from query params (`app/book/page.tsx:13`) and displays route, carrier, stops, dates, provider, offer, and price (`app/book/BookingFlow.tsx:43`).
- Provider notices are no longer discarded. The stream parser stores `notice` messages (`app/page.tsx:397`) and `FlightResults` renders them (`components/flights/FlightResults.tsx:104`).
- Alert signup failures are visible. Failed responses set `alertError` (`app/page.tsx:446`) and the results UI renders it (`components/flights/FlightResults.tsx:220`).
- Mobile origin/destination layout now stacks below `sm` (`app/page.tsx:549`), and date fields also stack on mobile (`app/page.tsx:587`).
- Flight Deal Score now renders Typical and low-confidence score states, with explanations and no fake 30-day trend (`app/components/FlightCard.tsx:129`, `app/components/FlightCard.tsx:240`).
- "Best deal" now uses a shared score-aware sorter (`app/page.tsx:477`, `lib/search/sortFlights.ts:42`).
- Baggage estimate failures now render a distinct unavailable state (`components/baggage/BaggageFeeEstimator.tsx:146`).

## Findings

### 1. P1: Passenger count is accepted in search but ignored by live fare providers

Evidence: The homepage sends `passengers` to `/api/search` (`app/page.tsx:355`) and the results header displays `x passengers` when more than one passenger is selected (`app/page.tsx:814`). The search route parses passengers into `range` (`app/api/search/route.ts:68`) but `FlightProvider.searchFares` does not include passengers in its type contract (`lib/types.ts:52`). Duffel always sends one adult (`lib/providers/duffel.ts:103`), Amadeus always sends one adult (`lib/providers/amadeus.ts:145`), and Kiwi always sends `adults=1` (`lib/providers/kiwi.ts:79`).

Repro:

1. On the homepage, set passengers to 2 or more.
2. Search a Duffel/Amadeus/Kiwi-backed route.
3. Inspect the provider request body/query from code: each provider requests one adult.
4. Observe the UI still labels the result set as multiple passengers.

Impact: Users can believe results reflect party size when live providers priced one traveler. This directly affects booking trust and price accuracy.

### 2. P1: Duffel cache key can reuse wrong live fares across return dates and passenger counts

Evidence: Duffel builds slices from both `depart` and optional `return` (`lib/providers/duffel.ts:84`) but caches only `origin`, `dest`, and `departDate` (`lib/providers/duffel.ts:78`). The provider also ignores passenger count as above. A one-way search and a round-trip search for the same origin, destination, and departure date can hit the same cache entry.

Repro:

1. Search `SFO -> ORD` one-way on `2026-10-01`.
2. Search `SFO -> ORD` round trip with return `2026-10-08`.
3. The second request uses cache key `duffel:search:SFO:ORD:2026-10-01` in both cases.

Impact: The app can show stale or structurally wrong Duffel fares for the requested itinerary. This is high trust risk because Duffel is the in-app booking provider path.

### 3. P1: Amadeus configuration conflicts with the non-negotiable env contract

Evidence: The briefing requires `AMADEUS_ID` and `AMADEUS_SECRET`. The provider reads `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET` (`lib/providers/amadeus.ts:53`, `lib/providers/amadeus.ts:57`), and the tests codify those non-briefing names (`lib/providers/__tests__/amadeus.test.ts:107`).

Repro:

1. Configure env with `AMADEUS_ID` and `AMADEUS_SECRET` only, per the ticket briefing.
2. Run a destination search.
3. `AmadeusProvider.searchFares` returns `Amadeus not configured` because it never reads those vars (`lib/providers/amadeus.ts:103`).

Impact: A correctly configured deployment per product contract will silently lose an intended live fare source.

### 4. P1: Hotel prices are likely stored/displayed in the wrong minor-unit scale

Evidence: `HotelLook` requests `currency=USD` (`lib/providers/hotellook.ts:61`) and maps `priceFrom` directly to `priceCents` with `Math.trunc(priceCents)` (`lib/providers/hotellook.ts:74`, `lib/providers/hotellook.ts:82`). The field name in our contract is integer minor units, but the provider variable is sourced from an API price field, not a cents field. Tests reinforce the current mapping by expecting `priceFrom: 12999` to become `priceCents: 12999` (`lib/providers/__tests__/hotellook.test.ts:66`, `lib/providers/__tests__/hotellook.test.ts:91`).

Repro:

1. Mock or receive a HotelLook response with `priceFrom: 129`.
2. `HotelCard` formats `pricePerNight.priceCents` by dividing by 100 (`app/components/HotelCard.tsx:49`).
3. The card renders `$1.29` instead of `$129`.

Impact: Hotel cards and hotel snapshots can understate prices by 100x, and those bad values feed hotel score baselines (`scripts/snapshot-job.ts:54`).

### 5. P1: Hotel Deal Score presentation is still materially weaker than flight Deal Score

Evidence: Hotel cards render only `DealBadge` for scored hotels (`app/components/HotelCard.tsx:111`). They omit percentile, pct vs median, median/usual price, and `DealScore.explanation`, while flight cards show a full score panel (`app/components/FlightCard.tsx:129`). The product differentiator is supposed to answer "is this actually a good price, and what would I normally pay?"

Repro:

1. Return any hotel with a score from `/api/score?type=hotel`.
2. Observe the hotel card shows only `Great`, `Good`, `Typical`, or `Limited history`.
3. There is no visible usual price, percent vs median, percentile, or plain-language explanation.

Impact: Hotels are now gated more honestly, but when hotels do render, their deal quality is not explained to the same acceptance level as flights.

### 6. P2: Best-deal ranking jumps while scores stream in

Evidence: `sortFlights` puts unscored fares last (`lib/search/sortFlights.ts:21`) and the homepage recomputes display order every time `scores` changes (`app/page.tsx:477`). Score requests fire asynchronously for each new fare (`app/page.tsx:383`). There is no "ranking pending" lock or stable pre-score order.

Repro:

1. Run a search returning multiple fares.
2. Watch result order while individual `/api/score` calls resolve.
3. Cards can move as each score arrives because the sorter starts using score rank immediately.

Impact: This is not data corruption, but it can make the results feel unstable and cause users to click the wrong card if ordering shifts under them.

### 7. P2: Amadeus outbound deeplinks do not carry affiliate markers

Evidence: Amadeus fares build a generic `https://www.amadeus.com/en/search?...` deeplink (`lib/providers/amadeus.ts:200`). The briefing requires affiliate markers on outbound deeplinks. Travelpayouts and HotelLook have marker logic (`lib/providers/travelpayouts.ts:67`, `lib/providers/hotellook.ts:37`); Amadeus does not.

Repro:

1. Configure Amadeus credentials using the names currently expected by code.
2. Search a route that returns Amadeus fares.
3. Inspect `fare.deeplink`; it has no affiliate/tracking marker.

Impact: Revenue attribution is missing for Amadeus-sourced outbound traffic, and the link may overpromise "Book flight" despite being a generic search URL.

## Recommended Repair Tickets

### Ticket 1: REPAIR-PASSENGERS-01: Make passenger count truthful across search and booking

Scope: `lib/types.ts`, `app/api/search/route.ts`, `lib/providers/duffel.ts`, `lib/providers/amadeus.ts`, `lib/providers/kiwi.ts`, `lib/booking/config.ts`, relevant provider tests.

Acceptance criteria:

- `FlightProvider.searchFares` accepts passenger count explicitly.
- Duffel, Amadeus, and Kiwi request the selected adult passenger count.
- Cache keys include passenger count and other itinerary-defining inputs.
- UI copy clearly states whether displayed prices are per person or total for the selected party.
- Booking fare context preserves passenger count or blocks booking review when count is unsupported.

### Ticket 2: REPAIR-DUFFEL-CACHE-01: Fix Duffel cache normalization

Scope: `lib/providers/duffel.ts`, `lib/providers/__tests__/duffel.test.ts`.

Acceptance criteria:

- Duffel cache key includes origin, destination, depart date, return date or one-way marker, passenger count, and cabin when supported.
- One-way and round-trip searches cannot share the same cached fare array.
- Tests cover one-way vs round-trip cache keys and passenger-count cache separation.

### Ticket 3: REPAIR-AMADEUS-CONTRACT-01: Align Amadeus with env and outbound-link contracts

Scope: `lib/providers/amadeus.ts`, `lib/providers/__tests__/amadeus.test.ts`, deployment docs if present.

Acceptance criteria:

- Provider reads `AMADEUS_ID` and `AMADEUS_SECRET` per briefing, with optional backwards compatibility only if explicitly approved.
- Misconfiguration notice is visible through existing provider-notice UI.
- Amadeus outbound links either include approved affiliate/tracking parameters or are labeled as provider search links, not booking links.
- Tests use the briefing env names.

### Ticket 4: REPAIR-HOTEL-PRICE-SCORE-01: Correct hotel price units and score explanation

Scope: `lib/providers/hotellook.ts`, `lib/providers/__tests__/hotellook.test.ts`, `app/components/HotelCard.tsx`, `scripts/snapshot-job.ts`.

Acceptance criteria:

- HotelLook `priceFrom` is converted into `{ priceCents, currency }` using confirmed API units.
- Zero, missing, or invalid hotel prices are excluded or shown as unavailable, not `$0` or underpriced.
- Hotel cards show Deal Score explanation, usual price/median, percent vs median, and low-confidence copy.
- Snapshot tests prevent 100x hotel price regressions.

### Ticket 5: REPAIR-RANKING-STABILITY-01: Prevent result-order jumps while scoring

Scope: `app/page.tsx`, `components/flights/FlightResults.tsx`, `lib/search/sortFlights.ts`, `lib/search/__tests__/sortFlights.test.ts`.

Acceptance criteria:

- During score loading, results either keep deterministic price/order fallback with a visible "ranking updating" state or reorder only once after scoring settles.
- Sort behavior is deterministic when some fares are scored and others are pending.
- Tests cover partial score availability and stable fallback ordering.

## Out-of-Scope Notes

- I did not run a browser/device screenshot pass. This ticket requested a code-path audit and `git diff --check`; current code indicates the main mobile search layout repair is present.
- I did not verify live vendor API behavior or external API docs. Findings above are based on current code contracts and mocked-provider paths.
- No accessible `admin/safe-space` material was found in this worktree.

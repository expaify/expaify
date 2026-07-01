# AUDIT-HOTEL-AVAILABILITY-FIRST-CLASS-PARITY-02

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel availability parity in the main search-to-results flow

## Scope Mismatch

Requested files not present in this worktree:

- `components/hotels/HotelResults.tsx`
- `components/hotels/HotelCard.tsx`
- `app/api/hotels/route.ts`

Actual local hotel surfaces inspected:

- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`
- `lib/providers`

## Manual Verification Coverage

Screenshot capture was blocked by the execution environment. `npm run dev -- --hostname 127.0.0.1 --port 3000` failed with `listen EPERM: operation not permitted 127.0.0.1:3000`, and the worktree has no Playwright/Puppeteer package or Chromium binary. Clear viewport notes are provided in place of screenshots.

### Happy-Path Hotel Search

Flow reviewed: origin `JFK`, destination `LAX`, depart `2099-09-22`, return `2099-09-29`, round trip.

Code path:

- Search submits through `app/page.tsx`.
- `/api/search` calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })`.
- On hotel data, API emits `hotel-status: available` then `hotels`.
- UI enables the Hotels tab and renders `HotelCard`.

Result: Functionally present in code and covered by mocked provider tests, but blocked from live browser verification by local server bind failure.

### No-Results Case

Code path: `app/api/search/route.ts` emits `hotel-status: empty` with `No hotels were returned for these dates.` when Hotellook returns `{ ok: true, data: [] }`.

UI path: `app/page.tsx` keeps the Hotels tab enabled for `empty`, then renders a `ResultsStatePanel` titled `No hotel inventory found`.

Result: Coherent empty state in code.

### Provider-Error Case

Code path: `app/api/search/route.ts` emits `hotel-status: unavailable` for provider errors/timeouts, with bounded user copy.

UI path: `app/page.tsx` disables the Hotels tab when `hotelAvailability === 'unavailable'` and shows a banner: `Hotels were not included.`

Result: Error copy is bounded, but the hotel tab/action is disabled in the normal UI, which weakens hotel parity.

### Mobile 375px Pass

Code-level responsive review:

- Search form stacks route/date controls on one column below `sm`.
- Results tabs are horizontally scrollable.
- Hotel card price/CTA layout stacks below `sm`, and CTA is full width.
- No obvious fixed-width hotel card control should overflow 375px.

Result: Static 375px pass with one caveat: runtime screenshot verification could not be captured because the dev server cannot bind in this environment.

## Confirmed Defects

### 1. Hotels are visually secondary at the search entry point

Files:

- `app/page.tsx:986`
- `app/page.tsx:1174`
- `components/search/SearchPanel.tsx:153`

Visible symptom:

- The actual homepage search surface says `Search flights` in the panel heading and submit button.
- A separate `SearchPanel` component says `Search flights + hotels`, but it is not the active homepage search surface.

Repro steps:

1. Open the homepage.
2. Read the primary search panel heading and submit CTA.
3. Observe that the main action frames the flow as flight-only.

Paid-user trust impact:

- Users looking for hotel availability have to infer hotel support from secondary copy. Paid users can reasonably conclude the product is flight-first and hotels are incidental.

Narrow repair recommendation:

- Align the active homepage search heading/CTA with the real combined flow, without adding filters or new hotel features.

### 2. Hotel lookup waits until all flight providers finish

Files:

- `app/api/search/route.ts:220`
- `app/api/search/route.ts:289`

Visible symptom:

- Hotel availability cannot start streaming until after all four flight providers settle. A slow/timeout flight provider delays the hotel loading, empty, or error state.

Repro steps:

1. Run a round-trip search with destination and dates.
2. Have any flight provider hang until provider timeout.
3. Observe that hotel availability status is delayed even though hotel lookup does not depend on flight results.

Paid-user trust impact:

- Hotels feel subordinate to flights. A paid user may wait on flight-provider degradation before learning whether hotels are available.

Narrow repair recommendation:

- Start hotel provider lookup concurrently with flight providers when destination, check-in, and checkout are present.

### 3. Guest rating is derived from hotel star class

Files:

- `lib/providers/hotellook.ts:95`
- `lib/providers/hotellook.ts:106`
- `lib/providers/hotellook.ts:107`
- `app/components/HotelCard.tsx:229`

Visible symptom:

- Provider maps `rating` from `stars`.
- UI labels that value as `Guest rating`.

Repro steps:

1. Mock a HotelLook result with `stars: 4` and no guest review rating.
2. Render the hotel card.
3. Observe a `Guest rating` block for a value that came from hotel class, not guest reviews.

Paid-user trust impact:

- This is an unsupported hotel quality claim. It can make the app appear to fabricate social proof.

Narrow repair recommendation:

- Do not populate or display `rating` unless the provider returns a real guest/review rating field. Keep star class separate.

### 4. Hotel card does not expose a real availability confirmation boundary

Files:

- `app/components/HotelCard.tsx:50`
- `app/components/HotelCard.tsx:257`
- `app/components/HotelCard.tsx:269`
- `lib/types.ts:33`

Visible symptom:

- Card shows nightly price, currency, HotelLook handoff, and price-change caveat.
- It does not show when availability was checked, whether the rate is cached, or whether the card means an actual room is available for the selected dates.
- `HotelOffer` has no fetched/availability timestamp or availability status field.

Repro steps:

1. Render any successful hotel card.
2. Look for availability freshness or confirmed-room state on the card.
3. Only `Opens provider site. Prices can change.` is shown.

Paid-user trust impact:

- Paid users cannot distinguish current availability from cached/provider teaser pricing.

Narrow repair recommendation:

- Add honest card copy using existing data only, or add a narrow provider contract field if the provider can supply checked/fetched time. Do not claim confirmed rooms unless provider data supports it.

### 5. Provider-error hotel tab is disabled in the normal flow

Files:

- `app/page.tsx:916`
- `app/page.tsx:1367`
- `app/page.tsx:1399`

Visible symptom:

- When hotel provider status is `unavailable`, the Hotels tab is disabled and labeled `Unavailable`.
- The user sees a banner below the tabs but cannot switch into the hotel panel from the normal UI.

Repro steps:

1. Run a round-trip search where `hotellook.searchHotels` returns `{ ok: false }`.
2. Observe the Hotels tab is disabled.
3. Observe hotel-specific retry/detail state is not reachable through the tab.

Paid-user trust impact:

- Hotels feel like a suppressed add-on rather than a first-class result category with a clear failure state.

Narrow repair recommendation:

- Keep the Hotels tab reachable for `unavailable` and render the existing bounded error panel there.

## Suspected Risks

### A. HotelLook `location` may be receiving airport IATA instead of a hotel-search location

Files:

- `app/api/search/route.ts:292`
- `lib/providers/hotellook.ts:67`
- `lib/providers/hotellook.ts:76`

Concern:

- The search endpoint passes destination IATA such as `LAX` directly to HotelLook `location`. If HotelLook expects a city/location identifier rather than airport code for some markets, hotel results may be under-supplied or empty.

Evidence needed:

- Provider contract confirmation or real HotelLook responses for airport-code destinations.

### B. `HotelResults` component absence limits hotel parity ownership

Files:

- No `components/hotels/HotelResults.tsx`

Concern:

- Hotel result state is embedded in `app/page.tsx`, unlike flights which have `components/flights/FlightResults.tsx`. This increases the chance that hotel loading/empty/error parity drifts.

Evidence needed:

- Product decision on whether hotel results should remain page-local for MVP.

## Out-of-Scope Findings

- Historical audit docs reference ops-board surfaces, but those are explicitly absent from this worktree and were not evaluated.
- No provider or UI code was changed.
- No hotel filters, maps, loyalty, or room selection work was proposed.

## Verification Commands

Command: `npm run tsc -- --noEmit`

Result: Failed because the repo has no `tsc` npm script.

Command: `npx tsc --noEmit --incremental false`

Result: Passed.

Command: `npm test -- --runInBand`

Result: Passed. 20 test suites, 176 tests.

Command: `npm run dev -- --hostname 127.0.0.1 --port 3000`

Result: Failed with `listen EPERM: operation not permitted 127.0.0.1:3000`; live screenshot capture blocked.

## Recommended Repair Order

1. Remove the fake guest rating mapping/display.
2. Run hotel lookup concurrently with flight providers.
3. Keep Hotels tab reachable for provider-error/empty states.
4. Align homepage copy so users understand the search includes hotels when eligible.
5. Add honest availability/freshness language using supported provider data only.

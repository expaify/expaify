# AUDIT-REGRESSION-02: Regression Audit After Passenger Hotel Ranking Repairs

Date: 2026-06-30  
Role: Senior QA Engineer  
Scope: Strict audit only. No product code changed.

## Executive Decision

No P0 regression found in the inspected repair surfaces.

P1 regressions remain in provider/env contracts. The main repaired UX/data surfaces are materially improved: passenger count now propagates into the flight search range, Duffel/Amadeus/Kiwi cache keys include passenger count and return date, booking links preserve fare context, hotel price conversion now uses cents, hotel cards show score explanation/usual price, and deal ranking defers reorder until visible scores settle.

## Surfaces Inspected

- Search passenger propagation: `app/page.tsx`, `app/api/search/route.ts`, `lib/types.ts`
- Booking context: `lib/booking/config.ts`, `app/book/page.tsx`, `app/book/BookingFlow.tsx`, `app/api/book/route.ts`, `app/components/FlightCard.tsx`
- Provider contracts: `lib/providers/duffel.ts`, `lib/providers/amadeus.ts`, `lib/providers/kiwi.ts`, `lib/providers/travelpayouts.ts`, `lib/providers/hotellook.ts`
- Hotel pricing/score display: `app/components/HotelCard.tsx`, `app/api/score/route.ts`, `lib/scoring/scoreDeal.ts`
- Score-ranking stability: `app/page.tsx`, `lib/search/sortFlights.ts`, `lib/search/__tests__/sortFlights.test.ts`

## Findings

### 1. P1: Amadeus still violates the approved env contract, so a correctly configured deployment loses that provider

Evidence: The product contract names `AMADEUS_ID` and `AMADEUS_SECRET`. Current code reads `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET` instead (`lib/providers/amadeus.ts:53`, `lib/providers/amadeus.ts:57`). If those non-contract names are absent, `searchFares` returns `Amadeus not configured` (`lib/providers/amadeus.ts:103`). The search stream then ignores non-ok Amadeus results entirely (`app/api/search/route.ts:136`), so users see fewer/no fares with no provider notice.

Repro/evidence:

1. Configure env with only `AMADEUS_ID` and `AMADEUS_SECRET`, as specified.
2. Run a destination search with valid dates.
3. `AmadeusProvider.searchFares` sees empty credentials and returns `Amadeus not configured`; `/api/search` does not stream that notice.

Impact: Live fare coverage silently drops despite deployment using the documented env names.

Recommended repair ticket: `REPAIR-AMADEUS-CONTRACT-02` - align Amadeus env reads/tests to `AMADEUS_ID` and `AMADEUS_SECRET`, and surface non-config provider notices consistently where appropriate.

### 2. P1: Affiliate marker env names do not match the current contract, breaking hotel availability and flight attribution under approved envs

Evidence: The contract allows `TP_TOKEN` and `HOTEL_AFFILIATE_ID`. Hotellook instead requires `TP_AFFILIATE_MARKER` and returns `TP_AFFILIATE_MARKER not configured` when missing (`lib/providers/hotellook.ts:46`, `lib/providers/hotellook.ts:60`). Travelpayouts also reads `TP_AFFILIATE_MARKER`; when it is missing, it still returns Aviasales deeplinks without `marker` (`lib/providers/travelpayouts.ts:63`, `lib/providers/travelpayouts.ts:70`, `lib/providers/travelpayouts.ts:72`).

Repro/evidence:

1. Configure only `TP_TOKEN` and `HOTEL_AFFILIATE_ID`, per contract.
2. Run a round-trip destination search with hotel-eligible dates.
3. Hotels return unavailable because Hotellook never reads `HOTEL_AFFILIATE_ID`.
4. Travelpayouts flight links can render without an affiliate marker.

Impact: Hotel supply is disabled under the approved env contract, and outbound flight links can violate the affiliate-marker requirement.

Recommended repair ticket: `REPAIR-AFFILIATE-ENV-01` - standardize provider marker reads on `HOTEL_AFFILIATE_ID` or explicitly update the contract; add tests that no outbound deeplink is emitted without the required marker.

### 3. P2: Kiwi is wired as a live provider using an unapproved secret name

Evidence: The briefing/file map describes Kiwi as stubbed, and the allowed secret list does not include a Kiwi key. Current search calls Kiwi on every search (`app/api/search/route.ts:139`), and `KiwiProvider` makes a live Tequila API call using `KIWI_KEY` (`lib/providers/kiwi.ts:42`, `lib/providers/kiwi.ts:92`). Its returned `deep_link` is passed through directly (`lib/providers/kiwi.ts:118`) without any app-side affiliate validation.

Repro/evidence:

1. Add `KIWI_KEY` locally.
2. Run a destination search.
3. `/api/search` calls `https://api.tequila.kiwi.com/v2/search` and returns Kiwi deeplinks, despite Kiwi not being in the approved secret contract.

Impact: This expands live provider behavior beyond the approved contract and bypasses explicit affiliate-marker enforcement. It is lower severity than Amadeus/HotelLook because it requires a non-contract env var to be set.

Recommended repair ticket: `REPAIR-KIWI-CONTRACT-01` - either keep Kiwi stubbed/inactive until approved or add Kiwi to the explicit provider/env/affiliate contract with tests.

## Closed Regression Checks

- Passenger propagation: homepage sends `passengers` (`app/page.tsx:355`), `/api/search` parses it into `range` (`app/api/search/route.ts:73`), and Duffel/Amadeus/Kiwi now request or cache with `range.passengers`.
- Booking context: Duffel fares build `/book` links with offer, provider, route, price, passenger count, and price scope; booking review parses and displays that context before any booking action.
- Duffel cache separation: cache key includes depart, return, and passenger count.
- Hotel price display: Hotellook converts major-unit `priceFrom` to integer cents before display (`lib/providers/hotellook.ts:32`, `lib/providers/hotellook.ts:37`), and `HotelCard` rejects invalid/non-positive prices (`app/components/HotelCard.tsx:162`).
- Hotel score display: hotel cards now show percentile/limited-history copy, usual price, vs median, and explanation (`app/components/HotelCard.tsx:98`).
- Score-ranking stability: deal sort uses deterministic fallback while scores are pending/deferred (`lib/search/sortFlights.ts:55`) and the page passes `deferDealSort` while ranking is updating (`app/page.tsx:488`).

## Out-of-Scope Notes

- I did not run live vendor API calls or browser screenshots for this audit.
- I did not modify product code.
- The old passenger propagation, Duffel cache, hotel price scale, hotel score presentation, and ranking-jump issues should not be reopened from prior audits based on current code.

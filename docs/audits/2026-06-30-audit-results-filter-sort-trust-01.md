# AUDIT-RESULTS-FILTER-SORT-TRUST-01: Results Controls Trust

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Strict audit only. No product code changed.

## Executive Decision

Not ready for paid-user results-control trust.

The core flight result controls are present and mostly honest: sort/filter buttons are real controls, the hotels tab has a disabled unavailable state, unavailable booking actions are visually disabled, and external booking CTAs warn that price and availability can change. The trust breaks are in state accuracy: "Best deal" can silently become price ordering after score failures, great-deal summary copy can refer to fares hidden by the active filter, result cards visually lift like selectable containers even though only the CTA is actionable, and the email alert control can appear available when the server knows alerts are not configured.

## Surfaces Inspected

- `app/page.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/api/search/route.ts`
- `lib/types.ts`
- `components/flights/FlightResults.tsx`
- `components/baggage/BaggageFeeEstimator.tsx`
- `app/api/score/route.ts`
- `app/api/alerts/route.ts`
- `lib/search/sortFlights.ts`
- `app/globals.css`

Requested file not present in this worktree:

- `app/components/SearchForm.tsx`; the search form is inline in `app/page.tsx`.

## P1 Findings

### 1. "Best deal" can remain active while results are actually ordered by price

Evidence: `sortBy` defaults to `deal` (`app/page.tsx:355`) and the active sort button renders "Best deal" with `aria-pressed` (`components/flights/FlightResults.tsx:175` to `components/flights/FlightResults.tsx:187`). Score requests write `null` on failure (`app/page.tsx:434` to `app/page.tsx:447`). Once every visible fare has a settled score property, `rankingUpdating` becomes false (`app/page.tsx:735` to `app/page.tsx:743`), but `sortFlights` gives null scores the same low rank and then falls back to price/stops/date/carrier/id (`lib/search/sortFlights.ts:24` to `lib/search/sortFlights.ts:42`, `lib/search/sortFlights.ts:55` to `lib/search/sortFlights.ts:63`). The UI does not disclose that the selected "Best deal" sort has degraded to fallback price ordering after score failures (`components/flights/FlightResults.tsx:207` to `components/flights/FlightResults.tsx:214` only covers the loading/updating phase).

Repro:

1. Run a search that returns multiple fares.
2. Make `/api/score` fail or return non-OK for every fare; a DB baseline failure returns 502 (`app/api/score/route.ts:100` to `app/api/score/route.ts:107`).
3. Wait for score loading to finish.

Result: "Best deal" remains selected, but the list is ordered by fallback price logic and no score-unavailable message is shown.

Impact: Users can believe expaify ranked by deal quality when it did not. This directly undermines the product differentiator.

### 2. Header great-deal count ignores the active stops filter

Evidence: `greatCount` is computed from all scores, not `displayFlights` or `filteredFlights` (`app/page.tsx:749` to `app/page.tsx:750`). The header renders that count above the active filtered result set (`app/page.tsx:1108` to `app/page.tsx:1117`). Stops filtering is applied separately to `filteredFlights` (`app/page.tsx:729` to `app/page.tsx:733`) and displayed through `displayFlights` (`app/page.tsx:745` to `app/page.tsx:747`).

Repro:

1. Search a route that returns at least one Great fare and at least one fare with a different stop count.
2. Select a stops filter that hides every Great fare.

Result: The header can still say there are great deals while none are visible in the filtered list.

Impact: The results summary becomes disconnected from the current controls. This is a true defect, not a request for new filtering features.

### 3. Result cards have selectable-card hover affordance but the cards are not selectable

Evidence: the shared `.card:hover` style changes border, shadow, and background for every card (`app/globals.css:170` to `app/globals.css:180`). Flight result cards render as non-clickable `<article className="card">`; only the booking/deeplink CTA is actionable (`app/components/FlightCard.tsx:208` to `app/components/FlightCard.tsx:315`). Hotel result cards render as non-clickable `<div className="card">`; only "Book hotel" is actionable when available (`app/components/HotelCard.tsx:204` to `app/components/HotelCard.tsx:308`).

Repro:

1. Open any results view on desktop.
2. Hover over a flight or hotel card outside the CTA.
3. Click the card body.

Result: The card visually lifts like a selectable item, but clicking the body does nothing.

Impact: This is a result-card affordance mismatch. It makes selection behavior feel unstable even though the CTA itself is functional.

### 4. Price alert control appears available even when alert email service is not configured

Evidence: the "Track this route" form renders after searches with destination and at least three flight results (`components/flights/FlightResults.tsx:274` to `components/flights/FlightResults.tsx:310`). The API rejects alert creation when `RESEND_API_KEY` is missing (`app/api/alerts/route.ts:75` to `app/api/alerts/route.ts:80`). The search page does not know that configuration state before showing the enabled email input and "Notify me" button.

Repro:

1. Run a successful destination search with at least three fares in an environment without `RESEND_API_KEY`.
2. Submit an email in "Track this route".

Result: The enabled control fails after submit with "Price alert emails are not configured, so no active alert was created."

Impact: This is an availability disclosure defect for a visible results control. It is not a request to add alerts; the control already exists and should not imply configured personalization when the server cannot create an active alert.

## Controls That Passed Source Review

- Flight sort and stops controls are real stateful buttons with `aria-pressed` and URL persistence (`components/flights/FlightResults.tsx:175` to `components/flights/FlightResults.tsx:201`, `app/page.tsx:704` to `app/page.tsx:717`).
- Filters that hide all returned fares show a specific empty state and tell the user to clear the stops filter (`components/flights/FlightResults.tsx:126` to `components/flights/FlightResults.tsx:144`, `components/flights/FlightResults.tsx:248` to `components/flights/FlightResults.tsx:258`).
- The Hotels tab is disabled when hotels are idle, skipped, or unavailable, and it displays "Unavailable" rather than a fake count (`app/page.tsx:751`, `app/page.tsx:1144` to `app/page.tsx:1177`).
- Flight CTAs have clear destinations: external provider links say `Check with {source}` and open sponsored/noopener links; Duffel/internal links say `Review paused booking`; unavailable links render a disabled button (`app/components/FlightCard.tsx:187` to `app/components/FlightCard.tsx:200`, `app/components/FlightCard.tsx:284` to `app/components/FlightCard.tsx:311`).
- Hotel CTAs are clear when valid and unavailable when price or deeplink is invalid (`app/components/HotelCard.tsx:197` to `app/components/HotelCard.tsx:201`, `app/components/HotelCard.tsx:271` to `app/components/HotelCard.tsx:303`).
- Deal badges do not claim Great on low confidence; low-confidence scores are labeled "Limited history" (`app/components/DealBadge.tsx:8` to `app/components/DealBadge.tsx:33`).

## Manual Verification Notes

Live browser verification at 375px and desktop was blocked: `npm run dev -- --hostname 127.0.0.1 --port 3000` failed with `listen EPERM: operation not permitted 127.0.0.1:3000`. A direct `tsx` route-handler call was also blocked because `tsx` attempted to create an IPC listener and failed with `listen EPERM` on a temp pipe.

Written observations from source review:

- Loading state: while searching with no displayed fares, the flight results surface shows a status panel plus six skeleton cards; the grid is single-column on mobile and expands at `sm`/`lg` (`components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:247`).
- Empty-result state: no-inventory, missing-date, provider-unavailable, and filters-hide-results cases have distinct copy (`components/flights/FlightResults.tsx:124` to `components/flights/FlightResults.tsx:145`, `components/flights/FlightResults.tsx:248` to `components/flights/FlightResults.tsx:258`).
- Provider-error state: `/api/search` emits provider notices when provider adapters return errors (`app/api/search/route.ts:144` to `app/api/search/route.ts:153`, `app/api/search/route.ts:194` to `app/api/search/route.ts:209`); with no flight results those notices drive "Flight providers unavailable" (`components/flights/FlightResults.tsx:127` to `components/flights/FlightResults.tsx:144`).
- Successful-search state: streamed flight chunks are deduped, scored, sorted/filtered, and rendered as `FlightCard`s (`app/page.tsx:598` to `app/page.tsx:603`, `app/page.tsx:729` to `app/page.tsx:747`, `components/flights/FlightResults.tsx:261` to `components/flights/FlightResults.tsx:271`).
- Mobile 375px source review: results header stacks vertically before `sm` (`app/page.tsx:1085` to `app/page.tsx:1140`), tabs scroll horizontally (`app/page.tsx:1144`), controls wrap (`components/flights/FlightResults.tsx:174` to `components/flights/FlightResults.tsx:206`), flight cards use one grid column (`components/flights/FlightResults.tsx:261`), and CTAs are full width (`app/components/FlightCard.tsx:291`, `app/components/HotelCard.tsx:271` to `app/components/HotelCard.tsx:280`).
- Desktop source review: the results list expands to two columns at `sm` and three at `lg` for flights/hotels (`components/flights/FlightResults.tsx:261`, `app/page.tsx:1241`); sort/filter controls sit in a single row at `lg` (`components/flights/FlightResults.tsx:174`).

## Out-of-Scope Feature Requests

- Adding new sort modes, multi-select filters, map controls, personalization, fare-selection state, or alert configuration discovery was not performed.
- Adding a 2+ stops filter would be a new feature. Current "1 stop" is exact and does not mislabel itself (`components/flights/FlightResults.tsx:190` to `components/flights/FlightResults.tsx:200`).
- Redesigning cards so the whole card is clickable is a product decision. The audit finding is limited to the current hover affordance mismatch.

## Verification Commands

- `npm run dev -- --hostname 127.0.0.1 --port 3000` - blocked by environment: `listen EPERM: operation not permitted 127.0.0.1:3000`.
- Direct route-handler smoke via `npx tsx -e ...` - blocked by environment: `listen EPERM` on the `tsx` temp IPC pipe.
- `npx tsc --noEmit --incremental false` - passed.
- `npx jest --runInBand` - passed. 19 suites passed, 151 tests passed.
- `npm test -- --passWithNoTests` - passed. 19 suites passed, 151 tests passed.

## Required Return Note

- What changed and why: Added this QA audit report documenting misleading or disconnected search-results controls for the assigned P1 ticket.
- Files changed: `docs/audits/2026-06-30-audit-results-filter-sort-trust-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx jest --runInBand` passed with 19 suites and 151 tests; `npm test -- --passWithNoTests` passed with 19 suites and 151 tests; `npm run dev -- --hostname 127.0.0.1 --port 3000` was blocked by sandbox port binding (`EPERM`).
- Out-of-scope findings or blockers: No product code was changed. Browser screenshots were blocked by sandbox server bind failure.

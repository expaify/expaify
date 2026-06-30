# AUDIT-PROVIDER-PARTIAL-PRICE-FRESHNESS-COPY-01

Date: 2026-06-30
Auditor: Senior QA Engineer
Scope: Provider freshness, partial-result, retry, empty, error, fee, currency, and Deal Score trust copy.

## Executive Summary

Fail with blocking caveats. The app has materially improved partial-provider and unavailable-state copy, but freshness copy is still too confident in several visible surfaces. Provider responses are cached for 6 hours in `lib/providers/*`, and cached fares/hotels are rendered without a visible timestamp or "cached up to 6h" caveat. User-facing copy still says "Live fare scoring", "live prices", "current fares", "current fare", and "today's level", which can overstate the actual data state.

Several files named in the ticket do not exist in this worktree, so I could not audit their copy or reproduce those flows: `app/api/run/[id]/route.ts`, `app/api/board-stream/route.ts`, `components/TicketCard.tsx`, and `components/TicketSlideOver.tsx`.

## Message-To-Condition Map

| Visible/API message | Triggering data condition | Source |
| --- | --- | --- |
| "Scanning deals..." / "Scanning deals across providers..." | Search submitted, `isSearching=true` before `/api/search` NDJSON completes | `app/page.tsx:1166`, `app/page.tsx:1277` |
| "Checking live flight inventory" | `isSearching=true` and no flight cards have streamed yet | `components/flights/FlightResults.tsx:289` |
| "Fare cards will appear here as providers return usable prices..." | Same loading state as above | `components/flights/FlightResults.tsx:301` |
| "Provider coverage may be incomplete" | Any provider notice exists, or missing departure/return state reaches results | `components/flights/FlightResults.tsx:193` |
| "{Provider} is unavailable for this search." | Provider returns `ok:false`, throws, has missing credentials, network failure, HTTP error, or classified unavailable reason | `app/api/search/route.ts:58`, `app/api/search/route.ts:75` |
| "{Provider} returned a response we could not use." | Provider reason contains malformed | `app/api/search/route.ts:75` |
| "Travelpayouts flexible-date coverage is incomplete for this search." | Flexible-date fanout returns at least one fare and at least one failed/rejected date request | `app/api/search/route.ts:228` |
| "No flight providers returned matching fares..." | All flight providers complete with zero fares and no provider issues | `app/api/search/route.ts:265` |
| "No flight inventory found" | UI has zero flights and no provider-unavailable classification | `components/flights/FlightResults.tsx:157` |
| "Flight providers unavailable" | Provider notices exist, zero flights, dates complete | `components/flights/FlightResults.tsx:151` |
| "Hotels were not included." | Hotel tab disabled after hotel status is `idle`, `skipped`, or `unavailable` and no hotel offers exist | `app/page.tsx:916`, `app/page.tsx:1399` |
| "The hotel provider is unavailable right now." | Hotel provider returns `ok:false` or throws; malformed gets a separate message | `app/api/search/route.ts:287`, `app/page.tsx:917` |
| "No hotels were returned for these dates." | Hotel provider returns `ok:true` with empty data | `app/api/search/route.ts:285`, `app/page.tsx:926` |
| "Add departure and return dates..." / "Add a destination..." | Hotel status skipped because destination/dates/roundtrip are incomplete | `app/page.tsx:920` |
| "Price unavailable" | Flight/hotel price fails integer-positive-money and 3-letter-currency validation | `app/components/FlightCard.tsx:240`, `app/components/HotelCard.tsx:181` |
| "Provider link unavailable" | Flight deeplink is empty/invalid or not an approved internal Duffel booking link | `app/components/FlightCard.tsx:241` |
| "Opens provider search. Price and availability can change." | Flight has valid money and valid external provider deeplink | `app/components/FlightCard.tsx:251` |
| "per night before taxes and fees" | Hotel has valid nightly money | `app/components/HotelCard.tsx:50` |
| "Baggage fee estimate unavailable right now." | `/api/baggage` fetch rejects, non-OK, or payload is invalid | `components/baggage/BaggageFeeEstimator.tsx:139` |
| "Deal Score unavailable right now" | Score request failed or has not stored a score after loading ends | `app/components/FlightCard.tsx:197` |
| "Limited history" / "Not enough route history..." | `score.confidence === 'low'`; scoring caps verdict at Typical for fewer than 10 comparable points | `app/components/DealBadge.tsx:14`, `lib/scoring/scoreDeal.ts:91` |

## Findings

### P1: Freshness copy overstates cached fare and hotel data

Repro:
1. Search any valid route that returns a cached provider result.
2. Observe result surfaces using "live/current/today" language.

Expected: User copy should distinguish fresh provider responses from cached data, or avoid "live/current/today" claims when freshness is unknown.

Actual: Provider adapters return cached data for up to 6 hours without freshness metadata in the UI. Examples:
- `lib/providers/travelpayouts.ts:143`, `lib/providers/duffel.ts:136`, `lib/providers/amadeus.ts:122`, `lib/providers/kiwi.ts:126`, and `lib/providers/hotellook.ts:69` return cached data directly.
- `app/page.tsx:956` says "Live fare scoring".
- `app/page.tsx:964` says "Search current fares".
- `app/page.tsx:987` says "rank live prices".
- `components/flights/FlightResults.tsx:293` says "Checking live flight inventory".
- `app/components/FlightCard.tsx:211` says "The live price is still shown above."
- `components/flights/FlightResults.tsx:343` says "prices drop below today's level".

Risk: Users may treat a six-hour cached fare as live/confirmed. This directly affects trust in Deal Score and price freshness.

Likely owners: `app/page.tsx`, `components/flights/FlightResults.tsx`, `app/components/FlightCard.tsx`, `lib/providers/*` if freshness metadata is added later.

### P2: Flight-level `fetchedAt` exists but is not shown

Repro:
1. Inspect a streamed `NormalizedFare`.
2. Observe the card copy and CTA copy.

Expected: If the app stores `fetchedAt`, visible copy should use it or avoid freshness claims.

Actual: `NormalizedFare.fetchedAt` is part of the contract at `lib/types.ts:28` and populated by flight providers, but the card does not render it. The UI shows price, provider, and Deal Score without a timestamp or cached-data caveat.

Risk: Users cannot know whether a card is newly fetched, cached, or several hours old.

Likely owners: `app/components/FlightCard.tsx`, `lib/types.ts`, provider adapters.

### P2: Partial-provider notices are bounded but too generic for no-supply vs outage

Repro:
1. Mock one provider success and another provider `ok:false`.
2. Search a route.
3. Observe the warning panel.

Expected: Copy should tell users which providers were missing and whether the state is no supply, unavailable, or malformed.

Actual: The route classifies most non-success provider reasons as `unavailable`; `no_supply` is defined but not produced for provider-level empty `ok:true` results. Empty provider responses are silent unless all providers return zero fares. Partial success with one provider empty and one provider successful does not inform users that provider coverage is narrower.

Risk: The user sees successful cards but not the coverage limitation if a provider returned no inventory rather than failed.

Likely owner: `app/api/search/route.ts`, `components/flights/FlightResults.tsx`.

### P3: Deal Score copy is mostly honest, but its freshness dependency is hidden

Repro:
1. Search a route with fares.
2. Wait for scores.
3. Inspect a flight card.

Expected: Deal Score should not appear more reliable than the fare freshness and baseline data support.

Actual: Low-history scoring is handled correctly: low confidence is capped at Typical and rendered as "Limited history" / "Not enough route history". However, high-confidence score panels can still be based on a cached provider fare while saying "Deal Score" and explaining a current price against the last 90 days. There is no visible connection between score confidence and fare freshness.

Risk: A mathematically correct score can still feel like a live deal claim when the input fare may be cached.

Likely owners: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `lib/scoring/scoreDeal.ts`.

## Manual Verification Flow

Normal provider success:
- Covered by unit flow in `app/api/search/__tests__/route.test.ts:137`, with mocked providers returning successful fare/hotel paths.
- Local live-provider reproduction blocked: no provider credentials are present in this shell environment.

Partial/failed provider state:
- Covered by tests at `app/api/search/__tests__/route.test.ts:155`, `app/api/search/__tests__/route.test.ts:179`, and `app/api/search/__tests__/route.test.ts:203`.
- UI condition maps to `Provider coverage may be incomplete` in `components/flights/FlightResults.tsx:193`.

Retry/error state:
- UI retry panel appears when `/api/search` returns non-OK or stream setup fails: `app/page.tsx:724`, `app/page.tsx:1328`.
- Live reproduction blocked without intentionally changing network/provider behavior; no code changes were made for this report-only ticket.

Empty results:
- API emits no-supply notice when all flight providers return zero fares and no failures: `app/api/search/route.ts:265`.
- UI empty state is `No flight inventory found` with edit-search action: `components/flights/FlightResults.tsx:157`.
- Hotel empty state is `No hotels were returned for these dates`: `app/api/search/route.ts:285`.

Mobile 375px and desktop:
- Static code inspection found trust copy generally placed in wrapping text containers, `truncate` is limited to route/provider labels, and primary actions remain full width on mobile.
- Browser/screenshot verification was blocked in this environment because no browser automation dependency is configured and the named run/board ticket surfaces are missing. This remains a verification gap.

## Accessibility And UX Notes

- Warning and error panels use `role="status"` or `role="alert"` where appropriate in `app/page.tsx:375` and `components/flights/FlightResults.tsx:95`.
- Score loading shimmer has `aria-label="Loading deal score"` but no explicit `role="status"` on the shimmer itself.
- Disabled provider CTAs are buttons/spans with status text; unavailable hotel booking includes an `aria-label`.
- Copy hierarchy is generally readable. The main trust issue is semantic overconfidence, not visual hierarchy.
- No cheap decorative effects were found in the audited trust surfaces; animations are limited to loading/progress and card entrance states.

## Blockers

- Missing assigned files: `app/api/run/[id]/route.ts`, `app/api/board-stream/route.ts`, `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`.
- No provider credentials in the local environment, so true live provider success/failure could not be reproduced against external APIs.
- No browser automation package is configured, so 375px/desktop visual verification could not be captured with screenshots.

## Verification

- `npx tsc --noEmit --incremental false`: passed.
- `npx jest --runInBand`: passed. 20 test suites, 172 tests.

## Required Return Note

- What changed and why: Added this report-only audit documenting provider freshness and partial-result copy against actual route/provider/UI conditions.
- Files changed: `docs/audits/2026-06-30-audit-provider-partial-price-freshness-copy-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx jest --runInBand` passed.
- Out-of-scope findings or blockers: Freshness metadata/copy repair is out of scope for this report-only ticket. Missing assigned files, absent provider credentials, and absent browser automation blocked full local reproduction.

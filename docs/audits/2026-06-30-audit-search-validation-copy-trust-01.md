# AUDIT-SEARCH-VALIDATION-COPY-TRUST-01: Search Validation Copy Trust

Date: 2026-06-30  
Reviewer: Senior QA Engineer  
Scope: search form validation copy, recovery behavior, focus/screen-reader usability, empty/loading/error states, mobile 375px and desktop layout risk. Audit only; no product code changed.

## Gate Decision

No-go for trust-critical search validation.

The search form has several calm, specific messages for missing dates and invalid typed airports, but two route states can still submit as if they are valid: unknown three-letter airport codes and same-origin-destination searches. These produce provider-unavailable or empty-result experiences instead of telling the user the route is invalid. Failed client validation also does not move focus to the relevant invalid control, and origin/destination errors are global form alerts rather than attached to the fields.

The assigned file `app/api/run/[id]/route.ts` does not exist in this worktree. I inspected `app/page.tsx`, `app/api/search/route.ts`, `app/components/AirportInput.tsx`, `components/flights/FlightResults.tsx`, and `lib/providers/*`.

Browser screenshots were not captured because the sandbox cannot start the Next dev server: `npm run dev -- --hostname 127.0.0.1 --port 3001` failed with `listen EPERM: operation not permitted 127.0.0.1:3001`. Local Playwright is also unavailable. Responsive notes below are source-level QA plus direct route-handler verification.

## Validation Matrix

| Input state | Expected result | Actual result | Trust risk |
| --- | --- | --- | --- |
| Empty origin, submit | Block submit, identify origin field, focus origin, tell user to add origin. | Client sets global alert: "Add an origin to search." API returns `400 {"error":"origin is required"}`. No explicit focus movement. | Medium: user gets copy, but it is not attached to the origin control and API copy is terse. |
| Typed invalid origin, e.g. `NotAPlace` | Block submit with field-specific copy and recovery: choose a listed airport. | Client blocks with global alert: "Choose a valid origin airport from the list before searching." API returns `400 {"error":"Unrecognised airport: NotAPlace"}`. | Medium: calm copy exists, but field is not marked `aria-invalid` or described by the error. |
| Unknown three-letter origin, e.g. `XXX` | Reject as unrecognized airport before provider calls. | API returns `200` NDJSON with provider-unavailable notices. `resolveToIATA` accepts any three-letter string. | High: submission appears to work but cannot produce trustworthy route results. |
| Same origin and destination, e.g. `JFK` to `JFK` | Block submit with specific route copy. | API returns `200` NDJSON with provider-unavailable notices. Client has no same-route guard. | High: user sees a failed provider/search experience instead of a route validation error. |
| Empty destination | Allow "Anywhere" search, but explain hotel availability limits. | Client allows it; API searches flights with empty destination and sends hotel `skipped`. Results copy says hotels need a destination. | Low: behavior is coherent, but route context can read "Anywhere" with provider-unavailable notices. |
| Missing departure date | Block submit, attach copy to depart field, focus depart. | Client sets `depart-error`: "Choose a departure date before searching." and global alert: "Correct the highlighted date fields before searching." API returns specific 400. No explicit focus movement. | Medium: copy is good and attached for screen readers only after the field is reached; focus recovery is missing. |
| Invalid date, e.g. `2026-02-31` in URL/API | Reject with specific date copy. | URL parser says "The departure date in this link is not valid. Use a calendar date before searching." API says `depart is not a valid date`. | Low/Medium: UI link copy is clear; API copy is less user-facing. |
| Past date, e.g. `2026-06-29` on 2026-06-30 | Reject, explain today/future date. | Client/API reject with "Departure date cannot be in the past. Choose today or a future date." | Low: specific and calm. |
| Return before departure | Reject, attach to return date. | Client return field error: "Return date must be on or after the departure date." API returns similar copy. | Low: specific and attached. |
| Round trip without return date | Reject, attach to return date. | Client return field error: "Choose a return date, or switch to one way." API returns specific 400. | Low: specific and recoverable. |
| One-way URL/API with return date | Reject mixed trip state. | URL parser rejects; API returns "One-way searches cannot include a return date. Remove the return date or switch to round trip." | Low: specific. |
| Passenger count below/above range or decimal via URL/API | Reject as 1-9 integer. | URL parser rejects with "Choose 1 to 9 passengers." API returns `Passenger count must be between 1 and 9`. Form buttons clamp 1-9. | Low: robust, though form has no editable numeric input state. |
| Provider credentials missing on valid route | Show loading, then clear provider-unavailable and empty-state copy. | Valid `JFK-LHR` returns 200 NDJSON provider notices for Travelpayouts, Duffel, Amadeus, Kiwi, hotel unavailable, plus nearby suggestion. | Medium: coherent for unavailable providers, but same-route/unknown-code bugs get the same treatment. |

## Manual Verification Flows

Valid search flow, direct route-handler verification:

1. Called `GET /api/search?origin=JFK&dest=LHR&depart=2026-07-15&return=2026-07-22&passengers=1&trip=roundtrip` through `node --import tsx`.
2. Actual: status `200`, `Content-Type: application/x-ndjson`.
3. Actual stream: provider-unavailable notices for Travelpayouts, Duffel, Amadeus, Kiwi; nearby suggestion `LGA, EWR`; hotel unavailable; `done`.
4. Trust note: this is acceptable for an uncredentialed local environment because the result is honest about provider availability.

Invalid search flow, direct route-handler verification:

1. Called same API with missing origin, invalid free-text origin, unknown 3-letter origin, same-origin-destination, missing depart, invalid date, past date, return-before-depart, invalid passengers, and one-way with return.
2. Actual: most invalid states return `400` with specific copy.
3. Actual defects: `origin=XXX` and `origin=JFK&dest=JFK` return `200` and stream provider notices.

Browser/manual UI flow was blocked by the sandbox server restriction. Required unrestricted follow-up: capture `/` at 375px and desktop; submit empty origin, invalid typed origin, missing dates, same route, `XXX`, and valid `JFK-LHR`; verify focus destination after each failed submit.

## Focus And Screen Reader Notes

- Date errors are attached with `aria-invalid` and `aria-describedby` on the date inputs in `app/page.tsx:1057` to `app/page.tsx:1074` and `app/page.tsx:1085` to `app/page.tsx:1102`.
- Origin and destination validation errors are global `role="alert"` messages in `app/page.tsx:1155` to `app/page.tsx:1158`; `AirportInput` does not accept error props, so the specific route error is not attached to either combobox.
- `AirportInput` has useful combobox attributes and live lookup status in `app/components/AirportInput.tsx:165` to `app/components/AirportInput.tsx:228`.
- There is no `focus()`, error summary focus, or `ref`-driven focus management after failed submit in `runSearch` or `handleSearch` (`app/page.tsx:658` to `app/page.tsx:815`).
- Passenger controls have screen-reader names: "Remove passenger" and "Add passenger" in `app/page.tsx:1132` to `app/page.tsx:1148`.

## Responsive State Notes

Mobile 375px:

- Search form stacks origin, swap, destination, dates, flexible dates, and passenger controls into one column or mobile-safe grids (`app/page.tsx:1011` to `app/page.tsx:1177`).
- No static overlap found in the source for the primary search form. The swap button rotates and sits between route fields.
- Risk: route errors appear as one global alert below passenger controls, so on a small screen the user may not see the problem near the origin/destination field.
- Results header compresses route and date into a sticky dark header with `pr-16` for the fixed theme toggle (`app/page.tsx:803` to `app/page.tsx:830`); long route display is truncated, which is usable but can hide the field that caused a problem.

Desktop:

- Search panel uses a two-column route grid and two-column date grid; primary action remains visible.
- Validation copy for date fields is close to the fields. Route validation remains global.
- Empty/loading/error states are coherent in `components/flights/FlightResults.tsx:157` to `components/flights/FlightResults.tsx:213` and `app/page.tsx:852` to `app/page.tsx:887`, but invalid route states can incorrectly reach these result states.

## Findings

### P1: Unknown three-letter airport codes are treated as valid

Repro:

1. Submit or call `/api/search?origin=XXX&dest=LHR&depart=2026-07-15&return=2026-07-22&passengers=1&trip=roundtrip`.
2. Observe `200` NDJSON provider notices instead of a route validation error.

Evidence:

- `resolveToIATA` returns any three-letter input uppercased before checking `AIRPORTS`: `lib/airports/resolve.ts:50` to `lib/airports/resolve.ts:61`.
- API route only catches resolver throws, so `XXX` proceeds to providers: `app/api/search/route.ts:102` to `app/api/search/route.ts:124`.

Recommended follow-up:

`AUDIT-REPAIR-SEARCH-IATA-VALIDATION-01` - Require three-letter codes to exist in the airport dataset or a provider-approved airport list before search submission. Keep autocomplete behavior unchanged.

### P1: Same-origin-destination route submits as a real search

Repro:

1. Submit or call `/api/search?origin=JFK&dest=JFK&depart=2026-07-15&return=2026-07-22&passengers=1&trip=roundtrip`.
2. Observe `200` NDJSON provider-unavailable notices.

Evidence:

- `runSearch` validates origin, destination free-text, and dates, but does not compare normalized origin/destination: `app/page.tsx:658` to `app/page.tsx:685`.
- API validates route fields independently but never rejects equal airport codes: `app/api/search/route.ts:102` to `app/api/search/route.ts:155`.

Recommended follow-up:

`AUDIT-REPAIR-SAME-ROUTE-VALIDATION-01` - Block equal normalized origin/destination in client and API with calm copy: "Choose a different destination, or clear destination to search everywhere."

### P1: Failed route validation does not move focus or attach errors to route controls

Repro:

1. Type an invalid origin such as `NotAPlace`.
2. Submit.
3. Observe global alert below the route/date/passenger controls; focus stays on the submit button or current field.

Evidence:

- Client sets global form errors for origin/destination: `app/page.tsx:667` to `app/page.tsx:677`.
- The global alert renders after flexible dates/passengers: `app/page.tsx:1155` to `app/page.tsx:1158`.
- `AirportInput` only has lookup status in `aria-describedby`, not validation error linkage: `app/components/AirportInput.tsx:165` to `app/components/AirportInput.tsx:182`.

Recommended follow-up:

`AUDIT-REPAIR-SEARCH-ERROR-FOCUS-01` - Add narrow field-level error plumbing for origin/destination and focus the first invalid control after failed submit. Do not change autocomplete suggestions.

### P2: API validation copy is inconsistent with user-facing UI copy

Evidence:

- Missing origin API copy is `origin is required`: `app/api/search/route.ts:102` to `app/api/search/route.ts:105`.
- Invalid API date copy uses field names like `depart is not a valid date`: `app/api/search/route.ts:43` to `app/api/search/route.ts:51`.
- UI link parsing uses calmer copy for equivalent URL states: `app/page.tsx:186` to `app/page.tsx:235`.

Recommended follow-up:

`AUDIT-REPAIR-SEARCH-API-COPY-01` - Normalize API validation reasons to match the client/link parser style so retry/error panels remain user-facing when API validation is hit directly.

### P2: Route suggestions are fake-feeling in a validation audit context

Evidence:

- Static route suggestions are hardcoded with claims like "Deal history ready" and "Flexible date friendly": `app/page.tsx:28` to `app/page.tsx:34`.

Risk:

This is out of scope for this ticket because it says do not add fake suggested destinations or examples, and changing/removing suggestions would alter homepage behavior. It should be reviewed separately for product trust.

Recommended follow-up:

`AUDIT-REVIEW-ROUTE-SUGGESTION-CLAIMS-01` - Audit whether static suggested-route metadata is backed by real route baseline availability.

## Verification Commands

- `node --import tsx ... GET /api/search?...` valid search: passed; returned `200` NDJSON with clear provider-unavailable notices in local uncredentialed env.
- `node --import tsx ...` validation matrix: completed; found `XXX` and same-route false positives.
- `npm run dev -- --hostname 127.0.0.1 --port 3001`: failed, sandbox `listen EPERM`.
- `node -e "require.resolve('playwright')..."`: Playwright and `@playwright/test` unavailable.
- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --passWithNoTests`: passed, 20 suites / 172 tests.
- `npm test -- --runInBand`: passed, 20 suites / 172 tests.

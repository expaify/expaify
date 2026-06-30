# AUDIT-SEARCH-PARAM-NORMALIZATION-01

Date: 2026-06-30

Scope: audit only. No validation, UI, provider, booking, fallback, or affiliate behavior was changed.

## Files Inspected

- `app/page.tsx`
- `app/components/AirportInput.tsx`
- `app/api/search/route.ts`
- `app/api/book/route.ts`
- `lib/providers/*`
- `lib/types.ts`
- `lib/money.ts`
- `lib/airports/resolve.ts`
- `lib/db/client.ts`

Requested-but-absent files:

- `app/api/tickets/route.ts`
- `app/api/tickets/[id]/route.ts`
- `lib/db.ts`

Current equivalents inspected instead:

- `app/api/search/route.ts` for search/provider calls.
- `app/api/book/route.ts` for ticket-like booking handoff behavior.
- `lib/db/client.ts` for database access.

## Parameter Map

| Parameter | UI state / input | URL / API payload | API normalization / rejection | Provider adapter input |
| --- | --- | --- | --- | --- |
| `origin` | `AirportInput` stores selected IATA in `origin`; typed-but-unselected text stays in `originDisplay` with empty `origin`. | `buildSearchParams` sends trimmed `origin`. | `/api/search` requires `origin`, then `resolveToIATA(originRaw)`. This trims, accepts 3-letter IATA case-insensitively, mapped 5-digit ZIPs, exact/prefix city names, and display strings ending in uppercase `(IATA)`. Unrecognized values return 400. | `originIATA` passed to all flight providers and snapshot route enrollment. |
| `dest` | Optional `AirportInput`; typed-but-unselected text stays in `destDisplay` with empty `dest`. | Sent only if trimmed `dest` is non-empty. | If present, `/api/search` resolves through `resolveToIATA`; unrecognized values return 400. Empty destination is allowed and becomes `''` for flight providers; hotels are skipped. | Flight providers receive `destIATA ?? ''`. Hotel provider receives `destIATA` only when destination plus depart and return are present. |
| `depart` | Native date input string. UI sets `min={todayIso()}` and validates on submit. | Sent if non-empty. | Required for all searches. Must match `YYYY-MM-DD`, parse to same UTC ISO date, and be today or future. Invalid values return 400 before providers. | `range.depart` passed unchanged except flex mode, where Travelpayouts receives shifted dates from -3 to +3 days. |
| `return` | Native date input string, hidden and cleared for one-way. | Sent only for round trips with a value. | Required for `trip=roundtrip`; forbidden for `trip=oneway`; must match `YYYY-MM-DD` and be on/after depart. Invalid values return 400 before providers. | `range.return` is passed to flight providers when present. Hotels use `{ checkin: depart, checkout: return }`. |
| `passengers` | Stepper clamps state to 1..9. | Always sent as string. | `parsePassengers` defaults missing to `1`, requires integer 1..9, else 400. | `range.passengers` passed to providers. Duffel/Amadeus/Kiwi build adult traveler arrays from it. Travelpayouts records it in normalized fares but vendor calls do not include a passenger count. |
| `trip` | `roundtrip` or `oneway` segmented control. | Always sent. | Missing defaults to `roundtrip`; only `roundtrip` and `oneway` accepted. Mixed one-way plus return is rejected. | Providers do not receive `trip`; they infer one-way vs round-trip from `range.return`. |
| `flex` | Checkbox boolean. | Sent as `flex=1` only when enabled and depart exists. | `/api/search` treats only `flex=1` as true; any other value is silently false at the API. URL parser rejects non-`0`/`1` values before client auto-search. | Only Travelpayouts receives shifted depart dates for flex search. Other flight providers receive the original date. |
| `currency` | No user-selectable currency in search UI. | No search currency parameter. Score/hotel score calls may include returned currency. | Search API has no currency input boundary. | Travelpayouts/Kiwi/Hotellook request or emit USD. Amadeus requests USD but returns provider currency. Duffel returns provider currency. |
| Hotel params | No standalone hotel search form. Hotels are derived from flight destination and round-trip dates. | No separate hotel payload from UI. | Hotels run only when `destIATA && depart && ret`; otherwise `hotel-status: skipped`. | `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })`; adapter trims/uppercases area and hardcodes `currency=USD`. |
| Result filters | `tab`, `sort`, `stops` live in page state. | Included in share URL when non-default. Not sent to `/api/search` except if present in page URL. | Client URL parser rejects invalid `tab`, `sort`, and `stops`. `/api/search` ignores them. | Not provider-facing. |

## Normalization Points

- `AirportInput` trims lookup queries and clears the canonical IATA value whenever the user types free text. This prevents typed-but-unselected airport text from being submitted as a selected airport from the normal form flow.
- `resolveToIATA` trims input and uppercases 3-letter airport codes. It accepts display strings only if they end in uppercase `(IATA)`.
- `app/page.tsx` validates dates before fetch, trims canonical `origin` and `dest`, clears return date for one-way searches, clamps passenger UI state to 1..9, and rejects malformed shared-link values for `tab`, `sort`, `stops`, `passengers`, `trip`, dates, and `flex`.
- `app/api/search/route.ts` repeats the critical provider-bound checks for origin, destination, dates, trip type, and passenger count before calling providers.
- Provider adapters normalize vendor money into integer minor units (`priceCents`) and currency strings in `NormalizedFare.price` / `HotelOffer.pricePerNight`.
- Display formatting validates money shape in `lib/money.ts` before showing prices and uppercases currency for presentation.

## Rejection and Error-Copy Points

- Client form rejects empty canonical origin with `Add an origin to search.` or `Choose a valid origin airport from the list before searching.`
- Client form rejects typed-but-unselected destination with `Choose a valid destination airport from the list, or clear the destination field to search everywhere.`
- Client form rejects missing, malformed, past, or reversed dates with field-level copy plus `Correct the highlighted date fields before searching.`
- Shared-link parsing rejects invalid route, dates, passenger count, trip type, flex flag, tab, sort, and stops with link-specific copy before auto-search.
- `/api/search` returns 400 JSON for missing origin, unrecognized origin/destination, invalid trip, missing depart, missing round-trip return, one-way plus return, malformed dates, past depart, reversed range, and invalid passenger count.
- Provider failures are not exposed raw in result cards. They are mapped to `notice` or `hotel-status` messages such as provider unavailable, malformed response, no flight providers returned matching fares, or hotel provider unavailable.

## Trust Risks

1. Shared-link and API error copy can disagree for the same malformed query. Example: shared-link parsing reports `The departure date in this link is not valid. Use a calendar date before searching.`, while direct API access returns `depart must use YYYY-MM-DD format`. This is not a provider risk, but it is a trust/copy consistency risk.
2. API `flex` handling is looser than client URL parsing. The page rejects `flex=maybe` in a shared link, but `/api/search?...&flex=maybe` silently treats it as false. Malformed flex does not reach providers as malformed data, but API validation and visible link validation disagree.
3. Flexible-date searches intentionally return Travelpayouts fares for dates up to seven searched variants while the URL/header still represents the originally selected depart date. Result cards show each fare's returned date, but the result context can make the search look narrower than the provider request actually was.
4. Travelpayouts does not send passenger count to vendor endpoints while the UI says multiple passengers and result cards label Travelpayouts prices as per-person fares. This is probably acceptable for per-person fare inventory, but it is a parameter-expectation mismatch worth keeping explicit.
5. `resolveToIATA` accepts any 3-letter alphabetic code by shape, not just known airports. That means values such as `AAA` can pass app validation and reach providers as an airport code. This may be intentional for broad airport support, but it is the main path where malformed-but-shaped route input can reach `lib/providers`.
6. Provider-returned airport/currency casing is not fully normalized after adapter parsing. Display code uppercases currency for formatting, but dedup and cache keys use raw `fare.price.currency`; providers that return lowercase or mixed-case currency can fragment dedup/cache behavior.
7. `lib/db/client.ts` throws when `DATABASE_URL` is missing. `/api/search` fire-and-forget route enrollment catches query rejection, but this database helper does not follow `Result<T>` itself. This is not a provider adapter issue, but it is a boundary difference from the no-throw service-contract style.

## Provider Boundary Findings

- Search provider calls are centralized behind `lib/providers` from `/api/search`. No component calls vendor APIs directly.
- Flight adapters implement `FlightProvider` and return `Promise<Result<NormalizedFare[]>>`; hotel adapter implements `HotelProvider` and returns `Promise<Result<HotelOffer[]>>`.
- Adapters catch network, cache, JSON, and parse failures and return `{ ok: false, reason }` to callers.
- `/api/search` does not throw provider failures to the client; it maps non-ok provider results to streamed notices/status lines.
- Money remains structured as `{ priceCents, currency }` in shared types and returned result models. No returned fare or hotel offer uses a bare money number.
- Internal conversion helpers use decimal-string parsing or major-unit-to-cents rounding; there are no floating-money fields in normalized result objects.

## Malformed Input Reachability

- Empty origin, unknown route text, invalid trip, invalid/missing dates, one-way plus return, reversed ranges, and passenger values outside 1..9 are rejected before provider calls.
- Mixed-case and whitespace-padded IATA/city/ZIP inputs are accepted and normalized by `resolveToIATA` before provider calls.
- Shape-valid but unknown 3-letter airport codes can reach providers because the resolver accepts any `/^[A-Za-z]{3}$/`.
- Malformed `flex` can reach `/api/search` but is coerced to false and does not reach providers as a malformed provider parameter.
- Invalid shared-link `tab`, `sort`, or `stops` are rejected by the client parser but are ignored by `/api/search` if called directly.

## Manual Verification

Local browser submission was blocked in this environment: `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`. Because the server could not bind, I could not complete an in-browser 375px/desktop submission pass.

Source-backed flow checked:

- Valid search: `origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=2`
  - Expected API behavior from route test/source: 200 NDJSON; all flight providers called with `('JFK', 'LAX', { depart: '2099-09-22', return: '2099-09-29', passengers: 2 })`; hotel provider called with `('LAX', { checkin: '2099-09-22', checkout: '2099-09-29' })`.
  - Expected UI copy: loading `Scanning deals across providers...`; hotel tab loads or reports empty/unavailable based on provider result; result header uses selected route/date/passenger state.
- Malformed search 1: missing depart, `origin=JFK&dest=LAX&trip=oneway&passengers=1`
  - API behavior: 400, no provider calls.
  - API copy: `Departure date is required. Choose a departure date before searching.`
  - UI form copy for normal submit: field `Choose a departure date before searching.` plus `Correct the highlighted date fields before searching.`
- Malformed search 2: past depart, `origin=JFK&dest=LAX&depart=2020-01-01&trip=oneway&passengers=1`
  - API behavior: 400, no provider calls.
  - API/UI copy: `Departure date cannot be in the past. Choose today or a future date.`
- Malformed search 3: reversed round trip, `origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-20&trip=roundtrip&passengers=1`
  - API behavior: 400, no provider calls.
  - API copy: `Return date must be on or after departure date.`
  - UI form copy: `Return date must be on or after the departure date.`
- Malformed search 4: invalid passenger count, `origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=10`
  - API behavior: 400, no provider calls.
  - API copy: `Passenger count must be between 1 and 9`
  - UI normal form cannot create this state via stepper; shared-link parser reports `The passenger count in this link is not valid. Choose 1 to 9 passengers.`

## Out-of-Scope Recommendations

- Align shared-link and API validation copy for the same malformed inputs.
- Decide whether 3-letter airport codes should be existence-checked against known airport data before provider calls.
- Make `/api/search` reject malformed `flex` explicitly if direct API parity with shared-link validation matters.
- Consider normalizing provider-returned currency codes to uppercase inside adapters before caching/deduping.
- Consider including an explicit flexible-date result-context label when flex mode fans out provider dates.

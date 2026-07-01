# AUDIT-HOTEL-PROVIDER-CURRENCY-LINEAGE-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: hotel `priceCents` and `currency` lineage from provider adapter through search UI and booking boundary.

## Executive Result

Conditional pass for the current Hotellook-only hotel path: hotel result prices that reach the UI are structured as integer minor units plus a currency code, and invalid or missing hotel prices are not rendered as zero or made bookable.

Blocked for multi-currency proof: the current hotel adapter requests `currency=USD` and hardcodes `pricePerNight.currency = 'USD'`, so this worktree cannot prove preservation of non-USD provider currency. No fixtures exercise multiple hotel currencies.

## Requested Surface Mismatch

These assigned files do not exist in this worktree:

- `app/api/hotels/route.ts`
- `components/hotels/HotelCard.tsx`
- `components/hotels/HotelPrice.tsx`
- `components/hotels/HotelResults.tsx`
- `lib/booking.ts`
- `lib/providers/hotels.ts`

Actual hotel surfaces inspected:

- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `app/page.tsx`
- `app/components/HotelCard.tsx`
- `app/api/book/route.ts`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `lib/booking/config.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/index.ts`
- `lib/types.ts`
- `lib/money.ts`
- `lib/providers/__tests__/hotellook.test.ts`
- `app/components/__tests__/scorePresentation.test.tsx`
- `lib/scoring/scoreDeal.ts`

## Hotel Money Fields Observed

| Field | Location | Contract status |
| --- | --- | --- |
| `HotelLookCacheEntry.priceFrom` | `lib/providers/hotellook.ts:17` | Provider raw major-unit number/string. Converted before leaving adapter. |
| `priceCents` local | `lib/providers/hotellook.ts:96` | Integer cents from `priceFromToCents`; null invalid values are dropped. |
| `HotelOffer.pricePerNight.priceCents` | `lib/providers/hotellook.ts:108` and `lib/types.ts:52` | Uses integer minor units. |
| `HotelOffer.pricePerNight.currency` | `lib/providers/hotellook.ts:110` and `lib/types.ts:52` | Present, but hardcoded to `USD` after requesting `currency=USD`; not provider-derived. |
| Redis cached hotel offers | `lib/providers/hotellook.ts:71` and `lib/providers/hotellook.ts:118` | Cached as full `HotelOffer[]`, including structured `pricePerNight`. No runtime cache validation. |
| Search NDJSON `hotels.data` | `app/api/search/route.ts:293` to `app/api/search/route.ts:295` | Forwards provider `HotelOffer[]` without flattening money. |
| Client hotel state | `app/page.tsx:763` to `app/page.tsx:767` | Casts streamed hotel data to `HotelOffer[]`; preserves structured money in state. |
| Hotel score query `pricePerNightCents` | `app/page.tsx:614` to `app/page.tsx:619` | Sends integer cents as string from `hotel.pricePerNight.priceCents`. |
| Hotel score query `currency` | `app/page.tsx:614` to `app/page.tsx:619` | Sends `hotel.pricePerNight.currency`. |
| Hotel score API `pricePerNightCents` | `app/api/score/route.ts:48` to `app/api/score/route.ts:60` | Requires positive integer. |
| Hotel score API `currency` | `app/api/score/route.ts:50` | Uppercases query currency, but defaults missing currency to `USD`. This is an implicit-USD boundary if callers omit currency. |
| Hotel snapshot `price_per_night_cents` | `app/api/score/route.ts:15` and `app/api/score/route.ts:28` | Returned as `PricePoint.priceCents`. |
| Hotel snapshot `currency` | `app/api/score/route.ts:15` and `app/api/score/route.ts:29` | Returned as trimmed `PricePoint.currency`. |
| Deal score `medianCents` and `currency` | `lib/scoring/scoreDeal.ts:155` | Structured score money is retained. |
| Hotel card nightly rate | `app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59` | Uses `formatMoney(Money)` and states `per night before taxes and fees`. |
| Hotel card usual price | `app/components/HotelCard.tsx:129` to `app/components/HotelCard.tsx:132` | Builds `{ priceCents, currency }` from score and formats with shared money formatter. |
| Booking fare context price | `lib/booking/config.ts:12` to `lib/booking/config.ts:13` | Flight booking only. No hotel result enters this context. |

## Findings

### P1: Hotel adapter cannot prove provider currency lineage beyond USD

Repro/evidence:

1. Inspect `lib/providers/hotellook.ts:74` to `lib/providers/hotellook.ts:81`.
2. The provider request appends `currency=USD`.
3. Inspect `lib/providers/hotellook.ts:108` to `lib/providers/hotellook.ts:110`.
4. Returned hotel offers set `currency: 'USD'` rather than reading a provider currency field.

Impact: current USD-only results are internally consistent, but this does not prove preservation of provider currency when a provider supports or returns multiple currencies. This blocks the full acceptance target for multi-currency lineage.

### P2: Hotel score API has an implicit USD fallback

Repro/evidence:

1. Inspect `app/api/score/route.ts:48` to `app/api/score/route.ts:50`.
2. If `currency` is absent, the API defaults to `USD`.
3. Current `app/page.tsx:614` to `app/page.tsx:619` does send currency, so normal UI use preserves it.

Impact: a malformed or future caller can score a hotel as USD instead of failing closed. This is an implicit-USD boundary at the score API.

### P3: Hotel Deal Score explanation can display USD amounts without the `USD` code

Repro/evidence:

1. `app/components/HotelCard.tsx:166` renders `score.explanation`.
2. `lib/scoring/scoreDeal.ts:45` to `lib/scoring/scoreDeal.ts:52` formats USD as `$x.xx` without appending `USD`.
3. The primary nightly rate and usual price use `lib/money.ts:14` to `lib/money.ts:24`, which appends the currency code.

Impact: the primary hotel price is explicit (`$189 USD`), but secondary score prose can show `$189.00` without `USD`. This is a display consistency issue, not a provider lineage break.

## Positive Coverage

- Money contract exists centrally: `Money = { priceCents: number; currency: string }` in `lib/types.ts:1`; `HotelOffer.pricePerNight` uses `Money` in `lib/types.ts:47` to `lib/types.ts:57`.
- Invalid hotel provider prices are not emitted. `priceFromToCents` rejects missing, zero, negative, non-finite, and unsafe values in `lib/providers/hotellook.ts:33` to `lib/providers/hotellook.ts:43`; entries with null cents are skipped at `lib/providers/hotellook.ts:100`.
- The search API forwards hotel offers without converting structured money to bare numbers or display strings at `app/api/search/route.ts:293` to `app/api/search/route.ts:295`.
- Client state stores hotel offers as `HotelOffer[]` and sends both cents and currency for scoring in `app/page.tsx:763` to `app/page.tsx:767` and `app/page.tsx:614` to `app/page.tsx:619`.
- Main hotel price display validates money before rendering. Invalid `priceCents` or invalid currency renders `Price unavailable`, not `$0`, at `app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:183` and `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:253`.
- Hotel CTA is gated on both a valid URL and valid money at `app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:184`. Missing price or deeplink renders `Booking unavailable` at `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:285`.
- Hotel booking handoff is external-only through the provider deeplink. The `/book` page is flight fare review only: metadata says `Book flight` at `app/book/page.tsx:5`, and `/api/book` rejects non-Duffel contexts at `app/api/book/route.ts:60` to `app/api/book/route.ts:63`.

## UX State Review

- Loading: hotel tab renders skeleton cards while `isSearching` is true at `app/page.tsx:1437` to `app/page.tsx:1450`; no fake price is shown in skeletons.
- Empty: no hotel inventory renders a state panel with `No hotel inventory found` and provider/date context at `app/page.tsx:1452` to `app/page.tsx:1471`.
- Error/unavailable: hotel provider failure renders `Hotels unavailable` with provider availability copy at `app/page.tsx:1452` to `app/page.tsx:1471`.
- Skipped: destination/date omissions disable hotel tab and explain why at `app/page.tsx:1399` to `app/page.tsx:1403`.
- Mobile 375px: hotel results use a single-column grid by default and switch to two/three columns at larger breakpoints (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) at `app/page.tsx:1438` and `app/page.tsx:1473`. Hotel card CTA stacks vertically by default at `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:254`.
- Desktop: hotel result grid supports three columns at `lg` without nested booking panels. No manual browser screenshot was taken in this audit.

## Manual Verification Flow

Use this flow when hotel credentials and at least one hotel result are available:

1. Start the app and search round trip with origin, destination, depart date, and return date.
2. Open the Hotels tab.
3. For each hotel card, record the displayed nightly rate. Expected format: amount plus three-letter currency code, e.g. `$129.99 USD`, plus `per night before taxes and fees`.
4. Inspect the network stream from `/api/search`. The selected hotel should contain `pricePerNight.priceCents` as an integer and `pricePerNight.currency` as a non-empty three-letter code.
5. Confirm the Deal Score request to `/api/score?type=hotel` includes `pricePerNightCents=<same integer>` and `currency=<same code>`.
6. Click `Check with HotelLook`. Confirm this is an external provider handoff, not `/book`.
7. Compare the provider page price manually. If it differs, the in-app copy already says provider prices can change; do not infer taxes, fees, or conversion locally.
8. Force a missing or invalid price fixture (`priceCents: 0` or blank currency) and confirm the card shows `Price unavailable` and `Booking unavailable`, with no `$0` and no provider CTA.

Booking continuity result: no hotel result continues to the in-app booking review in this worktree. Hotel continuity is result card to external provider handoff only. The in-app booking continuity checks in `lib/booking/config.ts` and `app/api/book/route.ts` are flight/Duffel-only.

## Fixture Blocker

`lib/providers/__tests__/hotellook.test.ts` validates USD conversion and invalid-price exclusion, including `priceFrom: 129.99 -> { priceCents: 12999, currency: 'USD' }`. It does not include multiple hotel currencies because the adapter requests USD and hardcodes USD. This blocks proving non-USD hotel currency lineage from provider to UI.

## Verification Commands

- `npm run typecheck`: failed. `package.json` has no `typecheck` script.
- `npx tsc --noEmit --incremental false`: passed.
- `npm test -- --runInBand`: passed. 20 test suites passed, 176 tests passed.
- `npm test -- --passWithNoTests`: passed. 20 test suites passed, 176 tests passed.

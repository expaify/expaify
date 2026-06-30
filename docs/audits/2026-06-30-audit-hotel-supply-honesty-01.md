# AUDIT-HOTEL-SUPPLY-HONESTY-01: Hotel Supply Honesty

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Strict audit only. No production feature code changed.

## Executive Decision

Mostly passing, with one hotel honesty defect.

Hotel cards do not render fake placeholder hotel supply as bookable when price, photo, or booking link is missing. Missing photos show explicit unavailable copy, missing or invalid price/link disables booking, empty/unavailable/skipped hotel states avoid hotel cards, and visible hotel money uses `priceCents` plus `currency`.

The defect: HotelLook `stars` are mapped into `rating`, so the UI can display an invented "Guest rating" based on hotel class rather than provider guest-review data.

## Files Inspected

- `app/page.tsx`
- `app/components/HotelCard.tsx`
- `app/components/FlightCard.tsx`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/index.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/amadeus.ts`
- `lib/providers/kiwi.ts`
- `lib/types.ts`
- `app/api/score/route.ts`
- `app/components/__tests__/scorePresentation.test.tsx`
- `lib/providers/__tests__/hotellook.test.ts`

Next.js local docs read before route assumptions: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.

## Findings

### P1: Hotel card can show invented guest rating from hotel class

Evidence:

- `lib/providers/hotellook.ts:94` reads `entry.stars`.
- `lib/providers/hotellook.ts:105` maps the same value to `stars`.
- `lib/providers/hotellook.ts:106` also maps that same value to `rating`.
- `app/components/HotelCard.tsx:202` treats any positive `hotel.rating` as available.
- `app/components/HotelCard.tsx:246` to `app/components/HotelCard.tsx:252` renders "Guest rating" and `RatingBadge`.
- `app/components/HotelCard.tsx:29` to `app/components/HotelCard.tsx:45` labels that number as `Good`, `Very good`, or `Excellent`.
- `lib/providers/__tests__/hotellook.test.ts:113` to `lib/providers/__tests__/hotellook.test.ts:124` locks this behavior in by expecting `rating: 4` from `stars: 4`.

Provider-data dependency: HotelLook cache rows inspected here expose `stars`, not a distinct guest-review score in the adapter type at `lib/providers/hotellook.ts:9` to `lib/providers/hotellook.ts:19`. A hotel class value is not a guest rating.

Repro:

1. Mock HotelLook with `{ hotelId: 12345, hotelName: 'Hotel Example', stars: 4, priceFrom: 129 }`.
2. Let `HotellookProvider.searchHotels()` normalize the row.
3. Render the returned hotel in `HotelCard`.
4. Observe both "Hotel class" and "Guest rating" are derived from the same `stars` value.

Expected: show hotel class only unless provider returns a separate review/rating field.

Actual: card can claim a guest rating that is not traceable to provider guest-review output.

Impact: Trust risk. Users may read hotel class as guest satisfaction/review quality.

### P2: All malformed hotel rows can collapse into true empty-inventory copy

Evidence:

- `lib/providers/hotellook.ts:91` to `lib/providers/hotellook.ts:115` filters unusable rows with `flatMap`.
- Rows missing valid `hotelId`, `hotelName`, or positive `priceFrom` are dropped at `lib/providers/hotellook.ts:96` to `lib/providers/hotellook.ts:100`.
- If all rows drop, the provider returns `{ ok: true, data: [] }` at `lib/providers/hotellook.ts:117` to `lib/providers/hotellook.ts:118`.
- `/api/search` renders that as true empty inventory: `app/api/search/route.ts:231` to `app/api/search/route.ts:232`.
- The page copy becomes "No hotel inventory found" / "No hotels were returned for these dates" at `app/page.tsx:761` to `app/page.tsx:767` and `app/page.tsx:1231` to `app/page.tsx:1238`.

Provider-data dependency: This depends on HotelLook returning a syntactically valid array where entries are individually unusable or missing price. It is not fake bookable supply, but it can overstate certainty that no hotels exist.

Repro:

1. Mock HotelLook with an array of rows that have hotel names but missing/zero/non-finite `priceFrom`.
2. Call `HotellookProvider.searchHotels()`.
3. Observe `{ ok: true, data: [] }`.
4. Search route emits `hotel-status: empty`, not a partial/malformed provider limitation.

Expected: distinguish "no usable priced hotel offers" from "provider returned no hotels" when provider rows existed but were unusable.

Actual: UI can present filtered provider data loss as no hotel inventory.

Impact: Medium. The app does not show fake hotels, but it can sound more definitive than the data supports.

## Passing Checks

- Fake or placeholder supply as bookable: Not observed. `HotelCard` only renders "Book hotel" when the deeplink is a valid `http`/`https` URL and price cents are a positive integer at `app/components/HotelCard.tsx:188` to `app/components/HotelCard.tsx:200` and `app/components/HotelCard.tsx:271` to `app/components/HotelCard.tsx:303`.
- Fake imagery: Not observed. Missing `photoUrl` renders "Hotel photo unavailable" instead of a stock/placeholder image at `app/components/HotelCard.tsx:206` to `app/components/HotelCard.tsx:220`. Existing test coverage asserts this at `app/components/__tests__/scorePresentation.test.tsx:156` to `app/components/__tests__/scorePresentation.test.tsx:161`.
- Unsupported amenities: None observed. Hotel cards render class, guest rating, area, price, Deal Score, and CTA only; no amenities, reviews, urgency, maps, or availability claims are invented in `app/components/HotelCard.tsx:222` to `app/components/HotelCard.tsx:305`.
- Vague location claims: Mostly passing. `area` is provider `entry.location?.name`, falling back to the searched location code at `lib/providers/hotellook.ts:104`; the card only renders `hotel.area` when present at `app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:235`. The fallback is a coarse destination code, but it is not presented as exact address or distance.
- Price basis: Passing. Hotel price label says "Nightly rate" and "per night before taxes and fees" at `app/components/HotelCard.tsx:49` to `app/components/HotelCard.tsx:67`.
- Money units: Passing for hotel surfaces. Shared type is `{ priceCents, currency }` at `lib/types.ts:1` and `lib/types.ts:47` to `lib/types.ts:57`; HotelLook converts major-unit `priceFrom` to integer cents at `lib/providers/hotellook.ts:32` to `lib/providers/hotellook.ts:42`; the card validates positive integer cents at `app/components/HotelCard.tsx:199`; the score request sends `pricePerNightCents` and `currency` at `app/page.tsx:454` to `app/page.tsx:459`.
- Affiliate handoff: Passing for HotelLook-produced links. Hotel deeplinks include `marker=` from `HOTEL_AFFILIATE_ID` or legacy marker at `lib/providers/hotellook.ts:50` to `lib/providers/hotellook.ts:55`, and missing marker blocks provider output at `lib/providers/hotellook.ts:62` to `lib/providers/hotellook.ts:64`.
- Empty/unavailable/skipped states: Passing for card suppression. `/api/search` sends `available`, `empty`, `unavailable`, or `skipped` at `app/api/search/route.ts:225` to `app/api/search/route.ts:249`; the page stores those states at `app/page.tsx:603` to `app/page.tsx:613` and disables the Hotels tab when no hotel cards are actionable at `app/page.tsx:751` and `app/page.tsx:1144` to `app/page.tsx:1184`.
- Loading state: Passing by source review. Hotel loading uses skeleton cards, not fake hotel names/prices, at `app/page.tsx:1216` to `app/page.tsx:1230` and `app/page.tsx:206` to `app/page.tsx:223`.

## Manual Verification

Live browser verification was blocked: `npm run dev -- --hostname 127.0.0.1 --port 3010` failed with `listen EPERM: operation not permitted 127.0.0.1:3010`.

Manual route-state verification was performed with a temporary Jest harness, then the harness was removed:

```text
npm test -- app/api/search/__audit-hotel-honesty.test.ts --runInBand
```

Result: passed. The temporary harness covered:

- Hotels present: route streamed `hotel-status: available` and a `hotels` event containing only mocked provider hotel data.
- Hotels absent: route streamed `hotel-status: empty` and no `hotels` event.
- Provider failure: route streamed `hotel-status: unavailable` and no `hotels` event.
- Missing criteria: route streamed `hotel-status: skipped` and did not call the hotel provider.

Mobile 375px and desktop layout review:

- Source review shows hotel grids collapse to one column on mobile and expand at `sm`/`lg` breakpoints at `app/page.tsx:1217` and `app/page.tsx:1241`.
- Hotel card price/CTA stack vertically on mobile and switch to row alignment on larger screens at `app/components/HotelCard.tsx:265` to `app/components/HotelCard.tsx:304`.
- Hotel CTA is full width on mobile through `btn-primary-responsive` at `app/components/HotelCard.tsx:279` and `app/globals.css:241` to `app/globals.css:243`; disabled CTA is also full width on mobile at `app/components/HotelCard.tsx:292` to `app/components/HotelCard.tsx:299`.
- No source-level evidence of overlapping hotel card text or hidden primary hotel action was found, but live viewport screenshot confirmation could not be completed because the server could not bind.

## Verification Commands

- `npm test -- app/api/search/__audit-hotel-honesty.test.ts --runInBand` - passed for temporary route-state audit harness; harness removed after use.
- `npm run dev -- --hostname 127.0.0.1 --port 3010` - blocked by sandbox: `listen EPERM`.
- `npx tsc --noEmit --incremental false` - passed.
- `npx jest --runInBand` - passed. 19 suites passed, 151 tests passed.
- `npm test -- --passWithNoTests` - passed. 19 suites passed, 151 tests passed.

## Required Return Note

- What changed and why: Added this audit report documenting hotel card honesty and hotel handoff trust for AUDIT-HOTEL-SUPPLY-HONESTY-01.
- Files changed: `docs/audits/2026-06-30-audit-hotel-supply-honesty-01.md`.
- Verification commands and results: Temporary route-state harness passed; `npx tsc --noEmit --incremental false` passed; `npx jest --runInBand` passed; `npm test -- --passWithNoTests` passed.
- Out-of-scope findings or blockers: Live mobile/desktop browser verification was blocked by local server bind permissions (`EPERM`). No production feature code changed.

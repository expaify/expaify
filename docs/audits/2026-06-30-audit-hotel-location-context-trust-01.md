# AUDIT-HOTEL-LOCATION-CONTEXT-TRUST-01: Hotel Location Context Trust

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Report-only audit. No production feature code changed.

## Executive Decision

Failing with one P1 trust issue and one P2 provenance gap.

Hotel cards mostly avoid inventing location facts: address, city, distance, neighborhood score, review count, and urgency/location superiority claims are not rendered when unavailable. Empty, skipped, unavailable, and loading hotel states are broadly honest.

The trust break is that the card can render a "Guest rating" and quality labels from HotelLook `stars`, not from a verified guest-review rating. The second gap is that the location line has no visible provenance and can fall back to a destination airport/location code while still being shown with a pin icon.

## Requested Files

- Inspected: `app/page.tsx`
- Requested but absent in this repo: `components/TicketCard.tsx`
- Requested but absent in this repo: `components/TicketSlideOver.tsx`
- Requested but absent in this repo: `app/api/run/[id]/route.ts`
- Actual hotel card inspected: `app/components/HotelCard.tsx`
- Actual hotel handoff inspected: direct HotelLook deeplink from `app/components/HotelCard.tsx`
- Provider inspected: `lib/providers/hotellook.ts`
- Shared model inspected: `lib/types.ts`

Next.js local docs read before route/navigation assumptions:

- `node_modules/next/dist/docs/01-app/index.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`

## Rendered Hotel Location Fields and Sources

| Visible field | Surface | Source | Status |
| --- | --- | --- | --- |
| Hotel name | Hotel card title | HotelLook `hotelName` mapped to `HotelOffer.name` at `lib/providers/hotellook.ts:101` to `lib/providers/hotellook.ts:104`; rendered at `app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:210` | Verifiable provider field |
| Area/location line | Hotel card under name | HotelLook `location.name`, falling back to searched destination code at `lib/providers/hotellook.ts:104`; rendered only when truthy at `app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:218` | Partly verifiable; fallback is coarse and unlabeled |
| Address | None | Not present in `HotelOffer` (`lib/types.ts:47` to `lib/types.ts:57`) or HotelLook adapter shape (`lib/providers/hotellook.ts:9` to `lib/providers/hotellook.ts:19`) | Correctly omitted |
| City | None as a distinct field | Not modeled; `area` may contain a provider location string | Correctly omitted as city |
| Distance | None | Not modeled in `HotelOffer` | Correctly omitted |
| Neighborhood | None as a distinct field | Not modeled; `area` may contain provider `location.name` | Correctly omitted as neighborhood |
| Hotel class | Hotel card fact row | HotelLook `stars` mapped to `HotelOffer.stars` at `lib/providers/hotellook.ts:94` and `lib/providers/hotellook.ts:105`; rendered at `app/components/HotelCard.tsx:222` to `app/components/HotelCard.tsx:228` | Verifiable provider field |
| Guest rating | Hotel card fact row | Same HotelLook `stars` value mapped to `rating` at `lib/providers/hotellook.ts:106`; rendered as "Guest rating" at `app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:235` | Unsupported |
| Review count | None | Not modeled in `HotelOffer` | Correctly omitted |
| Provider/source label | Hotel card CTA | `HotelOffer.source` exists (`lib/types.ts:55` to `lib/types.ts:56`) and HotelLook sets `source: 'hotellook'` at `lib/providers/hotellook.ts:111` to `lib/providers/hotellook.ts:114`, but visible text is hardcoded "Check with HotelLook" at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270` | Visible provider label exists, but not data-driven |
| Handoff URL source | External provider link | HotelLook affiliate deeplink built with marker at `lib/providers/hotellook.ts:50` to `lib/providers/hotellook.ts:55`; rendered directly at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:260` | Verifiable URL handoff; no in-app review surface |

## Findings

### P1: "Guest rating" is unsupported because it is derived from hotel class

Visible text:

- "Guest rating"
- "Good"
- "Very good"
- "Excellent"

Evidence:

- HotelLook adapter only defines `stars`, `location.name`, `priceFrom`, `photoUrl`, and `propertyType` in the inspected response shape at `lib/providers/hotellook.ts:9` to `lib/providers/hotellook.ts:19`.
- The adapter reads `entry.stars` at `lib/providers/hotellook.ts:94`.
- The same `stars` value is assigned to `stars` and `rating` at `lib/providers/hotellook.ts:105` to `lib/providers/hotellook.ts:106`.
- The card treats any positive `hotel.rating` as guest rating at `app/components/HotelCard.tsx:185` and renders "Guest rating" at `app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:235`.
- `RatingBadge` converts that number into "Good", "Very good", or "Excellent" at `app/components/HotelCard.tsx:30` to `app/components/HotelCard.tsx:45`.
- Existing tests lock in the mapping by expecting `rating: 4` from `stars: 4` at `lib/providers/__tests__/hotellook.test.ts:82` to `lib/providers/__tests__/hotellook.test.ts:119`.

Repro:

1. Mock HotelLook with `{ hotelId: 12345, hotelName: 'Hotel Example', stars: 4, location: { name: 'New York' }, priceFrom: 129.99 }`.
2. Let `HotellookProvider.searchHotels()` normalize the row.
3. Render the hotel with `HotelCard`.
4. Observe the card renders both hotel class stars and "Guest rating" from the same `stars` value.

Expected:

Only show a guest rating when the provider returns a separate guest-review rating field.

Actual:

The card can show a review-quality claim from hotel class.

Impact:

High trust risk. This makes a hotel look better reviewed than the data proves.

### P2: Area line lacks provenance and can be a coarse fallback

Visible text:

- Whatever `hotel.area` contains, shown next to a location pin.

Evidence:

- `area` is set to `entry.location?.name ?? location` at `lib/providers/hotellook.ts:104`.
- `location` is the uppercased search input passed to HotelLook, currently destination IATA from `/api/search` (`app/api/search/route.ts:247` to `app/api/search/route.ts:251`).
- The card renders the value with a pin icon and no label or source hint at `app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:218`.

Repro:

1. Mock HotelLook with a valid priced hotel row that omits `location.name`.
2. Run a round-trip destination search to `LAX`.
3. Open hotel results.
4. Observe the location line renders `LAX` as if it is location context.

Expected:

Provider location names can render as location context; fallback airport/location codes should be omitted or labeled as search-area fallback.

Actual:

A fallback code can appear as the hotel location line with no provenance.

Impact:

Medium. It does not invent an address or distance, but it weakens location trust because users may read a search code as a hotel area.

## Unsupported or Vague Location Claims

- Unsupported: "Guest rating" at `app/components/HotelCard.tsx:231` to `app/components/HotelCard.tsx:234`, sourced from `stars` rather than a review rating.
- Unsupported: "Good", "Very good", and "Excellent" at `app/components/HotelCard.tsx:30` to `app/components/HotelCard.tsx:45`, derived from the unsupported `rating`.
- Vague/unproven if fallback is used: the unlabeled `hotel.area` line at `app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:218`, because `lib/providers/hotellook.ts:104` can use the search location code.

Not observed on hotel cards or hotel handoff:

- "best area"
- "popular"
- "limited availability"
- "premium location"
- distance-to-center claims
- neighborhood score claims
- review-count claims

Non-hotel route-suggestion copy includes "Popular route" and "Premium cabins" in `app/page.tsx:31` to `app/page.tsx:34`, but that is outside hotel result/handoff surfaces.

## Missing Data Handling

Passing:

- Address is not available and is not rendered.
- Distance is not available and is not rendered.
- Review count is not available and is not rendered.
- Missing photo renders "Hotel photo unavailable" instead of fake imagery at `app/components/HotelCard.tsx:189` to `app/components/HotelCard.tsx:202`.
- Missing/invalid price or booking URL disables booking and gives an explicit unavailable reason at `app/components/HotelCard.tsx:105` to `app/components/HotelCard.tsx:114` and `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:284`.
- Hotel loading uses skeleton blocks, not fake hotel facts, at `app/page.tsx:253` to `app/page.tsx:269` and `app/page.tsx:1436` to `app/page.tsx:1449`.
- Skipped/unavailable hotel search states say hotels were not included or unavailable at `app/page.tsx:917` to `app/page.tsx:934` and `app/page.tsx:1399` to `app/page.tsx:1403`.

Failing:

- Guest rating is filled from hotel class.
- Area fallback is rendered without telling the user it is a coarse search-location fallback.

## Search-to-Results and Results-to-Handoff Continuity

Search-to-results:

- `/api/search` calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })` for round trips with destination and dates at `app/api/search/route.ts:246` to `app/api/search/route.ts:251`.
- The streamed hotel payload is assigned directly to `hotels` state at `app/page.tsx:763` to `app/page.tsx:767`.
- `HotelCard` receives those hotel objects unchanged at `app/page.tsx:1472` to `app/page.tsx:1479`.
- Result: hotel name, area, stars, price, rating, deeplink, photo URL, and source survive search-to-results as normalized by the provider.

Results-to-handoff:

- Hotel handoff is not an in-app ticket/slideover/review route. The card opens `hotel.deeplink` in a new tab at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:260`.
- The deeplink includes an affiliate marker when produced by HotelLook at `lib/providers/hotellook.ts:50` to `lib/providers/hotellook.ts:55`, and missing marker blocks hotel results at `lib/providers/hotellook.ts:62` to `lib/providers/hotellook.ts:64`.
- The only visible handoff provenance is "Check with HotelLook" and "Opens provider site. Prices can change." at `app/components/HotelCard.tsx:261` to `app/components/HotelCard.tsx:270`.
- Result: expaify cannot compare hotel location facts after handoff because the user leaves to HotelLook. The app does preserve the outbound provider source and affiliate marker, but there is no expaify hotel review surface to verify name/area/rating continuity.

## Mobile 375px and Desktop Observations

Live viewport verification was blocked by sandbox server permissions: `npm run dev -- --hostname 127.0.0.1 --port 3010` failed with `listen EPERM: operation not permitted 127.0.0.1:3010`.

Source-level layout observations:

- Hotel result grid is one column by default, two columns at `sm`, and three at `lg` at `app/page.tsx:1437` and `app/page.tsx:1472`.
- Hotel name is clamped to two lines at `app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:210`.
- Area line is truncated at `app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:218`, so long area text should not overflow but may hide useful specificity.
- Hotel class/rating row uses `flex-wrap` at `app/components/HotelCard.tsx:222`, reducing overlap risk at 375px.
- Price and CTA stack vertically on mobile and switch to row alignment at `sm` at `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:254`.
- Hotel CTA is full-width on mobile through `btn-primary-responsive` at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:264`.
- Empty/error panels use stacked actions on mobile through `ResultsStatePanel` at `app/page.tsx:346` to `app/page.tsx:372`.

No source-level evidence of hidden primary hotel actions or overlapping hotel card text was found, but screenshot confirmation could not be completed.

## Manual Verification Flow

Blocked for live browser execution because the dev server cannot bind in this environment.

Completed by source and mocked-test verification:

1. Hotel-inclusive search path: existing route test verifies a round-trip destination search reaches `hotellook.searchHotels('LAX', { checkin, checkout })` (`app/api/search/__tests__/route.test.ts:114` to `app/api/search/__tests__/route.test.ts:130`).
2. Hotel result rendering: existing component test renders a hotel card with area, class, rating, price, and HotelLook CTA (`app/components/__tests__/scorePresentation.test.tsx:115` to `app/components/__tests__/scorePresentation.test.tsx:140`).
3. Provider normalization: existing provider test verifies HotelLook row mapping into `id`, `name`, `area`, `stars`, `rating`, `pricePerNight`, `deeplink`, `photoUrl`, and `source` (`lib/providers/__tests__/hotellook.test.ts:82` to `lib/providers/__tests__/hotellook.test.ts:119`).
4. Handoff comparison: source review confirms hotel handoff is direct external `hotel.deeplink`, so no in-app destination surface exists for comparing hotel location facts after click.

## Verification Commands

- `npm run dev -- --hostname 127.0.0.1 --port 3010` - failed, blocked by sandbox bind permissions: `listen EPERM: operation not permitted 127.0.0.1:3010`.
- `npx jest app/api/search/__tests__/route.test.ts lib/providers/__tests__/hotellook.test.ts app/components/__tests__/scorePresentation.test.tsx --runInBand` - passed. 3 suites passed, 29 tests passed.

Full required verification is recorded in the agent return note after running TypeScript and full Jest.

## Required Return Note

- What changed and why: Added this focused audit report for hotel location context trust.
- Files changed: `docs/audits/2026-06-30-audit-hotel-location-context-trust-01.md`.
- Verification commands and results: See final agent response for `npx tsc --noEmit --incremental false` and `npx jest --runInBand`; targeted Jest passed as noted above.
- Out-of-scope findings or blockers: Live mobile/desktop browser verification was blocked by local server bind permissions. No maps, geocoding, fake imagery, fake ratings, fake distance values, provider refactors, or feature code were added.

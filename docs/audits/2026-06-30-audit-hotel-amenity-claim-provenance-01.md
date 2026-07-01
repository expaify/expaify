# AUDIT-HOTEL-AMENITY-CLAIM-PROVENANCE-01

Date: 2026-06-30
Role: Senior QA
Scope: hotel amenity, rating, location, policy, fee, and source-provenance audit only. No feature code changed.

## Files inspected

- `app/page.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `lib/types.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/index.ts`
- `lib/providers/__tests__/hotellook.test.ts`
- `app/components/__tests__/scorePresentation.test.tsx`

## Executive result

Hotel cards do not currently display specific amenity claims, cancellation claims, included-fee claims, fake scarcity, or fake fallback hotel imagery. The main provenance failure is ratings: `HotellookProvider` copies `stars` into `rating`, and the UI labels that copied class value as `Guest rating` with review-style certainty language.

Hotel metadata is also thin by contract. `HotelOffer` only carries `id`, `name`, `area`, `stars`, `pricePerNight`, optional `rating`, optional `photoUrl`, `deeplink`, and `source` (`lib/types.ts:47`). There are no provider-backed normalized fields for amenities, cancellation, resort fees, taxes, neighborhood precision, review count, or rating source.

## Provider field trace

`/api/search` only checks hotels when destination, depart date, and return date are present (`app/api/search/route.ts:278`). It calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })`, then streams `hotel-status` and `hotels` events (`app/api/search/route.ts:281` to `app/api/search/route.ts:286`).

HotelLook fields accepted by the adapter:

| Visible claim | Provider/input field | Normalized field | UI display | Provenance verdict |
| --- | --- | --- | --- | --- |
| Hotel name | `hotelName` | `hotel.name` | Card title (`app/components/HotelCard.tsx:207`) | Supported if non-empty; adapter only checks type, not blank strings (`lib/providers/hotellook.ts:96`). |
| Location/area | `location.name`, fallback to searched location code | `hotel.area` | Pin row (`app/components/HotelCard.tsx:212`) | Weak when fallback is IATA/search code, because it can look like property location context. |
| Hotel class | `stars` | `hotel.stars` | `Hotel class` star row (`app/components/HotelCard.tsx:222`) | Supported as hotel class, with visual clamp/rounding in `StarRow` (`app/components/HotelCard.tsx:13`). |
| Guest rating | No independent guest rating field in adapter shape | `hotel.rating` is incorrectly set from `stars` | `Guest rating` and `Good`/`Very good`/`Excellent` (`app/components/HotelCard.tsx:30`, `app/components/HotelCard.tsx:229`) | Unsupported. This is the blocker. |
| Nightly price | `priceFrom` | `pricePerNight` cents, USD | `Nightly rate` (`app/components/HotelCard.tsx:50`) | Supported for live adapter rows; invalid live prices are filtered (`lib/providers/hotellook.ts:32`). |
| Taxes and fees | No breakdown field | None | `per night before taxes and fees` (`app/components/HotelCard.tsx:59`) | Honest boundary copy; no included-fee claim observed. |
| Cancellation | No field | None | Not displayed | Passing. |
| Amenities | No field | None | Not displayed | Passing. |
| Photo | `photoUrl` | `hotel.photoUrl` | Image or `Hotel photo unavailable` (`app/components/HotelCard.tsx:189`) | Passing for missing imagery; no fake fallback image observed. |
| Booking/provider source | Adapter-built affiliate deeplink, `source: hotellook` | `deeplink`, `source` | `Check with HotelLook` (`app/components/HotelCard.tsx:257`) | Currently accurate for live HotelLook rows; hardcoded label is weak for cached/future providers. |

## Hotel result examples

Example A: complete HotelLook metadata in existing fixture.

Provider row in `lib/providers/__tests__/hotellook.test.ts:90`:

```ts
{
  hotelId: 12345,
  hotelName: 'Hotel Example',
  stars: 4,
  location: { name: 'New York' },
  priceFrom: 129.99,
  photoUrl: 'https://example.com/hotel.jpg',
  propertyType: 'Hotel',
}
```

Normalized expectation in the same test includes `name`, `area`, `stars`, `rating`, `pricePerNight`, `deeplink`, `photoUrl`, and `source` (`lib/providers/__tests__/hotellook.test.ts:113`). `name`, `area`, `stars`, price, photo, source, and deeplink are traceable. `rating: 4` is not traceable to a guest-review field; it is copied from `stars`.

Example B: partial metadata accepted by adapter.

Provider row from the invalid-price coverage set that would be valid after keeping only the valid row fields (`lib/providers/__tests__/hotellook.test.ts:153`):

```ts
{
  hotelId: 5,
  hotelName: 'Valid Hotel',
  priceFrom: '199.50',
}
```

Adapter behavior for this shape:

- `area` falls back to the searched location code because `location.name` is absent (`lib/providers/hotellook.ts:104`).
- `stars` becomes `0` because `entry.stars ?? 0` is used (`lib/providers/hotellook.ts:94` to `lib/providers/hotellook.ts:105`).
- `rating` becomes `0`, which suppresses the `Guest rating` block because `hasRating` requires `rating > 0` (`app/components/HotelCard.tsx:185`).
- `photoUrl` is absent, so the UI shows `Hotel photo unavailable` (`app/components/HotelCard.tsx:199`).
- Amenities, cancellation, fee details, and review count remain absent and are not displayed.

This partial state is mostly honest, but the fallback area can be visually mistaken for a sourced neighborhood/location claim.

## Findings

### P1 blocker: Guest rating is unsupported and derived from hotel class

Repro:

1. Mock or receive a HotelLook row with `stars: 4` and no guest-review score.
2. `HotellookProvider` maps `stars` to both `stars` and `rating` (`lib/providers/hotellook.ts:94` to `lib/providers/hotellook.ts:106`).
3. `HotelCard` treats positive `hotel.rating` as a guest rating (`app/components/HotelCard.tsx:185`).
4. The card renders `Guest rating`, numeric `4.0`, and qualitative copy such as `Good` (`app/components/HotelCard.tsx:30` to `app/components/HotelCard.tsx:45`, `app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:234`).

Impact: a hotel class value is presented as guest-review evidence. This directly violates the provenance goal. Existing tests codify the bad mapping by expecting `rating: 4` from `stars: 4` (`lib/providers/__tests__/hotellook.test.ts:113` to `lib/providers/__tests__/hotellook.test.ts:120`), and presentation tests expect `Guest rating` when a rating is present (`app/components/__tests__/scorePresentation.test.tsx:115` to `app/components/__tests__/scorePresentation.test.tsx:139`).

### P2: Location can appear more specific than the provider data

Repro:

1. Receive a valid HotelLook row without `location.name`.
2. Adapter sets `area` to the searched location code (`lib/providers/hotellook.ts:104`).
3. UI renders the value beside a pin icon without source or fallback caveat (`app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:218`).

Impact: `LAX`, `CDG`, or another search code can read as property location metadata. It is not fake, but provenance is weak and visually de-emphasized.

### P2: Source attribution is only in the CTA and hardcoded

Repro:

1. `HotelOffer` contains `source` (`lib/types.ts:55` to `lib/types.ts:56`).
2. Card ignores `hotel.source` and hardcodes `HotelLook` in the CTA and aria label (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:264`).

Impact: live HotelLook rows are labeled correctly today, but cached/future provider rows can display the wrong provider. This is a trust-boundary weakness, not a current live-path false claim.

### P2: Cached hotel rows bypass adapter validation

Repro:

1. Cache hit returns `HotelOffer[]` directly (`lib/providers/hotellook.ts:70` to `lib/providers/hotellook.ts:71`).
2. No revalidation is done for non-empty name, finite stars, valid price, valid source, safe photo URL, or source/rating provenance.
3. UI renders cached values directly (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:290`).

Impact: malformed cached hotel data can render blank or unsupported claims that the live adapter would not create.

## Loading, empty, error, mobile, and desktop states

Loading:

- Hotel tab renders existing hotel cards plus skeleton cards during active search (`app/page.tsx:1434` to `app/page.tsx:1450`).
- Per-card hotel score loading is a shimmer block (`app/components/HotelCard.tsx:240`).

Empty:

- Empty HotelLook results stream `hotel-status: empty` (`app/api/search/route.ts:285` to `app/api/search/route.ts:286`).
- UI title is `No hotel inventory found`; body copy says no hotels were returned for the dates (`app/page.tsx:926` to `app/page.tsx:934`, `app/page.tsx:1451` to `app/page.tsx:1470`).

Error/unavailable:

- Provider errors stream `hotel-status: unavailable` with safe generic copy (`app/api/search/route.ts:287` to `app/api/search/route.ts:307`).
- UI disables the hotel tab when no hotels exist and status is unavailable/skipped/idle (`app/page.tsx:916`, `app/page.tsx:1399`).

Mobile 375px:

- Hotel results use one column before `sm` (`app/page.tsx:1437`, `app/page.tsx:1472`).
- Hotel card price/CTA stack vertically before `sm`, keeping the handoff visible (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:254`).
- Long names clamp to two lines and area truncates (`app/components/HotelCard.tsx:208`, `app/components/HotelCard.tsx:217`).

Desktop:

- Hotel grid becomes three columns at `lg` (`app/page.tsx:1437`, `app/page.tsx:1472`).
- Price and CTA move side by side at `sm` and up (`app/components/HotelCard.tsx:248`).

Manual verification flow to run in browser:

1. Set viewport to 375px wide.
2. Search a round trip with origin, destination, depart date, and return date.
3. Wait for results, switch to Hotels if enabled, inspect complete and partial hotel cards.
4. Confirm no amenity/cancellation/included-fee claims appear.
5. Confirm `Guest rating` appears only when provider data includes a real guest rating. Current expected result: fail because the adapter can derive it from `stars`.
6. Activate `Check with HotelLook`; verify it opens an outbound provider URL with affiliate marker.
7. Repeat at desktop width and confirm no overlapping text, hidden primary action, or fake image fallback.

I did not add browser automation or new fixtures because the ticket is audit-only and adding tooling/data is out of scope.

## Unsupported/generic copy inventory

- Unsupported certainty language: `Guest rating` plus `Good`/`Very good`/`Excellent` when `rating` is sourced from `stars`.
- Weak source attribution: card does not visibly say which provider supplied hotel class, rating, area, or photo; only the CTA names HotelLook.
- Placeholder imagery: no fake property imagery observed. Missing photo honestly renders `Hotel photo unavailable`.
- Generic hotel copy: `Hotels were not included`, `Hotel availability is still loading`, `No hotel inventory found`, and provider-unavailable messages are generic state copy, not property claims.
- Fees: `per night before taxes and fees` is an honest limitation statement, not a fee-inclusion claim.
- Cancellation: no visible cancellation policy copy observed.
- Amenities: no visible amenities observed.

## Out-of-scope repair candidates

1. Stop mapping `stars` to `rating`; suppress `Guest rating` unless a real provider guest-review field is normalized.
2. Add source/fallback language for coarse `area` values, or suppress the location row when the adapter only has the searched IATA code.
3. Revalidate cached hotel rows before returning them.
4. Derive the CTA provider label from a bounded source-label map instead of hardcoding `HotelLook`.
5. Add an explicit hotel Deal Score unavailable state when `/api/score?type=hotel` fails; this is adjacent trust work, not an amenity provenance fix.

## Verification

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --passWithNoTests` - passed: 20 suites, 172 tests.

## Changes

Audit document added only.

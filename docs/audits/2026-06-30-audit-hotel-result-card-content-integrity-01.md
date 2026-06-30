# AUDIT-HOTEL-RESULT-CARD-CONTENT-INTEGRITY-01

Date: 2026-06-30
Role: Senior QA
Scope: hotel result card content integrity only. No feature code changed.

## Files inspected

- `app/page.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/index.ts`
- `lib/types.ts`
- `lib/money.ts`
- `lib/providers/__tests__/hotellook.test.ts`
- `app/api/search/__tests__/route.test.ts`
- `app/components/__tests__/scorePresentation.test.tsx`

Requested file mismatch: `app/api/run/[id]/route.ts` does not exist in this worktree. The executable hotel result path is `app/api/search/route.ts`.

## Result paths covered

Hotel result path with usable results:

1. Submit a valid round-trip destination search, for example `origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=2`.
2. `/api/search` calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })` when `destIATA`, `depart`, and `ret` are present (`app/api/search/route.ts:278` to `app/api/search/route.ts:284`).
3. Existing route coverage verifies that a valid round trip reaches the hotel provider with `LAX`, check-in, and checkout (`app/api/search/__tests__/route.test.ts:137` to `app/api/search/__tests__/route.test.ts:150`).
4. Existing provider coverage maps a mocked HotelLook row into a card-ready `HotelOffer` with name, area, stars, price cents, photo, deeplink, and source (`lib/providers/__tests__/hotellook.test.ts:85` to `lib/providers/__tests__/hotellook.test.ts:125`).

Hotel path with no usable hotel results:

1. Same round-trip destination search, with HotelLook returning an empty array or all rows dropped by adapter validation.
2. Empty HotelLook response returns `{ ok: true, data: [] }` (`lib/providers/__tests__/hotellook.test.ts:176` to `lib/providers/__tests__/hotellook.test.ts:188`).
3. `/api/search` streams `hotel-status: empty` and no `hotels` event (`app/api/search/route.ts:285` to `app/api/search/route.ts:286`).
4. The page renders the hotel empty panel with title `No hotel inventory found` and provider copy (`app/page.tsx:926` to `app/page.tsx:934`, `app/page.tsx:1451` to `app/page.tsx:1470`).

## Findings

### P1 - Unsupported "Guest rating" is derived from hotel class

Repro/data condition:

1. HotelLook returns a row with `stars: 4` and no independent guest review score.
2. Adapter maps `stars` to both `stars` and `rating` (`lib/providers/hotellook.ts:93` to `lib/providers/hotellook.ts:106`).
3. Card treats any positive `hotel.rating` as a guest rating (`app/components/HotelCard.tsx:185`) and renders `Guest rating` (`app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:234`).
4. `RatingBadge` turns that value into qualitative copy like `Good`, `Very good`, or `Excellent` (`app/components/HotelCard.tsx:30` to `app/components/HotelCard.tsx:45`).

Visible defect: a hotel class value is presented as guest-review evidence. This is unsupported provider context and makes the card look more proven than the data allows. The test fixture currently locks this in by expecting `rating: 4` from `stars: 4` (`lib/providers/__tests__/hotellook.test.ts:113` to `lib/providers/__tests__/hotellook.test.ts:120`).

### P1 - Deal Score can disappear with no explanation

Repro/data condition:

1. Hotel cards are rendered after a `hotels` stream event (`app/page.tsx:763` to `app/page.tsx:767`).
2. Each hotel score is fetched separately from `/api/score?type=hotel...`.
3. If the score request fails, `hotelScores[hotel.id]` is set to `null`.
4. `HotelCard` renders a score skeleton while loading, renders `HotelDealPanel` when `score` exists, and renders nothing when `score` is `null` (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`).

Visible defect: the product differentiator is absent on affected hotel cards, with no `Deal Score unavailable` explanation. Flight cards have an explicit unavailable score state, but hotel cards do not. This is triggered by hotel baseline DB failure, `/api/score` 502, invalid score query params, or any client-side score fetch failure (`app/api/score/route.ts:40` to `app/api/score/route.ts:84`).

### P1 - Cached hotel rows bypass adapter validation and can render blank/generic fields

Repro/data condition:

1. `HotellookProvider.searchHotels` returns cached `HotelOffer[]` directly when cache hits (`lib/providers/hotellook.ts:69` to `lib/providers/hotellook.ts:71`).
2. The cached object is not revalidated for non-empty `name`, non-empty `area`, finite `stars`, valid `pricePerNight`, safe `deeplink`, or expected `source`.
3. The card renders fields directly from `hotel` (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:290`).

Visible defects possible from stale or malformed cache:

- Blank hotel name: `hotel.name` renders inside the title with no fallback or suppression (`app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:210`).
- Missing area: the location row disappears entirely when `hotel.area` is empty (`app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:219`).
- Generic/coarse area: live adapter falls back to the searched location code, such as `LAX`, when `location.name` is missing (`lib/providers/hotellook.ts:101` to `lib/providers/hotellook.ts:105`).
- Invalid or zero price: card suppresses money and shows `Price unavailable`, but the result may still look like hotel inventory until the user reads the lower card section (`app/components/HotelCard.tsx:249` to `app/components/HotelCard.tsx:253`).
- Invalid link: card disables booking with `Booking unavailable` (`app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:286`).

### P2 - Duplicate hotel cards are not guarded

Repro/data condition:

1. HotelLook returns the same `hotelId` more than once, or returns near-duplicates with different IDs.
2. The provider maps every valid row into `hotels` and does not dedupe (`lib/providers/hotellook.ts:91` to `lib/providers/hotellook.ts:118`).
3. The page renders `hotels.map` with `key={hotel.id}` (`app/page.tsx:1472` to `app/page.tsx:1481`).

Visible defect: duplicate hotel IDs can cause React key collisions; near-duplicate hotels can appear as separate cards with identical name/area/photo/price and no explanation.

### P2 - Provider label is hardcoded, not tied to `hotel.source`

Repro/data condition:

1. `HotelOffer` includes `source` (`lib/types.ts:47` to `lib/types.ts:56`).
2. Live HotelLook rows set `source: 'hotellook'` (`lib/providers/hotellook.ts:111` to `lib/providers/hotellook.ts:113`).
3. Card CTA and aria label are hardcoded to `HotelLook` (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).

Visible defect: current live provider label is correct, but cached or future provider data can display the wrong provider context. This is a follow-up candidate only; adding providers is out of scope for this ticket.

## Field integrity matrix

| Card field | Source | Can be blank/generic/duplicated/unsupported? | Visible behavior |
| --- | --- | --- | --- |
| Name | `entry.hotelName` to `hotel.name` | Blank string can pass because provider only checks `typeof entry.hotelName === 'string'`; cache can also supply blank. | Empty title area; no fallback (`app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:210`). |
| Area/location | `entry.location?.name ?? location` | Generic fallback to airport/location code; cache can be blank. | Row is unlabeled and truncated; blank area removes row (`app/components/HotelCard.tsx:212` to `app/components/HotelCard.tsx:219`). |
| Imagery | `entry.photoUrl` | Missing photo supported; unsafe/generic photo URL is not validated. | Missing photo shows `Hotel photo unavailable`; no fake stock image observed (`app/components/HotelCard.tsx:189` to `app/components/HotelCard.tsx:202`). |
| Hotel class | `entry.stars` | Missing/non-finite becomes `0`; values are rounded and clamped visually to 0-5. | Renders 0 to 5 stars (`app/components/HotelCard.tsx:13` to `app/components/HotelCard.tsx:27`). |
| Guest rating | Adapter copies `stars` into `rating` | Unsupported. | Renders review-style label from class value (`app/components/HotelCard.tsx:30` to `app/components/HotelCard.tsx:45`, `app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:234`). |
| Price | `pricePerNight: Money` | Live adapter filters invalid `priceFrom`; cache can contain invalid money. | Valid positive integer cents display as nightly rate; invalid shows price unavailable (`lib/money.ts:3` to `lib/money.ts:24`, `app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`). |
| Currency | Adapter hardcodes `USD` after requesting `currency=USD` | Live path is bounded; cache can contain invalid/other currency. | Invalid currency suppresses money; visible price includes currency code (`lib/providers/hotellook.ts:73` to `lib/providers/hotellook.ts:80`, `app/components/__tests__/scorePresentation.test.tsx:220` to `app/components/__tests__/scorePresentation.test.tsx:230`). |
| Deal Score | `/api/score?type=hotel` | Can be missing silently. Low-confidence evidence is clear when present. | Present score shows verdict, percentile/limited-history copy, usual price, vs median, and explanation (`app/components/HotelCard.tsx:117` to `app/components/HotelCard.tsx:167`). Missing score renders nothing (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`). |
| Provider label | Hardcoded `HotelLook` | Can become wrong if `source` differs. | CTA says `Check with HotelLook`; source field is not rendered (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`). |
| Deeplink | Affiliate deeplink built from HotelLook ID | Live path includes marker; cache can contain any URL. | Only `http`/`https` is bookable; invalid link disables booking (`lib/providers/hotellook.ts:50` to `lib/providers/hotellook.ts:55`, `app/components/HotelCard.tsx:171` to `app/components/HotelCard.tsx:183`). |

## Price and currency boundary

Passing on the live provider path:

- Shared money contract is integer minor units (`lib/types.ts:1`, `lib/types.ts:47` to `lib/types.ts:56`).
- HotelLook requests USD (`lib/providers/hotellook.ts:73` to `lib/providers/hotellook.ts:80`).
- `priceFrom` major units are converted to integer cents with `Math.round(majorUnits * 100)` (`lib/providers/hotellook.ts:32` to `lib/providers/hotellook.ts:42`).
- Card validates `priceCents` as a positive integer and currency as a three-letter code before formatting (`lib/money.ts:3` to `lib/money.ts:24`).
- Visible rate says `Nightly rate` and `per night before taxes and fees` (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`).

Caveat: cache hits bypass the adapter conversion/validation and return stored `HotelOffer[]` directly (`lib/providers/hotellook.ts:69` to `lib/providers/hotellook.ts:71`).

## Loading, empty, error, mobile, and desktop states

Loading:

- Hotel tab shows existing loaded hotel cards plus skeletons while search is still running (`app/page.tsx:1434` to `app/page.tsx:1450`).
- Per-card Deal Score skeleton appears while the score request is active (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:241`).

Empty/no usable hotel results:

- Empty state is coherent for provider empty result: `No hotel inventory found` and the search context are shown (`app/page.tsx:926` to `app/page.tsx:934`, `app/page.tsx:1451` to `app/page.tsx:1470`).
- One-way or missing destination/date searches skip hotels and disable the hotel tab with explanatory copy (`app/api/search/route.ts:309` to `app/api/search/route.ts:314`, `app/page.tsx:920` to `app/page.tsx:928`).

Error/unavailable:

- Hotel provider errors are bounded into `hotel-status: unavailable` and do not leak raw provider messages (`app/api/search/route.ts:287` to `app/api/search/route.ts:307`).
- Existing route coverage verifies a thrown hotel provider error becomes a safe unavailable status (`app/api/search/__tests__/route.test.ts:224` to `app/api/search/__tests__/route.test.ts:239`).

Manual mobile 375px verification flow:

1. Use a 375px-wide viewport.
2. Run a round-trip hotel-producing search and switch to Hotels once available.
3. Expected: results grid is one column until `sm` (`app/page.tsx:1437`, `app/page.tsx:1472`).
4. Expected: price and CTA stack vertically on mobile, then change to row layout at `sm` (`app/components/HotelCard.tsx:248`).
5. Expected: CTA spans the card width on mobile via `w-full` wrapper and responsive button class (`app/components/HotelCard.tsx:254` to `app/components/HotelCard.tsx:263`).
6. Expected: long names clamp to two lines, area truncates, and class/rating facts wrap (`app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:222`).

No browser automation package is installed in this repo (`node_modules/.bin` exposes `next`, `jest`, and `tsc`, but not Playwright). I did not add tooling because this is an audit ticket.

Desktop source verification:

- Hotel grid uses three columns at `lg` (`app/page.tsx:1437`, `app/page.tsx:1472`).
- Card bottom row switches to side-by-side at `sm`, keeping the price and CTA visible (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:288`).

## Fake polish and unsupported claims

- Fake imagery: not observed. Missing image uses a text fallback, not stock imagery (`app/components/HotelCard.tsx:189` to `app/components/HotelCard.tsx:202`).
- Fake scarcity/urgency: not observed. Hotel cards do not claim limited rooms, recent bookings, countdowns, or inventory scarcity (`app/components/HotelCard.tsx:187` to `app/components/HotelCard.tsx:290`).
- Unsupported claim observed: `Guest rating` and quality adjectives derived from `stars`.
- Unsupported/weak claim observed: `Deal Score` can be absent with no explanation after score failure.

## Narrow follow-up candidates

1. Hotel rating honesty: remove or suppress `rating` until a real provider guest-review score exists; update HotelLook tests that currently expect `rating` from `stars`.
2. Hotel score unavailable state: add a hotel-card unavailable Deal Score panel matching the flight card honesty pattern.
3. Cached hotel validation: revalidate cached hotel rows before returning them, or version cache entries so stale malformed rows cannot bypass adapter checks.
4. Hotel duplicate handling: dedupe exact `hotel.id` matches before rendering and flag near-duplicate provider rows for a provider-level repair.
5. Provider label boundary: render provider CTA text from a bounded source-label map instead of hardcoding `HotelLook`.

These are intentionally separate candidates; none requires a new provider, new layout, Deal Score logic changes, or shared rendering refactor.

## Verification

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand --passWithNoTests` - passed: 20 suites, 172 tests.

## Changes

Audit document added only.

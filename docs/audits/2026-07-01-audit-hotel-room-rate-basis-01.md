# AUDIT-HOTEL-ROOM-RATE-BASIS-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: hotel room-rate basis clarity from search through hotel result selection. Audit only; no production feature code changed.

## Files inspected

- `app/page.tsx`
- `app/components/HotelCard.tsx`
- `components/search/SearchPanel.tsx`
- `lib/types.ts`
- `lib/providers/hotellook.ts`
- `app/api/search/route.ts`
- `app/components/__tests__/scorePresentation.test.tsx`

Requested file mismatch: `components/hotels/HotelResults.tsx`, `components/hotels/HotelCard.tsx`, `components/hotels/HotelPrice.tsx`, and `components/search/SearchSummary.tsx` do not exist in this worktree. The active hotel result UI is `app/components/HotelCard.tsx`, rendered by `app/page.tsx`.

Next.js local docs read before app-code review: `node_modules/next/dist/docs/01-app/index.md`.

## Executive decision

Failing for room-rate basis trust.

The card-level hotel price label is clear that the displayed money is a nightly pre-tax/pre-fee rate. The broken part is context preservation: search accepts passengers, dates, and destination, but hotel provider calls and hotel result cards do not preserve or disclose occupancy, room count, or total-stay basis. A user can enter 2 travelers, open Hotels, and see a price that says `Nightly rate` without knowing whether it is for 1 room, 2 guests, single occupancy, double occupancy, or an unspecified provider default.

## Visible hotel pricing labels

| Visible label/copy | Classification | Evidence |
| --- | --- | --- |
| `Nightly rate` | Clear, but incomplete | It correctly says the price is nightly, not stay total (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`). It does not state occupancy or room basis. |
| Formatted hotel money, for example `$129` | Ambiguous | The money is shown as the primary card price under `Nightly rate`, but no visible card copy says whether it is one room, one guest, all guests, or provider default occupancy (`app/components/HotelCard.tsx:56` to `app/components/HotelCard.tsx:59`). |
| `per night before taxes and fees` | Clear for tax/fee exclusion | This explicitly excludes taxes and fees (`app/components/HotelCard.tsx:59`). It still does not cover occupancy or room count. |
| `Price unavailable` | Clear | Unavailable price data is visually separated from confirmed money (`app/components/HotelCard.tsx:64` to `app/components/HotelCard.tsx:75`). |
| `No confirmed nightly price or valid booking link was returned.` | Clear | Separates missing price and missing booking link from valid offers (`app/components/HotelCard.tsx:101` to `app/components/HotelCard.tsx:111`). |
| `No confirmed nightly price was returned.` | Clear | Avoids presenting partial price data as confirmed (`app/components/HotelCard.tsx:105` to `app/components/HotelCard.tsx:107`). |
| `No valid booking link was returned.` | Clear | Distinguishes valid price from unusable booking handoff (`app/components/HotelCard.tsx:109` to `app/components/HotelCard.tsx:111`). |
| `Booking unavailable` | Clear | Disabled status is separate from the provider CTA and repeats the unavailable reason (`app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:284`). |
| `Check with HotelLook` | Ambiguous | It is a clear outbound action, but it does not warn that final occupancy/room assumptions may differ on provider handoff (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`). |
| `Opens provider site. Prices can change.` | Ambiguous | It warns about volatility but not taxes, fees, room count, guest count, or occupancy basis (`app/components/HotelCard.tsx:269` to `app/components/HotelCard.tsx:270`). |
| `Usual` in hotel Deal Score | Ambiguous | The median price is shown without saying the comparison is nightly, pre-tax/pre-fee, and based on the same unspecified hotel basis as `pricePerNight` (`app/components/HotelCard.tsx:140` to `app/components/HotelCard.tsx:154`). |
| `Vs median` in hotel Deal Score | Ambiguous | The comparison inherits the same unstated hotel basis as `Usual` (`app/components/HotelCard.tsx:146` to `app/components/HotelCard.tsx:154`). |
| `No hotel inventory found` / `No hotels were returned for these dates.` | Clear enough for empty state | No price is shown; it does not invent fallback rates (`app/page.tsx:926` to `app/page.tsx:934`, `app/page.tsx:1452` to `app/page.tsx:1470`). |

## Findings

### P0: Hotel prices do not disclose occupancy or room-count basis

Repro:

1. Start from the homepage search form.
2. Enter a round-trip destination search, for example origin `JFK`, destination `LAX`, depart `2099-09-22`, return `2099-09-29`.
3. Increase `Passengers` to `2`.
4. Submit search and open the Hotels tab when hotel results are available.
5. Observe each hotel card shows `Nightly rate`, the price, and `per night before taxes and fees`, but no `2 travelers`, `1 room`, `2 guests`, or provider-default occupancy basis appears on the hotel card.

Evidence:

- Search state stores `passengers` (`app/page.tsx:491`) and includes it in URL params (`app/page.tsx:154`).
- Result summary can show passenger count globally (`app/page.tsx:910` to `app/page.tsx:914`, `app/page.tsx:1297`), but the hotel card does not receive or render passenger context (`app/page.tsx:1476` to `app/page.tsx:1479`).
- `HotelProvider.searchHotels` only accepts `{ checkin, checkout }`; it has no guests, adults, children, or rooms field (`lib/types.ts:76` to `lib/types.ts:80`).
- `/api/search` calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })` and drops the parsed passenger count for hotels (`app/api/search/route.ts:289` to `app/api/search/route.ts:295`).
- `HotelOffer` has `pricePerNight`, but no room-count, guest-count, occupancy, tax, fee, or stay-total fields (`lib/types.ts:47` to `lib/types.ts:56`).

Expected: if the app cannot confirm occupancy or rooms, the hotel card should plainly say the nightly rate is before taxes/fees and occupancy/room basis is not confirmed.

Actual: the UI makes the rate basis look complete because only tax/fee exclusion is stated.

Impact: P0 trust issue. A paid user cannot tell whether a hotel result is comparable for their party size.

### P1: Total-stay basis is absent, so nightly and stay-total comparison is incomplete

Repro:

1. Run any round-trip hotel-producing search.
2. Switch to Hotels.
3. Compare the date range in the top result context with each hotel card price.
4. Observe no stay total, night count, or explicit `total not shown` copy appears.

Evidence:

- The global result context can show date range (`app/page.tsx:910` to `app/page.tsx:914`).
- The hotel card only renders `Nightly rate` and `per night before taxes and fees` for confirmed prices (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`).
- The provider maps `priceFrom` into `pricePerNight` only (`lib/providers/hotellook.ts:102` to `lib/providers/hotellook.ts:115`).
- `HotelOffer` has no stay-total money field (`lib/types.ts:47` to `lib/types.ts:56`).

Expected: because the search has check-in and check-out dates, the UI should avoid implying that the nightly rate is the full stay cost. If no total is available, the absence should be explicit.

Actual: the price is only labeled as nightly; the user must infer that total stay is not shown.

Impact: Users can underestimate hotel cost when scanning results.

### P1: Provider handoff copy does not carry tax, fee, room, or occupancy uncertainty

Repro:

1. Run a valid round-trip hotel search with any passenger count.
2. On a hotel card with a valid price and deeplink, inspect the CTA area.
3. Observe `Check with HotelLook` and `Opens provider site. Prices can change.`

Evidence:

- CTA copy is hardcoded in `HotelCard` (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).
- The secondary copy only covers price volatility, not excluded taxes/fees or unknown room/occupancy basis (`app/components/HotelCard.tsx:269` to `app/components/HotelCard.tsx:270`).

Expected: provider handoff should preserve the same rate-basis caveats users saw before clicking.

Actual: the handoff warning is narrower than the displayed rate caveat.

Impact: Users can assume the provider link confirms the same room/guest basis shown in expaify, but that basis is not known locally.

### P2: Hotel Deal Score price labels inherit the same unstated nightly basis

Repro:

1. Run a hotel search where `/api/score?type=hotel` returns a score.
2. Open Hotels and inspect the Deal Score panel.
3. Observe `Usual` and `Vs median` near the nightly hotel price.

Evidence:

- Hotel scoring request sends `pricePerNightCents` and `currency`, not total stay price (`app/page.tsx:579` to `app/page.tsx:585`).
- The hotel Deal Score panel labels the median as `Usual`, with no nightly/pre-tax/pre-fee caveat (`app/components/HotelCard.tsx:140` to `app/components/HotelCard.tsx:154`).

Expected: hotel score comparison labels should say the comparison is using the same nightly pre-tax/pre-fee basis, or should explicitly state that room/occupancy basis is unavailable.

Actual: `Usual` reads like a complete hotel price benchmark.

Impact: Medium. The Deal Score can look more precise than the underlying hotel price basis supports.

## Passing checks

- The primary hotel price does not mix nightly and total-stay wording. It consistently says `Nightly rate` and `per night before taxes and fees` (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`).
- Taxes and fees are not falsely claimed as included. The only confirmed-price label says they are excluded (`app/components/HotelCard.tsx:59`).
- Unavailable hotel price data is not rendered as money. Invalid or missing money renders `Price unavailable` plus a reason (`app/components/HotelCard.tsx:64` to `app/components/HotelCard.tsx:75`, `app/components/HotelCard.tsx:249` to `app/components/HotelCard.tsx:253`).
- Missing valid booking handoff is separated from confirmed bookable offers. `canBook` requires both valid price and valid URL (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:184`).
- One-way or incomplete hotel criteria are skipped rather than producing fake hotel cards (`app/api/search/route.ts:325` to `app/api/search/route.ts:330`, `app/page.tsx:916` to `app/page.tsx:928`).

## Manual verification notes

Desktop flow, source-backed because browser automation is not installed:

1. Use homepage form in desktop viewport.
2. Search `JFK` to `LAX`, `2099-09-22` to `2099-09-29`, `2` passengers.
3. Expected page state by source: hotel search is attempted because destination, depart, return, and round trip are present (`app/page.tsx:706`; `app/api/search/route.ts:289` to `app/api/search/route.ts:295`).
4. Select Hotels when available.
5. Expected visible hotel card labels: `Nightly rate`, formatted money, `per night before taxes and fees`, `Check with HotelLook`, and `Opens provider site. Prices can change.` (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`, `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).
6. Confusing state recorded: passenger count may appear in the global result summary, but the card does not say whether the nightly rate applies to the searched travelers or rooms (`app/page.tsx:1297`; `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:270`).

Mobile 375px flow, source-backed because browser automation is not installed:

1. Use a 375px-wide viewport and run the same round-trip search.
2. Select Hotels when available.
3. Expected layout by source: hotel grid is one column on mobile (`app/page.tsx:1437` to `app/page.tsx:1451`, `app/page.tsx:1472` to `app/page.tsx:1483`).
4. Expected card layout by source: price and CTA stack vertically before `sm`, so primary price and action should remain visible at 375px (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:287`).
5. Confusing state recorded: the mobile card stacks the exact same incomplete basis copy. The only basis text is `Nightly rate` and `per night before taxes and fees`; room count, guest count, occupancy, and stay total remain unstated.

No screenshots were captured. This repo does not include Playwright or another browser automation package (`node_modules/.bin` exposes `next`, `jest`, and `tsc` only). I did not add tooling because this is an audit-only ticket.

## Blockers and missing provider fields

- `HotelOffer` has no fields for room count, guest count, occupancy, included taxes, included fees, resort fees, or total stay price (`lib/types.ts:47` to `lib/types.ts:56`).
- `HotelProvider.searchHotels` cannot accept room or guest context (`lib/types.ts:76` to `lib/types.ts:80`).
- HotelLook adapter only maps `priceFrom` to `pricePerNight`; it does not expose total stay, taxes, fees, rooms, or occupancy (`lib/providers/hotellook.ts:102` to `lib/providers/hotellook.ts:115`).

## Out-of-scope findings

- `components/search/SearchPanel.tsx` has a `Search flights + hotels` button but no passenger, room, or guest controls (`components/search/SearchPanel.tsx:90` to `components/search/SearchPanel.tsx:192`). I did not change it because it is not the active `app/page.tsx` homepage search surface in this flow.
- Prior audits already identify unsupported `Guest rating` provenance. That issue is not a room-rate basis defect, so it is not expanded here.

## Verification

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand --passWithNoTests` - passed: 20 suites, 176 tests.

## Required return note

- What changed and why: Added this focused audit report for `AUDIT-HOTEL-ROOM-RATE-BASIS-01` to document where hotel nightly/tax/fee wording is clear and where occupancy, rooms, and stay total are not preserved.
- Files changed: `docs/audits/2026-07-01-audit-hotel-room-rate-basis-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --runInBand --passWithNoTests` passed with 20 suites and 176 tests.
- Out-of-scope findings or blockers: missing requested hotel component files; no browser automation/screenshot tooling installed; provider/types do not expose room, occupancy, fee, tax, or stay-total fields.

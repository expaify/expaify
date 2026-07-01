# AUDIT-HOTEL-RESULTS-PRICE-BASIS-STACK-01

Date: 2026-07-01
Role: Senior QA
Scope: hotel result price basis stack. No feature code changed.

## Files inspected

- `app/page.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`
- `lib/money.ts`
- `app/components/__tests__/scorePresentation.test.tsx`
- `app/api/search/__tests__/route.test.ts`

Requested file mismatch: `components/hotels/HotelResults.tsx`, `components/hotels/HotelCard.tsx`, `components/hotels/HotelPrice.tsx`, `components/search/SearchSummary.tsx`, `app/api/hotels/route.ts`, and `lib/providers/hotels.ts` do not exist in this worktree. The implemented hotel path is `app/api/search/route.ts` -> `lib/providers/hotellook.ts` -> `app/page.tsx` -> `app/components/HotelCard.tsx`.

## Result

Hotel amount, currency, nightly basis, and taxes/fees boundary are visible on each valid hotel card. The stack is not complete enough for trust: visible cards do not show stay length, do not show a total stay price, and do not show provider source/freshness beyond generic provider handoff copy.

## Findings

### P1 - Hotel cards omit stay length and total stay context

Repro:

1. Search a round-trip multi-night stay, for example `origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=2`.
2. Switch to Hotels when hotel results are available.
3. Inspect the visible price block on each hotel card.

Observed:

- The card labels the amount as `Nightly rate`, renders formatted money with currency, and states `per night before taxes and fees` (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`).
- The card does not show `7 nights`, check-in/check-out, or total stay math anywhere in the card (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:291`).
- The only date context is outside the card in the results header/search summary area, and on mobile the sticky header hides dates because the date span is `hidden ... sm:inline` (`app/page.tsx:1263` to `app/page.tsx:1266`).

Impact: a user comparing hotel cards can see that a price is nightly, but cannot verify the stay length from the card itself. This fails the ticket goal to verify every hotel result presents stay length.

### P1 - Provider freshness is not visible per hotel result

Repro:

1. Search a round-trip hotel stay with returned hotels.
2. Inspect the card footer and CTA copy.

Observed:

- The provider adapter returns `source` but no `fetchedAt`, cache age, or freshness field for hotels (`lib/types.ts:47` to `lib/types.ts:57`).
- Hotel cards hardcode `Check with HotelLook` and only say `Opens provider site. Prices can change.` (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).
- `/api/search` emits hotel availability and hotel data, but no hotel freshness metadata (`app/api/search/route.ts:292` to `app/api/search/route.ts:295`).
- The cache TTL is 6 hours, but that age boundary is not surfaced in the UI (`lib/providers/hotellook.ts:5` to `lib/providers/hotellook.ts:6`, `lib/providers/hotellook.ts:67` to `lib/providers/hotellook.ts:72`).

Impact: users cannot tell whether the hotel amount is live, cached, or provider-stale. The UI says prices can change but does not communicate provider freshness or cache uncertainty.

### P2 - Search summary and card price basis only partially agree

Repro:

1. Search a multi-night round trip.
2. Compare the result header/tab context with the visible hotel card price basis.

Observed:

- The results header shows route and date context in the sticky edit control on desktop (`app/page.tsx:1254` to `app/page.tsx:1267`).
- The main results count summary is flight-first and says `{flights.length} flights found`; it does not summarize hotel stay length or hotel rate basis (`app/page.tsx:1294` to `app/page.tsx:1304`).
- Hotel cards say `Nightly rate` / `per night before taxes and fees`, but the summary does not explicitly reinforce that hotel prices are nightly for the selected stay (`app/components/HotelCard.tsx:50` to `app/components/HotelCard.tsx:59`).

Impact: there is no direct contradiction, but the summary is not a reliable cross-check for hotel price basis, especially on mobile where the dates are hidden in the sticky header.

### P2 - Loading, empty, and unavailable states are coherent but do not teach price basis

Observed:

- Loading state renders hotel skeletons when the Hotels tab is active during search (`app/page.tsx:1435` to `app/page.tsx:1451`).
- Empty and unavailable states explain no inventory/provider unavailable and include route/date context (`app/page.tsx:1452` to `app/page.tsx:1471`).
- One-way or missing destination/date searches produce hotel skipped copy (`app/page.tsx:917` to `app/page.tsx:928`, `app/api/search/route.ts:325` to `app/api/search/route.ts:330`).

Impact: these states are coherent. They do not need price-basis copy because no hotel amount is presented.

## Manual verification

Live browser verification with returned hotel cards is blocked in this environment:

- `TP_TOKEN` and `HOTEL_AFFILIATE_ID` are not present, so `/api/search` will mark hotels unavailable instead of returning HotelLook inventory.
- `playwright` and `@playwright/test` are not installed, so I could not run a browser with mocked `/api/search` hotel results for screenshot-level 375px and desktop verification.

Code-level flow verified:

1. Valid round-trip searches reach `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })` (`app/api/search/route.ts:290` to `app/api/search/route.ts:295`).
2. Existing Jest coverage confirms a multi-night round trip calls the hotel provider with `checkin: 2099-09-22` and `checkout: 2099-09-29` (`app/api/search/__tests__/route.test.ts:138` to `app/api/search/__tests__/route.test.ts:153`).
3. Existing component coverage confirms rendered hotel card text contains `$189 USD`, `per night before taxes and fees`, `Check with HotelLook`, and `Opens provider site. Prices can change.` (`app/components/__tests__/scorePresentation.test.tsx:83` to `app/components/__tests__/scorePresentation.test.tsx:112`).
4. Mobile 375px and desktop layout were inspected statically. Hotel cards use a single-column grid at mobile and three columns at large desktop (`app/page.tsx:1438`, `app/page.tsx:1473`). The hotel card footer stacks price and CTA on mobile and switches to side-by-side at `sm` (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:254`). Primary CTA is full-width on mobile via `w-full` wrapper and `btn-primary-responsive` (`app/components/HotelCard.tsx:254` to `app/components/HotelCard.tsx:264`). No overlap risk was found from the class structure, but screenshot verification remains blocked.

## Acceptance criteria status

| Criteria | Status |
| --- | --- |
| Report whether hotel price basis is consistently visible and understandable | Partial pass: amount, currency, nightly basis, and tax/fee boundary are visible; stay length and freshness are missing. |
| Identify exact file and UI locations for conflicting or missing price basis copy | Done. Findings above include file/line references. |
| Include manual verification flow for multi-night hotel stay and compare to summary | Blocked for live/browser results; code-level flow and existing Jest coverage documented. |
| Verify mobile 375px wrapping and primary action visibility | Static inspection done; browser screenshot verification blocked by missing browser tooling. |
| Include `npm run tsc` results | `npx tsc --noEmit --incremental false` passed with exit code 0 and no output. |
| Include Jest command results | `npm test -- --runInBand` passed with 20 suites and 176 tests. |

## Verification

- `npx tsc --noEmit --incremental false` - passed with exit code 0 and no output.
- `npm test -- --runInBand` - passed. 20 suites passed, 176 tests passed.
- `npm test -- --passWithNoTests` - passed. 20 suites passed, 176 tests passed.

## Out-of-scope notes

- I did not add fake stay-length labels, estimated taxes/fees, discounts, or total price math because the current hotel type does not carry enough data for that presentation.
- I did not change provider adapter boundaries or money storage.
- I did not redesign flight components.

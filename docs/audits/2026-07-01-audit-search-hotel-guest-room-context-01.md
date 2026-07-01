# AUDIT-SEARCH-HOTEL-GUEST-ROOM-CONTEXT-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel guest and room context across search, results, and booking review.

## Verdict

Fail. Hotel search and result surfaces do not preserve a clear guest, room, or stay-price basis. The current local app also has no hotel booking review route, so the acceptance criterion for booking review cannot be fully verified in this worktree.

## Findings

### P0 - Hotel occupancy is not captured or stated, but hotel prices are still shown as if comparable

Files:
- `app/page.tsx:1112`
- `app/page.tsx:1126`
- `app/api/search/route.ts:289`
- `app/api/search/route.ts:292`
- `lib/types.ts:47`
- `lib/types.ts:85`
- `lib/providers/hotellook.ts:68`

The active homepage captures a flight-style `Passengers` count, but there is no room count and no hotel-specific guest assumption. The search API validates `passengers` for flight providers, then calls `hotellook.searchHotels(destIATA, { checkin, checkout })` without guests, rooms, or passenger count. The shared `HotelProvider` contract accepts only `area` and `{ checkin, checkout }`, and `HotelOffer` has no fields for guests, rooms, stay dates, or price basis. The Hotellook cache key is also only location/check-in/check-out, so a 1-traveler and 4-traveler hotel search share the same cached hotel response.

Repro:
1. Open `/`.
2. Enter `JFK` to `LHR`, depart `2026-08-10`, return `2026-08-15`.
3. Set passengers to `2`.
4. Search and inspect `/api/search?origin=JFK&dest=LHR&depart=2026-08-10&return=2026-08-15&passengers=2&trip=roundtrip`.
5. Observe the hotel provider call uses only destination and dates.

Expected: Hotel search either captures hotel occupancy or plainly states the occupancy and room assumption used for hotel prices.

Actual: The UI has no room context, and the backend cannot distinguish hotel results by guest or room assumptions.

### P0 - Hotel result cards omit the stay and occupancy basis for the nightly rate

Files:
- `app/components/HotelCard.tsx:50`
- `app/components/HotelCard.tsx:59`
- `app/components/HotelCard.tsx:248`
- `app/page.tsx:1435`
- `app/page.tsx:1473`

`HotelCard` renders `Nightly rate` and `per night before taxes and fees`, but does not show check-in date, check-out date, number of nights, guests, rooms, or whether the rate is for one room. The parent hotel tab passes only `hotel`, `score`, and score loading state to each card, so the card has no way to repeat the search assumptions.

Repro:
1. Search a round trip with destination and dates.
2. Open Hotels tab when hotel inventory is available.
3. Review any hotel card price block.

Expected: The result card repeats the hotel stay and occupancy basis without inventing provider data.

Actual: Price copy is limited to a nightly rate before taxes/fees. Guest and room assumptions are absent.

### P0 - Hotel booking review is absent; hotel handoff does not preserve stay or occupancy context locally

Files:
- `app/components/HotelCard.tsx:257`
- `app/book/page.tsx:5`
- `app/book/BookingFlow.tsx:81`
- `app/book/BookingFlow.tsx:100`
- `app/book/BookingFlow.tsx:108`
- `lib/booking/config.ts:3`
- `lib/providers/hotellook.ts:55`

Hotel cards link directly to the provider in a new tab. The only local booking page is flight-specific (`Book flight`) and `BookingFlow` renders fare route, dates, passengers, provider, and price basis for flights only. There is no local hotel booking review that can repeat guests, rooms, or hotel stay context.

The generated hotel deeplink includes the affiliate marker and hotel id, but not the searched check-in/check-out dates, passenger count, guests, or rooms. Even stay dates are not preserved in the outbound URL in this local implementation.

Repro:
1. Search a round trip with hotel availability.
2. Click `Check with HotelLook` on a hotel card.
3. Observe the app does not show a hotel booking review page.
4. Inspect `buildDeeplink`; it builds `https://tp.media/r?...&u=https://hotellook.com/hotels/{hotelId}` only.

Expected: Booking review or handoff clearly repeats the same hotel stay and occupancy assumptions, or explicitly says the provider will require the user to re-check them.

Actual: No local hotel review exists, and the outbound handoff URL does not carry the searched stay or occupancy context.

### P1 - Search/results summary is inconsistent and weak for hotel context

Files:
- `app/page.tsx:909`
- `app/page.tsx:913`
- `app/page.tsx:1263`
- `app/page.tsx:1295`
- `app/page.tsx:1468`
- `app/page.tsx:1469`

`resultContext` includes route, dates, and passenger count only when passengers are greater than one. For a single traveler, the summary silently omits occupancy. It never includes rooms. On mobile, the sticky results header hides the dates at the `sm` breakpoint and only shows the route plus `Edit`, so hotel criteria are less visible at 375px.

Expected: Hotel-visible summaries consistently show the same stay and occupancy basis, including the single-traveler case if that is the current assumption.

Actual: The visible context varies by state and viewport, and rooms are never represented.

### P2 - Ticket references local surfaces that do not exist

Files not present:
- `components/search/SearchSummary.tsx`
- `components/hotels/HotelResults.tsx`
- `components/hotels/HotelCard.tsx`

The active hotel card is `app/components/HotelCard.tsx`. Hotel results are rendered inline in `app/page.tsx`. `components/search/SearchPanel.tsx` exists but is not mounted anywhere in this worktree.

## Manual Verification

### Hotel-only flow

Blocked as a true hotel-only flow. The active UI has one combined search form, defaults to flight results, and only allows switching to Hotels after hotel inventory exists. With local env on 2026-07-01:

Command:

```sh
curl -sS -N 'http://127.0.0.1:3021/api/search?origin=JFK&dest=LHR&depart=2026-08-10&return=2026-08-15&passengers=2&trip=roundtrip&tab=hotels'
```

Observed:
- Flight providers returned unavailable notices.
- Hotel status returned `unavailable` with message `The hotel provider is unavailable right now.`
- The request included `passengers=2`, but the hotel provider path does not use passenger count or rooms.

### Mixed flight + hotel flow

Supported as the default combined search.

Steps:
1. Open `/`.
2. Enter origin `JFK`, destination `LHR`.
3. Enter depart `2026-08-10`, return `2026-08-15`.
4. Set passengers to `2`.
5. Submit the search.
6. Review the results header, Hotels tab state, hotel empty/error copy, and hotel card implementation.

Observed:
- Search form is usable with route, dates, flexible dates, and passenger count.
- Results summary can show `2 passengers`, but this is flight-style copy and not hotel rooms/guests.
- Hotels tab is disabled when hotel provider is unavailable.
- Empty/error hotel state shows route/date context, but no room context.
- If hotel inventory exists, cards would show only nightly rate before taxes/fees.

### Mobile 375px / desktop state review

Static review from responsive classes and active markup:
- Search form stacks at mobile width and keeps the primary action reachable.
- Hotel result grid is one column on mobile and three columns on large desktop.
- Hotel card CTA is full-width on mobile.
- Results sticky header hides dates on mobile and never shows guests/rooms.
- No overlapping text was found by code inspection, but no browser screenshot tool is installed in this worktree.

## State Coverage

Loading:
- Hotel skeletons render in a responsive grid while searching.
- Skeletons do not expose hotel stay, guest, or room assumptions.

Empty:
- Empty hotel state says no hotels were returned for these dates.
- It repeats route/date context but no room context.

Error/unavailable:
- Hotel unavailable copy is coherent about provider failure.
- It does not state whether hotel occupancy was assumed, omitted, or delegated to provider.

Booking review:
- Not verifiable for hotels because no local hotel booking review exists.

## Blockers and Out-of-Scope Notes

- Blocker: Hotel provider was unavailable in local manual verification, so live hotel cards could not be visually exercised from real provider data.
- Blocker: No Playwright/browser automation is installed; 375px review was static plus server/API verification.
- Blocker: Ticket asks for `components/search/SearchSummary.tsx`, `components/hotels/HotelResults.tsx`, and `components/hotels/HotelCard.tsx`, but those files do not exist.
- Out of scope per ticket: no new occupancy controls, no room selection, no provider request changes, and no fake defaults were added.

## Verification Commands

```sh
npx tsc --noEmit
npm test -- --runInBand
```

Results are recorded in the handoff note.

# AUDIT-SEARCH-HOTEL-DATE-STAY-INTEGRITY-01: Hotel Date and Stay Integrity

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Audit only. No production feature code changed.

## Executive Decision

Failing for paid hotel trust.

The selected departure and return dates are validated, serialized into `/api/search`, and passed to `hotellook.searchHotels()` as `checkin` and `checkout`. However, once hotel results are visible, the hotel cards do not show check-in, check-out, or night count, and the outbound HotelLook deeplink contains only the hotel id. A user can click the provider handoff without seeing the stay dates on the hotel result card or sending those dates in the handoff URL.

There is also a same-day stay defect: round-trip validation allows `returnDate === depart`, which creates a zero-night hotel search. The UI and API copy treat this as valid even though hotel check-out must be after check-in.

## Files Inspected

- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `components/search/SearchSummary.tsx` - not present in this worktree
- `components/hotels/HotelResults.tsx` - not present in this worktree
- `components/hotels/HotelCard.tsx` - not present in this worktree
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `lib/types.ts`

Next.js local docs read before app-route assumptions: `node_modules/next/dist/docs/01-app/index.md`.

## Date Flow Map

| Step | Source | Date values | User-visible date or stay display | Result |
|---|---|---:|---|---|
| Search form inputs | `app/page.tsx:1050` to `app/page.tsx:1105` | `depart`, `returnDate` | Date inputs labeled "Depart" and "Return" | Pass for entry clarity |
| Form validation | `app/page.tsx:117` to `app/page.tsx:140` | `depart`, `returnDate`, `tripType` | Inline error under each date plus form error | Fails same-day hotel stay; `returnDate === depart` is accepted |
| URL/share state | `app/page.tsx:148` to `app/page.tsx:160` | `depart`, `return` | Query string preserves both dates | Pass |
| Search execution state | `app/page.tsx:658` to `app/page.tsx:724` | normalized `depart`, `returnDate` | No stay summary before results; search proceeds | Pass for transport, incomplete for hotel stay copy |
| Search API validation | `app/api/search/route.ts:134` to `app/api/search/route.ts:165` | `depart`, `ret` | JSON error on invalid API requests | Fails same-day hotel stay; API accepts `ret === depart` |
| Hotel provider call | `app/api/search/route.ts:289` to `app/api/search/route.ts:297` | `{ checkin: depart, checkout: ret }` | Not user-visible | Pass for provider input |
| Provider request/cache | `lib/providers/hotellook.ts:59` to `lib/providers/hotellook.ts:81` | `range.checkin`, `range.checkout` | Not user-visible | Pass for API query and cache key |
| Results header | `app/page.tsx:1258` to `app/page.tsx:1267` | `depart`, `returnDate` | Desktop only: `YYYY-MM-DD - YYYY-MM-DD`; hidden on mobile via `sm:inline` | Fails mobile date persistence |
| Results summary | `app/page.tsx:1275` to `app/page.tsx:1305` | route and passenger count only | No hotel dates or nights in normal results header | Fails hotel context |
| Hotel loading | `app/page.tsx:1435` to `app/page.tsx:1451` | none visible | Skeletons only | Fails date clarity while hotel results load |
| Hotel empty/error | `app/page.tsx:1452` to `app/page.tsx:1470` | `resultContext` includes date range | Empty/error panel shows selected date range | Pass for empty/error state |
| Hotel card | `app/components/HotelCard.tsx:205` to `app/components/HotelCard.tsx:285` | none in `HotelOffer` | Name, area, class/rating, price, score, CTA; no check-in, checkout, nights | Fails before booking handoff |
| Hotel outbound CTA | `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270` | `hotel.deeplink` only | "Check with HotelLook"; no date copy next to CTA | Fails handoff clarity |
| Hotel deeplink generation | `lib/providers/hotellook.ts:55` to `lib/providers/hotellook.ts:56` | hotel id only | External URL omits check-in/check-out | Fails handoff integrity |
| Booking entry | `app/book/BookingFlow.tsx:81` to `app/book/BookingFlow.tsx:107` | flight fare dates only | Flight review shows Depart/Return | Out of scope for hotels; no hotel booking entry exists locally |

## Findings

### P0: Hotel result cards lose stay dates and night count before the user clicks out

Evidence:

- `HotelOffer` has no `checkin`, `checkout`, or `nights` field at `lib/types.ts:47` to `lib/types.ts:57`.
- `HotelCard` renders hotel identity, area, class/rating, deal score, nightly price, and CTA, but no stay date or night count at `app/components/HotelCard.tsx:205` to `app/components/HotelCard.tsx:285`.
- The only normal results date display is in the sticky header at `app/page.tsx:1263` to `app/page.tsx:1267`, and it is hidden below the `sm` breakpoint.
- The main results title at `app/page.tsx:1294` to `app/page.tsx:1304` omits dates entirely.

Repro:

1. Search a valid two-night hotel route, for example origin `JFK`, destination `CDG`, depart `2026-09-10`, return `2026-09-12`, round trip.
2. Open hotel results.
3. Review any hotel card before clicking "Check with HotelLook".
4. Observe no check-in date, check-out date, or "2 nights" copy on the hotel card.

Expected: every bookable hotel card or immediate CTA context shows the selected check-in, check-out, and night count.

Actual: stay context disappears from the hotel card.

Impact: High. A paid hotel result can be acted on without visible confirmation of the stay being priced.

### P0: Hotel outbound deeplink does not include check-in or check-out

Evidence:

- `/api/search` passes the selected dates into the provider call as `{ checkin: depart, checkout: ret }` at `app/api/search/route.ts:289` to `app/api/search/route.ts:292`.
- `HotellookProvider.searchHotels()` uses those dates in its API request and cache key at `lib/providers/hotellook.ts:67` to `lib/providers/hotellook.ts:81`.
- `buildDeeplink()` only includes marker, tracking params, and `/hotels/{hotelId}` at `lib/providers/hotellook.ts:55` to `lib/providers/hotellook.ts:56`.
- `HotelCard` opens that deeplink directly at `app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`.

Repro:

1. Perform the same valid two-night search.
2. Inspect a HotelLook CTA URL.
3. Observe the URL has no selected check-in or check-out parameters.

Expected: the provider handoff preserves the stay dates or blocks with clear copy that dates must be rechecked on provider site.

Actual: expaify searched hotels for specific dates, but the outbound handoff URL does not carry those dates.

Impact: High. User trust can break at the paid handoff because the provider page may not open on the stay that was searched.

### P0: Same-day hotel stay is accepted as valid

Evidence:

- UI validation only rejects `returnDate < depart`, so `returnDate === depart` passes at `app/page.tsx:130` to `app/page.tsx:137`.
- The return date input explicitly allows `min={depart || todayIso()}` at `app/page.tsx:1085` to `app/page.tsx:1091`.
- API validation also only rejects `ret < depart`, so a same-day hotel query reaches the provider at `app/api/search/route.ts:151` to `app/api/search/route.ts:157` and `app/api/search/route.ts:289` to `app/api/search/route.ts:292`.

Repro:

1. On mobile width 375px, enter a destination.
2. Set Depart and Return to the same date.
3. Submit the search.
4. Observe there is no visible error explaining that hotels require checkout after check-in.

Expected: hotel stay validation rejects same-day check-in/check-out or clearly skips hotels with a specific zero-night explanation.

Actual: same-day range is treated as valid for both flights and hotels.

Impact: High for hotel trust. This can request a zero-night hotel stay and produce unclear empty/unavailable results.

### P1: Mobile hotel results hide the only normal date display

Evidence:

- The sticky results header date range is wrapped in `hidden ... sm:inline` at `app/page.tsx:1263` to `app/page.tsx:1267`.
- Hotel cards do not repeat stay dates at `app/components/HotelCard.tsx:205` to `app/components/HotelCard.tsx:285`.
- The hotel tab and normal hotel results grid do not render `resultContext`; `resultContext` only appears in error/empty panels at `app/page.tsx:1353` to `app/page.tsx:1356` and `app/page.tsx:1467` to `app/page.tsx:1470`.

Repro:

1. Use a 375px viewport.
2. Run a valid hotel search.
3. Open hotel results.
4. Observe the visible hotel result flow lacks selected stay dates before the CTA.

Expected: mobile users see stay context before committing to a provider handoff.

Actual: mobile hides the header date and hotel cards do not show it elsewhere.

Impact: Medium-high. This is the most constrained viewport and the most likely place date context disappears.

## Passing Checks

- Missing return date is blocked for round-trip search at `app/page.tsx:130` to `app/page.tsx:137` and `app/api/search/route.ts:145` to `app/api/search/route.ts:147`.
- Reversed dates are blocked in both UI and API at `app/page.tsx:135` to `app/page.tsx:136` and `app/api/search/route.ts:156` to `app/api/search/route.ts:157`.
- Invalid date strings from shared links are rejected before search at `app/page.tsx:201` to `app/page.tsx:210`.
- Empty and unavailable hotel states show date context through `resultContext` at `app/page.tsx:912` to `app/page.tsx:928` and `app/page.tsx:1452` to `app/page.tsx:1470`.
- Provider request caching is keyed by normalized location plus `checkin`/`checkout` at `lib/providers/hotellook.ts:67` to `lib/providers/hotellook.ts:81`.

## Manual Verification

Live browser verification was blocked by the sandbox. Command attempted:

```text
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Result:

```text
Error: listen EPERM: operation not permitted 127.0.0.1:3010
```

Source-level manual verification performed:

- Valid two-night desktop flow: traced `2026-09-10` to `2026-09-12` from form state, to URL params, to `/api/search`, to `hotellook.searchHotels()`. The hotel request preserves dates, but normal hotel results and HotelCard do not show `2 nights`, check-in, or check-out before the CTA.
- Invalid mobile 375px flow: source review confirms the date fields stack to one column at `app/page.tsx:1050`; return `min` allows the same date as depart at `app/page.tsx:1085` to `app/page.tsx:1091`; validation does not reject same-day stays at `app/page.tsx:130` to `app/page.tsx:137`.
- Desktop/mobile layout: no live viewport screenshot could be captured. Source review found no hotel-specific overlap evidence, but date clarity fails independently because the relevant date/night copy is missing.

## Blockers and Out-of-Scope Findings

- Blocker: local dev server could not bind, so live desktop and 375px browser verification could not be completed.
- Worktree mismatch: `components/search/SearchSummary.tsx`, `components/hotels/HotelResults.tsx`, and `components/hotels/HotelCard.tsx` do not exist locally.
- Out of scope: `components/search/SearchPanel.tsx` has date fields and no validation at `components/search/SearchPanel.tsx:145` to `components/search/SearchPanel.tsx:224`, but it is not wired into `app/page.tsx` in this worktree.
- Out of scope: `app/book/page.tsx` and `app/book/BookingFlow.tsx` are flight fare review surfaces. No local hotel booking review page exists; hotel booking entry is the external HotelLook CTA.

## Verification Commands

- `npm run dev -- --hostname 127.0.0.1 --port 3010` - failed: sandbox blocked server bind with `listen EPERM`.
- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed. 20 test suites passed, 176 tests passed.

## Required Return Note

- What changed and why: Added this audit report for AUDIT-SEARCH-HOTEL-DATE-STAY-INTEGRITY-01 to document hotel date/stay integrity failures without changing production code.
- Files changed: `docs/audits/2026-07-01-audit-search-hotel-date-stay-integrity-01.md`.
- Verification commands and results: See Verification Commands above.
- Out-of-scope findings or blockers: Live browser verification blocked by `listen EPERM`; named hotel/search summary components are absent from this worktree; no local hotel booking page exists.

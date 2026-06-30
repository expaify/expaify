# AUDIT-SEARCH-LOCALE-DATE-INPUT-AMBIGUITY-01

Date audited: 2026-06-30
Auditor role: Senior QA Engineer
Scope: visible search-to-results-to-booking date entry, persistence, rendering, and API payload paths in the implemented app.

## Blockers Against Assigned File List

- `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, `app/api/tickets/route.ts`, and `app/api/tickets/[id]/route.ts` do not exist in this worktree.
- The implemented equivalent user flow is search results through `app/components/FlightCard.tsx` into `/book` via `app/book/BookingFlow.tsx`.
- Local Next dev server could not be started in this sandbox: `listen EPERM: operation not permitted 0.0.0.0:3001`. Screenshots are therefore blocked; copied UI text and command-level timezone repros are provided instead.

## Executive Verdict

Fail. Search form date values and search URL query values are mostly preserved as raw `YYYY-MM-DD` strings, but several visible date surfaces can shift calendar day because they parse date-only or offset-less provider values through JavaScript `Date` and user-local timezone rules.

## Date Surface Matrix

| Surface | Path | Result | Evidence |
| --- | --- | --- | --- |
| Search date inputs | `app/page.tsx:1057`, `app/page.tsx:1085` | Pass | Browser `type="date"` stores `event.target.value` as `YYYY-MM-DD`; labels are `Depart` and `Return`. |
| Form validation | `app/page.tsx:103`, `app/page.tsx:117` | Pass with note | Strict `YYYY-MM-DD`; invalid/missing dates show clear copy: `Choose a departure date before searching.`, `Use a valid return date before searching.`, `Return date must be on or after the departure date.` |
| URL serialization | `app/page.tsx:148`, `app/page.tsx:648` | Pass | Query params are raw `depart=YYYY-MM-DD` and `return=YYYY-MM-DD`; no locale formatting. |
| URL restore/back-forward | `app/page.tsx:163`, `app/page.tsx:519` | Pass with blocker | Initial restore validates and re-runs search. No `popstate` listener; browser back/forward after in-page `replaceState` may not retrigger component state, but `replaceState` itself avoids adding history entries. |
| Results header date summary | `app/page.tsx:910`, `app/page.tsx:1263` | Pass | Copied UI text uses raw ISO date strings: `2026-09-22 - 2026-09-29`; no locale ambiguity, but not user-friendly. |
| API search validation | `app/api/search/route.ts:43`, `app/api/search/route.ts:126` | Pass | Rejects missing, malformed, past, and reversed dates with explicit JSON errors. |
| Hotel provider API payload | `app/api/search/route.ts:279`, `lib/providers/hotellook.ts:63` | Pass | Search `depart`/`return` are forwarded as `checkin`/`checkout` raw strings. |
| Price calendar day selection | `app/page.tsx:411`, `app/page.tsx:416`, `app/page.tsx:417` | Fail | Builds local-midnight dates, then uses `toISOString().slice(0, 10)`. In UTC+14, selecting Sep 1 serializes as `2026-08-31`. |
| Flight result card date/time | `app/components/FlightCard.tsx:14`, `app/components/FlightCard.tsx:26`, `app/components/FlightCard.tsx:313`, `app/components/FlightCard.tsx:338` | Fail | Parses provider `depart`/`return` through `new Date` and `toLocaleDateString`/`toLocaleTimeString`. UTC instants can display the previous local calendar day; offset-less local provider datetimes are interpreted in the viewer timezone. |
| Booking link payload | `lib/booking/config.ts:123`, `lib/booking/config.ts:139` | Pass for serialization | Booking URL preserves `fare.depart` and `fare.return` exactly. |
| Booking context validation | `lib/booking/config.ts:67` | Fail | Accepts date-only and arbitrary `T...` strings if `new Date(value)` parses them; no offset requirement, no calendar-day normalization. |
| Booking review date text | `app/book/BookingFlow.tsx:35`, `app/book/BookingFlow.tsx:90`, `app/book/BookingFlow.tsx:103` | Fail | `new Date(value).toLocaleString('en-US', ...)` shifts date-only strings west of UTC and shifts UTC instants based on viewer timezone. Copied UI labels: `Fare review`, `Depart`, `Return`. |
| Traveler DOB input/API | `app/book/BookingFlow.tsx:279`, `app/book/BookingFlow.tsx:294`, `app/api/book/route.ts:15` | Pass with validation gap | DOB is submitted as raw `YYYY-MM-DD` from `type="date"`. API checks required presence only; browser validation is the main guard. |

## Reproduction Flows

### Flow 1: Search to Results to Booking Review

Precondition: use a future search date because current date is 2026-06-30.

1. Open search form.
2. Enter origin `JFK`, destination `LAX`.
3. Set depart `2026-09-22`, return `2026-09-29`.
4. Submit search.
5. Expected copied UI text in search/result context: `2026-09-22 - 2026-09-29`.
6. Browser URL should contain `depart=2026-09-22&return=2026-09-29&trip=roundtrip`.
7. Click Share; copied URL uses raw query strings.
8. Use browser back/forward or reload copied URL. Initial URL restore path keeps the same strings and reruns search.
9. Open a Duffel `/book?...depart=...&return=...` link from a result.
10. Booking review displays `Fare review`, `Depart`, and optional `Return`.

Result: search and URL strings preserve the day. Result cards and booking review can render a different visible day depending on the exact provider timestamp and viewer timezone.

### Flow 2: Price Calendar Shift

Command-level repro:

```sh
TZ=Pacific/Kiritimati node -e "const y=2026,m=8; const d=new Date(y,m,1); console.log(d.toISOString().slice(0,10))"
```

Observed copied output: `2026-08-31`

Expected selected calendar day: `2026-09-01`

Path: `PriceCalendar` creates `new Date(year, month, day)` at local midnight and serializes it using UTC ISO.

### Flow 3: Booking Review Bare Date Shift

Command-level repro:

```sh
TZ=America/New_York node -e "const value='2026-09-22'; console.log(new Date(value).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric'}))"
```

Observed copied output: `Mon, Sep 21`

Expected calendar day from payload: `Tue, Sep 22`

Path: `validateBookingFareContext` accepts bare dates; `BookingFlow.formatDateTime` parses them as UTC midnight.

### Flow 4: Result Card UTC Instant Shift

Command-level repro:

```sh
TZ=America/Los_Angeles node -e "const value='2026-09-22T00:30:00Z'; const d=new Date(value); console.log(d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}), d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}))"
```

Observed copied output: `Mon, Sep 21 5:30 PM`

Provider instant calendar day in payload: `2026-09-22`

Risk: user sees Sep 21 on the card/review for a fare whose provider date begins Sep 22 UTC.

## Findings

### P1: Price calendar can select the previous date

Files:
- `app/page.tsx:411`
- `app/page.tsx:416`
- `app/page.tsx:417`
- `app/page.tsx:454`

The custom calendar builds local `Date` objects and serializes with `toISOString()`. Users in positive UTC offsets can click a visible day and store/search the previous UTC date.

User impact: a paid user selecting a cheap Sep 1 travel day can search/book Aug 31 without realizing it.

### P1: Booking review can show the wrong travel day for date-only fare context

Files:
- `lib/booking/config.ts:67`
- `app/book/BookingFlow.tsx:35`
- `app/book/BookingFlow.tsx:90`
- `app/book/BookingFlow.tsx:103`

`validateBookingFareContext` allows bare `YYYY-MM-DD`; `formatDateTime` parses with `new Date(value)`, which treats date-only strings as UTC midnight. In US timezones this displays the previous day.

User impact: `/book?...depart=2026-09-22` can show `Mon, Sep 21` in review copy.

### P1: Flight cards can show different calendar days from provider/source dates

Files:
- `app/components/FlightCard.tsx:14`
- `app/components/FlightCard.tsx:26`
- `lib/providers/kiwi.ts:195`
- `lib/providers/kiwi.ts:211`
- `lib/providers/amadeus.ts:192`
- `lib/providers/amadeus.ts:235`
- `lib/providers/travelpayouts.ts:185`
- `lib/providers/travelpayouts.ts:237`

Flight cards parse provider dates with user-local `Date`. Provider values are mixed: date-only strings, offset-less local datetimes, and UTC instants. The UI does not preserve source calendar day consistently.

User impact: a result can display `Mon, Sep 21` even when the serialized fare date or searched date is `2026-09-22`.

## Clear Invalid/Partial Date Copy

Copied UI/API text found:

- Missing depart: `Choose a departure date before searching.`
- Missing roundtrip return: `Choose a return date, or switch to one way.`
- Malformed depart link: `The departure date in this link is not valid. Use a calendar date before searching.`
- Reversed dates: `The return date in this link is before the departure date. Correct the dates to search.`
- API missing depart: `Departure date is required. Choose a departure date before searching.`
- API malformed date: `depart must use YYYY-MM-DD format`
- API reversed dates: `Return date must be on or after departure date.`

This area passes for search. Booking passenger DOB has only required browser validation plus API presence checks.

## Verification Results

- `npx tsc --noEmit --incremental false`: pass.
- `npx jest --runInBand`: pass, 20 suites / 172 tests.
- `npx tsc --noEmit`: pass.
- `npm test -- --passWithNoTests`: pass, 20 suites / 172 tests.
- `npm run dev`: blocked by sandbox bind permission, `listen EPERM: operation not permitted 0.0.0.0:3001`.

## Out-of-Scope Notes

- I did not redesign the search form or add a calendar widget.
- I did not change provider contracts or introduce provider fields.
- I did not modify production data.
- I did not fix the findings because this ticket is an audit and explicitly says to report broken behavior plainly.

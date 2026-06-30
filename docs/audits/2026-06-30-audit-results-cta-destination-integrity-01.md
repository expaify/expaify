# AUDIT-RESULTS-CTA-DESTINATION-INTEGRITY-01

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Audit only. No product UI or provider code changed.

## Decision

Needs repair before paid-user trust signoff.

Most visible result CTAs use honest labels and fail closed when price or link data is missing. The blocker is Travelpayouts: its cards can expose clickable Aviasales handoff links with `marker=` empty because the adapter does not require an affiliate marker before returning fares.

## Requested Files

Requested first-pass files:

- `app/page.tsx` - present, inspected.
- `components/TicketCard.tsx` - missing from this worktree.
- `components/TicketSlideOver.tsx` - missing from this worktree.
- `app/api/tickets/route.ts` - missing from this worktree.
- `app/api/tickets/[id]/route.ts` - missing from this worktree.

Actual CTA surfaces inspected:

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/search/route.ts`
- `app/api/book/route.ts`
- `lib/booking/config.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/kiwi.ts`

## CTA Matrix

| Surface | Route / viewport | Label | Expected destination | Actual destination | Status |
| --- | --- | --- | --- | --- | --- |
| Search form primary | `/`, mobile 375 and desktop source review | `Search flights` / `Scanning deals...` | Submit search and transition to results | Calls `runSearch`, streams `/api/search`, disables while searching (`app/page.tsx:1090`) | Pass |
| Result header secondary | `/` results, mobile 375 and desktop source review | `Edit` | Return to editable search form | `setView('form')` (`app/page.tsx:1183`) | Pass |
| Results share secondary | `/` results, mobile 375 and desktop source review | `Share` / `Copied!` | Copy current result URL with route/tab/sort/filter params | Uses `buildSearchParams` and clipboard (`app/page.tsx:1235`) | Pass |
| Flight external primary: Travelpayouts | `/` results, mobile 375 and desktop source review | `Check with travelpayouts` | External provider handoff with affiliate marker, honest provider label | Aviasales URL is built as `...?marker=${marker}` even when marker is empty (`lib/providers/travelpayouts.ts:74`, `lib/providers/travelpayouts.ts:78`) | Fail |
| Flight external primary: Kiwi | `/` results, mobile 375 and desktop source review | `Check with kiwi` | External provider handoff with configured attribution | Provider fails closed if attribution param/value are missing; link is attributed when returned (`lib/providers/kiwi.ts:79`, `lib/providers/kiwi.ts:91`) | Pass |
| Flight internal primary: Duffel | `/` results, mobile 375 and desktop source review | `Review paused booking` | Internal `/book?...` review-only handoff | Duffel builds `/book` href (`lib/providers/duffel.ts:217`); `FlightCard` labels it review-only (`app/components/FlightCard.tsx:244`) | Pass |
| Flight unavailable primary | `/` results, mobile 375 and desktop source review | `Price unavailable` or `Provider link unavailable` | Disabled, non-clickable state with reason | Disabled button plus explanatory copy (`app/components/FlightCard.tsx:244`, `app/components/FlightCard.tsx:370`) | Pass |
| Hotel external primary | `/` hotel results, mobile 375 and desktop source review | `Check with HotelLook` | External HotelLook/Travelpayouts handoff with hotel affiliate marker | HotelLook requires `HOTEL_AFFILIATE_ID` or marker fallback and builds `tp.media` URL (`lib/providers/hotellook.ts:50`, `lib/providers/hotellook.ts:54`, `app/components/HotelCard.tsx:257`) | Pass |
| Hotel unavailable primary | `/` hotel results, mobile 375 and desktop source review | `Booking unavailable` | Non-clickable failure state with specific reason | Renders status span when price or booking URL is invalid (`app/components/HotelCard.tsx:105`, `app/components/HotelCard.tsx:273`) | Pass |
| Empty flight results action | `/` results, mobile 375 and desktop source review | `Edit search` or `Show all stops` | Return to form or clear stops filter | Action is state-specific and full width on mobile (`components/flights/FlightResults.tsx:158`) | Pass |
| Search error actions | `/` results, mobile 375 and desktop source review | `Retry search`, `Edit search` | Retry current search or return to form | Error panel exposes both actions (`app/page.tsx:1257`) | Pass |
| Hotel empty action | `/` hotel results, mobile 375 and desktop source review | `Edit search` | Return to form | Empty hotel state exposes one edit action (`app/page.tsx:1380`) | Pass |
| Booking review recovery | `/book`, mobile 375 and desktop source review | `Back to search` | Return to search without creating order | Invalid/paused states do not collect payment or submit order (`app/book/BookingFlow.tsx:224`, `app/book/BookingFlow.tsx:338`) | Pass |

## Finding: Travelpayouts CTA Does Not Fail Closed Without Affiliate Marker

Severity: P0

File references:

- `lib/providers/travelpayouts.ts:74` reads `TP_AFFILIATE_MARKER`, which is not in the ticket's approved secret list.
- `lib/providers/travelpayouts.ts:78` builds a clickable Aviasales deeplink even when the marker is empty.
- `lib/providers/travelpayouts.ts:193`, `lib/providers/travelpayouts.ts:245`, and `lib/providers/travelpayouts.ts:295` attach that deeplink to visible fare cards.
- `app/components/FlightCard.tsx:155` treats any `http:` or `https:` URL as safe.
- `app/components/FlightCard.tsx:353` renders the visible primary CTA when price and link are present.

Repro:

1. Run a search in an environment with `TP_TOKEN` set and no Travelpayouts affiliate marker.
2. Wait for Travelpayouts fares to stream.
3. Inspect a `Check with travelpayouts` CTA.
4. Actual: the CTA points to an Aviasales URL with an empty `marker=` value.
5. Expected: provider should fail closed or the CTA should render unavailable with clear copy until a valid affiliate marker is configured.

Impact:

This violates the outbound marker requirement and creates a paid-user trust gap: the result looks bookable and provider-ready, but the commercial destination is not properly attributed.

## Empty, Loading, And Error States

Loading:

- Search form primary changes to `Scanning deals...` and disables while searching (`app/page.tsx:1090`).
- Results loading shows `Scanning deals across providers...` and skeleton flight cards (`app/page.tsx:1206`, `components/flights/FlightResults.tsx:257`).
- No result-card primary action is clickable in skeleton cards (`app/components/FlightCard.tsx:217`).

Empty:

- Flight empty states distinguish missing dates, filters hiding fares, provider unavailable, and no inventory (`components/flights/FlightResults.tsx:137`).
- Filter-empty state uses `Show all stops`; other empty states use `Edit search` when available (`components/flights/FlightResults.tsx:158`).
- Hotel empty/unavailable states show explanatory copy and `Edit search` (`app/page.tsx:1380`).

Error:

- Search error state has `Retry search` and `Edit search` actions (`app/page.tsx:1257`).
- Invalid booking context shows `We can't identify this fare` and only `Back to search`; it does not submit an order (`app/book/BookingFlow.tsx:224`).
- Paused booking context shows `In-app booking is paused` and only review/recovery copy (`app/book/BookingFlow.tsx:338`).

## Manual Verification Flows

Mobile 375px source-traced flow:

1. Start at `/` on a 375px viewport.
2. Submit a valid route search with origin, destination, and dates.
3. Expected loading: `Scanning deals...`, then results loading skeletons.
4. Expected result CTA: a flight card primary action is full-width because `FlightCard` uses `w-full` and a single-column grid below `sm` (`app/components/FlightCard.tsx:352`, `components/flights/FlightResults.tsx:292`).
5. Expected action behavior: Duffel opens `/book?...` review-only; external providers open new-tab provider links; unavailable cards render disabled copy.
6. Blocker: live browser execution could not be completed because the sandbox blocks local server binding with `listen EPERM`.

Desktop source-traced flow:

1. Start at `/` on desktop.
2. Submit the same route search.
3. Expected loading: results header plus provider scanning copy.
4. Expected result CTA layout: results grid expands to two columns at `sm` and three at `lg` (`components/flights/FlightResults.tsx:292`).
5. Expected action behavior: same destination rules as mobile.
6. Blocker: live browser execution could not be completed because the sandbox blocks local server binding with `listen EPERM`.

## Out-of-Scope Finding

Existing handoff continuity issues are documented in `docs/audits/2026-06-30-audit-results-booking-handoff-06.md`, including Deal Score disappearing on the booking review and booking review using client-supplied URL context. I did not repair those in this audit-only ticket.

## Verification

- `npm run dev -- -H 127.0.0.1 -p 3000` - failed before serving app: `listen EPERM: operation not permitted 127.0.0.1:3000`.
- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --passWithNoTests` - passed. 19 suites passed, 162 tests passed.

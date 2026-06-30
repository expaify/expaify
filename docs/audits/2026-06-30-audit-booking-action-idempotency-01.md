# AUDIT-BOOKING-ACTION-IDEMPOTENCY-01

Date: 2026-06-30  
Role: Senior Full-Stack Engineer  
Scope: Audit only. No product behavior changed.

## Scope Notes

The ticket asked to inspect `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, `app/api/tickets/route.ts`, `app/api/tickets/[id]/route.ts`, and `lib/db.ts`, but those paths do not exist in this worktree. The current booking and handoff surfaces are:

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `lib/booking/config.ts`
- `lib/providers/duffel.ts`
- `app/deals/[dealId]/page.tsx`

## Executive Decision

Not idempotent enough for premium booking.

External provider handoff links are mostly recoverable because they are plain anchors and do not mutate expaify state. The in-app Duffel booking submit path is not idempotent server-side: repeated `POST /api/book` requests with the same offer and passenger payload can reach Duffel order creation more than once. The client shows pending state and disables the submit button after React enters `loading`, but there is no idempotency key, duplicate-submit guard before state commit, persisted booking attempt record, or refresh/back recovery for a successful provider reference.

## User-Triggered Actions Audited

| Action | Entry point | Repeated trigger behavior | Pending UI | Success UI | Failure/retry UI | Duplicate/state risk |
| --- | --- | --- | --- | --- | --- | --- |
| Flight external provider handoff | `FlightCard` external `<a>` (`app/components/FlightCard.tsx:353`) | Can be clicked repeatedly; opens provider URL in a new tab each time | None in expaify | Provider-owned tab | None in expaify | No expaify duplicate record. Multiple provider tabs can confuse users, but card copy says price/availability can change. |
| Duffel internal booking review handoff | `FlightCard` internal `/book?...` `<a>` (`app/components/FlightCard.tsx:353`) | Can be clicked repeatedly; navigates to the same URL | Browser navigation only | Review page from query params | Invalid context blocks form | No record created by the click. Back/refresh reconstructs review from URL, but values are client-supplied fare context until submit-time provider recheck. |
| Hotel external handoff | `HotelCard` `<a>` (`app/components/HotelCard.tsx:257`) | Can be clicked repeatedly; opens provider URL in a new tab each time | None in expaify | Provider-owned tab | Unavailable state if price/link invalid | No expaify duplicate record. Multiple provider tabs possible. |
| Saved deal external handoff | Deal detail `<a>` (`app/deals/[dealId]/page.tsx:255`) | Can be clicked repeatedly; opens provider URL in a new tab each time | None in expaify | Provider-owned tab | Provider-link-unavailable panel | No expaify duplicate record. Multiple provider tabs possible. |
| In-app booking submit | `BookingFlow` form submit (`app/book/BookingFlow.tsx:283`) | Client disables submit while `state === 'loading'`, but concurrent submits or retries can send repeated `POST /api/book` | Shows `Submitting request` and changes button to `Confirming request...` (`app/book/BookingFlow.tsx:405`, `app/book/BookingFlow.tsx:461`) | Shows booking reference only in React state (`app/book/BookingFlow.tsx:311`) | Error screen has `Review details again` retry (`app/book/BookingFlow.tsx:363`) | Concrete gap: duplicate API calls can create duplicate provider orders; refresh loses success reference; some failures can be ambiguous after order submission. |

## Findings

### P0 - `POST /api/book` has no server-side idempotency before Duffel order creation

Evidence:

- The client posts `{ offerId, fareContext, passenger }` without an idempotency key (`app/book/BookingFlow.tsx:288` to `app/book/BookingFlow.tsx:296`).
- The API validates the selected fare and passenger, fetches the Duffel offer, then calls `POST https://api.duffel.com/air/orders` (`app/api/book/route.ts:155` to `app/api/book/route.ts:184`).
- There is no database insert, unique constraint, request key, Redis lock, persisted order state, or provider idempotency header around the order call (`app/api/book/route.ts:38` to `app/api/book/route.ts:221`).
- The ticket's `lib/db.ts` and ticket record APIs are absent, so there is no existing booking-attempt persistence layer to recover from.

Repro by code path:

1. Open a valid single-passenger Duffel `/book?...` URL with `BOOKING_ENABLED=true`.
2. Submit the same traveler details twice quickly, or replay the same request body to `POST /api/book`.
3. Each accepted request can pass validation, fetch the offer, and call Duffel order creation independently.

Impact:

Duplicate submissions can create duplicate provider order attempts for the same offer and passenger. The UI only protects the common single-click path after React applies `loading`; it does not make the mutation idempotent.

Smallest repair ticket:

`REPAIR-BOOKING-SUBMIT-IDEMPOTENCY-01`: Add a narrow booking idempotency key to the existing `/api/book` request and server path. Generate a stable client attempt id per loaded fare review, send it with the booking submit, and have the server persist or Redis-guard `offerId + passenger identity + attemptId` through the Duffel order attempt. Repeated requests should return the same known result or an in-progress response instead of creating another order. Keep provider behavior and price validation unchanged.

### P0 - Successful booking state is not recoverable after refresh or navigation

Evidence:

- `bookingRef` is local React state only (`app/book/BookingFlow.tsx:268`).
- Success renders only when `state === 'success'` (`app/book/BookingFlow.tsx:311`).
- Refreshing `/book?...` remounts the page from query params via `parseBookingFareContext` (`app/book/page.tsx:11` to `app/book/page.tsx:18`) and returns to the initial review/form state.
- There is no `orderId` or `bookingReference` in the URL, database, ticket API, or recovery endpoint.

Impact:

After a successful provider response, browser refresh or back/forward navigation can make the reference disappear and show a fresh submit form for the same fare context. That is misleading and increases duplicate-submit risk.

### P1 - Error copy and retry path are not safe for ambiguous provider outcomes

Evidence:

- On any failed client-side response after submit, the error page says "the provider stopped the booking request before an order was created" (`app/book/BookingFlow.tsx:367`).
- The API can fail after the order request is attempted, including JSON parsing or caught exceptions after provider side effects (`app/api/book/route.ts:186` to `app/api/book/route.ts:219`).
- The retry action simply returns to `idle`, allowing a fresh submit with the same payload (`app/book/BookingFlow.tsx:374`).

Impact:

For timeouts, malformed responses, or 5xx after `POST /air/orders`, expaify cannot prove no provider order exists. The current retry flow can encourage a duplicate order attempt while assuring the user the prior request was stopped.

### P1 - Result card booking-mode copy can conflict with enabled booking behavior

Evidence:

- Duffel fares always get an internal `/book` deeplink from the provider adapter (`lib/providers/duffel.ts:217`).
- `FlightCard` labels every internal Duffel booking link as "Review paused booking" and notes "In-app booking is paused. Review only." (`app/components/FlightCard.tsx:248` to `app/components/FlightCard.tsx:257`).
- `/book` can collect traveler details and submit an order when `BOOKING_ENABLED=true` (`app/book/BookingFlow.tsx:338` to `app/book/BookingFlow.tsx:393`).

Impact:

When booking is enabled, the user can move from "paused/review only" copy into an active order-creation form. This is not an idempotency bug by itself, but it makes the action boundary unclear.

## Positive Checks

- `FlightCard` blocks invalid or missing flight deeplinks and disables the CTA when price is not valid (`app/components/FlightCard.tsx:240` to `app/components/FlightCard.tsx:257`, `app/components/FlightCard.tsx:370` to `app/components/FlightCard.tsx:378`).
- `HotelCard` blocks invalid hotel links or missing prices and states why booking is unavailable (`app/components/HotelCard.tsx:180` to `app/components/HotelCard.tsx:184`, `app/components/HotelCard.tsx:273` to `app/components/HotelCard.tsx:285`).
- Booking review blocks missing fare context instead of collecting traveler details (`app/book/BookingFlow.tsx:334`).
- Booking-disabled and multi-passenger states explicitly say expaify is not creating an order (`app/book/BookingFlow.tsx:338` to `app/book/BookingFlow.tsx:360`).
- The submit form exposes `aria-busy` and a visible pending panel while loading (`app/book/BookingFlow.tsx:393` to `app/book/BookingFlow.tsx:411`).
- `/api/book` revalidates Duffel passenger count, price cents, and currency before order creation (`app/api/book/route.ts:137` to `app/api/book/route.ts:153`).

## Manual Verification Flow

Live browser execution was blocked in this environment: `npm run dev -- -H 127.0.0.1 -p 3017` did not become reachable by `curl`, process inspection with `ps` is not permitted, and `timeout` is not installed for a bounded foreground server run. Static/manual trace results:

1. Start from search results: `app/page.tsx` syncs search state into the URL with `replaceState`, so browser Back from `/book?...` should generally restore the results URL state (`app/page.tsx:648` to `app/page.tsx:655`).
2. Trigger handoff twice quickly: external flight, hotel, and saved-deal handoffs are anchors and can open multiple provider tabs. Internal Duffel review handoff navigates to the same `/book?...` URL and creates no record.
3. Trigger booking submit twice quickly: the first submit sets `loading` and disables the button, but repeated HTTP requests to `/api/book` are not deduped server-side.
4. Use browser back from review: returns to the previous search URL if the user came from search history. The visible "Back to search" link in `BookingFlow` points to `/`, so it drops selected search params.
5. Refresh before submit: `/book?...` reconstructs the review from query params and remains submit-capable if booking is enabled.
6. Refresh while pending: the pending state is lost. There is no in-progress recovery, so the user sees the initial review/form again.
7. Refresh after success: the booking reference is lost because it lives only in component state.
8. Mobile 375px source check: booking form uses a single-column layout before `sm` and a sticky bottom submit container (`app/book/BookingFlow.tsx:413` to `app/book/BookingFlow.tsx:471`). No source-level overlap was found, but live 375px screenshot verification is blocked.
9. Desktop source check: review uses a two-column layout at `lg` with sticky action panel (`app/book/BookingFlow.tsx:172` to `app/book/BookingFlow.tsx:186`). No source-level hidden primary action was found, but live desktop screenshot verification is blocked.

## Copy Honesty Check

User-facing copy still overstates finality in active booking success and ambiguity in error states:

- "Booking confirmed" and "Order confirmed" are shown from a returned booking reference only (`app/book/BookingFlow.tsx:315` and `app/book/BookingFlow.tsx:321`).
- The error state says the provider stopped the request before an order was created, which is not knowable for every post-order network failure (`app/book/BookingFlow.tsx:367`).

Paused, invalid, multi-passenger, unavailable-link, and external-provider copy are otherwise conservative about price and availability.

## Out of Scope Left Alone

- No locking, queues, payment/session infrastructure, or new recovery screens were implemented.
- Provider adapter behavior was not changed.
- Price calculation, fee labels, and shared database helpers were not changed.
- Existing provider-boundary issue in `app/api/book/route.ts` was already documented in `AUDIT-BOOKING-PRICE-AND-POLICY-HONESTY-01` and was not repaired here.

## Verification Commands

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed. 20 suites passed, 168 tests passed.
- `npm run dev -- -H 127.0.0.1 -p 3017` plus `curl -I http://127.0.0.1:3017/` - blocked; the server did not become reachable in this sandbox, and process inspection is not permitted.

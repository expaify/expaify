# AUDIT-BOOKING-CONTACT-PRIVACY-AND-SECURITY-COPY-01

Date: 2026-06-30
Auditor: Senior QA Engineer
Scope: Audit only. No product code changed.

## Decision

Not ready for paid-user booking contact and traveler data collection.

The paused and invalid booking states are mostly honest about not collecting passenger details or payment data. The enabled booking path still asks for traveler/contact details without enough privacy boundary copy, uses confirmation/order language that can overstate finality, and does not clearly tell the user what expaify does with submitted details after they are sent to the provider.

## Files Inspected

Requested files inspected:
- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`

Requested files not present in this worktree:
- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`
- `app/api/tickets/[id]/route.ts`
- `app/api/tickets/route.ts`

Current equivalent booking/contact/handoff files inspected:
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/book/route.ts`
- `lib/booking/config.ts`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `components/flights/FlightResults.tsx`
- `app/deals/[dealId]/page.tsx`

## Copy Surface Inventory

| Surface | File | Status | Notes |
| --- | --- | --- | --- |
| Search footer trust notes | `app/page.tsx:321` to `app/page.tsx:325` | Pass | Correctly says provider sets final price/availability and support belongs to provider. Mentions affiliate markers. |
| Root metadata | `app/layout.tsx:29` to `app/layout.tsx:60` | Pass | No booking, payment, account, or privacy overclaim found. |
| Global responsive/focus styles | `app/globals.css:137` to `app/globals.css:144`, `app/globals.css:183` to `app/globals.css:240` | Pass | Focus and control styles support readability; no copy-specific hiding found by source review. |
| Flight external handoff CTA | `app/components/FlightCard.tsx:244` to `app/components/FlightCard.tsx:257`, `app/components/FlightCard.tsx:353` to `app/components/FlightCard.tsx:379` | Pass with gap | Says provider search opens and price/availability can change. Gap: affiliate marker disclosure is footer-level, not adjacent to CTA. |
| Duffel internal booking CTA | `app/components/FlightCard.tsx:241` to `app/components/FlightCard.tsx:257` | Fail | Always says "Review paused booking" and "In-app booking is paused" even though `/book` can collect details when `BOOKING_ENABLED=true`. |
| Hotel handoff CTA | `app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:270` | Pass with gap | Says provider site opens and prices can change. Gap: no adjacent affiliate/sponsored disclosure. |
| Booking page loading copy | `app/book/page.tsx:17` to `app/book/page.tsx:34` | Fail | "Checkout review" implies a checkout/payment context before any privacy or payment boundary is visible. |
| Invalid booking link recovery | `app/book/BookingFlow.tsx:232` to `app/book/BookingFlow.tsx:253` | Pass | Clearly says no passenger details, payment details, or provider order can be submitted. |
| Booking paused recovery | `app/book/BookingFlow.tsx:338` to `app/book/BookingFlow.tsx:346` | Pass | Clearly says expaify is not collecting passenger details, payment information, or creating provider orders. |
| Multi-passenger unsupported recovery | `app/book/BookingFlow.tsx:350` to `app/book/BookingFlow.tsx:359` | Pass | Blocks incomplete traveler data and says no order will be created. |
| Enabled booking intro | `app/book/BookingFlow.tsx:386` to `app/book/BookingFlow.tsx:390` | Fail | Says expaify sends traveler information to provider, but does not say whether expaify stores, logs, retains, reuses, or deletes submitted contact/traveler data. |
| Traveler field helper copy | `app/book/BookingFlow.tsx:393` to `app/book/BookingFlow.tsx:458` | Fail | Field labels are clear, but there is no restrained privacy statement near email/phone/date of birth explaining why each is needed or how details are handled. |
| Booking status panel | `app/book/BookingFlow.tsx:399` to `app/book/BookingFlow.tsx:403` | Fail | "Review fare context before creating the order" is order-creation language without payment, ticketing, provider-policy, or data-retention boundaries. |
| Submit CTA and fine print | `app/book/BookingFlow.tsx:460` to `app/book/BookingFlow.tsx:470` | Fail | "Confirm booking" / "Confirm sandbox booking" overstates the action. "expaify sends these details only after you confirm" omits storage/retention and provider-use boundaries. |
| Loading after submit | `app/book/BookingFlow.tsx:405` to `app/book/BookingFlow.tsx:411` | Pass | Does not claim success; says provider is responding. |
| Error recovery after submit | `app/book/BookingFlow.tsx:363` to `app/book/BookingFlow.tsx:378` | Pass with gap | Says request stopped before order creation. Gap: does not tell user whether submitted details were transmitted before the stop. |
| Success state | `app/book/BookingFlow.tsx:311` to `app/book/BookingFlow.tsx:328` | Fail | "Booking confirmed" and "Order confirmed" imply final booking confirmation without visible ticketing/payment/provider-policy boundaries. Sandbox success also drops the "no live ticket" boundary. |
| Booking API disabled response | `app/api/book/route.ts:38` to `app/api/book/route.ts:44` | Pass | Cleanly says in-app booking is unavailable and points to provider link when available. |
| Booking API validation errors | `app/api/book/route.ts:51` to `app/api/book/route.ts:100` | Pass with UX gap | Required-field errors are bounded and do not leak secrets. Gap: raw field names like `passenger.given_name` are API-oriented if surfaced in UI. |
| Booking API provider/payment errors | `app/api/book/route.ts:117` to `app/api/book/route.ts:205` | Fail | `Failed to fetch offer: ${text.slice(0, 200)}` can surface provider response text to users. "Payment failed - contact airline directly" is not clearly true for a Duffel balance/payment failure and may misroute support. |
| Saved deal provider handoff | `app/deals/[dealId]/page.tsx:253` to `app/deals/[dealId]/page.tsx:265` | Pass with gap | Says provider site opens and prices/availability can change. Gap: no adjacent affiliate/sponsored marker copy. |

## Findings

### P1 - Enabled booking form collects sensitive traveler/contact data without enough privacy boundary copy

Evidence:
- The form collects title, gender, first name, last name, date of birth, email, and phone (`app/book/BookingFlow.tsx:413` to `app/book/BookingFlow.tsx:458`).
- Intro copy says expaify sends traveler information to the provider (`app/book/BookingFlow.tsx:386` to `app/book/BookingFlow.tsx:390`).
- Fine print says details are sent only after confirm (`app/book/BookingFlow.tsx:468` to `app/book/BookingFlow.tsx:470`).
- `/api/book` forwards those details to Duffel order creation (`app/api/book/route.ts:155` to `app/api/book/route.ts:183`).

Problem:
The page does not state whether expaify stores, logs, retains, reuses, or deletes the submitted traveler/contact details. A paid travel user entering date of birth, email, and phone needs a plain, restrained boundary before submission.

Narrow copy repair:
- Near the form intro or submit fine print, add one sentence limited to known behavior, for example: "These details are used for this provider order request; final use and support are handled by the provider."
- Do not claim deletion, encryption, compliance certification, or "secure" handling unless implementation evidence exists.

### P1 - Submit and success copy can imply expaify confirms bookings or ticketing

Evidence:
- Button copy: "Confirm booking" / "Confirm sandbox booking" (`app/book/BookingFlow.tsx:460` to `app/book/BookingFlow.tsx:467`).
- Success copy: "Booking confirmed" and "Order confirmed" (`app/book/BookingFlow.tsx:313` to `app/book/BookingFlow.tsx:324`).
- API creates a Duffel order using balance payment and returns `bookingReference` / `orderId` (`app/api/book/route.ts:155` to `app/api/book/route.ts:213`).

Problem:
The UI does not show enough evidence to claim a confirmed live airline ticket, completed payment, ticketing status, refund terms, baggage terms, or provider support boundaries. Sandbox mode is especially risky because pre-submit copy says no live ticket is issued, then success still says "Booking confirmed."

Narrow copy repair:
- Replace pre-submit "Confirm booking" with "Send details to provider" or "Submit provider order request."
- Replace success "Booking confirmed" / "Order confirmed" with "Provider reference received."
- Preserve sandbox boundary after success: "Sandbox response only. No live ticket was issued."

### P1 - Result-card paused booking copy conflicts with enabled booking behavior

Evidence:
- Internal Duffel `/book` links are detected in `FlightCard` (`app/components/FlightCard.tsx:241` to `app/components/FlightCard.tsx:242`).
- The card always says "Review paused booking" and "In-app booking is paused. Review only." (`app/components/FlightCard.tsx:244` to `app/components/FlightCard.tsx:257`).
- Booking enablement is env-driven (`lib/booking/config.ts:23` to `lib/booking/config.ts:30`).
- When enabled, `/book` can display traveler fields and submit to `/api/book` (`app/book/BookingFlow.tsx:386` to `app/book/BookingFlow.tsx:473`).

Problem:
The user can see "paused/review only" on the result card and then land on a form that collects traveler/contact details. That breaks trust at the handoff boundary.

Narrow copy repair:
- Make result-card copy match the destination state: review-only, sandbox-only, or provider order request capable.
- If state cannot be known on the card, use neutral copy like "Review booking options" and keep the destination page explicit.

### P1 - Provider/payment error copy can be legally and operationally unsafe

Evidence:
- Provider offer fetch failure returns part of the raw provider response: `Failed to fetch offer: ${text.slice(0, 200)}` (`app/api/book/route.ts:117` to `app/api/book/route.ts:121`).
- Balance/payment failures return "Payment failed - contact airline directly" (`app/api/book/route.ts:193` to `app/api/book/route.ts:202`).

Problem:
Raw provider text can expose confusing or internal copy to users. "Contact airline directly" may be wrong if the failed payment/order request belongs to Duffel/expaify balance handling rather than airline support.

Narrow copy repair:
- Use a bounded user message: "The provider could not complete this order request. No expaify confirmation was created."
- Route support copy to the provider/airline only when the implementation can prove who owns the recovery.

### P2 - Affiliate/provider handoff disclosure is not adjacent to every outbound action

Evidence:
- Search footer says outbound provider links may include affiliate markers (`app/page.tsx:321` to `app/page.tsx:325`).
- Flight external CTA note says provider search opens and price/availability can change (`app/components/FlightCard.tsx:251` to `app/components/FlightCard.tsx:257`, `app/components/FlightCard.tsx:379`).
- Hotel CTA note says provider site opens and prices can change (`app/components/HotelCard.tsx:255` to `app/components/HotelCard.tsx:270`).
- Saved deal CTA note says provider site opens and prices/availability can change (`app/deals/[dealId]/page.tsx:253` to `app/deals/[dealId]/page.tsx:265`).

Problem:
Footer-level affiliate copy is easy to miss before the user exits. The non-negotiable briefing says affiliate markers must be attached to outbound deeplinks; for trust, adjacent copy should not hide that relationship.

Narrow copy repair:
- Add restrained adjacent language such as "May include affiliate tracking" to outbound provider CTA notes.

## Mobile 375px and Desktop Fit Observations

Live screenshot verification was blocked by sandbox bind permissions, so these are source-level layout observations.

- Booking page mobile: main shell uses `px-4`, single-column flow by default, and form fields stack until `sm:grid-cols-2` (`app/book/BookingFlow.tsx:166` to `app/book/BookingFlow.tsx:181`, `app/book/BookingFlow.tsx:413` to `app/book/BookingFlow.tsx:458`). Primary action is sticky at bottom on mobile (`app/book/BookingFlow.tsx:460` to `app/book/BookingFlow.tsx:471`). No source-level hidden primary action found.
- Booking page desktop: switches to a two-column layout with sticky side panel at `lg` (`app/book/BookingFlow.tsx:170` to `app/book/BookingFlow.tsx:182`). Long fare/reference values use `break-words` or `break-all` (`app/book/BookingFlow.tsx:72` to `app/book/BookingFlow.tsx:77`, `app/book/BookingFlow.tsx:112` to `app/book/BookingFlow.tsx:115`).
- Result cards mobile: flight and hotel CTAs are full-width on mobile and use truncation for long labels (`app/components/FlightCard.tsx:359` to `app/components/FlightCard.tsx:379`, `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:287`).
- Copy risk for mobile: adding privacy copy must stay one sentence near the submit area or form intro. A long legal paragraph would push context and actions down, especially with the sticky mobile submit.

## Manual Verification

Attempted live manual flow:
1. Start Next dev server with `BOOKING_ENABLED=true DUFFEL_ENV=sandbox`.
2. Open a valid `/book?...` URL.
3. Submit empty required fields to observe validation.
4. Enter title, gender, first name, last name, date of birth, email, and phone.
5. Submit to reach provider handoff/recovery.

Blocked:
- `npm run dev -- --hostname 127.0.0.1 --port 3000` failed with `listen EPERM: operation not permitted 127.0.0.1:3000`.
- `tsx` route execution also failed because the sandbox blocked its IPC pipe: `listen EPERM ... /tsx-501/...pipe`.
- Playwright is not installed in this workspace, so I did not add browser tooling for an audit-only ticket.

Source-verified flow:
1. `FlightCard` sends safe internal Duffel links to `/book` (`app/components/FlightCard.tsx:144` to `app/components/FlightCard.tsx:153`).
2. `/book` parses fare context and passes booking enabled/sandbox state into `BookingFlow` (`app/book/page.tsx:11` to `app/book/page.tsx:40`).
3. Empty required fields rely on native `required` validation on traveler/contact inputs (`app/book/BookingFlow.tsx:413` to `app/book/BookingFlow.tsx:458`).
4. Filled traveler/contact data posts to `/api/book` (`app/book/BookingFlow.tsx:283` to `app/book/BookingFlow.tsx:309`).
5. API validation can recover with field-specific errors before any provider call (`app/api/book/route.ts:72` to `app/api/book/route.ts:100`), or with provider/order recovery after provider response (`app/api/book/route.ts:117` to `app/api/book/route.ts:205`).

## Blockers

- Live browser manual verification at 375px and desktop was blocked by sandbox networking restrictions.
- Required ticket files for `TicketCard`, `TicketSlideOver`, and `app/api/tickets` do not exist in this checkout.
- Enabled booking privacy copy is insufficient for paid-user traveler/contact detail collection.

## Out-of-Scope Findings

- `app/api/book/route.ts` calls Duffel directly instead of going through `lib/providers`, conflicting with the briefing contract. Not changed because provider integration changes are out of scope.
- `app/api/book/route.ts` returns `{ ok, bookingReference, orderId }` instead of the shared `Result<T>` shape. Not changed.
- No full privacy policy, account model, saved traveler profile, payment UI, or provider integration was added.

## Verification Results

- `npx tsc --noEmit --incremental false` - passed.
- `npx jest --runInBand` - passed: 20 suites, 172 tests.
- `npm test -- --passWithNoTests` - passed: 20 suites, 172 tests.
- `npm run dev -- --hostname 127.0.0.1 --port 3000` - blocked: `listen EPERM`.

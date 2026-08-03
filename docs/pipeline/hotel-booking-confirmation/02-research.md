# UXR-HOTEL-BOOKING-CONFIRMATION-01: Hotel Booking Confirmation and Itinerary Access Reliability

**Stage:** UX Research (UXR)
**Date:** 2026-08-03
**Priority:** P1
**Persona:** Senior UX Researcher
**Upstream:** `docs/pipeline/hotel-booking-confirmation/01-discovery.md`
**Downstream:** `UXDES-HOTEL-BOOKING-CONFIRMATION-01`

**Files read for this audit:** `app/book/BookingFlow.tsx` (full), `app/book/page.tsx`, `app/api/book/route.ts`, `app/api/book/hotel-context/route.ts`, `lib/booking/config.ts` (full), `lib/booking/hotelContextStore.ts`, `app/components/HotelCard.tsx` (full), `app/api/analytics/route.ts`, `lib/db/schema.sql`.

---

## 0. Executive summary

The discovery report's problem statement holds, and the audit strengthens it in four ways that change what the design stage must solve:

1. **The post-handoff surface does not render at all.** The return prompt is passed to `ReviewShell` as the `hotelSupplement` prop, and `ReviewShell` never renders that prop. On the hotel branch it renders `HotelDecisionSummary`, `status`, and `children` only. So the traveler currently returns to an unchanged pre-handoff review screen — not to a price-mismatch survey. The design stage is building the return moment from zero, not replacing a bad one.
2. **Away-duration cannot disambiguate booked from bounced.** The one signal expaify has tops out at a `120s+` bucket. A hotel checkout and a two-minute price comparison land in the same bucket. Any inference-based branch is unbuildable with today's instrumentation.
3. **A durability mechanism already exists and is 30 minutes long.** `lib/booking/hotelContextStore.ts` persists a validated `BookingHotelContext` in Redis under an opaque 24-char reference with `HOTEL_CONTEXT_TTL_SECONDS = 30 * 60`. For long offers the `/book` URL is *only* `?kind=hotel&hotelContextRef=<ref>`. After 30 minutes that URL resolves to nothing and the traveler gets **"We can't identify this hotel"**. For those offers, repeat-visit behaviour is not "invites a duplicate booking" — it is a dead end.
4. **Wiring `parseStayContinuity` is necessary but not sufficient.** Both call sites drop the continuity argument, *and* the review screen hardcodes the "Stay dates not provided" panel without reading `hotelContext.checkIn` at all. Two independent breaks; fixing the first alone changes nothing on screen.

Five directives follow. Each is written against a named reference pattern at the interaction level and carries acceptance tests a QA stage can execute.

---

## 1. Current implementation — verified in source

### 1.1 The return state is unreachable code (new finding)

`HotelHandoffReview` builds the return prompt and passes it down (`app/book/BookingFlow.tsx:1121-1170`):

```tsx
hotelSupplement={policy ? (
  <div className="space-y-3">
    <TrackedSmokingPolicyPanel … surface="review" />
    {showReturnPrompt ? ( /* "Did the partner details match?" */ ) : null}
  </div>
) : undefined}
```

`ReviewShell` declares `hotelSupplement` in its props (`:543`, `:555`) and **never renders it**. The hotel branch (`:558-570`) renders `HotelDecisionSummary`, `{status}`, `{children}`; the flight branch (`:573-596`) renders `{status}`, `FareSummary`, `{hotelParking}`, `{children}`. `hotelSupplement` appears nowhere in either body.

Consequences, all checkable:

- The `visibilitychange` listener (`:980-1008`) still fires and still emits `hotel_handoff_returned`, so the analytics event exists while the UI it gates does not. `setShowReturnPrompt(true)` mutates state nothing reads.
- The traveler returning from the partner sees the pre-handoff review screen, unchanged, with the primary action still reading "Check rooms at {partner}".
- Collateral: `TrackedSmokingPolicyPanel surface="review"` is also dead, so the review screen has no smoking-policy panel. Out of scope here; flagged in §6.

The discovery report described the prompt as rendering. That was true of the code as written; it is not true of the code as wired. UXDES should treat "nothing renders on return" as the baseline.

### 1.2 expaify holds no booking record, and the schema file cannot currently be applied

`lib/db/schema.sql` defines `snapshots`, `hotel_snapshots`, `route_baseline`, `price_alerts`, `searched_routes`, `tracked_markets`, `price_snapshots`, `deals`, `users`, `accounts`, `sessions`, `verification_token`, `subscriptions`, `deal_alert_deliveries`, `analytics_events`, `admin_users`, `admin_audit_log`, `account_export_requests`, `account_deletion_requests`, `product_analytics_events`. **No bookings, reservations, orders, or trips table.** Confirmed.

Separately: the file contains unresolved merge-conflict markers at `lib/db/schema.sql:272` (`<<<<<<< HEAD`), `:395` (`=======`), and `:408` (`>>>>>>> agent/DEV-HOTEL-SMOKING-POLICY-01`). The file is not valid SQL as committed. Out of scope for this ticket (§6), but it is a hard constraint on any directive that would add a table.

### 1.3 A server-side context store exists — with a 30-minute TTL

`lib/booking/hotelContextStore.ts`:

- `persistBookingHotelContext(input)` validates via `validateStructuredBookingHotelContext`, mints `randomBytes(18).toString('base64url')`, and writes to Redis at `booking:hotel-context:<ref>` with `HOTEL_CONTEXT_TTL_SECONDS = 30 * 60` (`:9`, `:23-25`). Returns `Result<{reference}>`; never throws.
- `resolveBookingHotelContext(ref)` gates on `/^[A-Za-z0-9_-]{24}$/`, returns `{ ok: false, reason: 'Hotel booking context expired' }` on a cache miss (`:41`).

`app/api/book/hotel-context/route.ts` wraps it and returns `/book?kind=hotel&hotelContextRef=<ref>`.

`app/book/page.tsx:15-23` resolves the reference server-side and falls back to `parseBookingHotelContext(params)`. When both fail and `kind=hotel` was requested, `invalidHotelSelection` is set (`:53`) and the flow renders `InvalidHotelState` — **"We can't identify this hotel" / "Selection details are missing"** (`BookingFlow.tsx:688-732`), an `aria-live="assertive"` red panel whose only action is "Back to search".

So there are two distinct repeat-visit behaviours depending on how the offer was serialised:

| Path | Trigger | Repeat visit after handoff |
|---|---|---|
| Inline URL | `buildInlineHotelBookingHref` under 4096 chars (`config.ts:1371`, `MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH = 4_096`) | Pre-handoff review screen renders again, indistinguishable from a first visit |
| Reference URL | href exceeds 4096 chars → `?hotelContextRef=…` (`config.ts:1372`), or `HotelCard.handleReviewClick` posts to `/api/book/hotel-context` (`HotelCard.tsx:893-916`) | Within 30 min: pre-handoff screen again. After 30 min: **hard dead end**, "We can't identify this hotel" |

The second row is a worse failure than the discovery anticipated and is the strongest argument for a client-owned durable stub (§5.4).

### 1.4 Stay dates: two independent breaks

- `buildBookingHotelContext(hotel, continuity?)` exists and honours `continuity` (`config.ts:1233`, `:1269-1277`). Both call sites omit it: `buildHotelBookingHref` (`config.ts:1370`) and `HotelCard.handleReviewClick` (`HotelCard.tsx:902`). `parseBookingHotelContext` does read `checkIn`/`checkOut`/`nightCount` from query params (`config.ts:1144-1146`), so the URL contract is ready — nothing populates it.
- Independently, `HotelDecisionSummary` renders a hardcoded panel (`BookingFlow.tsx:383-388`): `<p>Stay dates not provided</p>` plus "Stay dates are incomplete. Choose or confirm dates with the provider…" — with no reference to `hotelContext.checkIn`, `checkOut`, or `nightCount` anywhere in the component.

**Both must be fixed for a stay to be nameable.** This is the hard dependency the ticket names, and it is twice as large as the discovery recorded.

### 1.5 The offer reference is buried, and it is the only handle expaify owns

`BookingFlow.tsx:1327-1334`, inside a closed `<details>` labelled "Show offer details", at the bottom of "Supporting evidence":

> **Offer reference** `{hotelContext.offerId}`
> "Use this reference if you contact expaify support."

Pre-handoff only; never re-surfaced. By contrast the flight path renders the offer reference **uncollapsed** in `FareSummary` (`:343-346`). The hotel path is the one that needs it more and hides it.

### 1.6 The flight confirmation is real and non-durable

`app/api/book/route.ts:211-215` returns `bookingReference` and `orderId` with no persistence. `BookingFlow.tsx:1356` holds `bookingRef` in `useState`; `:1419-1444` renders "Booking confirmed" and the reference in mono. One refresh destroys a paid order's only expaify-side record. Confirms discovery §6. Not in scope (§6).

### 1.7 Analytics is a strict double allowlist

`app/api/analytics/route.ts` rejects any event not present in `EVENT_PROPERTIES` (`:12-62`), rejects any property not in that event's set (`:323`), rejects any event missing a key from `REQUIRED_PROPERTIES` (`:317-318`), and validates every value through `validPropertyValue` (`:148-291`). A new event needs **three** registrations, not one.

`awayDurationBucket` is constrained to `['<5s', '5–30s', '30–120s', '120s+']` (`:229`). This is the ceiling on outcome inference (§5.2).

---

## 2. Reference patterns (interaction level)

### 2.1 Booking.com — merchant of record

After checkout Booking.com asserts the reservation, shows a confirmation number and a PIN, and offers **credential-free retrieval**: booking number + PIN reaches the reservation without an account. The transferable pattern is *not* the assertion — Booking.com owns the reservation and expaify does not. The transferable pattern is the **retrieval handle given at the moment of confirmation and repeated in the email**: a short, copyable string plus a stated place to use it.

### 2.2 Google Flights — intermediary that defers completely

Google Flights hands off to the airline or OTA and asserts nothing afterwards. There is no return prompt, no claimed status. Clean on trust, zero on recovery: the traveler who loses the confirmation email gets nothing back from Google. This is expaify's current behaviour for hotels (§1.1), reached by accident rather than by design. It is the safe floor, not the target.

### 2.3 Kayak / metasearch trips — self-declared outcome

Kayak sits in expaify's exact structural position — affiliate handoff, no visibility into the partner's order — and resolves the ambiguity by **asking the traveler**. The record it then creates is labelled by provenance: it is what the traveler said, or what a forwarded confirmation email said, never what the partner told Kayak. Two mechanisms:

- **Self-declaration on return**: "Did you book?" → creates a local trip stub.
- **Email forwarding**: the traveler forwards the partner confirmation to a trips address; the parser extracts the real confirmation number.

### 2.4 The delta

| Dimension | Booking.com | Google Flights | Kayak trips | expaify today |
|---|---|---|---|---|
| Asserts a reservation exists | Yes (owns it) | No | No — traveler asserts | No |
| Return moment exists | n/a (no handoff) | No | Yes | **No — dead prop** |
| Tells traveler what to save | Implicit (owns the record) | No | Yes | No |
| Durable handle survives reload | Yes (number + PIN) | No | Yes (account trip) | **No — 30-min Redis TTL, then a dead end** |
| Repeat visit recognises prior handoff | n/a | No | Yes | No |

expaify is at Google Flights' level of assertion (correct) with none of Kayak's recovery (the gap). The design target is **Kayak's interaction model executed under Booking.com's discipline about provenance** — the traveler declares, expaify records only the declaration and only what expaify itself observed, and the record is retrievable without an account.

---

## 3. Constraints carried forward

1. **expaify must never assert a reservation exists.** It may state only: an offer was shown (with the values it showed), a handoff occurred at a time expaify observed, and what the traveler themselves declared. Every string that could be read as "your booking is confirmed" is out of bounds for hotels.
2. **No new provider calls.** Repair mode. Everything in these directives is buildable from data already in `BookingHotelContext` plus one traveler input.
3. **Non-negotiable contract.** Money stays `{ priceCents, currency }`; any new adapter returns `Result<T>`; `providerUrl` keeps its affiliate marker (`isValidatedAffiliateProviderUrl`, `config.ts:232-240`) on every re-issued link.
4. **375px and keyboard.** The review screen is already dense. The return state must not be appended to the bottom of it (§5.1).
5. **`lib/db/schema.sql` cannot be extended until its merge conflict is resolved** (§1.2). Directives are scoped to require no schema change.

---

## 4. Sequencing dependency (blocking)

The stay record in D4 is meaningless without stay dates, and stay dates need **both** fixes from §1.4. UXDES must specify the dates-present and dates-absent variants of every state; UI must not ship D4's "your stay" language while `HotelDecisionSummary` still hardcodes "Stay dates not provided". Directives D1, D2, D3, D5 have no such dependency and can ship first.

---

## 5. Design directives

### D1 — Render a return state, and render it above the handoff action

**Current:** nothing renders (§1.1). `showReturnPrompt` is set and read by no mounted element.

**Reference:** Kayak's return interstitial takes the top of the viewport and demotes the outbound action; Booking.com's confirmation replaces the checkout surface rather than appending to it.

**Directive:**

- `ReviewShell` must render `hotelSupplement` — or the return state must be moved out of it entirely. Prefer the latter: pass it as `status`, which the hotel branch already renders directly beneath `HotelDecisionSummary` and above `children` (`BookingFlow.tsx:565-567`). This places the return state above the "Check rooms at {partner}" action without restructuring the shell.
- The return state must not be nested inside the smoking-policy supplement. Today the whole block is gated on `policy` being truthy (`:1121`); the return moment must not depend on smoking-policy evidence being present.
- When `showReturnPrompt` becomes true, the state is announced (`role="status"`, `aria-live="polite"`) and focus moves to its heading (`tabIndex={-1}` + `.focus()`), matching the pattern already used by `InvalidHotelState` (`:689-693`) and `focusHotelDocumentRetryStatus` (`:88-96`).
- While the return state is shown, the primary handoff button is demoted to secondary styling and its label changes from "Check rooms at {partner}" to "Open {partner} again". The affiliate `providerUrl` is unchanged.

**Acceptance tests:**

1. Render `HotelHandoffReview`, fire `visibilitychange` → `hidden` → `visible` after a continue click; the return state is present in the DOM. (Fails today.)
2. The return state's DOM position precedes the handoff `<a href={providerUrl}>`.
3. With `hotelContext.smokingPolicy` set to the unavailable fallback, the return state still renders.
4. On appearance, `document.activeElement` is the return state's heading.
5. At 375px no element in the return state overflows its container or overlaps `HotelDecisionSummary`.

---

### D2 — Disambiguate booked from bounced by asking, never by inferring

**Current:** expaify cannot observe the outcome, and the only proxy — `awayDurationBucket` — saturates at `120s+` (`app/api/analytics/route.ts:229`, `getAwayDurationBucket` at `BookingFlow.tsx:998`). A completed hotel checkout and a two-minute rate comparison are the same value.

**Reference:** Kayak asks; Google Flights declines to guess. Neither infers.

**Directive:**

- The return state opens **outcome-agnostic**, with a single heading that is true in both cases and a two-way choice as the only branch. Final copy:
  - Heading: **"Back from {partner}"** (unnamed partner: **"Back from the booking partner"**).
  - Body: **"expaify does not receive your reservation from {partner}. Tell us what happened so we can show you the right next step."**
  - Choice A: **"I booked"** · Choice B: **"I didn't book"**
- `awayDurationBucket` must not gate which branch renders, and must not preselect an answer. It stays an analytics dimension only.
- **"I didn't book"** returns the traveler to the unmodified pre-handoff review screen and restores the primary handoff label. No survey, no upsell.
- **"I booked"** reveals D3's capture checklist and writes D4's stay stub. Every subsequent string is provenance-marked: **"You told us you booked this on {date}. expaify has not confirmed this with {partner}."**
- The existing price-mismatch survey moves to a tertiary link under the "I didn't book" branch, labelled **"Something didn't match on {partner}"**. It keeps `hotel_handoff_return_reason_selected` and its nine existing reasons unchanged (`BookingFlow.tsx:66-76`); it must never be the first thing a traveler who just paid is asked.

**Acceptance tests:**

1. With `awayDurationBucket` forced to each of the four values, the rendered return state is byte-identical.
2. No string in the "I booked" branch asserts the reservation without an adjacent "You told us" or "expaify has not confirmed" qualifier.
3. "I didn't book" restores the pre-handoff screen with the primary button label unchanged from a first visit.
4. The mismatch survey is not reachable in fewer than two interactions from the return state.
5. Both choices are reachable by Tab and activate on Enter and Space.

---

### D3 — A four-field capture checklist, framed as what to save

**Current:** nothing tells the traveler what to record. `HotelCard`'s `RoomRateDetailsPanel` already states that refundability and the cancellation deadline are **not provided by this provider** (`HotelCard.tsx:713-718`) — expaify knows it does not know these, and never converts that into an instruction.

**Reference:** Booking.com's confirmation surfaces exactly the fields a traveler later needs (number, deadline, property phone). expaify cannot show them; it can name them.

**Directive:** on the "I booked" branch, render a checklist headed **"Save these from {partner} now — expaify cannot retrieve them later."** Exactly four items, in this order, each stating who holds it:

1. **Confirmation number** — "On {partner}'s confirmation page and in its email. expaify never receives this."
2. **Cancellation deadline** — "{partner} set this at checkout. expaify was not told the deadline for this rate." (Consistent with `HotelCancellationChoicesUnavailable` and `RoomRateDetailsPanel`.)
3. **Property phone number** — "On {partner}'s confirmation. Use it to reach the property directly."
4. **The email address you used** — "Your confirmation goes there. Check spam if it has not arrived within an hour."

Rules:

- No field is an input. expaify collects none of these values. The checklist is instruction, not a form. (This also keeps the surface clear of the property-contact ticket's scope.)
- Each item is a static line, not a checkbox with persisted state — expaify cannot verify completion and must not imply it has.
- Directly beneath, one line: **"{partner} holds this reservation. expaify cannot look it up, change it, or cancel it."**
- At 375px the checklist is a single column; item text wraps with `[overflow-wrap:anywhere]`, matching `partnerLabelWrapCls` usage on partner labels elsewhere in the file.

**Acceptance tests:**

1. All four items render with the partner name resolved, or with "the booking partner" when `partner.named` is false.
2. No `<input>`, `<select>`, or `<textarea>` exists within the checklist.
3. No item claims expaify holds, has received, or can retrieve any value.
4. At 375px the checklist renders in one column with no horizontal scroll.
5. Screen-reader order is heading → four items → ownership line.

---

### D4 — Durability: a client-owned stay stub, not a bookings table

**Current:** three layers, none durable. `showReturnPrompt`/`feedbackSent` are `useState` (`:934-937`). `handoffAttemptId` is `useMemo(createHandoffAttemptId, [])` — a fresh UUID per mount, so it cannot correlate a return with the handoff that caused it across a reload. The Redis context store expires at 30 minutes (§1.3). No `localStorage`, cookie, or DB write exists on this path.

**Reference:** Kayak's trip stub is created from the traveler's declaration and survives independently of the partner. Booking.com's retrieval handle works without an account.

**Directive:**

- On "I booked", write a **stay stub to `localStorage`** under a versioned key (`expaify.hotelStay.v1`), keyed by `offerId`. Contents are limited to what expaify observed or the traveler declared:
  `offerId`, `provider`, `partnerHost`, hotel `name`, `area`/`location.label`, `priceCents` + `currency` + `priceBasis` (the rate expaify showed — never presented as the amount paid), `providerUrl`, `declaredBookedAt` (ISO), `handoffAttemptId`, and `checkIn`/`checkOut`/`nightCount` **when present**.
- **Do not create a bookings table, an account trips list, or a `/api/account` route in this ticket.** Reasons, in order: expaify holds no reservation, so a server record adds custody of traveler data without adding truth; the surface must work for signed-out travelers, who are the majority on first booking; and `lib/db/schema.sql` cannot be extended until §1.2's merge conflict is resolved. A server-backed record is a follow-up ticket gated on a signed-in-user requirement, not on this one.
- **Do not extend `HOTEL_CONTEXT_TTL_SECONDS`** to cover this. That store's job is to carry a pre-handoff offer across one navigation; lengthening it to hold post-handoff state would put traveler-declared data in a cache with eviction semantics nobody has designed for. Leave it at 30 minutes.
- Cap the store at 10 stubs, evicting oldest by `declaredBookedAt`. Expire a stub 180 days after `checkOut` when dates are present, and 180 days after `declaredBookedAt` when they are not.
- Every render of a stub is provenance-marked (D2) and, when dates are absent, must read **"Stay dates were not provided for this offer."** — never a blank, never an inferred date.
- `localStorage` unavailable (Safari private mode, disabled storage) is a first-class state: the checklist and offer reference still render, plus one line — **"This browser is not saving the stay. Copy the details above before you close this tab."** No error styling; the traveler did nothing wrong.

**Acceptance tests:**

1. Declare "I booked", reload `/book?...` with the same `offerId` → the stub is found and the recognised-return state (D5) renders.
2. With `localStorage.setItem` throwing, the return state still renders fully and the fallback line appears; no unhandled rejection reaches the console.
3. A stub written without `checkIn`/`checkOut` renders "Stay dates were not provided for this offer." and no date placeholder.
4. Writing an 11th stub evicts exactly the oldest.
5. `lib/db/schema.sql` is unchanged by the implementing commit; no `/api/account` route is added.
6. No stored field is a float; `priceCents` is an integer and `currency` a 3-letter code.

---

### D5 — Repeat visit: recognise the prior handoff, and survive an expired reference

**Current:** two failures (§1.3). Inline offers re-render the pre-handoff screen identically to a first visit, inviting a duplicate booking. Reference offers past 30 minutes render `InvalidHotelState` — "We can't identify this hotel", assertive red, single "Back to search" action — for a traveler who may have just paid.

**Reference:** Kayak recognises a returning traveler on a trip it already knows and leads with the record, not the booking action.

**Directive:**

- **Inline path.** On mount, if a stub exists for this `offerId`, the review screen opens in a recognised-return state above everything else: heading **"You told us you booked this stay"**, the declared date, the offer reference (D3/§5.6 relocation), a link to reopen `{partner}`, and the demoted handoff action labelled **"Book this again"** with the line **"You already told us you booked this stay on {date}. Booking again creates a second reservation with {partner}."** The action is never removed — a traveler booking a second room is legitimate.
- **Reference path.** `resolveBookingHotelContext` returning `Hotel booking context expired` must not fall through to `InvalidHotelState` when a matching stub exists. `app/book/page.tsx` cannot read `localStorage`, so this is resolved client-side: when `invalidHotelSelection` is true, `BookingFlow` checks the store for any stub whose `offerId` matches a new `offerId` query parameter (which must be appended to the reference href in `app/api/book/hotel-context/route.ts:22`, alongside `hotelContextRef`), and renders the recognised-return state instead of the dead end.
- When no stub matches, `InvalidHotelState` gains one line before "Back to search": **"If you booked a hotel from this page, your reservation is with the booking partner. Check your email for its confirmation."** No claim, no lookup offered.
- The recognised-return state is announced and takes focus on mount, matching D1.

**Acceptance tests:**

1. With a stub for `offerId`, re-entering the inline `/book` URL renders the recognised-return state; the primary action reads "Book this again".
2. With a stub and an expired `hotelContextRef`, `InvalidHotelState` does not render; the recognised-return state does.
3. With no stub and an expired `hotelContextRef`, `InvalidHotelState` renders with the added email line and keeps its assertive live region.
4. The handoff `<a href>` still carries its affiliate marker in the recognised-return state (`isValidatedAffiliateProviderUrl` passes).
5. At 375px the recognised-return state renders above `HotelDecisionSummary` content without overlap.

---

### D5b — Offer-reference relocation (folded into D1/D3/D5)

The `offerId` moves out of the collapsed `<details>` at `BookingFlow.tsx:1327-1334`. It appears, uncollapsed, in the "I booked" branch and in the recognised-return state, immediately under the capture checklist, using the flight path's already-shipped uncollapsed treatment (`:343-346`) — label, mono value, `break-all`.

Copy: label **"expaify offer reference"**; value `{offerId}`; helper **"Save this with your confirmation. It tells expaify support exactly which rate you were shown — it is not your reservation number."**

The pre-handoff `<details>` may remain for continuity, but its helper text must be corrected to the same wording so a traveler cannot read "offer reference" as a booking reference.

**Acceptance tests:** the reference renders inside an expanded element (no `<details>` ancestor) in both post-return states; its helper text explicitly denies that it is a reservation number; the value is selectable and wraps at 375px.

---

## 6. Out of scope, verified, and worth tickets

1. **`lib/db/schema.sql` has unresolved merge-conflict markers** at `:272`, `:395`, `:408`. The file is not valid SQL. Blocks any future schema work including the server-backed trips record. **P0, DEV.**
2. **`ReviewShell` never renders `hotelSupplement`**, which also drops `TrackedSmokingPolicyPanel surface="review"` from the hotel review screen. D1 fixes the return-state half; the missing smoking-policy panel belongs to `hotel-smoking-policy`. **P1.**
3. **Flight `bookingRef` is non-durable** (`app/api/book/route.ts:211-215`, `BookingFlow.tsx:1356`). A real, paid Duffel order is unrecoverable after one refresh. Confirms discovery §6; a strictly larger problem than the hotel case because expaify *does* hold the record and discards it. **Separate P0 ticket; do not fold into this feature.**
4. **`parseStayContinuity`/`buildBookingHotelContext` continuity is unwired at both call sites, and `HotelDecisionSummary` hardcodes "Stay dates not provided"** (§1.4). Owned by `hotel-booking-handoff-trust`; blocking for D4's dated variant.
5. **`handoffAttemptId` is per-mount** (`BookingFlow.tsx:800`), so `hotel_handoff_viewed` → `hotel_handoff_returned` cannot be joined across a reload. Limits measurement of the metric this ticket names.

---

## 7. Instrumentation to register with the design spec

Each new event needs three registrations in `app/api/analytics/route.ts`: `EVENT_PROPERTIES`, `REQUIRED_PROPERTIES`, and a branch in `validPropertyValue`.

| Event | Properties | Notes |
|---|---|---|
| `hotel_return_state_viewed` | `handoffAttemptId`, `awayDurationBucket`, `stubPresent` (bool) | Fires when D1's state renders. Separates "returned" from "saw something". |
| `hotel_return_outcome_declared` | `handoffAttemptId`, `outcome` (`booked` \| `not_booked`), `awayDurationBucket` | D2. Joining `outcome` against `awayDurationBucket` measures whether duration ever becomes a usable proxy. |
| `hotel_stay_stub_written` | `offerId`, `hasStayDates` (bool), `storageAvailable` (bool) | D4. `offerId` must satisfy the existing `OPAQUE_VALUE` pattern or be hashed. |
| `hotel_repeat_offer_recognized` | `offerId`, `entryPath` (`inline` \| `reference_expired`), `rebooked` (bool) | D5. The double-booking signal the discovery asked for. |

The existing `hotel_handoff_returned` stays unchanged.

---

## 8. Success criteria for UXDES

The design spec is complete when it specifies, for 375px and 1280px, keyboard, and screen reader:

- the return state in both outcome branches, plus its unrendered-today baseline;
- the capture checklist with all four items and both partner-named and unnamed copy;
- the stay stub's dates-present, dates-absent, and storage-unavailable variants;
- the recognised-return state on both the inline and expired-reference paths;
- the relocated offer reference in every post-return state;

and when no string in any state asserts a reservation status expaify has not observed.

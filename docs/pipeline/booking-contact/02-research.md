# UXR-BOOKING-CONTACT-01: Hotel Booking Contact Confidence

**Stage:** UX Research (UXR)  
**Date:** 2026-07-22  
**Priority:** P1  
**Research question:** Immediately before the hotel handoff, what is the minimum truthful model that lets a traveler identify who will confirm and service a completed reservation, distinguish that owner from expaify, and seek help without repeating the existing handoff-trust treatment?

## Executive finding

The proposed two-path model is valid, with one wording refinement: the owner of a completed reservation is **the company that completes/processes the booking**, which may be an online travel agency or the hotel itself—not necessarily the rate source and not always a partner expaify can name before redirect.

The current hotel review already answers where the traveler is going, who takes payment, what the partner rechecks, and that a new tab opens. It does **not** answer who provides the confirmation, who handles a missing confirmation or post-booking changes, what expaify can help with, or where either help path begins. Adding more handoff explanation would duplicate completed work. The repair is a compact, optional **“Who handles my booking?”** disclosure immediately before the outbound action, containing two visibly separate owners and no fabricated partner contact link.

This is a pattern-based and source-code validation, not evidence from an expaify usability study. The directives below therefore include a comprehension gate and privacy-safe behavioral measures rather than claiming demonstrated user comprehension.

## Inputs and method

- Read the exact upstream discovery artifact in `docs/pipeline/booking-contact/01-discovery.md` (restored into this branch from the `UXD-BOOKING-CONTACT-01` output because its integration commit was not an ancestor of this worktree).
- Traced the implemented path from `app/components/HotelCard.tsx` through `buildHotelBookingHref` / `parseBookingHotelContext` in `lib/booking/config.ts` to `HotelHandoffReview` in `app/book/BookingFlow.tsx`.
- Reviewed current handoff tests, the public Terms/Privacy contact language, the analytics primitive, and the prior `booking-handoff-confidence` research/design to exclude already-solved partner identity, price-change, and new-tab questions.
- Compared the service-ownership pattern with current official guidance from KAYAK and Google Travel. These are guidance references, not visual templates.

## Current-code evidence

### End-to-end path

1. A hotel card makes **Review hotel** available only when both the nightly money object and an HTTP(S) deeplink are valid (`app/components/HotelCard.tsx:400-419`, `:490-500`). Its disclosure says the provider confirms totals, taxes, fees, availability, cancellation policy, and terms. It says nothing about confirmation delivery or later support.
2. `buildHotelBookingHref` serializes the selected hotel, integer-cent nightly rate, rate source, location evidence, and the original provider URL into `/book` (`lib/booking/config.ts:360-385`).
3. `BookingHotelContext` contains `providerUrl` and a rate-source string, but no verified support URL, support email/phone, confirmation channel, property contact, or booking-management URL (`lib/booking/config.ts:18-29`, `:276-315`). The UI cannot truthfully render a partner contact channel from current data.
4. `HotelHandoffReview` derives a display label from the outbound host, with an honest generic fallback for opaque redirects such as `tp.media` (`app/book/BookingFlow.tsx:27-84`). It already says **“You’ll book with {Partner}”**, **“{Partner} takes payment”**, lists what expaify shows versus what the partner confirms, preserves `rel="noopener noreferrer sponsored"`, and explains that a new tab opens (`app/book/BookingFlow.tsx:630-689`).
5. Existing tests protect the unresolved and named-partner versions, the unchanged affiliate-bearing URL, the sponsored relationship marker, and the CTA accessible name (`app/book/__tests__/BookingFlow.test.tsx:157-213`).

### Contact and measurement gap

- The hotel handoff has no visible help/control containing “confirmation,” “changes,” “refund,” “missing confirmation,” or expaify’s inability to access a reservation (`app/book/BookingFlow.tsx:643-689`).
- The only public expaify mailbox is `questions@expaify.com`. Terms label it for terms questions; Privacy labels it for privacy requests/questions (`app/terms/page.tsx:45-46`; `app/privacy/page.tsx:38-39`, `:54-55`). The code does not establish that it is monitored for product or hotel-handoff support.
- The flow already emits `hotel_handoff_viewed`, `hotel_handoff_continue_clicked`, `hotel_handoff_back_clicked`, and `hotel_handoff_returned` with non-traveler context (`app/book/BookingFlow.tsx:569-628`, `:653`). It has no help-open or owner-specific contact event.
- `track()` only logs in development and has no production sink (`lib/analytics.ts:1-7`). Event schemas can be specified now, but production engagement cannot yet be measured.

## Reference-pattern guidance

### KAYAK: route by the company that processed the booking

KAYAK’s hotel guidance separates the metasearch product from the reservation owner: the company that processed the booking manages cancellations and refunds; KAYAK cannot access or modify the reservation. For redirected bookings, it tells travelers to use the provider directly, identify that company from the confirmation, card statement, or browser history, and use the confirmation/provider for support. It also reserves its own feedback path for inaccurate prices and partner/site problems. [KAYAK — Booking and checkout](https://www.kayak.com/c/help/bookings/)

**Applicable pattern:** explain both the ownership rule and the recovery method. A generic “contact the provider” instruction is weak when the partner name is unresolved; the traveler also needs to know how to identify the transaction owner after checkout.

**Do not copy:** KAYAK has booking receipts and account-level booking records in some paths. expaify has no equivalent record and must not imply it can retrieve a confirmation.

### Google Travel: two owners, separated by problem type

Google’s hotel-booking guidance makes the merchant the primary contact for confirmation, refunds, cancellations, and reservation/property issues, while routing interface/display or Google Pay issues to Google. It explicitly says Google cannot modify, cancel, or refund the merchant’s reservation. [Google Travel — Book hotels in AI Mode](https://support.google.com/travel/answer/17216079?hl=en)

**Applicable pattern:** make the two paths parallel and problem-specific: transaction/reservation problems go to the booking owner; discovery/handoff defects go to the comparison product.

**Do not copy:** Google’s referenced path completes checkout inside Google and can truthfully promise a merchant email. expaify redirects before checkout and does not know which contact detail or confirmation channel the final merchant will use.

## Exact gap

| Question | Current expaify behavior | Reference behavior | Delta for this ticket |
|---|---|---|---|
| Who completes the booking? | Named/generic partner takes payment. | Transaction owner is explicit. | Already solved; retain, do not restate at length. |
| Who provides confirmation? | Not stated. | Booking/transaction owner provides or controls confirmation. | State partner ownership, but say **provides your confirmation** rather than promise email. |
| Who handles changes, cancellations, refunds, payment, or missing confirmation? | Not stated. | The company that processed the booking is first contact; metasearch cannot access it. | Assign these needs to partner and name expaify’s inability to act. |
| What can expaify help with? | No product-help route on handoff. | Metasearch retains a path for its own display/redirect defects. | Route wrong hotel/deal details or broken handoff to expaify only. |
| How does the traveler contact the owner? | Only checkout CTA; no support data. | Confirmation and provider-owned surfaces contain contact details. | Instruct use of the confirmation or final booking site; never turn the affiliate checkout URL into a “support” link. |
| Can the team measure the question? | Handoff events only; dev-only sink. | Not observable from public patterns. | Add help intent and owner-attributed engagement schema; production sink remains separate. |

## Design directives

### D1 — Add one optional help disclosure directly before the outbound CTA

Place a keyboard-operable disclosure labeled **“Who handles my booking?”** after the existing responsibility facts and before **Continue to {Partner}**. Default is collapsed so the existing partner identity, price boundary, and outbound action remain the primary hierarchy. When open, the control retains focus, exposes `aria-expanded` and `aria-controls`, and reveals both ownership paths in the same reading order at 375px and 1280px.

Do not repeat: who takes payment, final-price volatility, cancellation-policy verification, affiliate disclosure, or new-tab behavior. Those remain in their current locations.

**Testable:** the control is reachable immediately before the outbound CTA in DOM/tab order; Enter and Space toggle it; both owner sections are present in the accessibility tree only in the expanded state; expanding it does not change `providerUrl`, the CTA label, `target`, or `rel`.

### D2 — Make the transaction owner’s responsibilities explicit without promising a channel

Named-partner heading: **“{Partner} manages your reservation”**.  
Fallback heading: **“Your booking partner manages your reservation”**.

Body rule: **“After checkout, {Partner/the booking partner} provides your confirmation and is your first contact for reservation status, changes, cancellations, refunds, payment questions, or a missing confirmation. Use the contact details in your confirmation or on the site where you complete the booking.”**

Use **provides your confirmation**, not “emails your confirmation.” Do not name the property as a third owner, show a phone/email, or link to a guessed `/help` path. If a future provider adapter supplies an explicitly verified support destination, it may appear as a separately attributed partner-help link; a checkout/affiliate deeplink is not a support destination.

**Testable:** for both `booking.com` and opaque `tp.media` URLs, all seven needs—confirmation, status, changes, cancellation, refunds, payment, missing confirmation—are assigned to the transaction owner; neither variant promises email or renders an invented partner contact link.

### D3 — Give expaify a separate, tightly bounded issue path

Second heading: **“expaify helps with the deal and handoff”**.

Body rule: **“Contact expaify if the hotel, price, or booking link shown here looks wrong. expaify cannot access, change, cancel, or refund a reservation completed with the booking partner.”**

The action label must describe the owned problem, e.g. **“Report an expaify issue”**, and must go only to a verified, monitored expaify product-support destination. Do not reuse the Terms or Privacy contact labels as if they were booking support. Product ownership must confirm whether `questions@expaify.com` is appropriate before UXDES assigns it to this action.

**Testable:** expaify display/link defects route to expaify; confirmation, payment, changes, cancellations, and refunds never do. The expaify action contains no offer ID, hotel name, traveler details, confirmation number, full provider URL, or affiliate query in its destination or analytics.

### D4 — Validate comprehension as owner assignment, not sentiment

Before considering the design successful, run a first-click/comprehension check with first-time hotel users after they inspect the review screen. Ask, without showing the answer, where they would go for: (1) missing confirmation, (2) cancellation/refund, (3) unexpected partner charge, and (4) wrong hotel or broken expaify link.

Pass rule: at least **4 of 5 participants** assign items 1–3 to the booking partner and item 4 to expaify, and can say that expaify cannot access or change the reservation. Also test the unresolved-partner fallback; recognition of a brand name alone is not sufficient.

**Testable:** record task-level owner assignment and rationale. Do not use “Do you understand?” or confidence ratings as the primary outcome.

### D5 — Measure help intent and owner-specific engagement without sensitive data

Use the existing non-blocking analytics wrapper and preserve current event names. Add:

| Event | Fires when | Allowed properties |
|---|---|---|
| `hotel_booking_help_opened` | disclosure changes from closed to open | `source`, `partnerHost`, `partnerNamed`, `locationPrecision` |
| `hotel_booking_help_contact_clicked` | a verified owner-specific help link is activated | above + `owner: 'partner' \| 'expaify'`, `destinationType: 'help_center' \| 'mailto'` |
| existing `hotel_handoff_continue_clicked` | outbound booking CTA is activated | add `helpViewed: boolean`; retain existing safe properties |

Do not emit `hotel_booking_help_contact_clicked` for plain instructions or for the checkout CTA. Do not include hotel/guest names, email/phone, offer IDs, confirmation numbers, full/referrer URLs, URL query strings, free text, or raw dwell time.

Derive:

- help intent = unique `hotel_booking_help_opened` / `hotel_handoff_viewed`;
- contact engagement by owner = unique contact clicks grouped by `owner` / help opens;
- help-to-handoff continuation = continue clicks with `helpViewed=true` / help opens;
- unresolved diagnostic sessions = help opens with no owner-contact click and no continue/back event, treated as a diagnostic signal rather than proof of abandonment.

**Testable:** analytics failures never prevent disclosure toggle, contact navigation, or checkout navigation. Events remain development-only until a production sink is separately approved.

## State and edge-case implications for UXDES

- **Named partner:** interpolate only the already-resolved display label; do not infer a support domain from it.
- **Opaque/unknown partner:** use “your booking partner” and the “site where you complete the booking” recovery instruction.
- **No verified partner support destination:** instruction only; no disabled, empty, or guessed link.
- **No verified expaify product-support destination:** this is a content/operations dependency, not permission to point at Terms/Privacy or fabricate a route.
- **Mobile 375px:** keep two owner blocks stacked and the outbound CTA fully visible after the disclosure; no side-by-side comparison is required.
- **Desktop 1280px:** owner blocks may sit side by side, but partner remains first in DOM order.
- **Keyboard/screen reader:** disclosure state is announced; contact links have owner-specific names; the outbound CTA remains the next primary action.

## Scope and contract check

- No external API/provider work is needed for the minimum truthful version.
- Do not alter the affiliate-bearing `providerUrl`, outbound relationship markers, or safe-link validation.
- Do not add property contact, booking status, reservation lookup, case management, or in-expaify hotel booking.
- Money remains integer minor units and no sensitive booking data enters analytics.
- The directives extend the completed handoff-confidence treatment; they do not redesign partner identity, price/policy honesty, or new-tab behavior.

## Blockers and out-of-scope findings

1. **UXDES dependency — expaify contact ownership:** the repository has no verified product-support destination. `questions@expaify.com` is publicly present but labeled only for Terms/Privacy. A product/operations owner must confirm a monitored destination before an actionable **Report an expaify issue** link can be specified or implemented.
2. **Out of scope — partner support deeplink:** `BookingHotelContext` has no verified support URL. Adding one requires a provider/data contract and must not be inferred from the affiliate checkout URL.
3. **Out of scope — production analytics:** `track()` has no production sink. This brief defines safe event semantics only.
4. **Pipeline integration repair:** the discovery report existed in commit `82f165b` but was absent from this ticket branch. It was restored unchanged so downstream stages have the required artifact.

## Handoff

Ready for **UXDES-BOOKING-CONTACT-01**. UXDES should specify the collapsed/expanded disclosure, named and unresolved partner copy, both owner blocks, the no-partner-link state, mobile/desktop/focus behavior, analytics semantics, and the expaify-contact dependency without changing the current outbound handoff contract.

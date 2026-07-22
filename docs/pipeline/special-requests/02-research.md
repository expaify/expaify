# UXR-SPECIAL-REQUESTS-01: Hotel Special-Request Expectations

Date: 2026-07-22  
Stage: UX Research  
Priority: P1  
Upstream: `docs/pipeline/special-requests/01-discovery.md`

## Research question

At expaify's hotel review-to-provider boundary, can a guest understand where to
make a quiet-room, high-floor, early-check-in, or multi-room proximity request
and distinguish **selected**, **transmitted**, **acknowledged**, and
**guaranteed**—without expaify implying that it books a room or communicates with
the property?

## Executive finding

No. The current handoff has no request surface and no request guidance. More
importantly, it has no technical means to transmit or observe a request: expaify
passes a hotel-level affiliate URL to an external partner and never creates or
retrieves a hotel order.

The safe repair is therefore **expectation-setting and provider-directed
guidance, not a selectable request form**. At the current boundary, a checkbox
could prove only local selection; it could not prove transmission. UXDES should
tell guests to add the request on the booking partner's site and confirm it with
the property, with the non-guarantee in the same content block before the
outbound CTA.

Richer providers validate the underlying pattern but not the current
implementation. Booking.com's Demand API accepts an optional free-text
`special_requests` value only during order creation and explicitly marks it as
not guaranteed; it models estimated arrival hour separately. Expedia Rapid can
store/change a special request on a completed itinerary and offers post-booking
property messaging. Those are **booking-lifecycle capabilities**, not features
of a search affiliate link. They provide a future adapter path, not permission
to imply delivery today.

## Inputs and method

### Current-code evidence read in this worktree

- `app/components/HotelCard.tsx` — hotel result and **Review hotel** entry point.
- `app/book/BookingFlow.tsx` — hotel review, partner identity, external CTA, and
  handoff analytics.
- `lib/booking/config.ts` — `BookingHotelContext`, validation, URL parsing, and
  construction.
- `lib/types.ts` — `HotelOffer`, `HotelProvider`, and `Result<T>` contracts.
- `lib/providers/hotellook.ts` — the only hotel provider implementation.
- `lib/providers/bookingComRapidApi.ts` — despite its name, flight-only and
  unmapped; it supplies no hotel-order capability.
- `lib/analytics.ts`, `app/components/TrackOnMount.tsx`, and
  `app/book/__tests__/BookingFlow.test.tsx` — event behavior and test evidence.
- `docs/pipeline/hotel-access-requirements/02-research.md` — reused certainty
  boundary: a room preference is requestable unless a selected room/rate or an
  explicit property response proves otherwise.

### External reference patterns

Only interaction and service-contract patterns were compared; visual styling
was not copied.

1. **Booking.com Demand order preview/create.** The traveller first has selected
   products and guest allocation, then supplies arrival information or an
   optional special request during order creation. The API documents the special
   request as not guaranteed. It treats `estimated_arrival_time` as a separate
   structured field, preventing arrival notice from being mislabeled as approved
   early check-in. Booking.com also documents contiguous rooms as a free-text
   request only in a multi-room allocation flow. Sources: [Create your
   orders](https://developers.booking.com/demand/docs/orders-api/order-preview-create)
   and [Occupancy and allocation use
   cases](https://developers.booking.com/demand/docs/accommodations/occupancy-use-cases).
2. **Expedia Rapid post-booking servicing.** A special request belongs to a room
   on an existing itinerary and can be updated as a soft change. The Property
   Message Center is offered after booking so the guest can ask or reconfirm with
   the property; property messages can include early-check-in information.
   Sources: [Itinerary
   history](https://developers.expediagroup.com/rapid/lodging/manage-booking/itinerary-history)
   and [Property Message
   Center](https://developers.expediagroup.com/rapid/lodging/manage-booking/property-message-center?locale=en_US).
3. **Current-provider viability.** Travelpayouts states that the Hotellook API
   was fully disabled on October 20, 2025, and requests now error; Hotellook
   landing pages were also disabled. The present adapter can therefore supply
   neither a reliable handoff nor request delivery. Source: [Travelpayouts FAQ on
   the closure of
   Hotellook](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook).

No participant sessions or production behavior dataset were available in this
stage. Candidate priority below is a **desk-research hypothesis**, not a claim
about observed expaify demand. The validation protocol in this brief is required
before calling the set user-validated.

## Current implementation audit

### 1. The result card provides no request information

`HotelCard` validates only money and a safe booking URL, then builds the internal
review link (`app/components/HotelCard.tsx:400-419`). The CTA is **Review hotel**
(`:486-500`). Neither collapsed nor expanded content mentions requests, where to
make one, or how to confirm one. The card does correctly defer room availability
and other final terms to the provider, but that generic deferral does not answer
the request question.

### 2. The hotel review is a transparent redirect, not a booking step

`HotelHandoffReview` shows hotel/rate facts and separates what expaify shows from
what the booking partner confirms (`app/book/BookingFlow.tsx:643-669`). The
outbound anchor preserves the provider URL, opens a new tab, and is marked
`sponsored` (`:670-684`). expaify takes no payment and creates no hotel order.

This surface is the right place for request expectations because it is the last
expaify-controlled decision point. It is the wrong place to imply that checking
a preference changes the external reservation.

### 3. The context cannot express eligibility, delivery, or response

`BookingHotelContext` carries hotel/offer identity, provider, optional location,
integer-cent nightly price, currency, price basis, and provider URL
(`lib/booking/config.ts:18-29`). Parsing and validation preserve only those
fields (`:276-337`); `buildHotelBookingHref` forwards the same hotel-level data
(`:360-380`). There is no check-in/out, room count, selected room/rate product,
request ID/value, request status, order ID, property contact, or message thread.

Consequences:

- **Rooms near each other is ineligible today** because a multi-room stay cannot
  be established.
- **Early check-in cannot be contextualized** because neither stay date nor
  standard check-in time is present.
- No state beyond **selected locally** could be represented even if UI state were
  added.

### 4. The provider contract is search-only

`HotelProvider` exposes only `searchHotels(area, range)` returning
`Result<HotelOffer[]>` (`lib/types.ts:179-186`). `HotellookProvider` calls a thin
search cache endpoint and builds a hotel landing-page affiliate redirect
(`lib/providers/hotellook.ts:396-490`). It has no create-order, update-request,
retrieve-order, or property-message method. The similarly named
`bookingComRapidApi.ts` implements `FlightProvider`, not hotel booking.

Provider conclusion: **current capability = provider-directed only**. There is
no supported parameter to append to the affiliate URL and no receipt that could
prove transmission. Do not add query parameters to the attributed URL unless a
future provider contract explicitly documents them.

### 5. Existing analytics are more complete than discovery implied, but not live

The handoff already emits:

- `hotel_handoff_viewed` on mount;
- `hotel_handoff_continue_clicked` on external CTA activation;
- `hotel_handoff_back_clicked` when the guest goes back before continuing; and
- `hotel_handoff_returned` after a hidden/visible tab cycle, with coarse duration.

These are implemented at `app/book/BookingFlow.tsx:569-628` and asserted in
`app/book/__tests__/BookingFlow.test.tsx:238-317`. However, `track()` only calls
`console.debug` in development (`lib/analytics.ts:1-7`). The events therefore
define useful denominators but produce no production baseline. Also, none records
request guidance, selection, request capability, or support intent.

## Reference-pattern delta

| Decision point | Established booking pattern | expaify now | Exact delta |
|---|---|---|---|
| When requests appear | After stay/room/allocation is selected, within order creation or post-booking servicing | Before any external room/rate is selected; no order exists | A request form here would be premature and unbound to inventory |
| Request shape | Optional free text in provider contract; arrival time is separate; contiguous-room request requires multi-room allocation | No request or arrival field; no room count | The proposed local structured set has no transmission mapping today |
| Non-guarantee | Paired with the request at entry | No request copy | Add explicit availability/non-guarantee copy in the same pre-CTA block |
| Delivery evidence | Successful order/update can evidence provider receipt; itinerary can retain the request | Only an outbound-link click is observed | Continue-click must never be relabeled as request sent |
| Property follow-up | Post-booking property contact/message action | No contact/help action or contact data | Explain where to confirm; never invent a direct-property link |

## Candidate request set: scope and priority

The constrained set is appropriate as a research stimulus because all four are
non-sensitive preferences, not room inventory. It is **not yet appropriate as an
interactive expaify control**.

| Priority for validation | Canonical ID | Why keep it | Provider feasibility and guardrail |
|---|---|---|---|
| 1 | `early_check_in` | Time-dependent and consequential: failure can leave a guest without room access | Keep separate from estimated arrival time. Arrival notice is not approval for early access. Always request-only until the property explicitly confirms |
| 2 | `quiet_room` | Clear room-assignment preference and understandable without collecting a reason | Maps only to a provider's supported special-request field; never infer quietness or guarantee placement |
| 3 | `high_floor` | Clear, bounded assignment preference | Maps only to a supported special-request field; never display a floor number or imply inventory |
| 4, conditional | `rooms_near_each_other` | Relevant to groups and explicitly supported as a request pattern by Booking.com | Render only when provider-backed `roomCount > 1`; “near” is not “connecting.” Current context makes it ineligible |

This ranking prioritizes consequence and semantic clarity, not measured
frequency. In 8–12 task-based sessions, recruit at least four participants who
have previously made a hotel request and at least four who have booked multiple
rooms or arrived before standard check-in. Ask each participant to rank the four
needs, name anything essential that is missing, and explain whether each is a
preference or a booking requirement. Keep a request only if at least 6 of 8 (or
75% in a larger sample) classify it correctly as a non-binding preference and at
least three participants identify a plausible past/future use. Do not expand the
MVP from open-ended answers; route accessibility/medical, bed/occupancy, amenity,
and policy needs to their owning tickets.

## Four-state truth model

UXDES must treat these as progressive evidence, not synonyms:

| State | Minimum evidence | Permitted user-facing meaning | Forbidden implication |
|---|---|---|---|
| **Selected** | Guest activates a local preference control | “Selected in expaify” | Sent to provider/property |
| **Transmitted** | A provider adapter successfully submits a documented request field against a selected order/product and stores a provider receipt/order reference | “Sent to booking provider” | Property saw, accepted, or will honor it |
| **Acknowledged** | Provider/property response explicitly confirms receipt or answers the request | “Property replied” or “Property received the request,” matching the response | Guaranteed assignment unless the response explicitly guarantees it |
| **Guaranteed** | Selected room/rate contract includes the attribute, or an explicit property response promises it for this reservation | “Confirmed for this stay” | A generic 200 response, stored request text, or silence is sufficient |

At the current `provider_directed_only` capability, expaify occupies **none** of
these states because no selection is recommended. If a future local control is
approved before transmission exists, its visible state must say **Selected here
only — not sent** and it must not survive into analytics as a sent request.

## Comprehension protocol and thresholds

Test the exact UXDES copy at 375px and 1280px with 8–12 first-time participants.
Use two prototypes:

- **A — current-capability handoff:** guidance only, followed by the provider CTA.
- **B — future provider-backed example:** one selected preference with an
  explicit transmission status. This tests the four-state vocabulary without
  authorizing implementation.

After each task, ask these questions without leading language:

1. “What, if anything, did you choose on expaify?”
2. “Has expaify sent anything? If yes, to whom?”
3. “Has the property responded?”
4. “Is this room arrangement guaranteed for your stay? What tells you that?”
5. “What would you do next to improve the chance that the request is honored?”

Score each state separately:

| State tested | Pass | Fail |
|---|---|---|
| Selected | Says no selection in A; identifies only the visibly selected preference in B | Invents a room/attribute selection |
| Transmitted | Says not sent in A; in B repeats the shown recipient/status only | Treats CTA click, local selection, or saved text as sent |
| Acknowledged | Says no response unless a property/provider response is shown | Treats transmission or generic booking confirmation as acknowledgement |
| Guaranteed | Says not guaranteed unless selected inventory or an explicit promise is shown | Treats selected, sent, received, “requested,” or “subject to availability” as guaranteed |
| Next step | Says add it on the partner site and/or confirm with the property | Believes no confirmation is needed or expects expaify to resolve it |

Ship threshold: at least **90% correct on every state**, **zero false-guarantee
answers**, and **zero false-transmission answers** in A. With 8 participants,
that operationally means 8/8; with 10–12, one error still fails the zero-error
guardrails. Iterate copy and retest any failed state before implementation.

## Design directives for UXDES

### D1 — Use guidance, not controls, for the current capability

Add one compact **Special requests** block to `HotelHandoffReview`, after the
expaify/partner responsibility comparison and immediately before the external
CTA. Do not add checkboxes, chips, a text box, a save action, or a success state.
The block must name the currently eligible examples—quiet room, high floor,
early check-in—and convey all three rules in one reading unit:

1. add the request on the booking partner's site;
2. availability determines whether it can be honored; and
3. confirm with the property after booking.

The persistent semantic test is: replacing the CTA click with no action must not
change any request status in expaify.

### D2 — Never show multi-room proximity without verified room count

Omit **rooms near each other** in the current design because
`BookingHotelContext` has no room count. A future design may show it only for a
provider-backed selection with `roomCount > 1`. Use “rooms near each other,” not
“connecting rooms,” and retain the request/non-guarantee qualifier.

### D3 — Pair state and certainty; never rely on a global disclaimer

If a future provider capability enables a control, every selected request must
carry its adjacent delivery label from the four-state model. The non-guarantee
must remain adjacent to the request/status and before the CTA; it cannot live
only in a tooltip, modal, terms link, aria label, or footer. A check mark may mean
selected only when the nearby text explicitly says so.

### D4 — Provide qualified follow-up without inventing support

The current handoff has no property contact details and no expaify support route.
The block should therefore direct the guest to the partner's post-booking
confirmation or itinerary for property contact. If UXDES adds **How requests
work**, it must expand inline, remain keyboard operable, and explain selected vs
sent vs confirmed; it must not imply expaify can contact the property. Do not add
a dead **Get help** or **Contact hotel** action.

### D5 — Preserve handoff priority and accessibility

The primary action remains **Continue to {partner}**; request guidance is
secondary and never blocks continuation. At 375px it must form one vertical
reading sequence before the full-width CTA; at 1280px it remains inside the
existing right-hand handoff panel. The heading, explanatory text, any inline
disclosure control, CTA, and Back action must follow DOM/tab order. Do not encode
request state with color or icon alone.

## Measurement specification

Production measurement depends on replacing the development-only analytics
adapter with an approved sink; this ticket does not choose or implement one.
Events must avoid free text, reason-for-request, medical/accessibility data,
property contact content, raw URLs, or provider messages. Fixed request IDs from
the approved set are permitted.

### Event contract

| Event | Trigger | Allowed properties |
|---|---|---|
| `hotel_request_guidance_viewed` | Guidance is at least 50% in viewport for 1 continuous second, once per review view | `source`, `partnerHost`, `capabilityState` (`provider_directed_only` / `transmit_supported`), `eligibleRequestCount` |
| `hotel_request_help_opened` | Guest opens **How requests work** | `source`, `partnerHost`, `capabilityState` |
| `hotel_request_selected` | Future-only: a request changes unselected → selected | `requestId`, `capabilityState`, `eligibleRequestCount` |
| `hotel_request_cleared` | Future-only: selected → unselected | `requestId`, `capabilityState` |
| `hotel_request_handoff_continued` | Existing provider CTA activates after guidance-view event | `source`, `partnerHost`, `capabilityState`, `selectedRequestCount`, `guidanceSeen: true` |
| `hotel_request_contact_intent` | Guest activates an approved provider/property-contact instruction or action | `destination` (`partner_itinerary` / `property` / `request_help`), `capabilityState` |

Do not fire `hotel_request_selected` in the guidance-only MVP. Continue to emit
the existing `hotel_handoff_*` events; the request events supplement rather than
rename them. `partnerHost` remains hostname-only and the affiliate URL remains
untouched.

### Metric definitions

1. **Request usage** (future control only): unique hotel-review views with at
   least one `hotel_request_selected` / unique hotel-review views eligible for a
   request control. Report overall, by fixed `requestId`, and by
   `capabilityState`. For the guidance-only MVP, label this metric **not
   available**, not 0%.
2. **Expectation mismatch:** primary measure is the comprehension-test failure
   rate for transmitted, acknowledged, and guaranteed questions. Production
   proxy is the share of request-related support cases tagged
   `expected_sent`, `expected_acknowledged`, or `expected_guaranteed`; the tag is
   an agent classification, never inferred from a provider not honoring a
   request. No baseline exists.
3. **Qualified handoff:** unique `hotel_request_handoff_continued` / unique
   `hotel_request_guidance_viewed`, segmented by capability state and (future)
   zero vs one-or-more selected requests. A handoff without the one-second
   guidance exposure is unqualified and reported separately; do not optimize
   away the comprehension guardrail to increase clicks.
4. **Support-contact intent:** unique review views with
   `hotel_request_contact_intent` or `hotel_request_help_opened` / unique
   `hotel_request_guidance_viewed`, segmented by destination. Opening education
   is not evidence of confusion by itself; pair the rate with comprehension
   results and pre-handoff exits.

Dashboard guardrails: report false-transmission and false-guarantee comprehension
separately; never collapse them into a single average. No production lift claim
is valid until a real analytics sink, session-safe deduplication, and event QA
are in place.

## Blockers and out-of-scope findings

1. **Current hotel supply is broken upstream.** Travelpayouts confirms Hotellook
   search and landing pages were disabled in 2025, while the repo still treats
   `engine.hotellook.com/api/v2/cache.json` as the live hotel source. This is an
   existing provider repair outside this UXR ticket, but it makes request
   transmission impossible and may make the provider CTA unreliable.
2. **No production analytics sink.** Event calls exist, but `track()` is
   development-only. Measurement can be specified now but not collected.
3. **No property contact route.** expaify has neither a booking itinerary nor
   property contact data. UXDES may provide accurate provider-directed
   instructions only.
4. **No observed user-demand baseline.** The candidate ranking is a research
   hypothesis pending the 8–12 participant protocol above. Do not describe it as
   behavioral validation.
5. **Adjacent scopes remain excluded.** Accessibility/medical needs,
   room/occupancy/bed fit, amenities, cancellation, and guaranteed room features
   stay with their existing pipeline work. No free-text request collection is
   recommended.

## Handoff

Ready for `UXDES-SPECIAL-REQUESTS-01`. The design stage should specify the
guidance-only `HotelHandoffReview` block for default, unknown partner, malformed
handoff recovery, 375px, 1280px, keyboard/focus, and optional inline-help states;
use the four-state model for comprehension fixtures, but do not design a live
request selector until a provider-backed transmission contract exists.

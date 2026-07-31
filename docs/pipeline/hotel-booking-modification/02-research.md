# UXR-HOTEL-BOOKING-MODIFICATION-01: Hotel booking modification expectations

Date: 2026-07-31  
Stage: UX Research  
Priority: P1  
Input: `docs/pipeline/hotel-booking-modification/01-discovery.md`

## Research decision

Advance the Tier 1/Tier 2 model to UX Design with one qualification: desk research
validates it as the safest information architecture, but not yet as a
comprehension result. The current expaify surface does not meet the Tier 1 bar.
Its owner boundary is optional, its primary policy sentence names cancellation
but not modification, and it gives no compact consequence cue for date, guest,
or room changes before the outbound action.

Tier 1 should therefore be an always-visible, provider-agnostic expectation cue
immediately before the hotel handoff action. Tier 2 remains unavailable in the
current contracts and must not be simulated in copy or UI. Correct-owner
comprehension for all three change types must pass the formative protocol in
this brief before the design is treated as validated.

This remains a handoff repair. It does not authorize reservation retrieval,
change submission, a manage-booking destination, or a post-booking portal.

## Questions and evidence standard

This brief answers four questions:

1. Does the current rendered hierarchy expose owner, consequence, and
   confirmation-artifact cues before the traveler leaves?
2. Do reference patterns support one generic “changes” rule, or do dates, guest
   details, and room changes require separate expectations?
3. Is Tier 1 sufficient for honest expectation-setting when selected-rate
   modification evidence is unknown?
4. What minimum cue set and comprehension threshold should gate UXDES?

“Current implementation” below means direct evidence from this worktree.
“Reference pattern” means external guidance that informs interaction design but
does not establish an expaify capability or a promise for any expaify offer.

## Current implementation audit

### Rendered order at 375px and 1280px

For hotel handoffs, `ReviewShell` uses one vertical sequence at both viewport
sizes (`app/book/BookingFlow.tsx:511-549`). The `sm:` classes change padding and
type size, but do not create a desktop sidebar. Before reaching the outbound
card, the traveler passes:

1. back to results;
2. hotel identity/location;
3. observed nightly rate and Deal Score;
4. hotel fit;
5. **Check rooms with provider**.

Inside **Check rooms with provider**, source order is identical at 375px and
1280px (`app/book/BookingFlow.tsx:1138-1182`):

1. generic provider duties and cancellation-policy sentence;
2. transport guidance;
3. collapsed **Who handles my booking?**;
4. collapsed loyalty disclosure;
5. room-view confidence disclosure;
6. mandatory-fee warning;
7. full-width outbound CTA;
8. new-tab helper.

The ownership trigger is a 44px-minimum full-width button with `aria-expanded`,
`aria-controls`, a visible focus ring, and retained trigger focus. This is a
sound keyboard pattern (`app/components/HotelBookingOwnership.tsx:54-73`). Its
closed state, however, reveals only the question **Who handles my booking?**; no
owner or limitation is visible without activation.

When expanded at 375px, the two ownership cards stack. At 1280px they form two
columns from the `sm:grid-cols-2` breakpoint
(`app/components/HotelBookingOwnership.tsx:76-109`). The first card says the
partner supplies the confirmation and is first contact for all “changes.” The
second says expaify cannot access, change, cancel, or refund the reservation.
Neither card distinguishes date changes, detail corrections, occupancy changes,
room/rate changes, or property requests.

The **Special requests** explanation appears later in the separate **Supporting
evidence** card, after rate restrictions, transport, parking, traveler readiness,
and optional document readiness (`app/book/BookingFlow.tsx:1184-1268`). It
correctly says a request is not guaranteed and directs the traveler to the
property using the confirmation. Because this guidance is separated from the
owner disclosure and CTA, a traveler can reasonably merge “change room” with
“ask the property for a preferred bed/high floor” even though the code intends
them to be different.

### What the code can and cannot know

| Evidence family | Current code evidence | Research implication |
| --- | --- | --- |
| Selected handoff | `BookingHotelContext` carries offer/provider, hotel, integer-cent rate, provider URL, and optional stay dates (`lib/booking/config.ts:70-98`). | Enough to preserve known shopping context, not to service a completed booking. |
| Modification policy | No modification capability, outcome, deadline, fee, rebooking rule, or servicing destination exists in `BookingHotelContext`, `HotelOffer`, or `HotelProvider` (`lib/booking/config.ts:70-98`; `lib/types.ts:625-694`). | Every change type is `unknown`; any “changeable,” fee, deadline, or direct-route claim would be invented. |
| Confirmation | Document readiness can represent whether a booking confirmation is supplied, but no completed booking reference or confirmation-owned manage/support route is stored. | The UI may tell travelers what to retain, but cannot route them after booking. |
| Partner name | Known domains are mapped, but `getHotelPartnerIdentity` also turns an arbitrary parseable non-opaque host into a display label and `named: true` (`app/book/BookingFlow.tsx:102-154`). | UXDES must specify a true unresolved state. It must not assume `named: true` is verified partner identity. Repairing identity resolution is a separate DEV concern. |
| Special request | Existing copy says expaify sends nothing and the property must confirm fulfillment (`app/book/BookingFlow.tsx:1241-1268`). | Preserve this distinction; it is not evidence that a reservation room/rate can be changed. |

### Exact experience gap

| Moment | Current expaify behavior | Reference-supported behavior | Delta |
| --- | --- | --- | --- |
| Before payment | Says the provider will show cancellation policy and terms. | Exposes rules/restrictions before booking and ties change permission/cost to those terms. | Name modification explicitly and state its possible consequences without claiming allowability. |
| Before outbound handoff | Owner boundary is collapsed; CTA can be used without reading it. | Makes the booking record/confirmation or authenticated trip the route into management. | Put the owner, expaify limitation, and confirmation-artifact cue in the default path before CTA. |
| Date change | One generic “changes” label. | Checks policy, availability, and current price; some rates cannot change and may require cancellation/rebooking. | Separate date expectations from cancellation and from other edits. |
| Guest details | One generic “changes” label. | Treats guest-name/allocation edits as room-level operations with rate/occupancy constraints. | Separate a spelling/contact correction from lead-guest or occupancy change. |
| Room selection | Special-request copy and generic owner copy live apart. | Separates room-reservation changes from preferences/requests; fulfillment is conditional. | Explicitly distinguish changing the booked room/rate from requesting a feature. |
| After booking | No expaify reservation or route; expanded copy says use confirmation/site. | Routes from a confirmation, account/trip, order/reservation ID, or support surface owned by the booking party. | Tell users to retain partner name, booking reference, and management/support instruction; do not invent a link. |

### Measurement reality

The client emits `hotel_booking_help_opened`, but that event is absent from the
internal API allowlist (`app/api/analytics/route.ts:10-48`). It therefore does not
persist to the stated first-party sink. The handoff events that are allowlisted
also receive extra properties such as `policyState`, `obligationTypes`,
`invoiceNeeded`, and `helpViewed` that the same allowlist does not accept
(`app/book/BookingFlow.tsx:961-987` versus
`app/api/analytics/route.ts:37-43`). Production disclosure-open and continuation
data must be reported as unavailable, not as zero. This UXR ticket does not
repair analytics.

Even after instrumentation repair, disclosure opens and CTA clicks are attention
signals, not proof of correct-owner comprehension. The research gate below is
required.

## Reference-pattern findings

### Booking.com: confirmation-led management, separated change types

Booking.com's consumer FAQ says booking changes are initiated from the
confirmation email or Booking.com and lists dates, guest details, bed type, room
type, added rooms, requests, and property contact as distinct operations. It also
says availability depends on property policy; non-refundable date changes may be
impossible; policy appears during booking and in the confirmation; and property
requests are not guaranteed. This supports a confirmation-led route and rejects
a single undifferentiated “changes are allowed” claim.

Its current Demand API documentation makes the separation even clearer: dates
and room-level details are different modification types; room-level details
include guest names and allocation; date changes can return a new price; changes
should be checked against availability; fixed occupancy can block guest-count
changes; and cancellation/rebooking may be required. This API is not expaify's
provider contract and grants expaify no capability. It is useful only as pattern
evidence that scope and consequence must be bound to the actual reservation and
change type.

Sources: [Booking.com consumer FAQ](https://secure.booking.com/faq.en-us.html),
[Booking.com order modification guide](https://developers.booking.com/demand/docs/orders-api/order-modify),
[Booking.com order FAQ](https://developers.booking.com/demand/docs/orders-api/orders-faqs).

### Expedia: rules before booking, owned trip/help route after booking

Expedia's Help Center places **Manage your bookings** behind sign-in and routes
travelers to customized help. Its current terms say provider rules and
restrictions are presented before booking; a change is not an automatic right;
the provider may disallow it or charge fees; a changed arrangement uses the
price applicable when the change is requested; and the booking confirmation is
part of the booking record. Expedia can route its own customers because it owns
the trip/help relationship. expaify cannot borrow that route after redirecting
checkout to another company.

Sources: [Expedia Help Center](https://www.expedia.com/helpcenter),
[Expedia Terms of Service, sections 1, 3, and 5](https://www.expedia.com/lp/b/terms-of-service).

### Pattern synthesis, not visual imitation

Both references reinforce four interaction principles:

- policy is scoped to the selected booking, not to “hotels” generally;
- dates, guest/occupancy details, and room/request changes are distinct;
- a change can affect availability, price, fees, taxes, or require a new booking;
- the post-booking route starts from the booking party's record—confirmation,
  trip/account, reservation ID, or its support surface.

They do **not** justify copying a manage-booking CTA, naming a property as the
default owner, or claiming that any expaify result can be changed.

## Validated expectation model

### Tier decision

**Tier 1 is necessary and sufficient for this repair.** It can truthfully set
expectations using only identity state, selected shopping context, the outbound
handoff, and an explicit unknown policy state. Tier 1 must not imply that the
traveler has a reservation yet.

**Tier 2 is correctly bounded but unavailable.** The discovery's proposed scope,
provenance, per-change outcomes, monetary consequences, staleness/conflict
handling, confirmation issuer, and provider-supplied service destination are the
minimum evidence for a positive or specific modification claim. No current type
supplies them. UXDES may specify how verified Tier 2 would replace Tier 1 in a
future state, but must not render example positive claims in the shipped Tier 1
surface.

### Correct owner by change type

| Change type | Correct pre-payment expectation | First owner after checkout | Critical distinction |
| --- | --- | --- | --- |
| Dates | Check selected rate terms; new dates can require availability, a current price, taxes/fees, or cancellation/rebooking. | The company named in the confirmation as booking manager; follow a different owner only when that confirmation explicitly directs it. | Cancellation flexibility does not prove date-change support. |
| Guest details | Verify spelling, lead guest, contact, and occupancy at checkout; support for later edits is unknown. | Confirmation-designated booking manager first. Property only when the confirmation/manager directs the traveler there. | A spelling/contact correction is not equivalent to replacing the lead guest or changing occupancy. |
| Room selection | Verify exact room/rate and whether required features are guaranteed before payment. | Confirmation-designated booking manager for room/rate record changes. Property only for fulfillment or when explicitly designated. | A bed/view/high-floor request is a preference, not a confirmed room/rate change. |

If the confirmation supplies no usable owner or route, the correct answer is
“the servicing route is unknown; use the site where checkout was completed or
the confirmation issuer's official support.” It is never “ask expaify to change
it,” and an opaque redirect host must not be promoted to a verified owner.

## Minimum pre-handoff cue set

The smallest candidate that contains every fact required for safe prediction is
one always-visible block in the primary handoff card, after fee/other selected
offer warnings and immediately before the outbound CTA. It needs exactly three
semantic parts:

1. **Scope:** “Before payment, check the selected rate and room terms for date,
   guest, and room changes.”
2. **Consequence:** “A change may depend on availability and may change the
   price, taxes, or fees, or require cancellation and rebooking.”
3. **Owner and artifact:** named state—“After booking, use your [Partner]
   confirmation for the booking reference and change or support instructions.
   expaify cannot change the reservation.” Unresolved state—replace `[Partner]`
   with “booking partner”; do not generate a brand from the redirect host.

The heading should be **Changes after booking**. These sentences are copy rules
for the candidate test, not evidence that a change is supported. Do not add a
manage link, a generic partner home-page link, a fee/deadline, or “contact the
property” to this minimum block.

The existing ownership disclosure may remain for the fuller division of
responsibility, but passing the test must not depend on opening it. The existing
special-request explanation should remain separate and should not be repeated
inside the minimum block.

## Formative comprehension protocol

### Method and sample

Run a moderated remote within-subject study with **18 hotel bookers** who have
changed or considered changing a stay in the last 24 months. Include at least
six mobile-first bookers, six travelers who have booked for another person or
multiple guests, and six who have selected a room for a required bed/access
feature; quotas may overlap.

Each participant sees the Tier 1 candidate at both 375px and 1280px across three
counterbalanced scenarios. Use a Latin-square order so each scenario appears
equally often first. Do not expose real confirmation data.

| Scenario | Handoff identity | Synthetic confirmation condition | Change prompts |
| --- | --- | --- | --- |
| A: partner-owned | Verified display name | Names the booking partner and supplies booking reference + manage/support instruction | dates, guest-name correction, booked room/rate change |
| B: explicitly redirected | Verified display name | Directs the traveler to the property for one request/fulfillment task while retaining the partner for reservation record changes | dates, occupancy/lead-guest change, bed/view request |
| C: unresolved | “booking partner” fallback | Supplies a booking reference but no usable servicing route | dates, guest contact-detail correction, room-type change |

For every prompt ask: (1) where would you go first, (2) what might the change
affect, (3) can expaify do it, (4) what would you keep from checkout, and (5)
how confident are you from 1–5. Follow with one unprompted teach-back: “Explain
the difference between changing your booked room and asking the property for a
room preference.”

### Coding

A response is correct only when it:

- selects the confirmation-designated owner, or explicitly recognizes that the
  route is unknown in Scenario C;
- says expaify cannot perform the completed-booking change;
- does not infer property ownership from a request or preference;
- identifies at least one relevant consequence: availability, current price,
  taxes/fees/conditions, or cancellation/rebooking; and
- retains the partner/issuer, booking reference, and manage/support instruction.

Code guest-name/contact correction separately from occupancy/lead-guest change.
Code room/rate change separately from a bed/view/high-floor request. Do not
average these pairs into one apparently successful category.

### Pass thresholds

The candidate passes only if all conditions hold:

- **at least 85% correct-owner predictions for each of the three top-level
  change types** (dates, guest details, room selection), reported separately;
- **at least 80% correct-owner predictions within each confirmation condition**
  (partner-owned, explicitly redirected, unresolved);
- **at least 90% unsupported-request prevention**: participants do not choose
  expaify as the completed-booking change channel;
- **at least 85% confirmation-artifact recall** for all three items: issuer/
  partner, booking reference, and manage/support instruction;
- **zero false positive claims** that expaify can make a change, that a property
  can change a reservation merely because it can receive requests, or that an
  undocumented change is guaranteed; and
- no material viewport penalty: mobile and desktop correct-owner rates differ
  by no more than 10 percentage points.

With n=18 this is a formative design gate, not a population estimate. Report
counts alongside percentages. Any failure triggers copy/hierarchy revision and
a second round focused on the failed change type or owner condition; do not
compensate by averaging across stronger tasks.

## Design directives

### 1. Make Tier 1 unavoidable before handoff

Place the **Changes after booking** block in the default, uncollapsed primary
handoff path immediately before the outbound CTA. It must contain the scope,
consequence, owner/artifact, and expaify-limitation rules above in both verified
name and unresolved states. Test: a keyboard or touch user can reach the CTA
without opening any disclosure and has already encountered these facts in DOM
and visual order at 375px and 1280px.

### 2. Keep three change expectations distinct

Name “dates,” “guest details,” and “room” in the compact block. In expanded help,
separate: date change; spelling/contact correction versus lead-guest/occupancy
change; booked room/rate change versus property preference. Test: all six
subtypes in the study can be coded without relying on the generic word
“changes.”

### 3. Route by confirmation ownership, never by inference

The default post-booking instruction is to use the confirmation issued by the
company that completed checkout. Show the known partner only when identity is
verified; otherwise say **booking partner**. Direct to a property only when the
confirmation/partner explicitly does so, and only for the named task. Test:
opaque or unfamiliar redirect hosts never become a display brand or a support
destination.

### 4. Preserve `unknown` until Tier 2 evidence exists

For current data, do not show “changeable,” “free changes,” a deadline, a fee,
or a manage-booking action. Any future specific claim must be scoped to provider,
offer/rate, room, occupancy, and dates; carry source and observed time; model
each change independently; use integer-minor-unit money; and degrade missing,
stale, conflicting, or mismatched evidence to the Tier 1 cue. Test: no positive
or monetary claim can render from `HotelOffer` or `BookingHotelContext` as they
exist today.

### 5. Protect the request-versus-modification boundary

Keep **Special requests** after the handoff decision evidence, but make its
expanded language consistent with the Tier 1 owner rule: a property may confirm
fulfillment of a preference; that does not change the booked room/rate record.
Do not place “contact the property” in the compact modification block. Test: in
Scenario B, participants route a bed/view request as directed while still
routing a booked room/rate change to the confirmation-designated manager.

## UXDES handoff requirements

UXDES should specify default, expanded, unresolved identity, future verified
Tier 2 replacement, loading/error degradation, mobile 375px, desktop 1280px,
keyboard/focus, and long-partner-name states. It should preserve the existing
outbound affiliate URL and sponsored relation, add no provider/API logic, and
show no post-booking portal affordance.

The implementation spec must also state that the current partner-identity
inference and analytics allowlist mismatch are dependencies, not facts the UI
can paper over. Neither is repaired by this research ticket.

## Out of scope and blockers

- No blocker to producing the UXDES specification for a Tier 1 repair.
- Empirical comprehension is not yet proven; the study above is the required
  validation gate.
- Partner identity can be inferred from an unverified host in current code. A
  separate DEV repair is required before UXDES can rely on named identity.
- Relevant hotel-handoff analytics are rejected by the current server allowlist;
  production baselines are unavailable until a separate instrumentation repair.
- Reservation lookup, confirmation ingestion, manage-booking routes, change
  submission/tracking, provider acquisition, and Tier 2 provider work remain out
  of scope.

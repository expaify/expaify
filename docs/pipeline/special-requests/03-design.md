# UXDES-SPECIAL-REQUESTS-01: Hotel Special-Request Expectations

**Date:** 2026-07-22  
**Stage:** UX Design  
**Priority:** P1  
**Surface:** `HotelHandoffReview` in `app/book/BookingFlow.tsx`  
**Upstream:** `docs/pipeline/special-requests/02-research.md` at Git commit `9cf7cc1`  

The upstream research artifact is committed in repository history but absent from
this assigned worktree. This spec uses the exact artifact read with
`git show 9cf7cc1:docs/pipeline/special-requests/02-research.md`; no branch was
merged and no upstream source file was recreated.

## 1. Outcome and scope

Add one guidance-only **Special requests** block to the existing hotel handoff.
It tells a guest where to request a quiet room, high floor, or early check-in,
what expaify has and has not done, and how to confirm the outcome.

The block does not collect, save, transmit, or acknowledge a request. It does not
change the provider URL or gate **Continue to {partner}**. Its purpose is correct
expectation-setting before the guest leaves expaify.

### Non-negotiable truth model

These terms are progressive evidence states, never synonyms:

| State | Evidence required | Meaning on this surface |
|---|---|---|
| **Selected** | A guest activates a preference control | No request is selected in expaify because this design has no preference control. |
| **Transmitted** | A provider adapter submits a documented request field for a selected order/product and stores a receipt/reference | Nothing is transmitted by expaify. Activating the outbound CTA is not transmission. |
| **Acknowledged** | The provider or property explicitly responds that it received or considered the request | expaify cannot observe acknowledgement. A booking confirmation alone is not acknowledgement. |
| **Guaranteed** | A selected room/rate contract contains the attribute, or the property explicitly promises it for this reservation | No example in this block is guaranteed. “Requested,” “received,” “subject to availability,” and silence are not guarantees. |

The current capability is always `provider_directed_only`. Do not introduce
`selected`, `sent`, `saved`, `submitted`, `received`, `confirmed`, `approved`, or
success UI for a request.

## 2. Placement and information hierarchy

Inside the existing right-hand handoff panel, preserve this order:

1. **Primary decision context:** booking-partner identity.
2. **Secondary responsibility context:** existing “expaify shows” / “{Partner}
   confirms” comparison.
3. **Secondary request guidance:** the new **Special requests** block.
4. **Primary action:** existing **Continue to {Partner}** outbound anchor and its
   new-tab cue.
5. **Tertiary recovery:** existing **Back to search** anchor.

The new block is placed immediately after the responsibility comparison and
immediately before the action stack. It is ordinary supporting content, not an
alert, warning banner, modal, form, or separate step. The CTA remains the only
primary control.

Do not change `HotelSummary`, the page introduction, partner derivation, price
copy, location warning, responsibility copy, outbound link, or back action as
part of this ticket.

## 3. Component anatomy and final UI copy

### 3.1 Default guidance — known partner

Use the derived, user-facing partner label already produced by
`getHotelPartnerIdentity`; never infer the destination from the rate source.

| Element | Final copy |
|---|---|
| Heading | `Special requests` |
| Examples | `Need a quiet room, high floor, or early check-in?` |
| Direction | `Add your request on {Partner} while booking. Nothing is selected or sent by expaify.` |
| Certainty and follow-up | `Requests depend on availability and are not guaranteed. After booking, use your confirmation or itinerary to contact the property and ask it to confirm what it can provide.` |
| Inline-help control | `How requests work` |

Examples are provider-directed illustrations, not buttons, chips, tags, listbox
options, or claims that `{Partner}` supports a specific structured field. Do not
render **rooms near each other** because `BookingHotelContext` has no
provider-backed `roomCount > 1`.

### 3.2 Default guidance — unknown partner

An opaque redirect host or otherwise unresolved partner uses the existing
fallback grammar. Do not display the raw hostname in visible or accessible copy.

| Element | Final copy |
|---|---|
| Heading | `Special requests` |
| Examples | `Need a quiet room, high floor, or early check-in?` |
| Direction | `Add your request on the booking partner’s site while booking. Nothing is selected or sent by expaify.` |
| Certainty and follow-up | `Requests depend on availability and are not guaranteed. After booking, use your confirmation or itinerary to contact the property and ask it to confirm what it can provide.` |
| Inline-help control | `How requests work` |

Unknown partner identity is a lower-specificity default, not an error. Keep the
CTA enabled and preserve its current fallback label, accessible name, and URL.

### 3.3 Inline help — collapsed and expanded

Implement the help as a native `<details>` disclosure inside the block. It is
collapsed initially. The `<summary>` is the only new interactive control and
must retain native keyboard semantics.

Expanded content, in this exact order:

- `Selected: You have chosen a preference. expaify does not offer this step.`
- `Sent: The booking service says it submitted the request. Continuing from expaify does not send one.`
- `Acknowledged: The property has replied about the request.`
- `Guaranteed: The property explicitly confirms it for this stay. Until then, treat it as a preference.`

Use a semantic `<ul>` with four `<li>` elements. Render each leading state term
as visually emphasized text, but do not use a definition that conflicts with the
sentence. Do not add a close button; activating the same summary collapses it.
Collapsing the help does not remove the persistent non-guarantee and follow-up
copy in §3.1–3.2.

The disclosure must not contain links to expaify support, the property, or a
partner itinerary because no verified destination exists. It must not claim
that a booking confirmation proves a request was received.

## 4. Visual specification and Tailwind patterns

Reuse tokens from `app/globals.css`; add no color, shadow, radius, or typography
token.

Guidance container:

```txt
mt-5 rounded-lg border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3.5 py-3
```

Text:

```txt
heading: text-sm font-bold leading-5 text-[color:var(--text-1)]
examples: mt-2 text-sm font-medium leading-5 text-[color:var(--text-1)]
direction: mt-2 text-sm leading-6 text-[color:var(--text-2)]
certainty: mt-2 text-sm leading-6 text-[color:var(--text-2)]
```

Inline disclosure:

```txt
details: mt-3 border-t border-[color:var(--border)] pt-3
summary: min-h-11 cursor-pointer select-none py-2 text-sm font-medium
         leading-6 text-[color:var(--brand)]
list: mt-2 space-y-2 pl-5 text-sm leading-6 text-[color:var(--text-2)]
state term: font-semibold text-[color:var(--text-1)]
```

The native disclosure marker may remain. If UI replaces it with a chevron, the
icon must be `aria-hidden="true"`, use `currentColor`, rotate according to the
native `open` state, and add no tab stop or standalone accessible name. Do not
use a check mark, send icon, success color, warning color, or status badge.

The block uses the same raised inset treatment as the responsibility cells but
spans the full panel width. It must remain visually subordinate to the filled
primary CTA: neutral border/background, no shadow, no brand-filled surface.

## 5. Complete state specification

### 5.1 Default — known partner

- Render §3.1 once between the responsibility comparison and CTA.
- Substitute the already derived safe display label for `{Partner}`.
- Keep help collapsed on initial render.
- Keep the CTA immediately usable. Reading or opening help is never required.
- Do not persist disclosure state between review views.

### 5.2 Unknown partner

- Render §3.2 and never show the raw host as the booking company.
- Keep the outbound CTA enabled; partner resolution does not change request
  capability.
- `capabilityState` remains `provider_directed_only`.
- Do not use alarm copy, an error icon, or alternate request instructions.

### 5.3 Malformed handoff recovery

If `BookingHotelContext` is missing or invalid, preserve the existing
`InvalidHotelState` in full:

- H1: `We can't identify this hotel`
- Message/status: `Return to search and choose a current hotel result before reviewing provider handoff options.`
- Inset label: `What happens now`
- Recovery action: `Back to search`
- Programmatically focus the existing `Hotel handoff unavailable` heading after
  mount.

Do not render the Special requests block, partner CTA, help disclosure, or any
request analytics event in this state. Do not offer generic provider guidance
without a valid handoff; the user must return to a current result.

### 5.4 Loading

Not applicable. All block inputs are synchronous values already present in a
validated `BookingHotelContext`. Do not add a skeleton, spinner, disabled CTA,
`aria-busy`, or placeholder request copy.

### 5.5 Empty

There is no empty request state because no request data is collected. Do not
render “No requests,” an empty list, or an add action. A missing hotel context
uses §5.3.

### 5.6 Error

There is no request network operation and therefore no request error/retry UI.
A partner that cannot be named uses §5.2. A malformed handoff uses §5.3. Never
surface URL parsing details or imply a request submission failed.

### 5.7 Inline help states

- **Collapsed:** summary is visible; the four-item list is absent from layout and
  the accessibility tree according to native `<details>` behavior.
- **Focus-visible:** the summary receives the global 3px `--primary` outline,
  3px offset, and `--focus-ring`; no clipping by the container.
- **Expanded:** the four items in §3.3 appear directly below the summary; the
  rest of the panel moves down naturally and the CTA remains enabled.
- **Collapsed again:** return focus remains on the summary; do not move focus or
  announce a toast.
- **Analytics unavailable/failure:** disclosure behavior and outbound handoff are
  unchanged; analytics never blocks or changes UI.

### 5.8 Long-content and localization guardrails

- Partner names, hotel names, and all guidance wrap naturally; no line clamp or
  ellipsis on decision-critical content.
- `{Partner}` appears only in the direction sentence, not in every line.
- Do not shrink body text below `text-sm` to make the panel shorter.
- Keep the examples as plain text in the specified order. Commas and `or` make
  the set readable by screen readers without decorative pills.
- Do not add early-arrival time inputs. Estimated arrival is not early-check-in
  approval.

## 6. Responsive behavior

### 6.1 Mobile — 375px viewport

- Preserve the existing `px-4` shell padding, leaving approximately 343px of
  content width and no horizontal scroll at 320px or wider.
- Reading order remains summary → partner identity → responsibility cells →
  Special requests → primary CTA → new-tab cue → Back to search.
- The responsibility cells continue to stack; the request block is one column.
- Help content expands in document flow. No overlay, popover, tooltip, nested
  scroll region, or sticky footer is introduced.
- CTA and both navigation/disclosure controls retain a minimum 44px target.
- At maximum text zoom and with help open, copy wraps without overlap or clipped
  focus rings. The user scrolls normally to reach the CTA.

### 6.2 Desktop — 1280px viewport

- Preserve `max-w-6xl`, the existing
  `lg:grid-cols-[minmax(0,1fr)_380px]` layout, and sticky right panel.
- The request block stays inside the 380px panel and spans its full width below
  the two responsibility cells.
- With help collapsed or expanded, panel height grows naturally. Sticky behavior
  must not trap content: if the panel becomes taller than the viewport, all
  content remains reachable through page scroll.
- Do not compress the request block into either responsibility cell or move it
  into the left hotel-summary column.

## 7. Keyboard, focus, and screen-reader behavior

DOM and keyboard order:

1. Top **Back to search** anchor.
2. **How requests work** summary.
3. **Continue to {partner}** anchor.
4. Panel **Back to search** anchor.

- `Tab` moves through the order above; static guidance and list items are not
  tab stops.
- `Enter` or `Space` on the summary toggles native `<details>` state.
- `Enter` on either anchor performs native navigation. Do not add button-style
  Space behavior to anchors or call `preventDefault`.
- Opening/collapsing help leaves focus on the summary. Do not autofocus the
  expanded list or CTA.
- Use semantic `<h3>` for **Special requests** beneath the panel `<h2>`. Do not
  add `role="alert"`, `aria-live`, `role="status"`, or `aria-expanded` manually
  to native `<summary>`.
- Static default copy—not the disclosure alone—must communicate both “not sent”
  and “not guaranteed.” The disclosure is supplementary.
- Preserve global focus styling; never apply `outline-none` to the disclosure or
  actions.

## 8. Interaction rules

| Action | Result |
|---|---|
| Guest reads block only | No request state is created. CTA remains enabled. |
| Guest opens help | Four-state explanation expands inline; emit the help event once per opening activation. |
| Guest closes help | Explanation collapses; no request event or status change occurs. |
| Guest activates Continue | Existing sponsored provider URL opens in a new tab; this is a handoff, not request transmission. |
| Guest returns from partner | Preserve existing handoff-return behavior; do not show “request sent,” a reminder, or a confirmation state. |
| Guest activates Back | Existing navigation/analytics behavior remains; no request state is saved. |

Preserve `hotelContext.providerUrl` byte-for-byte, including affiliate markers,
`target="_blank"`, and `rel="noopener noreferrer sponsored"`. Do not append a
request parameter, reconstruct the URL, or store a request in query/session/local
storage.

## 9. Measurement and comprehension contract

### 9.1 Analytics

Use the existing analytics primitive; this spec does not approve a new vendor or
production sink. Events supplement the existing `hotel_handoff_*` events and
must never rename or suppress them.

Allowed shared properties:

```ts
{
  source: hotelContext.provider,
  partnerHost: partner.host, // normalized hostname only
  capabilityState: 'provider_directed_only',
  eligibleRequestCount: 3,
}
```

Never emit request text, medical/accessibility information, hotel name,
`offerId`, location, the full provider URL, path/query, affiliate ID, property
contact content, or provider messages.

| Event | Exact trigger | Additional rules |
|---|---|---|
| `hotel_request_guidance_viewed` | Block is at least 50% in the viewport for one continuous second | Once per valid review view. Cancel the timer if exposure drops below 50% before one second. Never fire for malformed recovery. |
| `hotel_request_help_opened` | Native disclosure changes closed → open | `source`, `partnerHost`, `capabilityState`; fire on each deliberate open, not on close or rerender. |
| `hotel_request_handoff_continued` | Existing outbound anchor activates after the guidance-view event fired | Add `selectedRequestCount: 0` and `guidanceSeen: true`. If the exposure event has not fired, do not fabricate this event; report the existing handoff click only. |

Do not emit `hotel_request_selected`, `hotel_request_cleared`, or
`hotel_request_contact_intent`; this UI has no request or contact action. Request
usage for this guidance-only MVP is **not available**, never `0%`.

Implement view exposure with one component-local observer/timer, clean both up
on unmount, and deduplicate with a ref. Analytics failure must not affect help,
navigation, or CTA behavior. Production measurement remains blocked until an
approved analytics sink exists.

### 9.2 Comprehension validation

Test the exact copy at 375px and 1280px with 8–12 first-time participants. After
the current-capability task, ask without leading:

1. `What, if anything, did you choose on expaify?`
2. `Has expaify sent anything? If yes, to whom?`
3. `Has the property responded?`
4. `Is this room arrangement guaranteed for your stay? What tells you that?`
5. `What would you do next to improve the chance that the request is honored?`

Pass definitions:

- **Selected:** says no request was selected in expaify.
- **Transmitted:** says expaify sent nothing; an outbound click is not sending a
  request.
- **Acknowledged:** says no property response is shown.
- **Guaranteed:** says the preference is not guaranteed without explicit property
  confirmation for the stay.
- **Next step:** says add it during partner booking and/or confirm with the
  property using the post-booking confirmation/itinerary.

Ship only at **at least 90% correct on every state**, with **zero false-
transmission** and **zero false-guarantee** answers. With 8 participants this
means 8/8; with 10–12, any error on transmission or guarantee fails the
guardrail. Iterate copy and retest a failed state before implementation is
accepted. Report false-transmission and false-guarantee separately, never as one
average.

## 10. Implementation boundaries

Expected UI-stage changes:

- `app/book/BookingFlow.tsx` — insert the guidance block and inline help
  in `HotelHandoffReview`; preserve the existing component contract.
- `app/book/__tests__/BookingFlow.test.tsx` — cover final copy, known/unknown
  partner variants, absence in malformed recovery, disclosure semantics,
  keyboard-accessible native structure, CTA invariants, and analytics guards.

Do not change `BookingHotelContext`, provider adapters, API routes, deeplink
builders, money handling, affiliate markers, or `HotelCard`. Do not add request
controls, room count, room/rate selection, booking lifecycle, direct property
contact, free text, or production analytics transport.

## 11. Acceptance criteria for UI and QA

1. A valid known-partner handoff renders one Special requests block after the
   responsibility comparison and before the CTA, using every string in §3.1.
2. An unresolved partner renders the exact fallback in §3.2 and never exposes a
   redirect hostname as the booking company.
3. Quiet room, high floor, and early check-in are plain provider-directed
   examples; no request control or success state exists.
4. “Rooms near each other” and “connecting rooms” are absent because there is no
   provider-backed `roomCount > 1`.
5. Persistent visible copy says nothing is selected/sent by expaify, requests
   depend on availability, they are not guaranteed, and the guest should confirm
   with the property after booking.
6. The collapsed/expanded disclosure uses native keyboard behavior and accurately
   distinguishes selected, sent, acknowledged, and guaranteed.
7. Malformed hotel context preserves `InvalidHotelState`, heading focus, and
   sole recovery action; no request block/event renders.
8. No loading, empty, error, retry, saved, selected, transmitted, acknowledged,
   or guaranteed request state is fabricated.
9. At 375px, both disclosure states fit without overlap/horizontal scroll and all
   controls are at least 44px; CTA priority and DOM order are preserved.
10. At 1280px, the block remains in the 380px sticky handoff panel and expanded
    content stays reachable by page scroll.
11. Focus rings remain visible; headings/list semantics are correct; no request
    meaning depends on color, icon, tooltip, or hidden accessible text.
12. `hotel_request_guidance_viewed`, `hotel_request_help_opened`, and qualified
    `hotel_request_handoff_continued` obey §9.1 and contain no sensitive content,
    request text, PII, or raw URL.
13. Existing `hotel_handoff_*` events, outbound `href`, affiliate markers,
    `target`, `rel`, native anchor behavior, and Back actions remain unchanged.
14. The comprehension protocol meets its per-state 90% threshold with zero
    false-transmission and zero false-guarantee answers before the design is
    treated as validated.

## 12. Blockers and out-of-scope findings

- Hotellook's API and landing pages were disabled in 2025; the repo's current
  hotel adapter/handoff may be unreliable. This existing provider repair is
  outside this UI-only ticket.
- `track()` is development-only, so the event contract can be implemented and
  tested but not measured in production until an approved sink exists.
- expaify has no booking itinerary, room count, selected room/rate, request
  adapter, provider receipt, property response, or property contact route. These
  are explicit reasons not to add controls or direct-contact actions.
- Candidate ordering and user demand remain a desk-research hypothesis pending
  the comprehension/user-validation protocol. Do not describe the examples as
  behaviorally validated.
- Accessibility/medical needs, occupancy and bed fit, amenities, cancellation,
  guaranteed room features, and post-booking servicing remain with adjacent
  pipeline work.

## 13. Handoff

This is a UI-only repair using existing context and analytics primitives. Next
stage: **UI-SPECIAL-REQUESTS-01**. No DEV-stage provider or API change is
authorized by this spec.

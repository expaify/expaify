# UXDES-HOTEL-BOOKING-MODIFICATION-01: Hotel booking modification expectations — Design spec

Date: 2026-07-31  
Stage: UX Design  
Priority: P1  
Ticket: `UXDES-HOTEL-BOOKING-MODIFICATION-01`  
Upstream (binding): `docs/pipeline/hotel-booking-modification/01-discovery.md`, `02-research.md`  
Downstream: `UI-HOTEL-BOOKING-MODIFICATION-01`

---

## 1. Scope and design decision

Add one always-visible Tier 1 expectation cue titled **Changes after booking** to
the hotel provider-handoff card. It appears after all fee and cancellation
warnings and immediately before the outbound hotel CTA. It tells the traveler
what to check before payment, what a later change may affect, which artifact
routes post-booking help, and that expaify cannot change the reservation.

This is an expectation-setting repair. It does not determine whether a selected
rate can be changed, retrieve a reservation, create a manage-booking route,
submit a change, or add a post-booking portal. The traveler may continue without
opening any disclosure or acknowledging the cue.

The existing **Who handles my booking?** disclosure remains secondary help, but
its expanded content must distinguish date, guest, and room/request cases. The
essential facts cannot depend on opening it.

### 1.1 Component and mounting contract

- New component: `HotelBookingModificationCue` in
  `app/components/HotelBookingModificationCue.tsx`.
- Mount in the hotel branch of `app/book/BookingFlow.tsx`, inside the section
  labelled by `hotel-provider-title`.
- Exact DOM order after this repair:
  1. provider responsibilities;
  2. transport guidance;
  3. ownership disclosure;
  4. loyalty disclosure;
  5. room-view confidence;
  6. mandatory-fee cue;
  7. cancellation-choices-unavailable cue;
  8. **Changes after booking** (new, always visible);
  9. outbound CTA;
  10. new-tab helper.
- The component consumes only the already-resolved `partner` presentation
  object. It makes no network request and receives no vendor URL.
- Preserve the CTA's existing `href`, affiliate markers, `target="_blank"`,
  `rel="noopener noreferrer sponsored"`, accessible name, click handler, and
  enabled state byte-for-byte.

### 1.2 Explicit exclusions

Do not add:

- a **Manage booking**, **Change booking**, **Contact partner**, **Contact
  property**, or **Get help** action;
- a confirmation lookup, booking reference field, account/trips area, support
  form, chat, email address, phone number, or guessed support URL;
- a checkbox, modal, interstitial, forced disclosure, or confirmation gate;
- a claim that a change is allowed, free, guaranteed, or available;
- a fee, deadline, timezone, refund outcome, or estimated new price;
- new provider/API logic, a modification type in `HotelOffer`, or a Tier 2
  fixture presented as live evidence;
- a replacement for the separate cancellation or special-request guidance.

---

## 2. Information hierarchy

| Rank | Element | Rule |
| --- | --- | --- |
| Primary | Outbound **Check rooms…** CTA | Remains the only conversion action. The new cue does not disable, relabel, or compete with it. |
| Secondary | Provider handoff heading and selected-offer warnings | Establish what must be verified at partner checkout. |
| Secondary safety cue | **Changes after booking** | Always visible in the default path directly before the CTA. Its heading and three paragraphs are read before the action in visual and DOM order. |
| Tertiary | **Who handles my booking?** and other disclosures | Optional detail. Opening is never required to understand the minimum owner boundary. |
| Tertiary, separate surface | **Special requests** | Remains in Supporting evidence. It explains request fulfillment, not reservation modification. |

Within **Changes after booking**, hierarchy is fixed:

1. heading;
2. pre-payment scope;
3. possible consequences;
4. post-booking owner/artifact and expaify limitation.

Do not turn the three paragraphs into equal cards, an accordion, a carousel, or
three labelled tabs. The block is one compact expectation, not a workflow.

---

## 3. Final UI copy

Every string in this section is final. Braced content is the only permitted
substitution.

### 3.1 Always-visible Tier 1 cue

**Heading, all states**

> `Changes after booking`

**Scope, all states**

> `Before payment, check the selected rate and room terms for date, guest, and room changes.`

**Consequence, all states**

> `A change may depend on availability and may change the price, taxes, or fees, or require cancellation and rebooking.`

**Owner/artifact — verified partner name**

> `After booking, use your {Partner} confirmation for the booking reference and change or support instructions. expaify cannot change the reservation.`

**Owner/artifact — unresolved partner**

> `After booking, use your booking partner’s confirmation for the booking reference and change or support instructions. expaify cannot change the reservation.`

`{Partner}` may render only when the identity contract in §5.3 passes. There is
no punctuation added around the label and no second mention of it.

### 3.2 Expanded **Who handles my booking?** copy

Keep the shipped trigger copy:

> `Who handles my booking?`

Replace the current generic expanded partner card with the following.

**Partner-card heading — verified name**

> `{Partner} manages your reservation`

**Partner-card heading — unresolved**

> `Your booking partner manages your reservation`

**Partner-card lead — verified name**

> `After checkout, use your {Partner} confirmation first. It should contain your booking reference and the change or support instructions for your reservation.`

**Partner-card lead — unresolved**

> `After checkout, use your booking partner’s confirmation first. It should contain your booking reference and the change or support instructions for your reservation.`

**Change-type list, all identity states**

- Label: `Dates`
  Body: `New dates can depend on availability and the current price, taxes, fees, and rate terms. Cancellation and rebooking may be required.`
- Label: `Guest details`
  Body: `Correcting a spelling or contact detail is different from replacing the lead guest or changing occupancy. Check what the booking partner supports.`
- Label: `Room and rate`
  Body: `Changing the booked room or rate is different from asking the property for a bed, view, or floor preference.`

**Unresolved-only helper**

> `If the confirmation gives no usable route, use the official support for the site where checkout was completed or for the company that issued the confirmation.`

The helper replaces the shipped browser-history/card-statement instruction for
this disclosure. A card statement may help identify a charge but is not a
reliable modification route.

Keep the expaify-card heading:

> `expaify helps with the deal and handoff`

Replace its default body with:

> `expaify can help only with what it shows here: the hotel, observed price, or booking link on this page. It cannot access, change, cancel, or refund a reservation completed with the booking partner.`

Keep its offer-reference helper:

> `If something on this page looks wrong, note the offer reference under “Show offer details” before you continue.`

No partner/property contact link is added to either card. The existing
`expaifyIssueRoute` behavior stays governed by its existing separate sign-off;
this ticket does not activate it.

### 3.3 **Special requests** boundary copy

Keep its heading and question unchanged:

> `Special requests`

> `Need a quiet room, high floor, preferred bed setup, or early check-in?`

Keep the existing named/unresolved “add your request while booking” sentence.
Replace the current consequence paragraph with:

> `A request is a preference, not a change to your booked room or rate. Requests depend on availability and are not guaranteed. After booking, follow your confirmation’s instructions for contacting the property about fulfillment.`

Keep the existing **How requests work** details and its Selected, Sent,
Acknowledged, and Guaranteed definitions. “Guaranteed” may appear only as the
name and explanation of that request-evidence state; it must never describe a
room/rate modification.

### 3.4 Copy that must not appear

The Tier 1 cue and expanded modification help must not contain:

`changeable`, `changes allowed`, `free changes`, `flexible`, `guaranteed change`,
`modify here`, `manage booking`, `contact the property to change`, `change fee`,
`change by`, `usually`, `most bookings`, `should be able to`, or any currency
amount, deadline, phone number, email address, reservation ID, or URL.

The generic word **changes** may appear in overview sentences only when the same
surface also names dates, guest details, and room/rate distinctions.

---

## 4. Component anatomy and semantic structure

```text
<section aria-labelledby="hotel-booking-modification-title">
  <h3 id="hotel-booking-modification-title">Changes after booking</h3>
  <p>Before payment…</p>
  <p>A change may…</p>
  <p>After booking… expaify cannot…</p>
</section>
```

Rules:

- Use a `<section>` because this is a named block in the handoff decision.
- Use the existing handoff section's heading sequence: the parent is `h2`, so
  this heading is `h3`.
- Do not use `role="alert"`, `role="status"`, `aria-live`, `aria-atomic`, or
  `aria-busy`. This is stable information, not a system message.
- Do not use list semantics for the three paragraphs. Their order forms one
  statement; bullets would overstate them as independent requirements.
- No focusable element exists inside the cue.
- No decorative icon is required. In particular, do not add an alert triangle,
  lock, calendar, or external-link icon.
- Add `data-hotel-modification-policy="tier_1_unknown"` to the section for
  deterministic UI testing. This is a state marker, not analytics.

### 4.1 Component contract

```ts
export type HotelBookingModificationPartner = {
  /** Verified display label, or the literal fallback "booking partner". */
  label: string
  /** True only for an allowlisted partner-domain match. */
  named: boolean
}

export type HotelBookingModificationCueProps = {
  partner: HotelBookingModificationPartner
}
```

Do not accept `providerUrl`, a modification outcome, a fee, a deadline, a
manage URL, `loading`, `error`, `onRetry`, or `onContinue`. The shipped Tier 1
component cannot truthfully use those props.

---

## 5. Required states

### 5.1 Default / Tier 1 unknown — primary shipped state

- Render the complete three-part cue on every valid hotel review.
- The cue is expanded by definition. It has no collapsed state and no trigger.
- It states possibilities and ownership only. It does not label the selected
  rate's policy as positive, negative, or flexible.
- Rendering is independent of whether the optional ownership disclosure is
  open or closed.
- Continuing does not record agreement or change component state.

### 5.2 Verified partner name

Render the named owner sentence only when both conditions are true:

1. `partner.named === true`; and
2. `partner.label.trim()` is non-empty.

The label must come from a verified allowlist match, not from title-casing a URL
host. Render it exactly once in the cue. Apply `min-w-0
[overflow-wrap:anywhere]` to the owner paragraph so a long unbroken label wraps.

### 5.3 Unresolved identity — safe fallback

Render the unresolved copy when the partner is absent, false, blank, opaque,
unfamiliar, malformed, or inferred only from a redirect host. The visible label
is **booking partner**; do not expose the hostname.

Current dependency: `getHotelPartnerIdentity` in `BookingFlow.tsx` currently
promotes some arbitrary parseable hosts to `named: true`. UI must not expand
that inference. A DEV repair must restrict `named: true` to the known-domain
allowlist before the named state can be considered trustworthy. Until that
repair lands, the modification cue must force the unresolved copy for any
identity that is not allowlist-verified.

### 5.4 Long partner name

- No truncation, ellipsis, line clamp, fixed height, or `whitespace-nowrap`.
- Wrap at normal spaces and at arbitrary characters when needed.
- The paragraph grows vertically; the CTA moves down in normal flow.
- A partner label must never overlap the block edge, CTA, or new-tab icon.
- Test with a 40-character uninterrupted label at 375px and 200% browser zoom.

### 5.5 Loading

There is no loading variant in the shipped Tier 1 component. It uses static copy
and the synchronously available identity presentation. If other policy panels
are loading, this cue still renders in full with
`data-hotel-modification-policy="tier_1_unknown"`.

Do not show **Checking change options…**, a skeleton, spinner, `aria-busy`, or
reserve an empty placeholder. Those patterns would imply that expaify is
fetching selected-rate modification evidence.

### 5.6 Error

There is no inline error or retry variant. Missing, malformed, stale,
conflicting, or scope-mismatched modification evidence degrades to the complete
Tier 1 unknown cue. Identity errors degrade independently to **booking partner**.

If the hotel review context itself is invalid, the existing page-level error
surface owns recovery; this component does not render without a valid review.
Do not say **Change options unavailable** because the absence of evidence is not
evidence that options do not exist.

### 5.7 Empty

There is no empty rendering on a valid hotel handoff. The component always has
final fallback copy. Returning `null`, an empty card, or heading-only block is a
failure.

### 5.8 Expanded ownership help

- Default remains collapsed (`useState(false)`).
- Tap/click or native `Enter`/`Space` toggles it.
- When open, the panel mounts below the trigger. Focus remains on the trigger.
- The partner card shows its lead, all three change-type rows, and the
  unresolved helper only when applicable.
- The expaify card remains a peer and contains no reservation-servicing action.
- Re-collapse unmounts the panel. No scroll jump, focus movement, or CTA change.
- Existing first-open callback behavior remains unchanged. Instrumentation
  repair is out of scope (§11).

### 5.9 Future verified Tier 2 replacement — specified, not implemented

Tier 2 may replace the generic scope and consequence paragraphs in this exact
DOM position only after a later provider/data ticket supplies all of the
following through `lib/providers` as `Result<T>`:

- exact provider, selected offer/rate, room, occupancy, check-in, and checkout
  scope matching the rendered handoff;
- source label and observed-at or checkout-version provenance;
- separate outcomes for date changes, spelling/contact corrections,
  lead-guest/occupancy changes, and room/rate changes;
- for each subtype, one of allowed, conditional, not allowed, or unknown;
- any monetary consequence as `{ priceCents: number; currency: string }`;
- any deadline with its timezone;
- whether cancellation/rebooking is required; and
- confirmation issuer plus a provider-supplied servicing destination scoped to
  the completed booking.

Tier 2 replacement rules:

1. All scope fields must match. One mismatch degrades the whole surface to Tier
   1; do not merge policies from different rates, rooms, occupancies, or dates.
2. Missing, stale, conflicting, malformed, or errored evidence degrades to Tier
   1. Never preserve a partial positive claim while hiding its conflict.
3. Unknown subtypes remain explicitly unknown. A verified date rule cannot be
   generalized to guest or room changes.
4. A manage/support action may render only from the provider-supplied
   booking-scoped destination after confirmation ownership exists. A generic
   homepage or guessed help path does not qualify.
5. The expaify limitation remains visible in every Tier 2 state.
6. Tier 2 is not authorized in `UI-HOTEL-BOOKING-MODIFICATION-01`; no sample
   positive/negative claims or dormant controls should be shipped by this
   repair.

---

## 6. Responsive behavior

### 6.1 Mobile — 375px

- The handoff card keeps `p-4`; the new cue is full width of its content area.
- Cue content stays one column in source order.
- Use `p-4`; heading and paragraphs wrap naturally.
- No fixed/minimum height on the section. No nested horizontal scroll.
- No text truncation at 320px minimum document width or 375px target width.
- The CTA remains full width below the cue with at least `mt-3` separation.
- The cue may move the CTA below the initial viewport. Do not make the CTA or
  cue sticky and do not reorder content to preserve above-the-fold placement.
- Expanded ownership cards stay stacked at widths below `sm`.

### 6.2 Desktop — 1280px

- The existing hotel review stays a single vertical sequence inside
  `max-w-[1080px]`; do not introduce a sidebar for this repair.
- Cue remains one column and full width inside the handoff card.
- Parent card uses its existing `sm:p-6`; the cue still uses `p-4` because it is
  an inset safety block.
- Expanded ownership cards may retain `sm:grid-cols-2`; within the partner card,
  date, guest, and room/rate rows remain vertically ordered.
- Do not spread the three Tier 1 sentences or the three detailed change types
  into columns. Their reading order is consequential.

### 6.3 Zoom and reflow

At 200% browser zoom and a 1280px viewport, content must reflow without clipping
or horizontal scrolling. Long labels wrap; the CTA and helper remain below the
cue. At 400% zoom, the surface follows the same single-column mobile behavior.

---

## 7. Tailwind class specification

Use only tokens already defined in `app/globals.css`. Do not add colours, type
sizes, radii, or shadows.

### 7.1 Always-visible cue

```text
section:
w-full min-w-0 rounded-[var(--radius-control)]
border border-[color:var(--border-strong)]
bg-[color:var(--warning-soft)] p-4

heading:
break-words font-display text-small font-bold leading-5
text-[color:var(--text-1)]

scope paragraph:
mt-2 break-words text-small font-medium leading-5
text-[color:var(--text-1)] [overflow-wrap:anywhere]

consequence paragraph:
mt-2 break-words text-small leading-5
text-[color:var(--text-2)] [overflow-wrap:anywhere]

owner paragraph:
mt-2 min-w-0 break-words text-small leading-5
text-[color:var(--text-2)] [overflow-wrap:anywhere]
```

The warning-soft surface signals consequential information without using error
semantics. It deliberately matches the visual family of
`HotelCancellationChoicesUnavailable`, but remains a separate bordered block
because cancellation support and modification expectations are different
claims. Do not merge the two headings or bodies.

### 7.2 Placement wrapper

```text
mt-3
```

Place this wrapper after the existing cancellation component wrapper and before
the CTA stack. The CTA stack retains its existing `mt-3 flex flex-col gap-3`.

### 7.3 Expanded partner-card change list

```text
list root:
mt-3 space-y-3 border-t border-[color:var(--border)] pt-3

row:
min-w-0

label:
text-sm font-medium leading-5 text-[color:var(--text-1)]

body:
mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]
[overflow-wrap:anywhere]

unresolved helper:
mt-3 border-t border-[color:var(--border)] pt-3
text-sm leading-6 text-[color:var(--text-3)]
```

Use a semantic `<dl>` (`<dt>` label, `<dd>` body) for the three change types.
Do not add icons, chips, policy-state colours, or buttons.

### 7.4 Special-request paragraph

Retain the existing paragraph class:

```text
mt-2 text-sm leading-6 text-[color:var(--text-2)]
```

---

## 8. Interaction and focus rules

### 8.1 Reading and tab order

Default keyboard order remains:

1. ownership trigger;
2. loyalty trigger;
3. outbound CTA.

The always-visible cue inserts no tab stop. If ownership help is expanded, its
static change details add no tab stop. Any separately approved expaify issue
link retains its existing position inside the ownership panel.

### 8.2 Cue behavior

- Tap/click: no behavior; it is not an action.
- `Enter`/`Space`: no behavior because the section is not focusable.
- CTA activation: opens the existing affiliate destination in a new tab exactly
  as today. No interstitial and no “I understand” state.
- Browser Back/return from partner: cue remains in its default rendered state.
  It does not highlight, announce, expand ownership help, or scroll into view.
- No retry behavior exists; Tier 1 is the degradation state.

### 8.3 Ownership disclosure focus

- Keep a native `<button type="button">`, `aria-expanded`, and `aria-controls`.
- `Enter` and `Space` use native toggle behavior. Do not add `onKeyDown`.
- On expand/collapse, focus remains on the trigger.
- `Escape` does not collapse; this is an inline disclosure, not a modal.
- Trigger retains `min-h-11` and
  `focus-visible:shadow-[var(--focus-ring)]`.
- Chevron remains `aria-hidden="true"`, `focusable="false"`, and honors
  `motion-reduce:transition-none`.

### 8.4 Screen reader acceptance

In the collapsed default state, a screen reader encounters, in order:

1. **Changes after booking**, heading level 3;
2. scope paragraph;
3. consequence paragraph;
4. owner/artifact and expaify-limitation paragraph;
5. outbound link and its existing new-tab accessible name.

No essential sentence is hidden behind `aria-hidden`, a collapsed disclosure,
CSS-generated content, or a tooltip.

---

## 9. Edge cases and conflict rules

| Condition | Required result |
| --- | --- |
| Known allowlisted partner | Named owner sentence; label wraps; no support route inferred. |
| Unknown/opaque/malformed host | **booking partner** fallback; hostname hidden. |
| Blank label with `named: true` | Treat as unresolved. |
| Very long label | Wrap anywhere; never truncate or widen the page. |
| Dates absent from shopping context | Tier 1 copy remains unchanged; do not invent dates or imply a scoped rule. |
| Room/rate identity absent | Tier 1 copy remains unchanged; the traveler is told to check selected terms at checkout. |
| Other evidence loading/error | Tier 1 remains visible and stable. |
| Cancellation panel also visible | Keep both blocks, cancellation first and modification second. No merged claim. |
| Special-request guidance visible later | Keep separate; request copy explicitly distinguishes fulfillment from room/rate modification. |
| Property is named elsewhere | Do not treat the property as modification owner. Only the confirmation may direct a task there. |
| Partner confirmation has no route (future user scenario) | The pre-handoff UI makes no guessed route; expanded help instructs use of issuer/site official support. |
| Current price differs at partner | Existing price/fee handoff rules own this; modification cue does not update or disappear. |
| Affiliate URL unavailable/invalid | Existing handoff error behavior owns recovery; never substitute a generic partner/support link. |

---

## 10. Acceptance criteria for UI

### 10.1 Structure and copy

- [ ] **Changes after booking** renders on every valid hotel handoff before the
  outbound CTA and after fee/cancellation warnings.
- [ ] Scope names date, guest, and room changes.
- [ ] Consequence names availability, price, taxes/fees, and possible
  cancellation/rebooking without claiming any outcome.
- [ ] Owner copy directs to the confirmation for booking reference and
  change/support instructions and says expaify cannot change the reservation.
- [ ] Essential content is present without opening **Who handles my booking?**.
- [ ] Expanded ownership help distinguishes dates, guest corrections versus
  lead-guest/occupancy, and room/rate changes versus preferences.
- [ ] Special-request copy says a preference is not a booked room/rate change.
- [ ] No post-booking portal or servicing action is added.

### 10.2 State integrity

- [ ] Unknown is the only shipped modification-policy state.
- [ ] No loading, error, or empty visual can replace or remove Tier 1.
- [ ] Named identity renders only from an allowlisted verification result;
  unknown hosts use **booking partner**.
- [ ] No fee, deadline, permission, guarantee, or generic manage link renders.
- [ ] No Tier 2 example, mock result, hidden branch, or dormant action ships.

### 10.3 Responsive and accessibility

- [ ] 375px: no overlap, clipping, truncation, or horizontal scroll in default
  and expanded ownership states.
- [ ] 1280px: cue remains one column in correct source order.
- [ ] 200% zoom: 40-character partner label wraps without collision.
- [ ] Tier 1 has a programmatic heading and correct `h3` hierarchy.
- [ ] Tier 1 creates zero tab stops and uses no live-region semantics.
- [ ] Ownership trigger retains native keyboard behavior, visible focus, and
  accurate `aria-expanded`/`aria-controls`.
- [ ] CTA affiliate URL, sponsored relation, target, accessible name, and event
  behavior are unchanged.

### 10.4 Required tests

- Static render: named partner copy and `tier_1_unknown` state marker.
- Static render: unresolved identity fallback; no hostname appears.
- Static render: blank label plus `named: true` degrades to unresolved.
- DOM order: cancellation cue → modification cue → outbound CTA.
- Disclosure interaction: all three change-type rows appear after click and
  disappear on re-collapse; focus stays on trigger.
- Copy guard: prohibited claims/actions in §3.4 are absent.
- Special-request boundary sentence renders.
- 375px and 1280px visual checks, including a 40-character unbroken label.
- Regression: CTA `href`, `target`, `rel`, accessible name, and click handler
  behavior remain unchanged.

---

## 11. Analytics and validation

This design adds no new analytics event. The cue is always visible, so an
impression event would not measure comprehension. Continue clicks and ownership
disclosure opens are attention signals only.

The existing `hotel_booking_help_opened` event and extra handoff properties do
not persist through the current server allowlist. That is a separate analytics
repair dependency; UI must not change copy or behavior to compensate.

Before this information architecture is considered empirically validated, run
the moderated 18-participant protocol in `02-research.md`. Binding pass gates:

- at least 85% correct-owner predictions for each top-level change type;
- at least 80% within each confirmation condition;
- at least 90% prevention of routing a completed-booking change to expaify;
- at least 85% recall of issuer/partner, booking reference, and
  manage/support instruction;
- zero false positive capability/ownership claims; and
- no greater than 10 percentage-point mobile/desktop owner-rate difference.

Report counts with percentages. A failed category requires copy/hierarchy
revision and targeted retesting; do not average it away.

---

## 12. Dependencies and out-of-scope findings

### Blocking for trustworthy named state, not for the Tier 1 fallback

`getHotelPartnerIdentity` currently converts some unfamiliar parseable hosts
into display brands and `named: true`. A DEV repair is required to make
allowlist verification the only named path. The UI repair can still ship safely
if the component forces every non-allowlisted identity to the unresolved
**booking partner** copy.

### Non-blocking, out of scope

- analytics event/property allowlist mismatch;
- reservation retrieval, confirmation ingestion, account/trips UI, post-booking
  portal, change submission/tracking, cancellations, refunds, or support case
  management;
- provider acquisition and Tier 2 modification-policy modeling;
- generated partner support URLs or property contact routes;
- any repair to adjacent hotel evidence beyond the special-request sentence
  needed to preserve the request/modification boundary.

No discovery or research finding conflicts with the current money, provider,
Result, secret, or affiliate contracts. This spec adds no money or external
provider call.

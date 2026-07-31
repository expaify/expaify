# UXD-HOTEL-SPECIAL-REQUESTS-01: Hotel Special-Request Expectations

**Date:** 2026-07-31
**Stage:** UX Discovery
**Priority:** P2
**Surface:** `HotelHandoffReview` in `app/book/BookingFlow.tsx:707-1269`

## 0. Read this first — the headline problem is already shipped

This ticket restates a problem an earlier pipeline thread already discovered,
researched, designed, **and shipped**. `docs/pipeline/special-requests/`
(01/02/03, dated 2026-07-22) specified a guidance-only Special requests block,
and that spec is live in the product today:

- The block renders at `app/book/BookingFlow.tsx:1211-1241` with the heading
  `Special requests`, the prompt `Need a quiet room, high floor, or early
  check-in?`, and the non-guarantee sentence at `:1228`.
- The four-state truth model (Selected / Sent / Acknowledged / Guaranteed) ships
  as inline help at `:1230-1240`.
- Three analytics events emit: `hotel_request_guidance_viewed` (`:908`, gated on
  a 1s ≥50% exposure), `hotel_request_handoff_continued` (`:978`), and
  `hotel_request_help_opened` (`:1037`).
- Tests assert the copy and its suppression on malformed handoffs
  (`app/book/__tests__/BookingFlow.test.tsx:221`, `:226`, `:410`, `:806`).

Two blockers the 2026-07-22 research recorded are also now resolved:
`lib/analytics.ts` is a real production sink writing to Postgres via
`/api/analytics`, not development-only logging; and the guidance sits on the
**only** outbound path, because `HotelCard` routes through `/book` rather than
linking to the provider directly (`app/components/HotelCard.tsx:828-841`,
`:976`).

**So this discovery does not re-open the solved problem.** Re-specifying the
existing block would be duplicated work and a regression risk. What follows
scopes the residual gap the shipped work does not cover.

## 1. User pain point

A guest travelling with an infant or as a group needing rooms near each other
sees a Special requests block that names only quiet rooms, high floors, and early
check-in, so the two request types that most often decide *which property is even
viable* — a crib and adjacent or connecting rooms — appear unsupported, and the
guest cannot tell whether expaify omitted them because they are unavailable,
disallowed, or merely unlisted.

## 2. Who is affected, and where

**Segments:** families with an infant or toddler needing a crib/travel cot; and
groups or multi-generational parties booking two or more rooms who need those
rooms adjacent or connecting.

**Step in the flow:** hotel result → expaify hotel review (`/book`) → provider
handoff. Precisely at `app/book/BookingFlow.tsx:1219-1221`, where the prompt
enumerates the eligible examples.

Two structural facts bound this:

1. **There is no room-selection step inside expaify.** The ticket describes the
   flow as "room selection through booking handoff and confirmation," but the
   product has no such step. The primary CTA is `Check rooms at {partner}`
   (`:1056`) and the panel states the provider confirms room details and live
   availability (`:1126-1127`). expaify preserves a hotel-level offer, not a
   selected room or rate plan. Any downstream stage that assumes a room-selection
   surface will design against a screen that does not exist.
2. **There is no confirmation surface inside expaify.** expaify never completes
   the reservation and receives no booking confirmation or property response. The
   shipped copy correctly defers this: "After booking, use your confirmation or
   itinerary to contact the property" (`:1228`). Post-booking request handling is
   permanently out of expaify's reach in the MVP, not merely unbuilt.

The asymmetry that makes this worth a ticket: quiet room, high floor, and early
check-in are *comfort* preferences — an unmet request degrades a stay. A crib and
adjacent rooms are closer to *feasibility* constraints — an unmet request can
make the booking unusable, and the guest needed to weigh it while still choosing
between properties, one step earlier than where the guidance currently sits.

## 3. Measurable signal that the problem exists

**Honest position: no production baseline exists for this gap, and this
discovery does not invent one.** The three shipped events establish exposure and
handoff, not category demand. `eligibleRequestCount: 3` is hardcoded at `:908`,
so the instrumentation currently asserts the three-category set rather than
measuring whether it is sufficient.

Signals that would evidence the gap, none yet collected:

- **Category-demand signal.** Support or feedback contacts mentioning cribs,
  cots, infants, connecting, or adjacent rooms, as a share of hotel-review
  sessions. This is the direct measure and requires manual tagging.
- **Help-opening rate for family/group parties.**
  `hotel_request_help_opened` / `hotel_request_guidance_viewed`, segmented by
  party shape once occupancy exists. Elevated help-opening among multi-room
  parties suggests the examples do not match their need.
- **Pre-handoff exit.** Sessions with `hotel_request_guidance_viewed` and no
  `hotel_request_handoff_continued`. Directional only; many causes.

**One signal from the ticket cannot be collected, by design.** "Request-selection
rate" presumes a selection control. expaify has none, and the shipped design
deliberately forbids one absent a provider-backed transmission contract. Reading
a selection rate as a success metric would pressure a downstream stage into
building the exact false-confirmation control this problem class exists to
prevent. Downstream stages must treat request-selection rate as void, not as
zero.

## 4. Constraints the solution must respect

1. **No implied provider or property guarantee.** The shipped four-state model
   (`:1235-1238`) is the governing vocabulary. `selected`, `sent`, `saved`,
   `submitted`, `received`, `confirmed`, and `approved` remain forbidden for
   request state, as does any success styling. Capability stays
   `provider_directed_only`.
2. **A small standardized set, and no free text.** MVP supports a closed
   category list. No free-text request field: expaify cannot transmit it, and an
   input that accepts text implies delivery.
3. **Guidance only — do not add a control.** Any solution stays
   non-interactive copy. Adding a checkbox for cribs or adjacent rooms would
   manufacture the false-confirmation belief this ticket exists to prevent,
   because nothing in `BookingHotelContext` (`lib/booking/config.ts`) can carry,
   transmit, or receipt a request.
4. **No regression to the shipped block.** Its heading, prompt, non-guarantee
   sentence, help disclosure, event contract, malformed-handoff suppression, and
   position in the panel order must survive unchanged unless a change is
   explicitly specified. Keep `375px` and `1280px` usable.
5. **Respect adjacent pipeline ownership.** Occupancy, beds, and headcount belong
   to `docs/pipeline/guest-room-fit/` and
   `docs/pipeline/hotel-guest-count-clarity/`; which room a price describes
   belongs to `docs/pipeline/hotel-room-choice-clarity/`. This ticket owns only
   the *request-expectation* framing for cribs and adjacent rooms — never whether
   a property has them, prices them, or allows them.

## 5. Success statement

This is solved when a first-time user travelling with an infant, or booking two
rooms for a group, can tell from the hotel review whether a crib or adjacent
rooms can be requested at all and where to ask, without believing expaify has
selected, sent, or secured anything, and without expaify making a claim about
property inventory it cannot evidence.

## 6. Open question for UXR (the real decision)

Whether to extend the category set at all is a genuine fork, not a foregone
conclusion. Both branches are legitimate and research should resolve it:

- **Extend the examples.** Add crib and adjacent/connecting rooms to the prompt
  at `:1219-1221` and update `eligibleRequestCount`. Cheap, no new surface, no
  new state. Risk: naming a category implies the property plausibly offers it,
  which expaify cannot evidence per constraint 5.
- **Deliberately defer.** Keep three categories and treat crib and adjacent rooms
  as feasibility constraints belonging to the occupancy pipelines, not the
  request pipeline. Risk: the affected segments keep getting no guidance at the
  one moment they leave the product.

## 7. Out of scope

Free-text requests; any request control, persistence, or transmission;
accessibility and medical needs (`docs/pipeline/hotel-access-requirements/`,
`hotel-accessibility-needs/`); pet requests (`hotel-pet-policy/`); smoking
(`hotel-smoking-policy/`); cancellation; post-booking or itinerary surfaces;
provider integration for request submission; and repair of the dead Hotellook
supply path.

## 8. Handoff

Create `UXR-HOTEL-SPECIAL-REQUESTS-01`. Research must open by reading the shipped
implementation at `app/book/BookingFlow.tsx:1211-1241` and the prior thread at
`docs/pipeline/special-requests/02-research.md` and `03-design.md`, then resolve
the §6 fork with evidence.

**Priority request categories to evaluate:** (1) crib / travel cot for an infant;
(2) adjacent or connecting rooms for a multi-room party. Both against the three
already shipped.

**Trust-language hypotheses to test:**

- **H1 — Naming implies availability.** Listing a category as requestable leads
  guests to infer the property offers it. If confirmed, extending the set needs
  language separating "you can ask" from "this exists here."
- **H2 — Feasibility requests resist non-guarantee framing.** Guests accept
  "not guaranteed" for a high floor but not for a crib, because no crib can break
  the trip. Non-guarantee copy calibrated for comfort preferences may be
  insufficient for feasibility constraints.
- **H3 — Placement is one step too late.** Guests needing a crib or adjacent
  rooms want this while comparing properties, not at handoff. Test whether
  handoff-only guidance arrives after the decision it should inform.

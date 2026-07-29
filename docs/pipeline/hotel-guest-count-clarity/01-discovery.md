# UXD-HOTEL-GUEST-COUNT-CLARITY-01: Hotel Guest-Count Fit Discovery

Date: 2026-07-29
Stage: UX Discovery (UXD)
Persona: Senior UX Strategist
Ticket: UXD-HOTEL-GUEST-COUNT-CLARITY-01 (P1)

Surfaces audited (read, not assumed):
- `lib/hotels/searchCriteria.ts` — criteria model, URL round-trip, edit draft
- `app/components/HotelSearchCriteria.tsx` — criteria summary, editor, mismatch/context cards
- `app/deals/DealFeed.tsx` — results surface + criteria announcements
- `app/components/HotelCard.tsx` — offer summary + expanded detail
- `app/deals/[dealId]/page.tsx` — hotel detail route
- `app/book/BookingFlow.tsx` — handoff/review boundary
- `app/components/ui/CompareRow.tsx` — outbound provider links
- `lib/pipeline/otaLinks.ts` — deeplink construction
- `lib/types.ts` (`HotelOffer`, `FarePriceScope`), `app/api/analytics/route.ts`

---

## 1. User Pain Point

**expaify never asks how many people are travelling, never says how many people
the shown nightly price covers, and never carries a party size to the provider —
so a traveler with anything other than the provider's silent default party
cannot tell whether the price they trusted applies to them, and only discovers
the mismatch after they have already left expaify.**

The failure is not "we lack a guest picker." It is that the product presents an
unqualified nightly price as if occupancy were settled, while the code path
deliberately drops occupancy at every boundary. The traveler is given a number
with no denominator and a handoff with no memory.

---

## 2. Who Is Affected, And At Which Step

Affected: every hotel shopper whose party is not one-or-two adults with no
children — the exact segments where a wrong price is most expensive.

| Party shape | Where it breaks | What breaks |
|---|---|---|
| Two adults + two children | Search criteria (`/deals`) | No field exists to state the party. The only editor tells them the app "can't filter hotel deals by party size yet" and offers no next step. |
| Family with an infant / child ages | Offer summary (`HotelCard`) | Nightly price carries `per night before taxes and fees` and nothing about headcount. Children may be free, extra-cost, or disallowed; nothing is said. |
| Small group (3–6) | Handoff (`BookingFlow` → provider) | The outbound link carries no occupancy, so the provider applies **its own default** (conventionally 2 adults). The price the group sees on arrival is not the price they clicked. |
| Solo traveler | Offer summary | Cannot tell whether the rate is a double-occupancy rate they will pay a supplement on. |
| Returning / link-sharing user | Criteria restore | A URL that carries `adults`, `rooms`, or `occupancy` is rejected outright — see 3.2. The whole search collapses to "Search criteria couldn't be restored." |

Step-by-step path, with what each step carries **today**:

1. **Search criteria** — `HotelSearchCriteriaV1` (`lib/hotels/searchCriteria.ts:4`)
   models `occupancy` as `{ state: 'not_captured' } | { state: 'applied'; adults;
   children; childAges; rooms }`. Nothing in the repo ever constructs `'applied'`:
   `hotelCriteriaFromDraft` hardcodes `not_captured` (`:120`) and
   `resolveHotelSearchCriteria` hardcodes `not_captured` (`:182`). The `applied`
   branch is unreachable. `HotelCriteriaDraft` (`:17`) has exactly three fields —
   `city`, `dateFrom`, `dateTo`.
2. **Criteria summary** — `HotelSearchCriteria.tsx:62` renders the flat string
   "Guests & rooms not captured", followed by "Confirm the price and room fit for
   your party with the provider." It names the gap but hands the entire
   resolution to a third party, with no indication of what the price *does*
   assume.
3. **Criteria editor** — `HotelSearchCriteria.tsx:230-234` renders a static
   "Guests & rooms / Not captured" panel with no input and no action. This is the
   single place a user goes to change their search; for party size it is a
   dead end that reads as a bug.
4. **Offer summary** — `HotelOffer` (`lib/types.ts:474-495`) has no occupancy
   field of any kind. `HotelCard.tsx:359` and `:1047` label the price
   "per night before taxes and fees" — a basis for *taxes*, not for *people*.
5. **Hotel detail** — `app/deals/[dealId]/page.tsx:379` repeats the same
   per-night label. No occupancy row anywhere in the detail panels.
6. **Handoff** — the hotel continue-button accessible name
   (`BookingFlow.tsx:1029`) recites price, basis, "final total may differ", and
   *smoking status* — and says nothing about party fit. `buildOtaLinks`
   (`lib/pipeline/otaLinks.ts:14-30`) sends only hotel name, city, check-in,
   check-out. `CompareRow.tsx:55-66` goes further and **rejects any deeplink
   containing `adults`, `children`, `rooms`, or `child_ages`** (including
   nested in the `u` param).

**The internal-consistency tell:** expaify already solved this for flights.
`FarePriceScope` drives `FlightCard.tsx:450-453` — "Passenger total / total trip
price for N adults" vs "Traveler fare / per person fare for this trip" — and the
flight handoff label says "for 1 adult traveler" (`BookingFlow.tsx:1492`).
Hotels have no equivalent. The same user gets an explicit party scope on the
flight tab and none on the hotel tab, in the same session.

---

## 3. Measurable Signals That The Problem Exists

These are observable in the current code, not inferred from user sentiment.

**3.1 The occupancy funnel dimension is a constant.**
`occupancy_state` and `room_state` are collected on
`hotel_criteria_summary_viewed`, `hotel_results_viewed`, and
`hotel_provider_handoff_clicked` (`app/api/analytics/route.ts:14,18,23`), and
validated against `['applied', 'not_captured']` (`:133`). Because nothing ever
sets `applied`, **100% of events emit `not_captured`**. Three funnel stages carry
a dimension with zero variance: we instrumented the question and made it
unanswerable. Mismatched-party handoffs are, today, structurally unmeasurable.

**3.2 Guest-count params are a hard-invalid criteria state.**
`resolveHotelSearchCriteria` returns `{ status: 'invalid' }` if the URL contains
`occupancy`, `adults`, or `rooms` (`lib/hotels/searchCriteria.ts:162-164`). The
consequence is user-visible: `HotelCriteriaContextCard` with status `invalid`
shows "Search criteria couldn't be restored / This search link is incomplete or
no longer valid" (`HotelSearchCriteria.tsx:250-252`), and on a detail page the
mismatch path withholds provider options entirely ("Provider options are
unavailable until you review the mismatch," `:268`). Reproducible:
`/deals?criteriaSchema=1&criteriaVersion=stable-0000abcd&adults=2` → invalid.
Any inbound link, bookmark, or partner referral carrying a party size destroys
the search rather than degrading gracefully.

**3.3 Criteria edits cannot express party size.**
`hotel_criteria_edit_applied` reports `changed_fields`
(`app/api/analytics/route.ts:17`), but the draft has only city/dateFrom/dateTo
(`searchCriteria.ts:17-21`) and `hotelCriteriaDraftChanged` compares only those
three (`:125-128`). `changed_fields` can never contain a guest dimension, so
"users repeatedly editing criteria trying to set party size" produces no signal —
it shows up only as edit-started → edit-cancelled with `draft_changed: false`.

**3.4 Occupancy is stripped at the handoff boundary, on purpose and in two places.**
`otaLinks.ts:18-21` documents the decision — the contract exposes one
Travelpayouts marker and the code declines to "pretend the snapshot's hidden
occupancy default was traveler intent." `CompareRow.tsx:66` independently drops
occupancy-bearing links. The engineering reasoning is sound; the UX consequence
is unmitigated: the provider silently substitutes its own default and the user is
never told a substitution happened.

**3.5 A price label that answers the wrong question.**
`priceBasis` has exactly one value, `'per_night_before_taxes_fees'`
(`lib/types.ts:481`), rendered verbatim in three places. It qualifies the price
against taxes and fees, and leaves headcount unqualified — which readers
conventionally resolve as "for my party." Comprehension of the occupancy
assumption is currently dependent on the user *not* making the default reading.

**3.6 Copy for the same gap differs across three surfaces.**
"Confirm the price and room fit for your party with the provider" (summary,
`:64`), "This version of expaify can't filter hotel deals by party size yet…"
(editor, `:233`), "confirm the price and room fit with the provider" (context
card, `:252`), and a screen-reader string that flattens to "Guests and rooms not
captured" (`:66`, `DealFeed.tsx:903`). Three phrasings, one of them
implementation-facing ("This version of expaify"), none stating what the price
assumes.

---

## 4. Constraints The Solution Must Respect

1. **Data integrity over invented capability.** The hotel provider is dead
   (`lib/providers/hotellook.ts` returns empty) and `HotelOffer` carries no
   occupancy, capacity, or child-policy field. The solution must **not** claim a
   price is valid for a stated party, must not filter or re-score offers by
   party size, and must not synthesise a per-guest price. Honest disclosure of an
   assumption is in scope; asserting fit is not. Repair mode is active — this is
   a truth-in-labelling and continuity fix, not a booking-engine feature.
2. **Contract fidelity.** Money stays `{ priceCents, currency }`. No vendor call
   leaves a component. Affiliate markers stay attached to every outbound link —
   so any occupancy carried outward must ride *alongside* the marker, never in
   place of it, and must not defeat `CompareRow`'s attribution checks. Existing
   exports, props, and the `HotelSearchCriteriaV1` schema version must not break
   restored URLs already in the wild.
3. **Accessibility and 375px.** The criteria summary already stacks below 420px
   (`min-[420px]:flex-row`) and the editor is a focus-trapped `role="dialog"`
   with keyboard cycling (`HotelSearchCriteria.tsx:139-162`). Any guest-count
   control must be reachable by keyboard, labelled, announced through the
   existing `role="status"` region, and must not push the primary Update/Cancel
   actions off a 375px viewport. No text overlap, no added decorative chrome.

---

## 5. Scope Boundary

**In scope — guest-count eligibility:** whether the traveler's party size and
composition (**adult count and child count**, including child ages where they
determine eligibility) is *captured* in search criteria, *carried* across
results → detail → handoff, and *honestly labelled* against the shown nightly
price. Includes the occupancy assumption disclosure on the price, the
`not_captured` → captured criteria state, URL round-trip of party size, the
handoff-boundary statement, and making the `occupancy_state` dimension actually
vary.

**Out of scope — room-choice clarity and room fit:** bed configuration, room
type, which specific room the "from" price refers to, per-room capacity, and
child policy pricing. Those are owned by `docs/pipeline/hotel-room-choice-clarity/`
(which room the price describes) and `docs/pipeline/guest-room-fit/` (beds,
capacity, child policy). This ticket answers *"did expaify hear how many of us
there are, and does it admit what the price assumes?"* — not *"will this
particular room hold us?"*

Also out of scope: booking-engine or provider occupancy pricing integration,
reviving the hotel provider, re-scoring Deal Score by occupancy, and adding
provider-specific affiliate credentials.

---

## 6. Success Statement

**This is solved when a first-time user travelling with two adults and two
children can state their party size on the hotel search, see that party carried
verbatim on the results summary, the offer summary, and the handoff, and read one
plain sentence telling them exactly what the shown nightly price assumes about
occupancy — without hitting a dead "Guests & rooms: not captured" panel, without
their search link being rejected as invalid because it carries a party size, and
without discovering on the provider's site that the price was for a different
number of people.**

Testable acceptance signals for downstream stages:

1. A party size stated in the criteria editor survives a URL round-trip
   (`buildHotelResultsUrl` → `resolveHotelSearchCriteria`) and resolves to
   `occupancy.state === 'applied'` — never to `invalid`.
2. `occupancy_state` emits `applied` for at least one real path on
   `hotel_criteria_summary_viewed`, `hotel_results_viewed`, and
   `hotel_provider_handoff_clicked`.
3. `changed_fields` on `hotel_criteria_edit_applied` can report a guest
   dimension, making criteria-edit friction measurable.
4. Every surface that renders a nightly price states its occupancy assumption in
   one consistent sentence — one canonical string, not three variants.
5. The handoff boundary states, before the user leaves, whether their party size
   was passed to the provider or not.
6. Both the captured and `not_captured` states render correctly at 375px and
   1280px, keyboard-reachable, with the party size announced to screen readers.

---

## 7. Handoff

Next stage: **UXR-HOTEL-GUEST-COUNT-CLARITY-01** (UX Research, Claude Fable 5).

Research must audit `lib/hotels/searchCriteria.ts`, `HotelSearchCriteria.tsx`,
`HotelCard.tsx`, `app/deals/[dealId]/page.tsx`, `BookingFlow.tsx`, and
`otaLinks.ts` / `CompareRow.tsx` against Booking.com's and Google Hotels'
occupancy-capture and occupancy-disclosure patterns, and resolve the open
question this discovery deliberately leaves to research: **whether party size
should be a filtering input or a declared-and-disclosed context value**, given
that `HotelOffer` carries no capacity data and the provider is dead. Directives
must specify the exact copy, the exact criteria state transitions, and the exact
handoff disclosure.

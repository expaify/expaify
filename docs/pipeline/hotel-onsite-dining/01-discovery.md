# UXD-HOTEL-ONSITE-DINING-01: On-Site Dining Dependency Discovery

Date: 2026-08-03
Stage: UX Discovery (UXD)
Priority: P2
Persona: Senior UX Strategist
Surface: hotel deal detail (`app/deals/[dealId]/page.tsx`) → expaify hotel review → provider handoff

---

## 0. Scope Conflict — Read This First

This ticket overlaps an existing, completed discovery lineage. **`UXD-HOTEL-RESTAURANT-HOURS-01`
(2026-07-31) already owns the general problem** this ticket restates: on-site dining beyond
breakfast, restaurant and room-service availability, operating-hour reliability, late arrivals,
breakfast-inclusion separation, safe unknown-hours presentation, and no reservation promise. That
lineage ran to a design spec:

| Doc | Path | Status |
| --- | --- | --- |
| Discovery | `docs/pipeline/hotel-restaurant-hours/01-discovery.md` | Complete (82 lines) |
| Research | `docs/pipeline/hotel-restaurant-hours/02-research.md` | Complete (255 lines) |
| Design | `docs/pipeline/hotel-restaurant-hours/03-design.md` | Complete (653 lines) |

Re-deriving that problem statement would produce a second, competing owner for the same evidence
contract, the same copy, and the same block position — the exact duplication that lineage's own
research brief was told to prevent (`02-research.md`, directive on canonical location).

**Therefore this discovery does not restate the dining-hours problem.** It defers to
`hotel-restaurant-hours` as the canonical owner and scopes itself to the two things that lineage
does not cover, both of which are named or implied by this ticket and are genuinely unowned:

1. **Dining dependency for limited-mobility stays** — this ticket's `limited-mobility stays` clause.
   `hotel-restaurant-hours` frames the user as time-constrained (late arrival, early departure). It
   never addresses the traveler for whom leaving the property is the constraint, and never composes
   dining evidence with the step-free-route evidence the app already models.
2. **The reachability gap** — `hotel-restaurant-hours` reached a design spec and stopped. Nothing
   shipped. No user has yet seen any dining signal, so the problem this ticket describes is still
   fully live regardless of how good that spec is.

If the board intends this ticket as a straight re-run of `HOTEL-RESTAURANT-HOURS`, it should be
closed as a duplicate and that lineage resumed at `UI-HOTEL-RESTAURANT-HOURS-01` instead. This
report proceeds on the reading that the `limited-mobility` clause is the intended new work.

---

## 1. Problem Statement

A traveler who cannot practically leave the property to eat — because of limited mobility, a late
arrival into an unfamiliar area, or both — cannot tell from an expaify hotel deal whether that
property will actually feed them, because expaify models *step-free access to a room* and *breakfast
paid for by a rate* but never models whether a food service exists, when it operates, or whether the
traveler can physically reach it.

The failure is not a missing amenity list. It is that the two facts which together answer "can I eat
here" are owned by two different, non-communicating parts of the product, and neither one alone is
decisive: a confirmed step-free route to a room says nothing about a restaurant, and a confirmed
restaurant says nothing about whether a wheelchair user can get to it or order to the room instead.

---

## 2. Who Is Affected, And Where In The Flow

The affected traveler is making a **dependency** decision, not a preference decision. For them a
wrong choice is not a worse dinner; it is no dinner.

Three populations, in priority order:

1. **Limited-mobility guests.** Leaving the property costs materially more effort and risk than for
   other guests, and may be infeasible after dark, in bad weather, or without step-free routes to
   off-site options. On-property food is not a convenience; it is the plan. Room service is not a
   luxury tier; it is frequently the only workable channel, and its absence is decision-changing.
2. **Late arrivals with no viable alternative.** Arriving after local dinner service in an
   unfamiliar area. Owned as a time problem by `hotel-restaurant-hours`; listed here only because
   this population and population 1 overlap heavily and share one surface.
3. **Travelers deliberately choosing a self-contained stay.** Secondary; inherits whatever the other
   two populations get.

**Where the decision happens:** the hotel deal detail surface, during comparison and immediately
before the provider handoff — `app/deals/[dealId]/page.tsx`, which already renders an ordered
decision sequence (`data-hotel-decision-section`: `property_stay` → `price_deal_score` → …). This
is the last expaify-controlled surface where the traveler can still eliminate a property. After
handoff the question can only be answered by phoning the hotel.

**Explicitly not the scan/results surface.** `HotelCard` already carries price, Deal Score, class,
rating, eligibility, admission, parking, transport, funds policy, pet, smoking, and access blocks.
The card is at its density limit at 375px. Discovery's position is that dining is a detail-surface
fact, consistent with the `hotel-restaurant-hours` design decision.

---

## 3. Measurable Signal That The Problem Exists

Verified against the current worktree, not assumed:

| Check | Result |
| --- | --- |
| Dining/restaurant/room-service type in `lib/types.ts` | **None.** `HotelOffer` (`lib/types.ts:751–779`) carries 20+ evidence fields; no dining field. |
| Dining ids in the amenity normalizer | **None.** `ACCESS_FACTS` (`lib/providers/hotelAmenityEvidence.ts:18–26`) allowlists elevator, on-site parking, step-free route, and four room preferences; unrecognized ids are discarded. |
| Any schedule/hours representation in evidence | **None.** `HotelAmenityEvidence` (`lib/types.ts:138–148`) has no time, time-zone, or exception-date field. `HotelTransportHoursMode` exists but is transport-scoped. |
| What the traveler is told about food today | **One dead-end line.** `RoomRateDetailsPanel` (`app/components/HotelCard.tsx:728–731`) renders the static string *"Meal plan not provided by this provider for this rate."* |
| Step-free route composed with dining | **Never.** `step_free_route` is scoped entrance→room (`HotelCard.tsx:89, 186`). No common-area or dining-venue route fact exists. |
| Live supplier capability | **Zero.** The wired hotel provider is Hotellook, which returns `{ offers: [], coverage: 'unconfirmed' }` (`lib/providers/hotellook.ts:491`) and is documented as a dead API. |

So the observable baseline is unambiguous and is **zero across the board**: dining availability
statements shown: 0; operating-hours statements: 0; room-service statements: 0; statements composing
mobility access with a dining venue: 0.

Two consequences research must respect:

- **The static "Meal plan not provided" line is an active trust liability, not a neutral gap.** It is
  the only food-adjacent string on the surface, it is rate-scoped, and it renders unconditionally
  regardless of what any provider returned. A traveler reading it can reasonably infer the property
  has no meal service. That is an unsupported dining assumption *manufactured by our own UI* — the
  precise failure mode this ticket asks us to reduce.
- **No baseline can be measured from production, because no supplier returns the data.** Research
  must instrument first and must not fabricate a comprehension baseline. Any comprehension measure
  in this ticket's success criteria has to come from moderated evaluation against fixtures, exactly
  as `hotel-restaurant-hours/03-design.md` §1 already established with its research-prototype mode.

---

## 4. The Unowned Delta: Dining As A Composed Fact

This is the substantive contribution of this discovery, and the reason it is not a duplicate.

For a limited-mobility guest, "usable on-site dining" is a **conjunction of three independent facts,
each of which can independently fail**:

1. **Service exists** — a restaurant or room service is offered. *(Owned by `hotel-restaurant-hours`.)*
2. **Service operates when needed** — hours overlap the required property-local window. *(Owned by
   `hotel-restaurant-hours`.)*
3. **The guest can reach the service, or the service can reach the guest** — a step-free route to the
   dining venue exists, or room service delivers to the room. ***Unowned by any lineage.***

Fact 3 is where the product currently fails this population, and it has a specific structural
property that makes it worth its own discovery: **when fact 3 fails, fact 1 and fact 2 being
confirmed makes the outcome worse, not better.** A property showing "Restaurant · 6:00 PM–11:00 PM,
confirmed" reads as solved to a wheelchair user, right up until they discover the restaurant is up
four steps on a mezzanine. A confirmed positive on an incomplete conjunction is more dangerous than
an honest unknown. Any design that renders facts 1 and 2 without addressing fact 3 will actively
increase unsupported dining assumptions for this population while decreasing them for everyone else.

Adjacent lineages get close and stop short:

- `accessibility-stay-fit/02-research.md:180` and `hotel-accessibility-needs/02-research.md:142`
  both propose an `accessible_common_areas` fact — "step-free access to lobby, **dining**, pool" —
  property-scoped. This is the closest existing candidate for fact 3, but it bundles dining with
  unrelated spaces, so a confirmed value cannot answer "can I reach the restaurant" specifically,
  and neither lineage connects it to any dining service.
- `hotel-rate-inclusions` owns *breakfast included* as a rate-scoped price fact and must keep it.
  It is not, and must never be presented as, a dining-availability fact.

**The relationship this ticket must settle is ownership, not invention.** Research should almost
certainly recommend extending the `hotel-restaurant-hours` evidence contract with a reachability
dimension rather than creating a fourth parallel dining model.

---

## 5. Prioritized Questions For Research

1. **Conjunction semantics.** When service and hours are confirmed but reachability is unknown, what
   may expaify claim? Discovery's position, to be validated: **no positive fit claim** — an
   unresolved reachability dimension caps the strongest available statement at "may fit," never
   "fits." Establish whether users read a capped claim as useful or as noise.
2. **Room service as an accessibility channel.** Does confirmed room service substitute for an
   unreachable restaurant for this population, and under what conditions (hours, fee, delivery to
   room confirmed)? Do not assume equivalence; `hotel-restaurant-hours` already treats channels as
   independent and user-selected.
3. **Ownership.** Should reachability extend the dining evidence contract, extend
   `accessible_common_areas`, or be a distinct venue-scoped route fact? Recommend exactly one
   canonical owner and state how it composes with the other.
4. **The "Meal plan not provided" line.** Is removing or rewording this static string a
   prerequisite repair that should ship independently of, and ahead of, any dining evidence work?
   Discovery's position: yes, and research should size it as a standalone repair.
5. **Trust threshold.** What evidence is sufficient to tell a limited-mobility traveler a property
   is workable, given no supplier currently returns any of it, and given that property-level facts
   never guarantee a selected stay?

---

## 6. Constraints The Solution Must Respect

1. **Data integrity.** Never infer dining from breakfast inclusion, hotel class, marketing copy, or
   a photo. Never infer reachability from `step_free_route`, which is scoped entrance→room and says
   nothing about a dining venue. `unknown`, `not_returned`, and stale must stay distinct from
   `unavailable`, and an unknown reachability dimension must never be silently dropped from a fit
   calculation. No positive claim without a provider-backed value passing the normalized contract.
2. **Architecture and domain boundaries.** All facts arrive through `lib/providers` under
   `Result<T>`; no vendor call or hours parsing in a component. Any fee uses
   `{ priceCents, currency }`. Do not duplicate the `hotel-restaurant-hours` evidence contract —
   extend it. Do not repurpose `hotel-rate-inclusions`' breakfast fact. Excluded: menus, cuisine,
   dietary suitability, reservations, live capacity, delivery apps, off-property dining, minibar.
3. **Accessibility and layout.** The population most affected by this feature is the population most
   affected by inaccessible UI. Match/mismatch may not be conveyed by colour alone; hours need
   property-local-time labels in text; the block must not displace price, Deal Score, or the handoff
   affordance at 375px or 1280px; no reliance on hover.

---

## 7. Success Statement

This is solved when a first-time user who depends on eating at the property — because of limited
mobility, a late arrival, or both — can decide from the hotel deal detail surface whether that
property offers a food service they can actually use, with the service, its operating hours, and
their ability to reach it each stated separately and each honestly marked as confirmed, unavailable,
or unknown, without expaify claiming a fit while any of the three is unresolved, and without any
statement on the surface implying an absence of dining that no provider actually reported.

---

## 8. Out Of Scope

Restaurant reservations and table booking; menus, cuisine, pricing, and dietary accommodation;
off-property dining discovery or delivery; minibar and vending; general amenity browsing; breakfast
inclusion and rate-level meal plans (owned by `hotel-rate-inclusions`); front-desk hours; the
generic late-arrival dining-hours problem in its already-owned form (owned by
`hotel-restaurant-hours`); post-booking property contact; and any change to search, ranking, Deal
Score, or the scan-level `HotelCard`.

---

## 9. Handoff

`UXR-HOTEL-ONSITE-DINING-01` must begin by reading
`docs/pipeline/hotel-restaurant-hours/{01-discovery,02-research,03-design}.md` in full and must
treat that lineage as the canonical dining owner. Its brief is **not** to redo that research. It is
to:

1. Confirm or refute §0's duplication finding and give the board a clear recommendation: close this
   ticket as duplicate, or proceed on the reachability delta.
2. Audit `accessible_common_areas` across `accessibility-stay-fit` and `hotel-accessibility-needs`
   and recommend one canonical owner for dining reachability (§5.3).
3. Settle conjunction semantics for a three-dimension fit where any dimension may be unknown (§5.1).
4. Size the `RoomRateDetailsPanel` "Meal plan not provided" repair as a standalone item (§5.4).
5. Produce 3–5 testable directives covering claim ceilings, unknown-dimension handling, detail-surface
   placement relative to the existing `hotel-restaurant-hours` block, and instrumentation.

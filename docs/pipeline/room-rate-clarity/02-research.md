# UX Research: Room And Rate Clarity

Ticket: `UXR-ROOM-RATE-CLARITY-01`
Stage: UX Research
Priority: P0
Date: 2026-07-21

## Source Inputs

- Discovery report: `docs/pipeline/room-rate-clarity/01-discovery.md` (copied into this worktree from the `UXD-ROOM-RATE-CLARITY-01` worktree — see **Process Note** below)
- Current implementation audited:
  - `lib/types.ts`
  - `lib/providers/hotellook.ts`
  - `lib/providers/bookingComRapidApi.ts`
  - `app/components/HotelCard.tsx`
  - `app/book/BookingFlow.tsx`
  - `app/deals/[dealId]/page.tsx`
- Adjacent pipeline docs cross-checked: `docs/pipeline/hotel-amenity-provenance/01-discovery.md` + `02-research.md`, `docs/pipeline/deal-supporting-facts-order/02-research.md`, `docs/pipeline/hotel-rating-source-confidence/*`, `docs/pipeline/hotel-price-visibility/02-research.md`
- Ticket board state (`GET /api/tickets`) checked for in-flight overlap: `UXD-CANCELLATION-POLICY-01`, `UXR-HOTEL-QUALITY-SNAPSHOT-01`, `UXR-PRICE-ACCURACY-FEEDBACK-01`
- Reference pattern: Booking.com and Google Hotels single-rate-card interaction pattern (rate-plan name, refundable badge, cancellation deadline), evaluated at the interaction-pattern level, not visual style

## Process Note (flag, not a blocker)

`docs/pipeline/room-rate-clarity/01-discovery.md` did not exist in this worktree at task start — the discovery ticket (`UXD-ROOM-RATE-CLARITY-01`) is complete but still sitting in `review` status in its own worktree (`/Users/admin/dev/agent-worktrees/UXD-ROOM-RATE-CLARITY-01`), not yet integrated to `main`. I copied the finished discovery doc into this worktree unchanged so this research could proceed against the real discovery output rather than re-deriving it from the ticket description. The monitor should confirm both docs land together when `UXD-ROOM-RATE-CLARITY-01` and this ticket integrate, so the discovery doc isn't duplicated or orphaned.

## Research Question

Can a user, from the expanded state of a single hotel card, tell what room/bed they're booking, whether a meal plan is included, and whether the rate is refundable and by when — without leaving expaify? If not, is that a copy problem or a data problem?

## Research Summary

It's a data problem, not a copy problem, and no amount of UI rework changes that today. `HotelOffer` has zero fields for room type, bed configuration, meal plan, refundability, or cancellation deadline (`lib/types.ts:137-151`). The only live hotel provider, Hotellook's `cache.json` endpoint, is a **price-aggregator cache** — it returns the cheapest known price per property (`priceFrom`), not a bookable rate, and its response shape has no room/rate/cancellation fields to normalize from (`lib/providers/hotellook.ts:11-26`, confirmed live request shape at `lib/providers/hotellook.ts:429-436`: `location`, `checkIn`, `checkOut`, `currency`, `token`, `limit` — no rate-plan or room parameters, and the response contract the adapter parses (`isHotelLookEntry`, `lib/providers/hotellook.ts:37-39` and the `HotelLookOffer` mapping at `lib/providers/hotellook.ts:448-487`) never reads a room/bed/meal/cancellation field because the upstream payload doesn't carry one). `bookingComRapidApi.ts` implements `FlightProvider`, not `HotelProvider` (`lib/providers/bookingComRapidApi.ts:1`), so it cannot be repurposed as a second hotel data source without new provider work.

The honest scope for this stage is: **define the disclosure states for data expaify does not have**, flag the provider gap as a DEV blocker, and stop the same "confirmed after handoff" sentence from being the only thing said about room/rate/cancellation on three separate surfaces with three slightly different wordings.

## Task 1 — Is Room/Rate/Cancellation Data Obtainable From Hotellook Today?

No undocumented field, details endpoint, or affiliate widget path exists in this codebase that would supply it.

- The adapter's only network call is to `ENGINE_BASE = https://engine.hotellook.com/api/v2/cache.json` (`lib/providers/hotellook.ts:5`). There is no second call, no `hotels_page`/lookup/details endpoint, and no widget/iframe embed anywhere in `lib/providers/hotellook.ts` (grepped for `widget`, `iframe`, `room`, `rate`, `cancel` — zero matches beyond this research).
- `cache.json` is documented (and behaves here) as Hotellook/Travelpayouts's price-cache product: it answers "what's the cheapest nightly price we've seen for this property recently," not "what specific rate is bookable right now." That is a fundamentally different data product from a live rate-shopping API (which Hotellook/Travelpayouts also sell, under different endpoints/contracts, e.g. their "Hotels" booking API) — this codebase only integrates the cache product.
- The deeplink the adapter builds (`buildDeeplink`, `lib/providers/hotellook.ts:405-407`) sends the user to a generic `hotellook.com/hotels/{id}` property page via an affiliate redirect (`tp.media/r?marker=...`), not to a specific rate or room. There's no rate ID or room ID anywhere in the data model to deep-link into.
- **Conclusion: this is a provider-integration blocker, not a mapping gap.** Getting real room/bed/meal/refundable/cancellation data requires a new provider contract (a live rate-shopping API — e.g., Hotellook's booking/live-price product if terms allow, or a net-new provider under `HotelProvider`) that returns rate-level data, plus a `HotelProvider` interface change to carry it. UXDES and DEV should not spec or build toward populated room/rate states against Hotellook `cache.json`; the achievable deliverable this cycle is the **disclosure layer**, not the data.

## Task 2 — Overlap Audit: Avoid Duplicate/Conflicting Copy

Three other pieces of work touch this same territory. None of them has shipped conflicting copy yet, but two are live risks if this ticket's directives aren't coordinated with them.

1. **`UXD-CANCELLATION-POLICY-01`** (in_progress, worktree `uxd-cancellation-policy-01`) — scoped specifically to cancellation windows, refundability, and prepayment terms across hotel results, deal detail, and booking CTA handoff. Its prior run failed before producing a discovery doc (Fable credit error, confirmed: `docs/pipeline/cancellation-policy/` does not exist in that worktree). **This ticket and `UXD-CANCELLATION-POLICY-01` will collide on the same three surfaces** (`HotelCard.tsx`, `deals/[dealId]/page.tsx`, `BookingFlow.tsx`) if both proceed independently. Directive 3 below scopes this ticket's cancellation-deadline handling to the **disclosure-of-absence** state only (we don't have the data), leaving the full "cancellation policy confidence" UX (e.g., how to display a real deadline once obtained, policy comprehension copy) to `UXD-CANCELLATION-POLICY-01`'s eventual output. Flagging for the monitor: consider sequencing so `UXD-CANCELLATION-POLICY-01` is re-run before its downstream design stage, using this brief as a cross-reference so the two don't produce two different "not confirmed" sentences.

2. **`docs/pipeline/hotel-amenity-provenance/`** (research complete, stalled before design — confirmed via `UXR-HOTEL-QUALITY-SNAPSHOT-01` ticket description, which explicitly notes "no code, no 03-design.md") — covers general facility amenities (Wi-Fi, breakfast, parking, pool, pets). Its research brief already flags the exact seam this ticket must respect: *"Meal plan as a rate inclusion (e.g. room-only vs. bed-and-breakfast rate category) is conceptually distinct from breakfast as a facility amenity, but the two will read as duplicative to a user if both stages ship independent 'breakfast' copy blocks"* (`docs/pipeline/hotel-amenity-provenance/01-discovery.md:42`, restated in that doc's own research). Directive 4 below draws the line explicitly: this ticket owns **meal plan as a rate inclusion** ("this quoted rate includes/excludes breakfast" or "not provided"); amenity-provenance work owns **breakfast as a property facility** ("this property offers a breakfast service, provider-confirmed / not returned"). They must never both render on the same card as bare "Breakfast" chips with no rate-vs-property qualifier, or a user will read them as two different claims about the same thing.

3. **`docs/pipeline/deal-supporting-facts-order/02-research.md`** — already directs that hotel cards must show visible handoff-risk copy before the CTA (Directive 5 of that brief: `"Taxes, fees, room availability, cancellation policy, and terms are confirmed by the provider."`). That directive predates this ticket and is why `providerConfirmationCopy` exists in its current form. This ticket does not overturn that directive — a pre-CTA handoff-risk line is correct and should stay — but it does correct what the *expanded* details panel says beyond that one line, since right now the expanded panel repeats the identical collapsed-adjacent sentence instead of giving the user the room/meal/refundable states they opened Details to find (see Task 3).

**Duplication already in production code, independent of any of the above tickets:** the near-identical sentence *"Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms"* is hardcoded separately in three places — `app/components/HotelCard.tsx:417`, `app/book/BookingFlow.tsx:18` (`hotelTermsCopy`), and a shorter variant at `app/deals/[dealId]/page.tsx:332` (`"...cancellation policy, and final total are confirmed by the provider"` — note this variant drops "room availability" entirely). This is a pre-existing inconsistency this ticket surfaces but does not need to fix by itself; flagging as a finding for UXDES to resolve (likely a single shared copy constant) since it's directly adjacent to this ticket's scope.

## Task 3 — Attribute Priority Hypotheses

Ranked by decision impact on CTA trust — i.e., how much withholding this attribute increases the chance a user clicks through, discovers something disqualifying on the provider site, and bounces (or worse, books the wrong thing).

| Rank | Attribute | Why it ranks here | Disclosure rule (provider-backed vs. not-provided) |
|---|---|---|---|
| 1 | **Refundable flag** (refundable / non-refundable / unknown) | Binary, highest regret risk. A user who assumes "of course I can cancel" and can't loses real money — this is the single attribute most likely to produce a support complaint or chargeback dispute. It's also the cheapest to disclose honestly even at "unknown," because "unknown" is itself decision-relevant (it tells the user to verify before paying). | **Provider-backed:** show `Refundable` / `Non-refundable` as a labeled state, sourced from real rate data, never inferred from price tier or hotel class. **Not provided (current Hotellook reality):** show `Refundability not provided by this provider — confirm before payment`, not silence and not a soft assumption either way. Never default to implying refundable. |
| 2 | **Cancellation deadline** (date/time by which refund applies) | Only meaningful once refundable=true is known; a deadline without a refundable flag is misleading (implies refundability). Time-boxed regret: booking early for a "deal" only to have the free-cancellation window closer than expected is a common trust break in travel UX. | **Provider-backed:** show the exact deadline in the user's terms ("Free cancellation until [date]"), always paired with the refundable badge, never standalone. **Not provided:** fold into the refundable-flag disclosure above — do not invent a placeholder deadline or a generic "usually 24-48 hours" default. |
| 3 | **Room type / bed configuration** | Determines fitness for purpose (family needs two beds, accessibility needs, privacy expectations) more than it determines financial risk. Wrong-room surprises are frustrating but rarely as costly as a lost non-refundable payment. Still ranks above meal plan because it affects whether the stay is usable at all for the traveler's party. | **Provider-backed:** show room name/type and bed config as returned (e.g., "Standard Room, 1 King Bed"), verbatim from provider vocabulary — do not paraphrase into a category expaify invents. **Not provided:** `Room type not provided by this provider` in the expanded panel; never show a generic "Standard Room" placeholder that looks provider-sourced. |
| 4 | **Meal plan** (room-only / breakfast included / other) | Real cost-comparison factor (a cheaper room-only rate can be more expensive than a pricier breakfast-included rate once you'd pay for meals anyway) but the least regret-critical of the four — discovering it on the provider page is an inconvenience, not a financial or logistical failure the way refundability or room fitness are. | **Provider-backed:** show as a rate inclusion using the provider's own rate-plan label where possible (e.g., "Rate includes breakfast" sourced from a rate-plan name/flag, not inferred from hotel class or price). **Not provided:** `Meal plan not provided by this provider`. Must use language that is unambiguously about *this rate*, not the property in general, to avoid colliding with amenity-provenance's property-level "breakfast service" chip (see Task 2, item 2). |

All four are currently **not provided** under Hotellook `cache.json` (Task 1 finding), so today every one of these ships in its "not provided" state. The ranking still matters because it tells UXDES which disclosure gets top placement in the expanded panel (refundable-flag disclosure first, cancellation-deadline immediately adjacent, then room/bed, then meal plan) and which attribute justifies prioritizing a future provider-integration ticket if/when DEV picks this up (refundable flag first).

## Task 4 — Reference Pattern Comparison (Interaction Level)

**Booking.com single-rate card pattern** (property page, per-rate row — interaction pattern, not visual style):

- Each bookable rate is its own row with: rate-plan name (e.g., "Standard Room - Non-refundable" or "Deluxe Room, 1 King Bed"), a short bed/occupancy line, a meal-plan line when applicable ("Breakfast included" / no line when room-only), and a cancellation line that is either a green "Free cancellation until [date]" or a red/neutral "Non-refundable" — always co-located with the room row, never in a separate global disclosure block.
- Critically: **the refundable/non-refundable state is a first-class, per-rate visual fact shown before the user picks a rate**, not something deferred to a "we'll confirm this later" disclaimer. Booking.com never tells a user "cancellation policy will be confirmed by the provider" — because Booking.com *is* effectively showing provider-sourced rate data inline; the equivalent honest move for expaify (which does not have that data) is to say so explicitly rather than mimic the confident tone without the underlying data.

**Google Hotels pattern:** similarly attaches "Free cancellation," a specific deadline, and meal inclusion directly to the price line for each bookable option, sourced per-partner, with a visible per-partner "why this price" / policy note rather than one generic paragraph.

**Delta versus expaify:**

- expaify has exactly one "rate" per hotel (the aggregator's `priceFrom`), so there is no per-rate row to attach refundable/meal/room facts to even if the data existed — this is a structural difference from Booking.com/Google's multi-rate list, not just a missing-field problem.
- expaify's current copy pattern (`providerConfirmationCopy`) inverts the reference pattern: instead of stating the fact inline (refundable/non-refundable, deadline, room), it states that the fact *will be revealed later, elsewhere*. The reference pattern only defers to the provider for identity-level content it can't source (final tax total, live inventory at click-time) — it never defers a fact that it does or should have (refundability, room, meal) to "provider will confirm."
- **The fix expaify can make today, without new provider data, is interaction-pattern alignment on tone and placement, not content:** move from one deferred-disclosure sentence to explicit per-attribute "not provided by this provider" states, placed where the reference pattern places the real facts (adjacent to price, before the CTA reasoning), so the *absence* of data reads as an honest, specific gap rather than a vague promise.

## Task 5 — Is Refundable/Non-Refundable Comparison Across Two Cards Feasible?

**No — not under current single-provider data, and this ticket should say so rather than scope around it.**

- Cross-card comparison (e.g., filtering or sorting hotel results by refundability, or showing a comparison badge across the results list) requires the refundable flag to exist on `HotelOffer` for every card in the result set. It does not exist for any card today, and Task 1 established that Hotellook `cache.json` cannot supply it. Building a comparison UI against a field that is always "not provided" would either be dead UI (every card shows the same disclosure) or, worse, tempt a future implementer to leave the comparison affordance in place while quietly relaxing the "don't invent data" constraint to make it look populated.
- **Recommendation: scope this ticket's UI deliverable strictly to the expanded single-card view**, consistent with the discovery doc's constraint #3 (no room inventory browser, no multi-rate comparison table). Do not add a collapsed-card refundable badge, a results-list filter, or any UI element whose value proposition is "compare across hotels" — there is nothing real to compare yet.
- If/when a live rate-shopping provider is integrated (Task 1's DEV blocker is resolved), cross-card refundable comparison becomes a legitimate, separate downstream ticket — it should not be pre-built as a disabled/placeholder state now, per the no-placeholder-copy constraint in `AGENTS.md`.

## Exact Gap Summary

| Surface | Current code does | Reference pattern does | Delta |
|---|---|---|---|
| `HotelOffer` type | No room/bed/meal/refundable/cancellation fields (`lib/types.ts:137-151`). | Rate-plan objects carry room, bed, meal, and cancellation as structured per-rate fields. | Type contract has no place to put this data even if a provider returned it. |
| Hotellook adapter | Normalizes only price-aggregator fields; no rate-level data in the upstream payload at all (`lib/providers/hotellook.ts:11-26`, `396-495`). | Rate-shopping APIs return per-rate room/meal/cancellation data. | Structural provider gap — cannot be fixed by better mapping. |
| `HotelCard.tsx` expanded panel | One static sentence defers room availability + cancellation policy to "after you leave" (`app/components/HotelCard.tsx:417`, rendered `571-579`). | Per-rate row states the fact (or its provider-sourced absence) inline, before the CTA decision. | Tone inversion: expaify defers facts it should disclose as absent; reference pattern states facts (or would state absence, if it had a gap, which it typically doesn't). |
| Cross-surface copy | Near-duplicate sentence hardcoded independently in `HotelCard.tsx`, `BookingFlow.tsx`, and a shorter variant in `deals/[dealId]/page.tsx` (one drops "room availability"). | N/A (single source of truth expected). | Inconsistent disclosure across the three surfaces a user sees before/at handoff. |
| Cross-ticket scope | Amenity-provenance (breakfast-as-facility) and cancellation-policy (deadline UX) tickets are adjacent but not yet coordinated with this one. | N/A | Risk of two "breakfast" or two "cancellation" copy blocks shipping independently and reading as contradictory. |

## Design Directives For UXDES

1. **Design the "not provided" disclosure states first, as the shipped deliverable — not as a fallback for a populated state that doesn't exist yet.** For each of refundable flag, cancellation deadline, room/bed, and meal plan: define exact copy for (a) provider-backed present, (b) provider explicitly returned unavailable/none, (c) not returned by provider, and (d) loading/error — independent from hotel inventory loading. Given Task 1's finding, only states (c) and (d) are reachable with Hotellook today; states (a) and (b) must still be fully specified (with real copy, not TODO) so they're ready the moment a rate-shopping provider lands, per the discovery doc's provider-boundary constraint.

2. **Replace the single deferred-disclosure sentence in `HotelCard.tsx`'s expanded panel with four explicit per-attribute lines**, ordered by the Task 3 ranking: refundable-flag state, cancellation-deadline state (visually subordinate to/paired with refundable), room/bed state, meal-plan state. Each line must independently say provider-backed or not-provided — do not collapse them back into one sentence, since one sentence is exactly the pattern that made all four attributes invisible as distinct facts in the first place.

3. **Scope cancellation-deadline copy to the disclosure-of-absence state only in this ticket's deliverable**, and hand the fuller "cancellation policy confidence" UX (comprehension aids, policy-education copy, refundable-rate-first sorting) to `UXD-CANCELLATION-POLICY-01` once it produces a discovery doc. Do not design a populated cancellation-policy education panel here — that duplicates a ticket already scoped to own it.

4. **Draw an explicit line between "meal plan" (this rate) and "breakfast" (this property)** so this ticket's meal-plan disclosure and the amenity-provenance work's future breakfast-facility chip never render as two unqualified "Breakfast" labels on the same card. This ticket's copy must always scope to the rate ("This rate does not specify meal plan") — never a bare "Breakfast" chip that could be read as a property amenity.

5. **Unify the three duplicated handoff-copy instances** (`HotelCard.tsx:417`, `BookingFlow.tsx:18`, `deals/[dealId]/page.tsx:332`) into one copy source with one wording, fixing the `deals/[dealId]` variant that currently drops "room availability." This is a small, low-risk copy consolidation adjacent to this ticket's scope — flag it explicitly for DEV as a shared-constant extraction, not a redesign.

6. **Do not design any cross-card comparison UI** (results-list refundable filter/badge, comparison table). Per Task 5, scope entirely to the expanded single-card view. If the design spec includes a comparison mockup "for later," it violates the no-placeholder-copy / no-room-inventory-browser constraints from discovery.

7. **Flag the provider gap as a DEV blocker in the design spec itself**, not just in this doc — the spec's acceptance criteria should state explicitly that DEV work for populated (provider-backed) states requires a new `HotelProvider`-conformant rate-shopping integration and a `HotelOffer` type extension, and that this is out of scope for a UI-only implementation pass.

## Acceptance Criteria For UXDES

- Design covers, for each of refundable flag / cancellation deadline / room-bed / meal plan: provider-backed, provider-returned-unavailable, not-returned, loading, and error states, with final copy for each (no placeholders).
- The four attributes render as individually labeled facts in the expanded panel, not as one paragraph.
- Cancellation-deadline copy in this spec is limited to the not-provided disclosure; it does not build out a full policy-education surface.
- Meal-plan copy is explicitly rate-scoped and textually distinct from any property-level "breakfast" amenity language.
- No collapsed-card or results-list comparison UI for refundability is included.
- The spec calls out the shared-copy-constant fix for the three duplicated handoff sentences.
- The spec states plainly, as an acceptance item, that provider-backed states require new DEV provider work and are not implementable against Hotellook `cache.json` today.
- Mobile (375px) and desktop (1280px) layouts for the four new disclosure lines fit inside the existing expanded panel without displacing Deal Score, quality evidence, location, or price-scope sections.

## Risks And Constraints

- The dominant risk is scope creep into "build a rate-shopping integration" — this ticket and its design output must stay UI/disclosure-only; the provider gap is explicitly a DEV blocker for a future ticket, not something to route around with inferred data.
- `UXD-CANCELLATION-POLICY-01` is currently blocked (no discovery doc, prior Fable credit failure) — if it resumes and produces conflicting cancellation UX before this ticket's design/UI stages land, the monitor should reconcile which ticket owns final cancellation-deadline copy before both ship.
- `hotel-amenity-provenance` is fully researched but has no design/dev output yet (confirmed via `UXR-HOTEL-QUALITY-SNAPSHOT-01`'s description) — if it resumes independently, its breakfast-facility chip and this ticket's meal-plan-not-provided line must be built against a shared vocabulary (Directive 4) or reviewed together before merge.
- Existing non-negotiables apply unchanged: any future provider data flows through `lib/providers` as `Result<T>`, money stays integer cents, secrets from env only, outbound deeplinks keep affiliate markers, and nothing here invents or infers a room/rate/cancellation value that wasn't provider-sourced.

## Out Of Scope Findings

- Fixing the three-way copy duplication is flagged (Directive 5) but is a small adjacent finding, not this ticket's core deliverable — UXDES should treat it as a low-effort inclusion, not a blocker to the main disclosure-state work.
- A future rate-shopping provider integration (the actual fix for "no data") is out of scope for UXR/UXDES/UI stages entirely and should become its own DEV-track ticket once product/legal confirms terms for a Hotellook live-rate product or an alternative hotel rate-shopping vendor.
- `AUDIT-HOTEL-ROOM-RATE-BASIS-01` (done) covered nightly/total/taxes/occupancy pricing-basis clarity, a related but distinct concern from room/rate/cancellation attributes; no conflict found with this brief's directives.

## Handoff

Create `UXDES-ROOM-RATE-CLARITY-01` for implementation-ready design of the room/rate/cancellation disclosure states on the expanded hotel card, scoped to the not-provided states as the primary deliverable per Task 1's provider-gap finding.

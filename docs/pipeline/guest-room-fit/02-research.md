# UX Research: Guest and Room Fit

Ticket: `UXR-GUEST-ROOM-FIT-01`
Stage: UX Research
Priority: P1
Date: 2026-07-21
Persona: Senior UX Researcher

## Source Inputs

- Discovery report: `docs/pipeline/guest-room-fit/01-discovery.md` — **not present on disk at research time** (see Blocker). The full problem statement is carried verbatim in the `UXR-GUEST-ROOM-FIT-01` ticket description and is used as the discovery input for this stage.
- **Settled foundation (reuse, do not re-derive):**
  - `docs/pipeline/hotel-amenity-provenance/01-discovery.md` and `02-research.md` — established the provider-neutral hotel **evidence contract** this ticket extends: each fact carries a canonical id, display label, `status` of `confirmed` / `unavailable` / `not_returned` / `unknown`, source label, confidence, optional `fetchedAt`, and optional `scope` (`property` / `room` / `rate` / `selected_stay`) and `fee`. It also set the rules: never render `No <fact>` for missing data, never imply selected-stay availability without provider support, never use color/icon as the only status signal.
  - `docs/pipeline/hotel-amenity-fit/02-research.md` — established comprehension as the dominant risk with a sparse provider (Hotellook returns no structured fields), the three-state legibility model (`confirmed` ≠ `unavailable` ≠ `not_returned`), the "absence-of-data must be legibly different from confirmed-absence" gate, and the surface-wiring gap (`HotelCard` is not mounted in a live results page).
  - `docs/pipeline/hotel-location-decision-context/02-research.md` — established that `HotelOffer` carries only coarse fields, that the Hotellook adapter erases precision, and that `HotelCard`'s expanded panels are the correct home for provider-evidence blocks.
- Current implementation audited directly this stage (read, not assumed):
  - `lib/types.ts` (`HotelOffer`, lines 137–151; `HotelProvider.searchHotels` 179–183)
  - `lib/providers/hotellook.ts` (live map 448–487; cache map 318–381; `priceFromToCents` 383–394)
  - `app/api/search/route.ts` (passenger parse 107–113, 242; hotel call 396–423)
  - `app/components/HotelCard.tsx` (collapsed 425–521, expanded 523–582)
  - `app/page.tsx` (marketing/deals landing — no live search form)
- Reference patterns checked at the interaction level (not visual style):
  - Booking.com — room-row occupancy + bed-configuration rows ("max N guests", "1 double bed", child/extra-bed policy).
  - Google Hotels — guest-count selector at search and per-result occupancy fit.

## Research Question

Can a solo / couple / family / small-group traveler tell whether a hotel result **safely fits their party** — how many people the room holds, what beds it has, whether children are allowed — from the deal card or expanded detail, **without misreading "the provider did not return room details" as "this room does not fit"**, given a provider (Hotellook) that returns only a hotel-level "from" price with no room or occupancy binding?

## Research Summary

No. Room fit is **structurally absent** end to end, exactly as the ticket states:

- `HotelOffer` (`lib/types.ts:137`–`151`) has no occupancy, bed-configuration, or child-policy field. `NormalizedHotelOffer = HotelOffer`, so the search stream and every card inherit the gap.
- `HotellookProvider` maps price, location, hotel class, and guest rating for both live and cached paths, and nothing else. A search of the adapter for `occup|bed|sleeps|guest count|children|child|room type` returns no mapping.
- `/api/search` reads `passengers` (`parsePassengers`, 1–9) and passes it **only to flight providers** via `range.passengers`. The hotel call is `searchHotels(destIATA, { checkin, checkout })` (`app/api/search/route.ts:397`) — no party size reaches hotels.
- `HotelCard` has a mature evidence architecture (`QualityEvidencePanel`, location panel, price-scope panel) but **no room-fit region** in either collapsed or expanded state.

Two facts shape every directive below and are the reason this cannot be a naïve "show occupancy" feature:

1. **The price on the card is a hotel-level "from" price with no known occupancy.** `priceFromToCents` converts Hotellook's `priceFrom` lead-in rate (`lib/providers/hotellook.ts:383`); `HotelOffer.priceBasis = 'per_night_before_taxes_fees'`. Nothing tells the user *which room, for how many people,* that price buys. This is the ticket's named "from-price-with-no-room-occupancy" case and must be a first-class labeled state, not an omission.
2. **The dominant on-screen state will be `not_returned`.** Because the adapter maps zero room-fit fields today, every card will render room fit as "not reported by the provider." The failure mode is a user reading *no data* as *does not fit* and wrongly excluding a viable hotel — the mirror of the amenity `not_returned`-vs-`unavailable` trap, on a higher-stakes attribute (a family cannot book a room that genuinely can't hold them).

The job of this feature in v1 is therefore **honest provenance display**, not matching. We do not have occupancy data to match a party against, and pretending to would erode trust worse than the current absence.

## Current Implementation Findings

### 1. `HotelOffer` carries no room-fit dimension
`HotelOffer` (`lib/types.ts:137`–`151`) holds identity, `area`/`location`, `stars`, `pricePerNight`, `priceBasis`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, `guestRating`. There is no `maxOccupancy`, `bedConfig`, `childPolicy`, room-type label, or per-room price-scope field, and no status/source/confidence wrapper for any of them.

### 2. Hotellook maps a hotel-level "from" price and no room detail
`priceFromToCents` (`383`–`394`) treats `priceFrom` as a property lead-in rate. The live map (`448`–`487`) and cache map (`318`–`381`) normalize price, location, and quality only. There is no path today for occupancy, bed config, child policy, or room-type to reach the UI. `not_returned` is the **expected default**, not an edge case.

### 3. `/api/search` never sends party size to hotels
`passengers` is validated 1–9 (`107`–`113`) and folded into `range` (`242`, `248`) which is passed to `travelpayouts` / `duffel` / `amadeus` / `kiwi`. The hotel branch (`396`–`423`) calls `searchHotelAvailability(destIATA, { checkin, checkout })` with no guest count. The route also cannot express "room-fit data unavailable" separately from "hotel inventory unavailable" — the same independence gap the provenance research flagged for amenities.

### 4. `HotelCard` has evidence architecture but no room-fit slot
Collapsed (`425`–`521`): photo, name, hotel-class + guest-rating chips, location, price block, `ScoreChip`, `Review hotel` CTA, `Details` toggle. Expanded (`523`–`582`): photo, `DealScorePanel`, `QualityEvidencePanel`, low-confidence note, Location panel, Price-scope / Rate-check / Provider-handoff panel. No collapsed room-fit line and no expanded "Room fit" panel. The card already demonstrates the exact evidence discipline room fit must match (`getConfidenceText`, explicit unavailable states, text-not-color status).

### 5. Surface-wiring gap (carried forward, not re-litigated)
As established in the amenity research, `HotelCard` is not mounted in a live results page (`app/page.tsx` is a marketing/deals landing rendering `DealCard`/`LockedDealCard`; no component performs a live `GET /api/search`). This directly constrains the intake recommendation (Deliverable 4): **there is no live hotel search form to add a guest/room control to today.**

## Deliverable 1 — Target Segments and Their Fit Questions

Four party archetypes, each asking a distinct room-fit question. Ranked by how sharply an unanswered question forces a provider exit.

| Segment | Party shape | Core fit question | What a wrong read costs |
|---|---|---|---|
| **Family** (2 adults + 1–3 children) | Mixed adult/child, needs beds + child eligibility | "Does one room hold all of us, and are children even allowed / do they need an extra bed or crib?" | Highest. A room that maxes at 2, or bans children, is an invalid booking. Misreading `not_returned` as "fits/allows" causes a failed arrival; misreading it as "does not fit" wrongly drops a viable hotel. Child policy is the sharpest trap. |
| **Small group (3–6)** | 3–6 adults, often needs 2+ rooms or a large room | "Will this fit our group in one room, or how many rooms do we need — and does the 'from' price cover that?" | High. A 2-max room silently priced as a "deal" collapses the trip economics once they realize they need 2–3 rooms; the from-price trap is most damaging here. |
| **Couple** (2 adults) | 2 adults, bed *type* matters | "Is there a bed configuration that works for two — one bed vs. two singles?" | Medium. Usually fits on occupancy; the live question is bed config (one double vs. twin), a comfort/relationship constraint the from-price hides. |
| **Solo** (1 adult) | 1 adult | "Am I paying a double-occupancy 'from' price for a room I'll use alone — is a single/smaller rate available?" | Lower on fit, real on price honesty: the from-price ambiguity means a solo traveler can't tell whether the shown rate is their rate. Serves the "never overpay" product DNA. |

Cross-cutting: **no segment can answer its question from the current card**, and every segment is exposed to the from-price-with-no-occupancy ambiguity (Finding 2, item 1).

## Deliverable 2 — Minimum Room-Fit Signal Set (MVP lock — do NOT expand)

Three signals only, ranked. This set is locked per the ticket ("do not expand"). Each is a provider-evidence fact wrapped in the existing status contract (Deliverable 3), not a free-text field.

| # | Signal (canonical id) | Answers | Why this rank | MVP scope note |
|---|---|---|---|---|
| 1 | **Max occupancy** (`max_occupancy`) | "How many people fit?" | The single gating fact for every segment; without it neither family nor group can decide, and the from-price is uninterpretable. Highest decision leverage. | Integer count for the priced room/rate where scoped; hotel-level "from"-price rooms carry **no** occupancy and must render the from-price state, not a guessed number. |
| 2 | **Bed configuration** (`bed_config`) | "What beds, how arranged?" | Distinguishes "fits on paper" from "usable" (couple: double vs. twin; family: enough separate beds). Second because it refines an occupancy that must exist first. | Normalized bed descriptor(s) from the provider (e.g. `1 double`, `2 twin`); never inferred from occupancy count. |
| 3 | **Child policy** (`child_policy`) | "Are children allowed / free / extra bed?" | The hard constraint for families and the sharpest `not_returned`-vs-`unavailable` trap, but narrower audience than 1–2, so third. | Boolean-plus-note: children allowed / not allowed / not specified; optional age-cutoff and extra-bed/crib note **only when the provider supplies it**. Never state "children stay free" without `fee`/scope support. |

**Explicitly out of MVP** to hold scope: room-type taxonomy/naming, room size (sq ft/m²), view, smoking policy, accessibility/step-free room features (deferred to their own dedicated treatment as in the amenity research — must not be a room-fit chip), rollaway/crib inventory counts, and any multi-room "you need N rooms" calculator. These are candidate follow-ups, not this ticket.

## Deliverable 3 — Provenance and Missing-Data Label Rules

Reuse the amenity/provenance evidence contract verbatim — do **not** invent a parallel model. Each of the three signals is an evidence object with `status` ∈ {`confirmed`, `unavailable`, `not_returned`, `unknown`}, a source label, confidence, optional `fetchedAt`, and optional `scope` (`property` / `room` / `rate` / `selected_stay`) and, for child policy, optional `fee`.

State meanings and copy rules (final copy is UXDES's to finalize; these fix the semantics):

1. **`confirmed`** — provider returned the fact for a stated `scope`. Occupancy: "Sleeps N (per provider, this room)." Bed config: state the beds as returned. Child policy: "Children allowed" / with note only if supplied. Copy must name the scope; a `property`- or `rate`-scoped fact must never read as guaranteed for the selected room unless `scope` says so (carried from provenance rule 4).
2. **`unavailable`** — provider explicitly says the room does **not** hold the party / does not allow children. This is the only state that may say "does not fit" / "children not allowed." It must be visually **and** textually distinct from `not_returned`.
3. **`not_returned`** — provider returned rates but **no** room-fit field. This is the default. Copy: "Room capacity not reported by the provider — confirm before booking." Never "Sleeps 0", never "No beds", never "Children not allowed." This is the trust-critical state.
4. **`unknown`** — provider returned an ambiguous/uninterpretable value. Treated like `not_returned` for safety (confirm at provider), labeled as ambiguous rather than missing.
5. **Hotel-level from-price-with-no-room-occupancy (named ticket case)** — the price on the card is a property "from" rate (`priceFrom` → `priceBasis: 'per_night_before_taxes_fees'`) with **no** bound room or occupancy. This is a distinct, first-class state, not merely `not_returned` on occupancy. Required disclosure near the price/room-fit region: **"'From' rate — lowest available; room size and occupancy set at the provider."** It must break the implicit assumption that the shown price buys a room that fits the user's party. This state applies to essentially all current Hotellook results and must be designed as the norm.

Guardrails carried forward: never render `No occupancy` / `No beds` / `No child info` for missing data; never use color or icon as the only status signal; a `property`/`rate`-scoped fact never reads as selected-room availability; room-fit evidence never feeds or adjusts the Deal Score and never shares the success/warning tokens of `DealBadge`/`ScoreChip` or `QualityEvidencePanel`.

## Deliverable 4 — Intake Recommendation

**Recommendation: NEITHER a new dedicated hotel guest/room intake control NOR a silent party-size *match/filter* in v1. Instead, (a) add no new hotel-party-size form field now, and (b) optionally reuse the existing flight `passengers` value as lightweight decision *context* only — never as a filter or a fit claim.**

Reasoning from the evidence:

- **A dedicated "guests & rooms" intake would promise a match we cannot deliver.** The provider returns hotel-level "from" prices with no occupancy (Findings 2, item 1). If we ask "how many guests?" we imply we will filter or verify against it; we have nothing to filter against, so the control would either do nothing or, worse, silently drop results on data we don't have — the exact `not_returned`-as-`does-not-fit` failure this ticket exists to prevent. Adding it also violates the mobile-clutter constraint for zero user benefit today.
- **There is also no live surface to put it on.** `HotelCard`/`GET /api/search` are not mounted in a live results page (Finding 5). Designing a new search-form control now is speculative until that surface exists.
- **Inference from flight `passengers` is acceptable only as self-framing context.** When a search already carries `passengers = N`, the card/detail *may* show a neutral prompt — e.g. "You're planning for N traveler(s). Confirm this room fits your party at the provider." — that helps the user ask their own fit question. It must **not** filter results, must **not** claim a room fits or doesn't, and must degrade silently when `passengers` is absent. Flight party ≠ hotel room party (adults/children split, rooms-per-party), so it is context, not truth.
- **Revisit when a room-occupancy-capable provider lands.** A dedicated guests/rooms intake with real filtering becomes worth building the moment a provider returns per-room occupancy (Duffel Stays / Amadeus Hotel / a Booking-style hotel adapter). Note this as the trigger condition for a future `UXD`/`UXR` cycle; do not pre-build the intake now.

Net for UXDES: design the room-fit **display and provenance** (Deliverables 2–3); do **not** design a new intake widget; optionally spec the passengers-as-context line as an enhancement, clearly marked non-blocking.

## Deliverable 5 — Validation Metrics

Instrument against the discovery signal ("travelers leave expaify to confirm fit at the provider"). Primary gate is comprehension, because the dominant state is `not_returned`.

1. **Reduced room-fit provider exits.** Rate of sessions that open a hotel result then hand off to the provider *specifically to check occupancy/beds/child policy* (proxy: handoff within N seconds of expanding the room-fit panel, or exit-survey "I left to check if the room fit us"). Target: measurable reduction vs. the pre-feature baseline for family/group segments.
2. **Lift in qualified `Review hotel` clicks for matching offers.** Among results where room fit is `confirmed`, CTA click-through should rise relative to `not_returned` results — evidence that confirmed fit converts, and that we are not suppressing clicks on unknown-data hotels by making them look worse. Guard: `not_returned` CTR must **not** collapse (would signal the missing state reads as "does not fit").
3. **Comprehension: `not_returned` vs. does-not-fit (release gate).** Moderated, 5–7 participants per segment on the prototype. Threshold **≥85% correct** on the trust-critical tasks:
   - *Task — absence vs. explicit unavailable:* Hotel X `max_occupancy=not_returned` vs. Hotel Y `max_occupancy=unavailable` for a party of 4. "Which room do you *know* is too small?" Pass: Y only. Fail ("both"/"X") is the core misread to block.
   - *Task — from-price ambiguity:* a `not_returned` occupancy card showing a "from" price. "How many people does this price cover?" Pass: "Can't tell — set at the provider." Fail: any confident number.
   - *Task — child policy:* `child_policy=not_returned`. "Can you bring your kids?" Pass: "Not stated — confirm at provider." Fail: "No."
   - *Task — all-unknown card:* every signal `not_returned`. "Describe this room's fit." Pass: "Provider didn't report it." Fail: "It's a small/basic room / it has none."

## Deliverable 6 — Reference-Pattern Audit (interaction level)

- **Booking.com — room-row occupancy + bed rows.** Each bookable room lists "max N guests" (often an icon row), a bed configuration ("1 large double bed"), and child/extra-bed policy in a dedicated policies block. Interaction model: occupancy and beds are **structured, per-room, priced facts**, so the price you see is bound to a room that holds a stated number. **Delta:** expaify's price is a hotel-level "from" rate with no room binding, so it cannot yet show per-room rows honestly; it must instead *disclose that the price is unbound* (the from-price state) rather than fabricate a room row. Booking never needs a `not_returned` state because its data is dense; expaify's is empty, so it must add exactly that distinction. The reference is a floor, not a ceiling.
- **Google Hotels — guest count at search + per-result fit.** A guest-count selector at search narrows/annotates results; per-result occupancy fit is implied by the priced option. Interaction model: capture party size up front, then reflect fit. **Delta:** confirms guest-count-at-search as the mature pattern — but it depends on providers that return per-room occupancy. expaify has neither the occupancy data nor a live search form (Finding 5), which is precisely why Deliverable 4 defers the intake rather than copying this pattern prematurely.
- **Shared takeaway:** both references treat room fit as a structured, per-room fact bound to the price. expaify's obligation until it has such a provider is the inverse of both: make the **absence** of that binding legible (from-price disclosure + `not_returned` states) so no traveler assumes a fit neither reference would ever have to disclaim.

## Design Directives for UXDES (testable)

1. **Add a room-fit region reusing the evidence contract; three signals only.** Expanded `HotelCard` gets a dedicated "Room fit" panel covering `max_occupancy`, `bed_config`, `child_policy`, each rendered from a `{status, sourceLabel, confidence, scope?, fee?}` object. *Test:* each signal renders a distinct state for `confirmed` / `unavailable` / `not_returned` / `unknown`; no fourth signal appears; the panel does not nest inside DealScore or Quality panels and uses none of their tokens.
2. **`not_returned` must never read as "does not fit"; the two are visually AND textually distinct.** *Test:* comprehension Tasks (absence-vs-unavailable, child policy, all-unknown) pass ≥85%; a missing signal never renders "Sleeps 0 / No beds / Children not allowed."
3. **The from-price-with-no-room-occupancy state is first-class and shown near price + room fit.** Required disclosure that the "from" rate is unbound to any room/occupancy set at the provider. *Test:* from-price comprehension task passes ≥85%; the disclosure is present on every current-Hotellook result (all `not_returned` occupancy).
4. **No new intake widget; passengers-only context line optional and non-filtering.** *Test:* no hotel guest/room form control is specified; if the passengers-context line is included, it renders only when `passengers` is present, filters nothing, and makes no fit claim.
5. **Collapsed card stays scannable; room fit does not displace price, Deal Score, location, quality, or CTA at 375px.** At most one neutral room-fit line collapsed (only when a signal is `confirmed`, e.g. "Sleeps N"); all-`not_returned` hotels show no collapsed room-fit chip. *Test:* 375px layout has no overlap; screen reader announces each signal's state in words in a predictable order before provider-handoff copy.

## Non-Negotiables Carried Forward

- All room-fit data flows through `lib/providers` and is normalized there; components never parse vendor room/occupancy payloads.
- Adapters return `Result<T>`; money stays integer `priceCents`; secrets from env; outbound hotel deeplinks keep affiliate markers.
- Room fit never feeds, adjusts, or visually merges with Deal Score or hotel-class/guest-rating quality evidence.
- Reuse the provenance status contract (`confirmed` / `unavailable` / `not_returned` / `unknown`, `scope`, `fee`) — do not invent a parallel model.
- Missing data is never rendered as `No occupancy` / `No beds` / `Children not allowed`; it is `not_returned` / `unknown` with confirm-at-provider copy.

## Out-of-Scope Findings (flag, do not fix here)

- **Surface-wiring gap:** `HotelCard`/`GET /api/search` are not mounted in a live results page (`app/page.tsx` is marketing/deals). Reconciling the live hotel-results surface is a design/DEV decision under its own ticket, not this research.
- **DEV work is required and unavoidable:** `HotelOffer`, Hotellook live+cache normalization, cache validation, `/api/search` hotel streaming, and tests all lack room-fit fields. UXDES must call out a `DEV-GUEST-ROOM-FIT-01` need because no room-fit evidence can reach the UI until the data layer carries it — but the adapter can only surface what Hotellook returns (today: nothing), so the honest v1 is the provenance/`not_returned` display, not populated occupancy.
- **Dedicated guests/rooms intake + party matching** is deferred until a room-occupancy-capable hotel provider (Duffel Stays / Amadeus Hotel / Booking-style adapter) lands; that provider arrival is the trigger for a new UXD/UXR cycle.
- **Accessibility/step-free room features** are deferred to a dedicated treatment, not a room-fit signal.
- Room-fit data must not affect Deal Score until scoring has a separate approved hotel-fit model.

## Blocker

`docs/pipeline/guest-room-fit/01-discovery.md` does not exist on disk. The pipeline contract requires this stage to read the discovery report; the report's content is instead carried in full in the ticket description, which I have used as the discovery input. This research is complete on that basis. Flagging so the monitor can confirm the discovery doc was intended to be committed (the discovery stage produces docs only) — if a canonical `01-discovery.md` is later added, re-check this brief against it.

## Handoff

Create `UXDES-GUEST-ROOM-FIT-01` for an implementation-ready design covering: the three-signal room-fit set (`max_occupancy`, `bed_config`, `child_policy`) as evidence objects reusing the `confirmed`/`unavailable`/`not_returned`/`unknown` contract; the four provenance states plus the first-class from-price-with-no-room-occupancy disclosure with final copy; the `not_returned`-vs-does-not-fit legibility model; the expanded "Room fit" panel and the conservative collapsed treatment; the no-new-intake decision plus the optional non-filtering passengers-context line; hard separation from Deal Score and quality evidence; and full coverage of default, `confirmed`, `unavailable`, `not_returned`, `unknown`, from-price, loading, error, mobile 375px, desktop 1280px, and keyboard/assistive-tech order. The design must also state the required `DEV-GUEST-ROOM-FIT-01` data-layer work (`HotelOffer` fields, Hotellook live+cache mapping, cache validation, `/api/search` room-fit streaming, tests).

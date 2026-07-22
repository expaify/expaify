# UX Research: Hotel Access Requirement Clarity

Ticket: `UXR-HOTEL-ACCESS-REQUIREMENTS-01`
Stage: UX Research
Persona: Senior UX Researcher
Priority: P1
Date: 2026-07-22

## Source Inputs

- Discovery report (per ticket): `docs/pipeline/hotel-access-requirements/01-discovery.md` — **not present in the repo at audit time** (see Blocker below). The full problem statement is embedded in the ticket and is used as the discovery input for this brief.
- Current implementation audited (read, not assumed):
  - `lib/types.ts` (`HotelOffer`, `HotelRatingEvidence`, `HotelLocation`, `HotelProvider`)
  - `lib/providers/hotellook.ts` (live + cached normalization, `cache.json` payload shape)
  - `app/components/HotelCard.tsx` (collapsed card + expanded details)
  - `app/page.tsx` (marketing landing; does **not** render `HotelCard`)
  - `app/api/search/route.ts` (hotel streaming: `hotel-status` / `hotels` NDJSON events)
  - `app/deals/DealFeed.tsx` (the surface that actually renders hotel results today)
- Settled prior work reused, not re-derived:
  - `docs/pipeline/hotel-amenity-provenance/01-discovery.md` + `02-research.md` — the provider-neutral evidence contract (`status` + `scope` + source + confidence, optional `fetchedAt`/`fee`). **This ticket extends that contract; it does not fork it.**
  - `docs/pipeline/accessibility-stay-fit/01-discovery.md` — disability-specific stay fit (roll-in showers, grab bars, Braille, visual alarms, service animals). **This ticket must not duplicate it.**
  - `docs/pipeline/hotel-amenity-fit/01-discovery.md` — the amenity filter surface. Filter UI is **referenced, not built** here.
- Reference patterns checked at interaction level:
  - Booking.com property "Facilities" + "Parking" blocks and non-guaranteed room-preference language ("You can request … subject to availability").
  - Google Hotels accessibility/amenity filters and property "About" facts.

## Research Question

Can a traveler tell, from an expaify hotel result, whether four practical physical-access facts are **confirmed present**, **documented absent**, or **not documented** — and for room preferences, whether the fact is **guaranteed** for their booking or merely **requestable** — without leaving expaify and without mistaking a request for a guarantee?

The four MVP facts (per ticket): **elevator present**, **on-site parking**, **step-free route continuity (entrance → room)**, and **room-request certainty** (ground-floor / high-floor / near-elevator / connecting).

## Research Summary

No. expaify carries **zero** access-logistics data and has **no** UI surface for it. The `HotelOffer` type, the Hotellook adapter, the search stream, and `HotelCard` all stop at price, location, hotel-class, and guest-rating evidence. Every access-requirement decision happens off-platform on the provider's site, after the user has already invested effort choosing an expaify result.

The distinct problem this ticket owns is **requirement certainty, not feature presence**. The failure mode is not "we don't show an elevator icon." It is that once access facts are shown, expaify can silently convert:

- **silence into denial** — rendering an undocumented fact as "no elevator" (a false negative that wrongly rejects a usable hotel), or
- **a request into a promise** — rendering "connecting rooms available on request" as a guaranteed connecting room (a false positive that drives an unusable booking).

Both are trust-destroying and hard to reverse. The core research output is therefore an **evidence + certainty standard** that keeps three things distinct — *confirmed present* vs *documented absent* vs *not documented*, and orthogonally *guaranteed* vs *requestable* — before any UI or DEV work adds an access label.

## Scope Boundary (what this ticket is and is not)

This ticket owns **universal access logistics for the whole traveler population**: the person with a stroller and a sleeping toddler, the traveler with two heavy suitcases, an older guest who cannot climb stairs, a family that needs two rooms that connect, a driver who needs to know parking exists before arrival. These are not disability-specific medical needs; they are physical-access facts that affect a large share of ordinary bookings.

It is explicitly **not** `accessibility-stay-fit`. That ticket owns disability-specific, need-typed, room-scoped features (roll-in shower, grab bars, doorway clearance, Braille/tactile signage, visual/vibrating alarms, service-animal policy) where a boolean actively misrepresents fit. **Do not model those features here.** The one shared idea is the underlying data substructure — the provenance `status`/`scope`/source model — which both tickets reuse. Where the two overlap on the wire (e.g. "step-free entrance" is relevant to both a stroller user and a wheelchair user), the *fact* is universal-logistics and lives here; the *disability-specific interpretation* belongs to `accessibility-stay-fit`. The contract below is designed so both consume the same normalized facts without either owning the other's UI.

## Current Implementation Findings

### 1. `HotelOffer` cannot carry any access fact, let alone certainty

`HotelOffer` (`lib/types.ts:137`–`151`) carries identity, `area`/`location`, `stars`, `pricePerNight`, optional `rating`/`photoUrl`, `deeplink`, `source`, `hotelClass`, and `guestRating`. There is **no** amenity field, **no** access field, **no** per-fact `status`, **no** `scope`, and **no** certainty dimension. `HotelRatingEvidence` (`lib/types.ts:109`–`117`) is the closest existing evidence pattern (it pairs a `kind` + `value` with a `confidence` and `sourceLabel`), and it is the right structural precedent — but it models a *rating scalar*, not a present/absent/undocumented *fact with scope and certainty*.

Because `HotelProvider.searchHotels` returns `Promise<Result<HotelOffer[]>>` (`lib/types.ts:179`–`183`), every card receives this same shape. The UI **cannot** distinguish "provider confirms an elevator" from "provider did not return elevator data" from "provider says no elevator." This is a structural guarantee that, today, no access fact can be shown honestly — and a warning that adding one carelessly will manufacture false certainty.

### 2. Hotellook returns a thin payload and normalizes no access data

The `cache.json` engine entry type (`lib/providers/hotellook.ts:10`–`28`) is: `hotelId`, `hotelName`, `stars`, `location` (name/geo), `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType`. There is **no** field for elevator, parking, step-free access, floor, connecting rooms, or facilities of any kind.

Live normalization (`hotellook.ts:458`–`486`) emits `id`, `name`, `area`, `location`, `stars`, `pricePerNight`, `deeplink`, `photoUrl`, `source`, `hotelClass`, `guestRating`. Cached normalization (`hotellook.ts:318`–`381`) validates only those known fields and **drops anything outside the shape**. So even if a richer payload appeared, there is no path for an access fact to survive live fetch or 6h cache replay. **The realistic near-term data state for all four MVP facts is `not_documented`.** Empty-data treatment is the common case here, not an edge case.

### 3. The search stream separates hotel availability from access availability — but only structurally

`GET /api/search` (`app/api/search/route.ts:395`–`421`) resolves hotels after flights and emits `hotel-status` (`available` / `empty` / `unavailable` / `skipped`) or a `hotels` event with normalized offers. It can already say "hotel inventory is/ isn't available." It **cannot** say "we found rates but the provider returned no access facts," because there are no access facts to be absent. The distinction "hotels found, access data not returned" must be expressible per-offer (via the contract below), not only at the stream level.

### 4. The card has evidence panels but no access surface — and `HotelCard` is not even mounted

Collapsed `HotelCard` (`app/components/HotelCard.tsx:425`–`520`) shows photo, name, hotel-class + guest-rating chips, location label/value, nightly price (with an existing "Last-checked time unavailable" warning line), a Deal Score chip, and Review/Details controls. Expanded details (`HotelCard.tsx:523`–`582`) show the photo, a Deal Score panel, a Quality Evidence panel, a Location panel, and a Price scope / Rate check / Provider handoff panel. There is **no** access section anywhere.

Two facts the design stage must know:
- The card already has a proven **collapsed-chip + expanded-evidence-panel** idiom (the quality/guest-rating chips at `HotelCard.tsx:449`–`470` and `QualityEvidencePanel` at `:309`–`362`). Access should reuse this idiom, not invent a new one.
- **`HotelCard` is currently rendered only in tests** (`app/components/__tests__/scorePresentation.test.tsx`); the live results surface is `app/deals/DealFeed.tsx`, which renders its own `DealCard` and never mounts `HotelCard`. `app/page.tsx` is a marketing landing that does not render hotel offers at all. This is a pre-existing integration gap, flagged for downstream awareness — **out of scope to fix here**, but the design must not assume `HotelCard` is on screen for real users today.

### 5. No inference sources exist — and none may be invented

There is no field from which access could be honestly inferred. `stars`, `propertyType`, `photoUrl`, and `distance` say nothing reliable about elevators, parking, step-free routes, or room-assignment policy. Per the non-negotiable contract, the app **must not** infer any access fact from these. Absence of a "no elevator" flag is **not** evidence of an elevator.

## Certainty & Evidence Standard (the core deliverable)

### The reused base (from `hotel-amenity-provenance` — do not fork)

Every access fact is an evidence object carrying at minimum:

- `id` — canonical fact id (e.g. `elevator`, `on_site_parking`, `step_free_route`, `room_pref_connecting`).
- `label` — display string.
- `status` — `confirmed` | `unavailable` | `not_returned` | `unknown`.
- `scope` — `property` | `room` | `rate` | `selected_stay`.
- `sourceLabel` — provider attribution.
- optional `confidence`, `fetchedAt`, `fee` (`included` | `paid` | `unknown`).

### The single new dimension this ticket adds (the only extension)

- `certainty` — `guaranteed` | `requestable`.

`certainty` is **orthogonal** to `status`. `status` answers *"is the fact present, absent, or undocumented?"*. `certainty` answers *"if present, is it assured for this booking, or only something you can ask for?"*. A fact only carries a meaningful `certainty` when `status = confirmed`; for `unavailable` / `not_returned` / `unknown`, `certainty` is not applicable and must not be rendered. Do **not** introduce any other new field. Do **not** overload `status` with a fifth value to express requestability — that is exactly the fork the ticket forbids.

### The three distinctions the standard must keep visibly separate

**A. Confirmed present vs. documented absent vs. not documented** (all three are `status` values):

| Real-world meaning | `status` | Correct user reading | Forbidden reading |
|---|---|---|---|
| Provider states the hotel has an elevator | `confirmed` | "There is an elevator." | — |
| Provider states there is **no** elevator | `unavailable` | "The provider says there is no elevator." | — |
| Provider returned nothing about elevators | `not_returned` | "Not documented — check with the provider." | "No elevator." |
| Provider returned ambiguous/contradictory data | `unknown` | "Access details unclear — confirm with the provider." | either present or absent |

The single most important rule: **`not_returned` must never render as `unavailable`.** Silence is not denial. "Not documented" is a neutral, non-alarming state that directs the user to the provider; "the provider says no elevator" is a documented negative that lets the user reject the hotel confidently. Collapsing them wrongly rejects usable hotels (false negative) and erodes trust when the user later discovers an elevator did exist.

**B. Guaranteed vs. requestable** (the new `certainty` dimension), which only applies to `confirmed` facts:

- **Fixed property attributes** — `elevator`, `on_site_parking`, `step_free_route` — are inherently `guaranteed` **once `confirmed`**, because they are physical facts about the building, not per-stay assignments. (Parking is a nuance: presence is guaranteed if confirmed, but a *space* on a given night and its *fee* are not; model presence as `guaranteed` with `fee` metadata and, if the provider says spaces are limited/first-come, downgrade to `requestable`.)
- **Room-assignment preferences** — `room_pref_ground_floor`, `room_pref_high_floor`, `room_pref_near_elevator`, `room_pref_connecting` — are almost always `requestable`, not `guaranteed`, even when `confirmed`. The provider confirms the *property offers* the preference and that you *can request* it; the assignment happens at check-in subject to availability. `certainty = guaranteed` for a room preference is permitted **only** when the provider/rate explicitly guarantees the specific room feature for the booking.

The comprehension failure to design against: a user reading **"Connecting rooms — on request"** as **"connecting rooms are guaranteed."** Copy for a `requestable` fact must contain an explicit non-guarantee ("Request only — not guaranteed until the provider confirms") and must never use bare "available," "included," or a lone check mark.

### Scope discipline (carried, not new)

A `property`-scoped fact must never read as a `room`/`rate`/`selected_stay` promise. "The hotel has an elevator" (`property`) does not mean the path from *your* entrance to *your* room is step-free (`step_free_route`, which is a chain — see below). Property-level access copy must direct the user to confirm room- and rate-level details with the provider before payment.

### Step-free route continuity is a chain, and must degrade honestly

`step_free_route` (entrance → room) is not one boolean; it is a continuity claim over links: **entrance/lobby → vertical transport (elevator or step-free path) → guest-floor corridor → room door**. The route may be surfaced as `confirmed` step-free **only** when every constituent link is documented step-free. If any link is `not_returned`, the *route* is `not_returned` (or at best `unknown`), never `confirmed`. A documented step at any link makes the route `unavailable`. This prevents "hotel has an elevator" from being laundered into "step-free from door to bed." This fact is the highest-value and highest-risk of the four; the design must treat partial-chain data as `unknown`/`not_returned`, not as a green light.

## Success Measures

Tied to the discovery signals (structurally 0% today because no data or surface exists):

1. **In-app discovery rate** — share of hotel decisions where a user can locate the relevant documented access fact (or a clear "not documented" state) for at least one of the four MVP facts **without leaving expaify**. Target: from 0% to a measurable baseline once data exists.
2. **Certainty-comprehension pass rate (the critical check)** — in moderated evaluation, ≥ 90% of participants shown a `requestable` room preference (e.g. "Connecting rooms — request only") correctly answer that it is **not guaranteed** for their booking. This is the primary guardrail metric; below it, the copy has failed.
3. **Absence-comprehension pass rate** — ≥ 90% of participants shown a `not_returned` fact correctly read it as "not documented / unknown," **not** as "the hotel does not have it." A paired check confirms they read `unavailable` as a documented negative they can act on.
4. **Scope-comprehension check** — for `step_free_route` and room preferences, participants do not read a `property`-scoped fact as a `room`/`rate` guarantee.
5. **Filter-use intent (referenced, not built)** — because filter UI is out of scope (`hotel-amenity-fit`), measure only *stated* intent: given the four facts as evidence, would users want to filter by "has elevator" / "on-site parking" / "step-free"? Captured as a research signal to hand to `hotel-amenity-fit`, not as a shipped control.
6. **False-mismatch reduction (post-booking)** — a drop in "the hotel didn't actually have X" / "we couldn't get connecting rooms" reports, the direct symptom of `not_returned`-as-`unavailable` or `requestable`-as-`guaranteed` failures.

Comprehension checks 2–4 must be run against the **exact final copy**, not paraphrases, because the whole risk lives in wording.

## Card → Detail Discovery Map

Reuse the existing collapsed-chip / expanded-panel idiom; do not add a third pattern.

**Collapsed card (scan tier)** — conservative and space-safe. Access must not displace nightly rate, Deal Score, location, quality chips, or the Review/Details controls (`HotelCard.tsx:445`–`520`).
- Show **at most one** access signal in collapsed state, and **only** when `status = confirmed` for a fixed property attribute with `certainty = guaranteed` (realistically: `elevator` or `on_site_parking`). Example chip: `Elevator` or `On-site parking`.
- **Never** show a `requestable` fact, an `unavailable` fact, a `not_returned` fact, or a `step_free_route` claim in collapsed state — those need the sentence-level qualifiers that only fit in the expanded panel.
- If no confirmed-guaranteed property attribute exists, show **no** access chip collapsed (do not show "not documented" at scan tier — it is noise and mildly alarming out of context).

**Details toggle** — the existing `Details` button (`HotelCard.tsx:512`–`520`) reveals the expanded region `#hotel-details-${id}`.

**Expanded details (decision tier)** — add an **"Access & room requests"** evidence panel, placed after Location and before or alongside the Price scope / Provider handoff panel, styled like `QualityEvidencePanel` (`HotelCard.tsx:309`–`362`): a titled `section` with a `dl` of labelled facts, text-first, never color/icon-only. It must render, with final copy, every state:
- `confirmed` + `guaranteed` (fixed attribute) — e.g. "Elevator: provider confirms the property has an elevator."
- `confirmed` + `requestable` (room preference) — e.g. "Connecting rooms: the provider offers these on request. Not guaranteed until the provider confirms your room."
- `unavailable` — e.g. "Elevator: the provider states there is no elevator."
- `not_returned` — e.g. "Step-free route: not documented by the provider. Confirm with the provider before booking."
- `unknown` — e.g. "Access details: the provider's information was unclear."
- loading / access-evidence-failed-separately-from-inventory.
- Each fact carries a source attribution line and, where relevant, a scope qualifier ("for the property; confirm your specific room") and `fee` note for parking.

**Provider handoff** — the existing handoff copy (`HotelCard.tsx:571`–`579`) already defers final terms to the provider; access copy must chain into it: property-level and `requestable` facts explicitly tell the user the provider confirms the final room assignment.

## Reference Pattern Comparison (interaction level, not visual)

**Booking.com — Facilities & Parking.** Booking presents facilities as structured, labelled property facts grouped by category, with **Parking** as its own block that states presence, reservation need, and whether it is free/paid — i.e. presence and fee are separate, explicit facts, not a single icon. Crucially, room-preference language is **non-guaranteed by construction**: connecting rooms, floor preferences, and similar read as "You can request … subject to availability," never as a confirmed room feature.
- *Delta vs expaify:* expaify has no facilities structure and, more importantly, no vocabulary that separates a confirmed property fact from a requestable room preference. The lesson to adopt is the **explicit non-guarantee phrasing** and the **presence-vs-fee separation** for parking — mapped onto our `status` + `certainty` + `fee` contract.

**Google Hotels — filters & "About" facts.** Google exposes accessibility/amenity **filters** and shows property facts in an "About" list; undocumented attributes simply do not appear (they are not rendered as negatives). The interaction lesson: attributes are decision criteria a user can *pre-filter* by, and **absence is shown as absence of a claim, not as a negative claim**.
- *Delta vs expaify:* we must copy the "absent = no claim, not a negative" behavior directly (our `not_returned` state). The **filter** behavior is out of scope — it belongs to `hotel-amenity-fit`; we capture demand for it (success measure 5) and hand it over, but do not build it.

Neither reference exposes a *certainty* axis as clearly as this ticket requires — Booking implies it through prose. expaify's contribution is to make **guaranteed vs requestable a first-class, structured, testable distinction** rather than buried phrasing.

## Empty-Data Treatment (the common case)

Given the thin Hotellook `cache.json` payload, **all four facts will usually be `not_returned`.** The design must treat this as the default, first-class state:

- **Collapsed card:** show **nothing** access-related when there is no `confirmed` fixed attribute. No "not documented" chip at scan tier.
- **Expanded panel:** always render the "Access & room requests" panel, but when everything is `not_returned`, show a single neutral, non-alarming line — e.g. **"Access details not documented by this provider. Confirm elevator, parking, step-free access, and room requests directly with the provider before booking."** — never "No elevator / no parking / not step-free," and never a wall of four "not documented" rows if one neutral line reads better.
- **Screen-reader reading:** the empty state must read as *neutral information*, not a warning and not a reassurance. Announce "not documented by the provider," attributed, without implying the feature is absent. Do not rely on the `--warning` color used elsewhere for the empty case — reserve warning styling for `unavailable` (a real documented negative) so the two do not blur.
- **Partial data:** if one fact is `confirmed` (e.g. elevator) but the rest are `not_returned`, show the confirmed fact and the neutral not-documented line for the remainder — never let one confirmed fact imply the others.

## MVP Set (smallest reliable set)

1. **Elevator present** — `id: elevator`, scope `property`, `certainty guaranteed` when `confirmed`. States: `confirmed` / `unavailable` / `not_returned`. Highest scan value; the only strong collapsed-chip candidate.
2. **On-site parking** — `id: on_site_parking`, scope `property`, `certainty guaranteed` when `confirmed` (downgrade to `requestable` if provider says limited/first-come); carry `fee` (`included`/`paid`/`unknown`) — never call it "free" unless `fee = included`.
3. **Step-free route continuity (entrance → room)** — `id: step_free_route`, scope `property` (path), chain semantics per above; `confirmed` only when all links documented step-free, else `unknown`/`not_returned`; `unavailable` if any documented step.
4. **Room-request certainty** — the meta-fact governing `room_pref_ground_floor` / `room_pref_high_floor` / `room_pref_near_elevator` / `room_pref_connecting`. Default `certainty = requestable`; scope `room`. This fact exists primarily to carry the **guaranteed-vs-requestable** teaching and to prevent the "request read as promise" failure.

All four are **provider-data-dependent**; with the current payload they will read `not_returned` until a provider returns them. This is expected and is why the empty-data treatment is a required first-class state.

## Design Directives For UXDES (specific, testable)

1. **Extend the provenance contract with exactly one new field: `certainty: 'guaranteed' | 'requestable'`.** Reuse `status` + `scope` + `sourceLabel` (+ optional `fee`, `fetchedAt`, `confidence`) unchanged. Do not fork the amenity contract; do not add a fifth `status` value; do not model disability-specific features (those belong to `accessibility-stay-fit`).
2. **Render `not_returned` as neutral "not documented," never as a negative.** Reserve `--warning` styling for `unavailable` only. Provide final copy for all five per-fact outcomes (`confirmed`/`unavailable`/`not_returned`/`unknown` + the `confirmed`+`requestable` variant).
3. **Every `requestable` fact carries an explicit non-guarantee clause** in its final copy and its aria-label ("Request only — not guaranteed until the provider confirms"). No bare "available," "included," or lone check mark for a room preference. This is the metric-2 guardrail.
4. **Collapsed card shows at most one confirmed-guaranteed property attribute** (elevator or parking) and preserves the existing price / Deal Score / location / quality / Review-CTA hierarchy; no access content at 375px may overlap the photo, price block, score chip, or CTA.
5. **Add one expanded "Access & room requests" panel** styled on `QualityEvidencePanel`, text-first, source-attributed, scope-qualified, covering default / loading / confirmed-guaranteed / confirmed-requestable / unavailable / not-documented / unknown / error, at 375px and 1280px, reachable by keyboard in a predictable order before provider-handoff copy.
6. **Treat `step_free_route` as a chain**: `confirmed` only when all links are documented step-free; otherwise `unknown`/`not_returned`; `unavailable` on any documented step.
7. **Empty-data is the default**: one neutral "not documented" line when nothing is confirmed; no per-feature negatives; screen-reader-neutral.
8. **Reference, do not build, filtering.** Note demand for "has elevator / on-site parking / step-free" filters and hand it to `hotel-amenity-fit`.

## Acceptance Criteria For UXDES

- The spec covers, with final copy: default, loading, `confirmed`+`guaranteed`, `confirmed`+`requestable`, `unavailable`, `not_returned`, `unknown`, access-evidence error, mobile 375px, desktop 1280px, focus/keyboard order, and assistive-tech copy for every state.
- A fact with no provider data renders as **"not documented,"** never as a negative; `--warning` styling is reserved for `unavailable`.
- Every `requestable` fact's visible copy and aria-label contain an explicit non-guarantee; no room preference reads as guaranteed.
- `step_free_route` is `confirmed` only with a fully documented step-free chain; partial data renders `unknown`/`not_returned`.
- Parking never reads "free" unless `fee = included`; presence and fee are separate facts.
- Collapsed cards show at most one confirmed-guaranteed property attribute and preserve the existing hotel-card hierarchy at 375px.
- The spec adds **only** the `certainty` field to the reused provenance contract and models none of the disability-specific `accessibility-stay-fit` features.
- The spec identifies DEV work as required: `HotelOffer`, Hotellook live + cached normalization, cache validation, the search stream's per-offer access-not-returned expressibility, and tests all lack access + certainty fields today.

## Risks And Constraints

- **Data reality:** Hotellook's `cache.json` returns none of these facts. The `not_returned` empty state is the common case and must be first-class; DEV work that adds access fields is contingent on a provider that actually returns them.
- **No inference:** access facts must never be derived from `stars`, `propertyType`, `photoUrl`, `distance`, or the absence of a negative flag. Undocumented → `not_returned`, always.
- **Integration gap (out of scope):** `HotelCard` is not currently mounted on any live surface (`DealFeed` renders its own card; `page.tsx` is marketing). The design targets `HotelCard`; wiring it into the live results surface is a separate concern to flag, not fix here.
- **Non-negotiables still apply:** external calls stay in `lib/providers`; adapters return `Result<T>`; money is integer cents; secrets from env; outbound hotel deeplinks keep affiliate markers; no color/icon-only status.
- **Boundary with `accessibility-stay-fit`:** shared `status`/`scope`/source substructure, disjoint feature sets and disjoint UI copy. If a design decision would model a disability-specific feature, stop — it belongs to the other ticket.

## Out Of Scope Findings

- Amenity/access **filter UI** — owned by `hotel-amenity-fit`; reference and hand off demand, do not build.
- Disability-specific stay-fit features — owned by `accessibility-stay-fit`; do not duplicate.
- Any effect of access data on **Deal Score** — scoring has no approved hotel-fit model and must not conflate price percentile with usability.
- Mounting `HotelCard` on the live results surface — pre-existing integration gap, separate ticket.
- Provider integration that does not return documented access data — DEV is contingent on a real payload.

## Blocker

- **Missing upstream discovery doc.** `docs/pipeline/hotel-access-requirements/01-discovery.md` (the stated UXD output for this feature) does **not** exist in the repo. The pipeline contract states no stage may begin until the prior stage's output exists. I proceeded because the ticket embeds the complete problem statement, MVP set, and required deliverables, which are sufficient to research against. **Flag for the monitor:** the UXD discovery artifact should be backfilled to this path so the chain is auditable, or the ticket's embedded statement should be treated as the canonical discovery input of record.

## Handoff

Create `UXDES-HOTEL-ACCESS-REQUIREMENTS-01` (UX Design) with this research brief path embedded, to produce an implementation-ready spec for: the `certainty`-extended access-evidence contract, the collapsed access chip rule, the expanded "Access & room requests" panel with all states and final copy, the empty-data default, and the guaranteed-vs-requestable comprehension guardrails.

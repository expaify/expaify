# UXD-HOTEL-ACCESSIBILITY-NEEDS-01: Hotel Accessibility Needs Visibility Discovery

Date: 2026-07-29
Stage: UX Discovery
Persona: Senior UX Strategist
Priority: P1
Feature slug: `hotel-accessibility-needs`

---

## Read This First: Scope Conflict And How It Is Resolved

This ticket's brief is substantially the same brief as `docs/pipeline/accessibility-stay-fit/01-discovery.md` (`UXD-ACCESSIBILITY-STAY-FIT-01`, 2026-07-21), which already has a completed UXR brief (`02-research.md`). That line **stalled after research** — there is no `03-design.md`, and no `UXDES-ACCESSIBILITY-STAY-FIT-01` on the board (the board currently holds exactly one accessibility ticket: this one).

Per the briefing rule *"if a ticket conflicts with this briefing or the current code contract, stop and report the conflict instead of guessing,"* the conflict is reported here rather than resolved by writing a second, parallel accessibility model. **Re-deriving a competing feature taxonomy would be the single most damaging thing this stage could do**, because the prior research explicitly forbids forking the evidence contract and downstream stages would then have two conflicting canonical sets.

**Resolution taken:** this discovery does **not** restate the settled 2026-07-21 problem. It re-audits the code as it exists *today*, records what has shipped in the intervening eight days, and re-scopes the residual problem — which has materially changed and is now sharper and more dangerous than "absence." The prior discovery and research are treated as **settled inputs, inherited wholesale**, not competitors.

**Recommendation to the monitor:** treat `hotel-accessibility-needs` and `accessibility-stay-fit` as one feature line. This doc supersedes `accessibility-stay-fit/01-discovery.md` as the current problem statement; `accessibility-stay-fit/02-research.md` remains valid and is carried forward, with the deltas in "What Changed Since 2026-07-21" applied to it.

---

## User Pain Point

A traveler with a mobility, vision, or hearing need now opens an expaify hotel detail, finds a panel literally titled **"Access & room requests"** that answers about elevators, step-free routes, and floor preferences, and reasonably concludes it is *the* accessibility answer for this property — when it was never designed to carry disability-need facts (roll-in shower, grab bars, doorway clearance, visual/vibrating alarms, service-animal policy, accessible parking path), so the app has moved from *silently missing* accessibility information to *confidently answering an adjacent question with an accessibility-shaped panel*.

## Who Is Affected And Where

Wheelchair and mobility-aid users, blind and low-vision travelers, Deaf and hard-of-hearing travelers, travelers with a temporary injury holding a hard requirement, and companions booking on someone's behalf — across three surfaces:

- **Search / filter** — `DealFeed` now ships three filter pills: minimum discount, hotel class, maximum price (`app/deals/DealFeed.tsx:109`–`114`, `262`–`266`). There is no accessibility or amenity filter, so an access need cannot be expressed *before* scanning. A user with a hard requirement must open and read every card individually.
- **Deal-card scan** — the collapsed `HotelCard` carries no accessibility signal. This is correct and should stay correct (see Constraint 3); it is listed because it means the *entire* burden falls on detail.
- **Hotel detail** — `AccessEvidencePanel` (`app/components/HotelCard.tsx:259`–`~300`, rendered at `:1039`) is the only access-adjacent surface, sitting alongside `QualityEvidencePanel` (`:624`). Its heading is "Access & room requests" (`:286`). Its catalog is seven facts (`lib/providers/hotelAmenityEvidence.ts:18`–`26`): `elevator`, `on_site_parking`, `step_free_route`, and four room preferences (`ground_floor`, `high_floor`, `near_elevator`, `connecting`). **None of the seven is a disability-need fact.**

## What Changed Since 2026-07-21 (verified in current code)

The prior discovery's central claim — *"zero accessibility fields, zero provider mapping, zero UI; the problem is total absence"* — **is now out of date.** The `hotel-access-requirements` line shipped, and with it most of the infrastructure the accessibility work was waiting on:

| Prior finding (2026-07-21) | State today |
|---|---|
| `HotelOffer` has no field to carry evidence | **Shipped.** `amenityEvidence?: HotelAmenityEvidence[]` and `accessEvidenceState` exist (`lib/types.ts:489`–`490`). |
| No provenance contract in code | **Shipped.** `HotelAmenityEvidence` carries `status` (`confirmed`/`unavailable`/`not_returned`/`unknown`), `scope` (`property`/`room`/`rate`/`selected_stay`), `sourceLabel`, `fee`, `fetchedAt`, `confidence`, and a `certainty` (`guaranteed`/`requestable`) dimension (`lib/types.ts:~127`–`150`). |
| No provider normalization path | **Shipped.** `normalizeHotelAmenityEvidence` is wired into both Hotellook paths (`lib/providers/hotellook.ts:381`, `:502`). |
| No evidence panel on the card | **Shipped.** `AccessEvidencePanel` implements loading / ready / error / all-not-returned states with `aria-live` and a non-color-only status treatment. |

Two things did **not** ship, and they are the whole of the residual problem:

1. **No disability-need facts exist in the catalog.** A repo-wide search across `lib/` and `app/` for `wheelchair|roll-in|grab bar|braille|service animal|hard of hearing|mobility` returns **zero** product-code matches. The only accessibility-adjacent id is `step_free_route`, and it is framed as luggage/stroller logistics, not disability fit.
2. **No provider returns any of it.** Hotellook is a dead API and never populates `amenityEvidence`, so the panel's real-world steady state is the not-documented copy at `HotelCard.tsx:274`. The plumbing is provider-agnostic and ready; the data is not there.

## The Distinct Problem: A Near-Miss Answer Is Worse Than Silence

The prior discovery's risk model was *"the first wrong move would replace absence with false confidence."* That move has now effectively been made — not by a generic "Accessible ✓" chip, but by an adjacent panel whose title and vocabulary a user with an access need will read as the accessibility answer. Three properties make this distinct from the 2026-07-21 problem:

1. **The panel answers a different question under a name that claims this one.** "Access" in a hotel context is the word disabled travelers search for. A panel headed "Access & room requests" that resolves to *"Access details not documented by this provider"* tells a wheelchair user, in their own vocabulary, that the property's accessibility is undocumented — when the app never asked the provider about roll-in showers, grab bars, or alarms at all. **Absence was honest; this is a scope claim the app cannot support.** The catalog's silence is being rendered as the provider's silence.

2. **The failure is now a naming and boundary problem, not a data problem.** Because the contract, normalization path, and panel states already exist and are sound, the remaining work is *not* "build accessibility infrastructure." It is: decide what disability-need facts enter the catalog, decide whether they live in the existing panel or a separate need-grouped one, and fix the naming so neither panel over-claims the other's territory. This is a much smaller, more tractable problem than the one scoped on 2026-07-21, and mis-scoping it as "build it all" would duplicate shipped code.

3. **Requestable-vs-guaranteed does not transfer to disability needs.** The shipped model's `certainty: 'requestable'` is right for "high-floor room" — a preference the property tries to honor. Applying that same framing to a roll-in shower is a category error: for a wheelchair user this is not a preference that can gracefully fail, it is a booking-blocking requirement. The existing `certainty` dimension must be **reused for its own facts and explicitly not extended** to disability needs without new copy rules.

## Measurable Signal

The ticket names three measures. Each is defined against the current build:

- **Failed discovery rate** — share of hotel-detail sessions by a user with a stated access need that end without the user locating a fact relevant to their need *or* an honest "we did not ask about this" state. Today this is structurally **100%**: no disability-need fact exists in the catalog, so no such fact can ever be found. This is the headline number and it is verifiable now, without instrumentation.
- **Detail exits** — exits from the expanded `HotelCard` to the provider (`buildHotelBookingHref`) or out of the app entirely, occurring *after* the `AccessEvidencePanel` has rendered its not-documented state. An exit here is the observable proxy for "the app told me nothing and I left to find out." Analytics scaffolding already exists (`HotelDecisionAnalytics.tsx`, `track(...)` in `HotelDealCriteria.tsx:67`) and can carry this without new infrastructure.
- **Requests for unavailable information** — support/feedback contacts asking for accessibility facts the app does not model. This is the demand signal that ranks the MVP catalog: which facts users ask for is better evidence than which facts a taxonomy suggests.
- **Structural signal (verifiable today, no instrumentation):** 7 access facts in the catalog, 0 of them disability-need facts; 0 accessibility filter controls against 3 shipped filter pills; 1 panel titled "Access" that answers about elevators and floor preferences.

## Constraints The Solution Must Respect

1. **Reuse the shipped contract; do not fork it and do not rebuild it.** Any accessibility fact must be a `HotelAmenityEvidence` entry normalized in `lib/providers` (per the non-negotiable contract — no vendor call from a component), carrying `status`, `scope`, and `sourceLabel`. Do not introduce a parallel evidence type, a second normalization path, or a second panel component pattern. Unmapped vendor values map to `unknown`, never to a new id. The prior research's twelve-item need-grouped set (`accessibility-stay-fit/02-research.md`, Deliverable 4) is the starting catalog and must be reconciled against the seven ids already shipped — `elevator` and `step_free_route` already exist and **must not be duplicated under new names**.

2. **Never let a scope or a silence be misread — in either direction.** Property-level facts (`accessible_room`, `service_animals_welcome`, signage, common areas) must never read as a claim about the selected room or rate. "Not documented" must never render as "unavailable," and "unavailable" must never render as silence. No accessibility claim may be inferred from stars, price, photos, property type, or the absence of a negative flag. No ADA / compliance / certification / "suitable for" / "safe for" language, and no medical framing — the app reports what a provider documented, attributed, and defers suitability to the provider and the user.

3. **Do not disturb the shipped hierarchy, and keep the collapsed card silent.** Price, Deal Score, location, quality, and the Review CTA keep their current prominence; accessibility lives in detail. Per the prior research's Deliverable 5, the collapsed card shows nothing about accessibility absent confirmed data — a card-level claim cannot carry scope, so silence there is correct. Everything must remain scannable and non-overlapping at 375px and 1280px, must not convey status by color or icon alone (the audience is literally assistive-tech and low-vision users), and must preserve the existing panel's `aria-live` and reading-order behavior.

## Success Statement

This is solved when a first-time traveler with a mobility, vision, or hearing need can open an expaify hotel detail and, without leaving the app, correctly tell (a) which accessibility facts relevant to their need the provider has actually documented, (b) whether each applies to the whole property or to a specific room or rate, and (c) which of their needs expaify **did not ask the provider about at all** — so that they never mistake the elevator-and-room-preferences panel for an accessibility answer, never read "not documented" as "unavailable," and never read a property-level claim as a promise about the room they are booking.

---

## Required UXR Deliverables (`UXR-HOTEL-ACCESSIBILITY-NEEDS-01`)

Research must **carry forward** `accessibility-stay-fit/02-research.md` — participant criteria (Deliverable 1), evidence standards (Deliverable 2), success measures (Deliverable 3), the twelve-item MVP set (Deliverable 4), and the empty-data treatment (Deliverable 5) are **settled and must not be re-derived**. New work is limited to the four questions the 2026-07-21 research could not have asked, because the code it audited no longer exists:

1. **Catalog reconciliation.** Map the twelve proposed accessibility ids against the seven shipped ids in `lib/providers/hotelAmenityEvidence.ts`. Resolve `elevator` (exact duplicate), `step_free_route` vs. proposed `step_free_entrance` (overlapping but not identical — route-to-room vs. building entrance), and `on_site_parking` vs. proposed `accessible_parking_path`. Output one merged canonical catalog with an explicit keep / rename / drop / add decision per id and a one-line justification each.

2. **Panel boundary and naming.** Decide whether disability-need facts extend `AccessEvidencePanel` or occupy a sibling panel, and specify the resulting headings. The current heading "Access & room requests" over-claims and must be resolved either way. State the reading order relative to `QualityEvidencePanel` and the price/CTA block, and how a screen-reader user reaches the right panel.

3. **The "we did not ask" state.** The prior research defined `not_returned` (provider was asked, said nothing). Current reality needs a distinct fourth state: *expaify does not model this fact for this provider at all.* Specify how this differs from `not_returned` in both data and copy, whether it is expressible within the shipped `status` union or needs a minimal extension (prefer the former; justify any extension), and how it is announced without alarming or reassuring.

4. **Certainty boundary.** Specify why `certainty: 'requestable'` is valid for room preferences and must not be applied to disability-need facts, with the copy rule that enforces it.

Plus, unchanged from the general stage requirement: audit the actual current source files (do not trust this doc's line numbers without re-checking), and compare against one or two reference patterns at the interaction level — the prior research's Booking.com and Google Hotels comparison stands and need only be extended if question 2 or 3 requires it.

## Out Of Scope (flag for later tickets)

- **Building an accessibility filter.** Filtering is owned by the shipped `DealFeed` filter-pill system and `hotel-amenity-fit`. Accessibility filtering is real user value but is gated on data existing first; a filter over an empty catalog produces empty results and destroys trust faster than no filter.
- **Letting accessibility influence Deal Score.** Scoring has no approved model for hotel fit and must not conflate price percentile with usability.
- **Provider integration.** DEV work is contingent on a provider that actually returns documented accessibility data. Hotellook does not. If no such provider is confirmed, the deliverable ceiling for this line is an honest, well-scoped "we did not ask / provider did not document" state — which is still a real improvement over a panel that implies otherwise.

## Handoff

Create `UXR-HOTEL-ACCESSIBILITY-NEEDS-01` (UX Research) with this report's path, the problem statement, and the four scoped research questions above, plus explicit instruction to inherit rather than re-derive `docs/pipeline/accessibility-stay-fit/02-research.md`.

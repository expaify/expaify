# UX Research: Work-Friendly Hotel Fit

Ticket: `UXR-HOTEL-WORKSPACE-FIT-01`
Stage: UX Research
Priority: P2
Date: 2026-07-22
Persona: Senior UX Researcher

## Source Inputs

- Discovery report: `docs/pipeline/hotel-workspace-fit/01-discovery.md` (problem statement embedded in the ticket; the file is not present in this worktree, so the ticket-embedded problem statement is treated as the discovery of record and is not re-derived here).
- **Settled foundation — reuse, do not fork:**
  - `docs/pipeline/hotel-amenity-provenance/01-discovery.md` + `02-research.md` — the provider-neutral amenity **evidence contract**: canonical id, display label, `status` (`confirmed` / `unavailable` / `not_returned` / `unknown`), source label, confidence, optional `fetchedAt`, `scope` (`property` / `room` / `rate` / `selected_stay`), and `fee` (`included` / `paid` / `unknown`). Plus the data-integrity bar: never render missing data as `No X`, never imply selected-stay availability without provider support, never rely on color/icon alone for status.
  - `docs/pipeline/hotel-amenity-fit/02-research.md` — the 8-amenity intent ranking (Wi-Fi/parking/breakfast/AC/shuttle/pool/pets/gym), the `FilterPill` reuse decision, the confirmed-only filter semantics, and the coverage-degradation rule. Work-fit is a **need-specific lens over a subset of this vocabulary**, not a competing amenity model.
  - `docs/pipeline/accessibility-stay-fit/01-discovery.md` — the **direct structural sibling**. It established that for a need-specific fit domain a boolean chip is actively misleading, that property-level ≠ room-level is the highest-risk misread, and that the correct data substructure is the provenance `status` + `scope` + source model plus a first-class "not documented" state. This brief applies the identical discipline to work fit.
  - `docs/pipeline/trip-purpose-fit/01-discovery.md` — established that **no trip-purpose control exists** and that the "remote work" purpose is **blocked-on-amenity/workspace data**. Work-fit is precisely the data unlock that discovery named; §Deliverable 2 resolves how the two connect.
  - `docs/pipeline/guest-room-fit/01-discovery.md` — sibling fit lens; confirms the property-vs-room labeling discipline and the "don't conflate with Deal Score / quality / amenities" separation rule.
- Current implementation audited directly this stage (read, not assumed):
  - `lib/types.ts` (`HotelOffer` 137–151; `HotelProvider` 179–184; `HotelRatingEvidence` 109–117).
  - `lib/providers/hotellook.ts` (live normalization 448–487; cached 318–381).
  - `app/components/HotelCard.tsx` (collapsed 425–521; expanded 523–582; evidence-discipline helpers `getConfidenceText` 248, `getQualityHelperText` 264).
  - `app/deals/DealFeed.tsx` (`FilterPill` 91–160; filter row 465–506; renders `DealCard`/`LockedDealCard` 683/692).
  - `app/api/search/route.ts` (hotel intake 174–177; `searchHotelAvailability` call 397; stream events 397–410).
- Reference patterns checked at the interaction level (not visual style):
  - Booking.com "Great for a work trip" / "Ideal for solo travellers who are working" property callouts and the "Are you travelling for work?" prompt.
  - Google Hotels amenity filters (Free Wi-Fi, Business services / "Work-friendly") and the property "About" facility groupings.

## Research Question

Can a business or remote-work traveler correctly judge — from an expaify hotel result, without leaving the app — whether a stay actually supports productive work, given that (a) the app carries **zero** work-relevant signals today, (b) the one live hotel provider returns none, and (c) the honest work-fit signals (connection **reliability**, desk **suitability**, **quiet**) are precisely the ones that a presence boolean and a property-level scope cannot express — **without misreading "Wi-Fi ✓" as "good enough to take video calls," "has a desk" as "a room I can work in," or a property-level claim as a fact about the room they will book?**

## Research Summary

Work fit is entirely absent from the stack — no `HotelOffer` field, no provider mapping, no `HotelCard` UI — which matches the discovery's structural claim and is not re-litigated. The design problem is **not** "add a Wi-Fi and a Desk chip." That is the exact failure the discovery isolates: reducing work-fit to booleans destroys the signal, because the three things a working traveler actually needs are graded and conditional, not binary:

1. **Connectivity is about reliability, not presence.** "Free Wi-Fi ✓" is already covered by amenity-fit as a hidden-cost signal. It says nothing about whether the connection carries a two-hour video call. The work-relevant fact is a *quality/reliability* claim (speed tier, "suitable for streaming/calls," wired option), which a provider supplies rarely and separately from the presence flag.
2. **A desk is about suitability, not existence.** A decorative writing ledge and a full work desk with a task chair and reachable power are different facts. Provider desk data, when it exists at all, is usually a room-scoped feature, so it collides head-on with the property-vs-room problem.
3. **Quiet is not an amenity field at all.** Provider facility payloads almost never carry a "quiet" boolean. Real quiet signal lives in soundproofing facility flags (rare) and, dominantly, in **guest-review text** — which is out of scope here and owned by `hotel-review-relevance`. Work-fit must therefore treat quiet as *mostly not documented* and must not manufacture it.

So work fit has the same two-axis trap accessibility does — **presence ≠ suitability** and **property ≠ room** — but with an added twist: its highest-value signal (quiet, and to a lesser extent connection reliability) is the **least likely to be provider-documented as a structured field**. The dominant on-screen state will be `not_returned`. Every directive below makes "not documented" legibly different from "documented as unavailable," and makes a graded/conditional claim legibly different from a binary "has it."

This is a **contract + UI-states research deliverable**, not a build-now feature: like accessibility, DEV work is contingent on a provider that actually returns work-relevant fields. Hotellook does not, and is currently dead (returns empty). The output is the evidence contract, the signal ranking, the entry-point decision, and the comprehension bar — so UXDES can specify states and copy, and DEV can wire a field the moment a work-data-bearing provider is confirmed.

## Current Implementation Findings

### 1. `HotelOffer` carries no work dimension
`HotelOffer` (`lib/types.ts:137`–`151`) holds identity, `area`/`location`, `stars`, `pricePerNight`, `priceBasis`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, `guestRating`. There is **no connectivity, workspace/desk, quiet/noise, or work-suitability field, and no scope/status metadata for one.** `NormalizedHotelOffer = HotelOffer`, so the search stream inherits the gap. The existing `HotelRatingEvidence` shape (`lib/types.ts:109`–`117`: `kind`, `value`, `scaleMax`, `sourceLabel`, `reviewCount`, `fetchedAt`, `confidence`) is the structural template the work-evidence contract should mirror — not a parallel invention.

### 2. Hotellook maps zero work fields (and is dead)
`lib/providers/hotellook.ts` normalizes price, location, hotel class, and guest rating for both live (`448`–`487`) and cached (`318`–`381`) paths. A search for `wifi|internet|connection|desk|workspace|quiet|noise|soundproof|business` returns nothing. The `cache.json` engine payload is thin (id, name, stars, location, distance, priceFrom, photo, propertyType) and the provider currently returns empty. `not_returned` is therefore the **expected default**, exactly as accessibility and amenity-provenance found.

### 3. `HotelCard` has the evidence discipline but no work slot
- Collapsed (`425`–`521`): photo, name, hotel-class + guest-rating chips (`449`–`470`), location (`471`–`476`), price block, `ScoreChip`, `Review hotel` CTA, `Details` toggle. No work chip.
- Expanded (`523`–`582`): photo, `DealScorePanel`, `QualityEvidencePanel`, low-confidence note, Location panel, Price-scope/Rate-check/Provider-handoff panel. No work panel.
- The card already enforces the exact bar work fit must meet: `getConfidenceText` (`248`), `getQualityHelperText` (`264`), and explicit "not provided" states throughout distinguish verified vs provider-only vs inferred vs absent. Work fit must occupy its **own labeled region** at this bar and must not borrow the success/warning tokens used by `ScoreChip`/`QualityEvidencePanel`.

### 4. Surface reconciliation is still unresolved (carried, not fixed here)
`HotelCard` is referenced **only in tests** (`app/components/__tests__/scorePresentation.test.tsx`); it is not mounted in a live results page. `DealFeed` — which carries the real `FilterPill` row (`465`–`506`) — renders `DealCard`/`LockedDealCard` (`683`/`692`), not `HotelCard`. This is the identical open question raised in `hotel-amenity-fit/02-research.md` (item 2 / Question 8). Work fit inherits it and must not guess the target surface; it is flagged as a blocking design input below, not resolved in research.

### 5. `FilterPill` is single-select and premium-gated
`FilterPill` (`91`–`160`) takes `activeLabel: string | null` and a single `onClear` — it is single-select. The filter row (Destination, Min discount, Stars, Max price, sort) is gated `disabled={!premium}`. Any work filter must reuse this control and would need the same multi-select extension amenity-fit already scoped — this brief does **not** duplicate that extension work; it defers to amenity-fit as the owner of the filter mechanism.

---

## Deliverable 1 — Work-Fit Signal Priority Ranking

Audience: business travelers on short trips and remote/extended-stay workers, on a value product. The ranking weights three drivers: **task-blocking** (its absence makes work impossible, not just unpleasant — e.g. a call-grade connection), **suitability-graded** (the fact is only useful if it distinguishes "adequate for work" from "present but token"), and **provider-documentability** (how likely a structured provider field actually carries it — a high-value signal that is never documented cannot ship as a confirmed chip and belongs in the review lens instead).

Signals are expressed as **work-specific evidence items**, each reusing the provenance `status`/`scope`/`source`/`confidence` substructure. The top 3 are the recommended MVP lock; 4–5 are tier-2 (ship only if a provider documents them); the last is explicitly **not a structured chip**.

| # | Work signal (canonical id) | Primary driver | Why it ranks here / how it must be expressed |
|---|----------------------------|----------------|----------------------------------------------|
| 1 | **Connection reliability** (`work_connectivity`) | Task-blocking + suitability-graded | The single work-defining signal. Must be a *quality* claim, not the amenity Wi-Fi presence flag (which amenity-fit already owns as a hidden-cost signal). Surface only a provider-stated tier/claim ("Wi-Fi suitable for streaming/calls," speed band, wired option). Never derive reliability from the presence of Wi-Fi. If only presence is known, this signal is `not_returned`, **not** `confirmed`. |
| 2 | **Workspace / desk suitability** (`work_desk`) | Task-blocking (extended) + suitability-graded | A usable desk + chair is the physical precondition for laptop work. Almost always **room-scoped** — so it is the sharpest property-vs-room trap. Show only when provider documents a desk/workspace feature; declare `scope` explicitly; a property-level "business-friendly" claim must never read as "this room has a desk." |
| 3 | **Quiet / low noise** (`work_quiet`) | Task-blocking (calls/focus) but **low documentability** | The highest emotional value for a working traveler and the hardest to source: provider facility payloads rarely carry it. Ship only when a provider documents a concrete facility (soundproofing, quiet-room designation). Otherwise it is `not_returned`. **The dominant quiet signal lives in guest-review text and is out of scope here** — see §Out-of-Scope; do not fabricate quiet from stars, price, or property type. |
| 4 | **Business services** (`work_business_services`) | Suitability (short business trip) | Business center, printing, meeting space. Property-scoped, binary-safe (its presence is a real fact even without grading). Tier-2: include if documented. |
| 5 | **In-room power / ergonomics detail** (`work_power`) | Suitability (extended stay) | Reachable outlets/USB at the desk, adequate lighting. Rarely documented; tier-2, room-scoped. First to cut. |
| — | **"Overall good for work" verdict** | — | **Explicitly excluded as a structured signal.** A single roll-up verdict re-creates the boolean failure the discovery names and would imply a suitability judgment expaify cannot make from thin provider data. Booking's "Great for a work trip" badge is a *provider-computed* claim over dense data expaify does not have; expaify must not synthesize one. If ever shown, it may only be a **verbatim provider-attributed** label, never an expaify computation, and never fed by/into Deal Score. |

Explicitly deferred to hold scope: coworking-space partnerships, monitor/second-screen rental, day-rate/"work from hotel" products, loyalty-desk perks. Connectivity **presence and fee** remain owned by amenity-fit (`wifi`); this lens adds only the *reliability/suitability* layer on top.

## Deliverable 2 — Trip-Purpose Entry-Point Decision

**Context (settled, not re-derived):** `trip-purpose-fit` established that (a) no trip-purpose control exists anywhere today, and (b) the "remote work" purpose is *blocked-on-amenity/workspace data* — this ticket is that data unlock. It also warned against building **two different purpose pickers** (it cross-checks `trip-inspiration-paid-intent`).

**Decision: work-fit evidence is displayed passively; the trip-purpose "Work trip" chip is the *consumer/entry point* — and work-fit must not build or hard-depend on that chip.**

Rationale and the three options weighed:

- **(A) A dedicated "work fit" control of its own — Rejected.** It would be the second purpose picker `trip-purpose-fit` explicitly warned against, and it forces a working traveler to declare intent twice. Work fit is a *lens*, not a new intent surface.
- **(B) Hard-couple to the trip-purpose "Work trip" chip — Rejected as a dependency, adopted as a direction.** The trip-purpose chip is the *correct* long-term entry point: when a user taps "Work trip," results should emphasize/filter on this lens. But that chip **does not exist yet** (trip-purpose-fit is at discovery only). Work fit cannot block on an unbuilt control.
- **(C) Passive, always-on evidence display on card/detail (like amenity + accessibility evidence) — Recommended baseline.** Work-fit evidence renders wherever hotel evidence renders, shown only when `confirmed`, in its own labeled region — exactly as amenity/accessibility/quality evidence do. No entry point required to *see* it. This ships value independent of the purpose picker and preserves the "a user who ignores it gets today's experience" constraint from trip-purpose-fit.

**Net recommendation for UXDES:** design work-fit evidence as passive card/detail content now (option C). Design the *filter/emphasis* affordance as a **future consumer of the trip-purpose "Work trip" chip** once trip-purpose-fit ships it — reusing the `FilterPill` multi-select extension amenity-fit owns, not a new control. Do **not** introduce a standalone work-fit toggle. Coordinate the canonical id/label vocabulary with trip-purpose-fit so "Work trip" purpose consumes these exact `work_*` evidence ids.

## Deliverable 3 — Relevance Measurement Definition

"Relevance" here = **the share of work-intent hotel decisions where the traveler can locate the work-relevant facts they need (or a clear "not documented" state) without leaving expaify, and reads each fact at its true strength (presence vs suitability, property vs room).** Measured as:

- **Primary — in-app work-fit resolution rate.** Of sessions with declared or inferred work intent, the share where the user reaches a booking decision (Review hotel click *or* deliberate skip) after viewing work-fit evidence, without an intermediate provider-page exit whose only plausible purpose was checking work suitability. Baseline today is structurally **0%** (no data, no surface).
- **Primary — correct-strength read rate (comprehension gate).** From the tasks in §Deliverable 4: ≥85% correct on the presence-vs-suitability tasks (A, C) and the property-vs-room task (B) is the **release gate**. These are trust-critical; a graded signal misread as a guarantee is the failure mode.
- **Secondary — qualified engagement.** "Review hotel" CTR on hotels with `confirmed` work signals, for users with work intent, should exceed the same hotels shown with no work cue — clicks become more *qualified*, mirroring guest-room-fit's "qualified click" measure. Guardrail: no drop in overall hotel engagement for non-work users (work evidence must not crowd the card).
- **Secondary — false-confidence complaint rate.** Post-booking reports of "Wi-Fi could not carry my calls" / "no real desk" / "too noisy to work" should not rise after launch — the direct symptom of a presence/property claim being read as a suitability/room guarantee. A rise means the state legibility failed.
- **Coverage instrument (context, not a success metric).** Track provider work-signal coverage across the result set (share of hotels with ≥1 `confirmed` work field). Given Hotellook returns none, expect near-0 initially; this gates whether a filter is even offerable (see empty-data treatment) and sets expectation before any filter empties the list.

## Deliverable 4 — Comprehension Tasks (presence-vs-suitability and property-vs-room)

Run moderated with 5–7 participants split across business-trip and remote-work travelers. Threshold: ≥85% correct on A, B, C (the trust gate). Each task validates that a user reads work-fit **strength and scope** correctly, not just that a chip is present.

- **Task A — presence vs. suitability (connectivity).** Hotel X shows amenity "Free Wi-Fi ✓" but **no** `work_connectivity` evidence (`not_returned`). Hotel Y shows `work_connectivity = confirmed`, "suitable for video calls." Ask: "Which hotel do you *know* can carry a two-hour video call?" *Pass:* Y only. *Fail:* "both" / "X" — the core presence-as-suitability misread the lens must prevent.
- **Task B — property vs. room (desk).** Hotel shows `work_desk = confirmed`, `scope = property` ("business-friendly property"). Ask: "Does the room you'd book have a work desk?" *Pass:* "Can't tell from here / need to confirm the room with the provider." *Fail:* "Yes." Directly mirrors the accessibility property-vs-room gate.
- **Task C — filter semantics (unknown ≠ absent).** With a "Work-ready" filter applied, a hotel whose `work_connectivity` is `not_returned` disappears. Ask: "Do the hidden hotels definitely lack work-grade Wi-Fi?" *Pass:* "No — some just weren't reported." *Fail:* "Yes." Validates the filter hides unknowns, not confirmed-absent (identical to amenity-fit Task C).
- **Task D — documented-unavailable vs not-documented.** Hotel P: `work_quiet = unavailable` ("provider notes street-facing rooms, no soundproofing"). Hotel Q: `work_quiet = not_returned`. Ask: "Which hotel do you *know* is likely noisy for work?" *Pass:* P only. *Fail:* "both" / "Q."
- **Task E — all-unknown hotel.** Every `work_*` field `not_returned`. Ask: "Describe this hotel's work suitability." *Pass:* "The provider didn't report it." *Fail:* "It's not good for work / it has none." (Prevents absence read as a negative verdict.)
- **Task F — no synthetic verdict.** Show a high-star, central, well-rated hotel with **no** `work_*` evidence. Ask: "Is this a good hotel to work from?" *Pass:* references that work facts aren't reported / would check reviews or provider. *Fail:* "Yes, because it's 5-star/central" — confirms users are **not** inferring work fit from stars/price/location (the trip-purpose-fit honesty guardrail).

## Deliverable 5 — Empty-Data Treatment

Given the live provider documents no work fields, empty is the **default**, not an edge case. Recommendations for UXDES:

1. **All-unknown card: suppress, don't shout.** When a hotel returns 0 `work_*` fields, render **no** work region on the collapsed card and, in expanded detail, a single neutral line — `Work-suitability details not reported by the provider` — never a row of "not reported" chips and never `Not work-friendly`. (Directly follows the amenity-provenance rule: never render missing as `No X`.)
2. **Confirmed-only on the collapsed card.** Only `confirmed` work signals appear collapsed, max 2 (work evidence is lower-frequency and must not crowd price/score/CTA at 375px). `unavailable`, `not_returned`, `unknown` live in expanded detail only.
3. **Distinct labels for all four states, text + icon, never color/icon-only.** `confirmed` → e.g. "Wi-Fi suitable for calls (provider-stated)"; `unavailable` → "Provider notes no soundproofing"; `not_returned` → "Not reported by the provider"; `unknown` → "Provider data unclear." Screen readers must hear the state in words (accessibility-stay-fit and provenance both require this).
4. **Scope always declared.** Any `property`-scoped work fact uses language that cannot read as a room promise and directs the user to confirm the room/rate with the provider before payment — reuse the amenity-provenance property-level copy pattern (`Provider lists this for the property. Confirm room and rate details before payment.`).
5. **Filter offerability gate.** A "Work-ready" filter (future, via the trip-purpose chip) must render **disabled with explanation** when result-set work coverage is below the amenity-fit-defined threshold, rather than silently returning a near-empty list. Given current 0% coverage, the filter is disabled-with-reason by default until a work-data provider lands.
6. **Never synthesize.** No `work_*` value may be derived from `stars`, `hotelClass`, `guestRating`, `price`, `propertyType`, or photos. Undocumented is `not_returned`, full stop.

## Deliverable 6 — Reference Comparison (interaction level)

- **Booking.com — "Great for a work trip" / travelling-for-work prompt.** Booking asks "Are you travelling for work?" at search and surfaces property callouts like "Ideal for solo travellers who are working" and highlights work-relevant facilities (desk, high-speed Wi-Fi). Interaction model: intent is captured once, lightly and dismissably, then work-relevant facts are *emphasized* rather than invented. **Delta:** expaify has neither the intent prompt (trip-purpose-fit will own it) nor the underlying facts. Critically, Booking's "Great for work" is a *provider/platform-computed* label over dense data — expaify must **not** replicate the computed verdict (see Deliverable 1, excluded row); it can only emphasize provider-attributed facts. The reference validates the *passive-emphasis + single lightweight intent* model, not a synthesized badge.
- **Google Hotels — amenity/work-friendly filters.** Google exposes Free Wi-Fi and business-service filters and groups facilities in the property "About" tab. Interaction model: structured, filterable facility facts; pre-open narrowing by must-have. **Delta:** confirms the structured-fact + pre-open-narrowing pattern (which amenity-fit already adopts via `FilterPill`), but Google assumes dense data and shows **no "unknown" state** and no presence-vs-suitability distinction — the two things expaify's sparse data *forces* it to add. Reference is a floor, not a ceiling.
- **Shared takeaway:** both capture work intent lightly and treat work amenities as structured facts, but both assume dense, gradeable data. expaify's differentiator/obligation is the **confirmed-vs-unknown** and **presence-vs-suitability** legibility neither reference needs — the same conclusion amenity-fit and accessibility reached, sharpened here by connectivity reliability and quiet being the least-documented, highest-value signals.

## Design Directives for UXDES (testable)

1. **Reuse the provenance contract; add only work-specific evidence items.** Define `work_*` signals as `HotelRatingEvidence`-shaped items carrying `status` (`confirmed`/`unavailable`/`not_returned`/`unknown`), `scope`, `sourceLabel`, `confidence`, optional `fetchedAt`. Do **not** invent a parallel model, and do **not** overload the amenity `wifi` flag. *Test:* every work fact on screen resolves to one of the four statuses and declares a scope; connectivity presence (amenity) and connectivity reliability (work) are distinct rows.
2. **Presence ≠ suitability, and it must be legible.** Connectivity and desk must never render a bare "✓". Copy states the *suitability* claim and its source, or renders `not_returned`. *Test:* Tasks A and B pass ≥85%.
3. **Property ≠ room, always declared.** Every work fact shows `scope`; property-level copy cannot read as a room guarantee and routes room/rate confirmation to the provider. *Test:* Task B passes ≥85%.
4. **Four states visually AND textually distinct; absence ≠ unavailable; no synthetic verdict.** No missing chip encodes "not work-friendly"; no roll-up "good for work" score is computed by expaify. *Test:* Tasks D, E, F pass ≥85%; no `work_*` value is derived from stars/price/rating/type/photos.
5. **Hard separation from Deal Score and quality evidence.** Work fit gets its own labeled block; it must not share a container, adjacency, or the success/warning tokens with `ScoreChip`/`DealBadge`/`QualityEvidencePanel`, and must not feed or adjust Deal Score. *Test:* work chips use no score/quality token; work block is not nested in the DealScore or Quality panels; scoring inputs unchanged.
6. **Passive display now; trip-purpose chip is the future entry point.** Work evidence renders passively (max 2 confirmed collapsed, full states expanded); no standalone work toggle. A future "Work-ready" filter reuses the amenity-fit `FilterPill` multi-select extension, gated by the trip-purpose "Work trip" chip, disabled-with-reason below coverage threshold. *Test:* a user who never expresses work intent sees today's experience; the filter (when present) is disabled+explained with an all-`not_returned` fixture.

## Non-Negotiables Carried Forward

- All work-signal data flows through `lib/providers` and normalizes vendor strings there; components never parse vendor work/facility payloads.
- Adapters return `Result<T>`; money stays integer `priceCents`; secrets from env; outbound hotel deeplinks keep affiliate markers.
- Work fit never feeds, adjusts, or visually merges with Deal Score or hotel-class/guest-rating quality evidence.
- Reuse the provenance `status`/`scope`/`source`/`confidence`/`fee` contract — do not fork it, and do not duplicate the `FilterPill` multi-select extension owned by amenity-fit.
- No work value is ever inferred from stars, price, rating, property type, or photos.

## Out-of-Scope Findings (flag, do not build here)

- **Surface wiring gap (blocking design input, not fixed here):** `HotelCard` is tests-only; `DealFeed` renders `DealCard`. Which surface work fit lands on is the same unresolved decision as amenity-fit Question 8 and must be named by design before UI/DEV.
- **Quiet from guest reviews is owned by `hotel-review-relevance`.** The dominant quiet signal is review-text-derived; this lens surfaces only provider-documented structured quiet facts and must not synthesize quiet. Coordinate so the two do not double-count or contradict.
- **The "Work trip" purpose picker is owned by `trip-purpose-fit`.** Work fit consumes it; it must not build a second purpose control.
- **The amenity `FilterPill` multi-select extension is owned by `hotel-amenity-fit`.** Any work filter reuses it.
- **DEV is provider-contingent.** No work fields exist in any adapter and Hotellook returns none; implementation is gated on a provider that documents work-relevant facts. Until then the deliverable is the contract + UI states, exactly like accessibility.
- Work data must not affect Deal Score until scoring has a separate approved hotel-fit model.

## Handoff

Create `UXDES-HOTEL-WORKSPACE-FIT-01` for an implementation-ready design covering: the work-signal set (top-3 lock: `work_connectivity`, `work_desk`, `work_quiet`; tier-2 business-services/power; no synthetic verdict), the `work_*` evidence contract as a reuse of the provenance `status`/`scope`/`source`/`confidence` model, the four-state legibility model with presence-vs-suitability and property-vs-room copy, the passive card/detail display (max 2 confirmed collapsed, full states expanded), empty-data as the default state, the future filter as a trip-purpose-chip consumer reusing amenity-fit's `FilterPill` extension, and hard separation from Deal Score/quality — with final copy for every state at 375px and 1280px, plus keyboard/assistive-tech order. Answer the surface-reconciliation question (which surface work fit mounts on) before UI/DEV.

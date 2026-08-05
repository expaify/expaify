# UXD-HOTEL-FITNESS-FACILITY-01: Hotel Fitness-Facility Suitability Confidence Discovery

Date: 2026-08-03
Stage: UX Discovery (UXD)
Priority: P2
Persona: Senior UX Strategist
Method: Static audit of the reachable deal-card → hotel-detail path, the shared amenity-evidence contract, the provider normalizer and its id allowlist, the `deals` persistence shape, the disruption-evidence contract, and the analytics helper. No production amenity analytics, no provider fitness-attribute sample, and no traveler research were available at this stage.

## Problem Statement

A traveler who needs to maintain a training routine cannot tell from expaify whether a property has a usable gym for their stay — because no fitness fact of any kind is rendered, stored, or even accepted by the data layer, so the entire decision (facility presence, equipment breadth, access hours, age restrictions, and whether it is closed) is deferred to the provider site after expaify has already implied it showed the fit.

This is an evidence-confidence problem, not a request for a generic `Fitness centre` amenity chip. A one-word amenity label is precisely the ambiguous signal this ticket exists to replace: it cannot distinguish a 24-hour equipped gym from a windowless room with one bike, a facility that closes at 20:00 from one open at 05:00, an 18+ policy that excludes a travelling family, or a confirmed facility from a facility the provider simply never described.

## Who Is Affected And Where

The affected user is the routine-maintaining traveler: business travelers on repeat trips, endurance and strength athletes in training blocks, physiotherapy and rehabilitation patients with prescribed exercise, and long-stay or relocating guests. For this segment fitness is not a nice-to-have amenity — it is a hard filter that can outrank price, and a wrong answer costs a paid day of training. The need intensifies for early-start and late-arrival itineraries, where **access hours** decide suitability more than the facility itself, and for travel with under-18s, where an age restriction can void the facility entirely.

The failure spans the reachable card-to-detail flow:

1. **Deal-card shortlist — `app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx`.** The card carries property identity, class, price, discount, and Deal Score. It carries no fitness fact and no fitness summary. A traveler cannot eliminate an unsuitable property at scan time and must open details on every candidate, or shortlist blind.
2. **Hotel detail — `app/deals/[dealId]/page.tsx:426`.** The page has a section titled **"Hotel fit"**. It contains hotel class, a permanently negative guest-rating state, an optional pool ledger, disruption evidence, quiet-stay evidence, and sustainability credentials. It contains no fitness attribute. A section named for the traveler's question answers a different one, which reads as "we checked and there is nothing more" — worse than omission for a user whose decision hinges on this.
3. **Provider handoff — `app/deals/[dealId]/page.tsx:448`.** The provider is the correct boundary for current conditions, but expaify currently sends the traveler there carrying no fitness evidence summary and no statement of what is still unverified. An outbound click must not be read as a resolved fitness decision.

**The stranded contract.** A well-built evidence model already exists: `HotelAmenityEvidence` (`lib/types.ts:138-148`) carries `id`, `label`, `status` (`confirmed` / `unavailable` / `not_returned` / `unknown`), `scope`, `sourceLabel`, `fee`, `fetchedAt`, `confidence`, `certainty` — which is exactly the vocabulary needed to separate "confirmed facility" from "no evidence." Three things prevent any fitness fact from using it:

- **The normalizer discards unknown ids.** `lib/providers/hotelAmenityEvidence.ts` allowlists seven ids — `elevator`, `on_site_parking`, `step_free_route`, and four room-preference requests — and rebuilds output as `ACCESS_FACTS.map(...)` (line 174). A provider returning a `fitness_centre` id has that evidence silently dropped before it reaches any surface.
- **The richer renderer is unreachable.** `app/components/HotelCard.tsx` holds the mature evidence patterns (`AccessEvidencePanel`, with correct unknown/unavailable/loading/error states) but is imported by no page — only by `HotelRateRestrictions.tsx` and tests. Its own `ACCESS_FACTS` (lines 83-94) is a narrower six-id list that also filters out everything else via `isAccessFactId`.
- **Nothing persists.** The `deals` table (`lib/db/schema.sql:125-148`) stores identity, class, photo, prices, dates, `ota_links`, `headline`, `description`. There is no amenity column and no amenity join table, and the live feed reads from `deals`. So a result-time fitness statement cannot currently be reproduced on the detail page, and card-level fitness filtering is not possible without a persistence or per-property-fetch decision.

**The nearest precedent, and its limit.** `HotelPoolEvidenceLedger` (`app/components/ui/HotelPoolEvidenceLedger.tsx`) proves the honest-evidence pattern is achievable for a facility with schedules and unknowns. It is not a shipped capability: it renders only from `app/components/research/hotelPoolFixtures.ts` behind a query param and is hard-disabled in production (`app/deals/[dealId]/page.tsx:313`). It is a research prototype, and UXR must treat it as a pattern reference, not as evidence that provider fitness data exists.

## Measurable Signal

### Structural baseline (verifiable in this repo today)

- Fitness facts rendered on the reachable deal card: **0**. In the detail "Hotel fit" section: **0**.
- Occurrences of gym/fitness/workout data anywhere in `lib/`, `app/`, `scripts/`: **0** (the sole `fitness` string is "fitness for a particular purpose" in `app/terms/page.tsx:42`).
- Canonical fitness ids accepted by `lib/providers/hotelAmenityEvidence.ts`: **0** of 7 allowlisted ids.
- Fitness or amenity columns in the `deals` table: **0**.
- Fitness-specific impression, detail-open, comprehension, or handoff analytics: **0**. `lib/analytics.ts` provides only a generic event-name validator.

No behavioral baseline is therefore obtainable pre-release. The structural zero above is the pre-ship baseline; numeric targets must wait for UXR validation and an instrumented release.

### Primary outcome: fitness-fit recognition

Measure whether a routine-maintaining traveler, after viewing a card and its detail, correctly classifies the property on each dimension the provider disclosed and correctly identifies which dimensions were **not** disclosed. Recognition is only a success when paired with correct comprehension of these distinctions:

- facility **confirmed** vs **explicitly unavailable** vs **not described by the provider**;
- **equipment described** vs **equipment breadth unknown** — a listed facility is not a described one;
- **disclosed access hours** covering, partly covering, or not covering the traveler's stated training window, vs **hours not provided** (never rendered as "24 hours" or "open");
- **age restriction disclosed** (with its threshold) vs **no age policy provided** — absence is not permission;
- **reported closure/restriction during the stay** vs **no closure reported**, which is not the same as "open."

Confidence that outruns comprehension is a trust regression, not a win.

### Secondary outcome: reduced reliance on ambiguous generic labels

Test whether travelers stop treating a bare amenity label as a suitability answer: measure the rate at which they claim a fitness decision is resolved when only a generic label is present, and target a reduction. Diagnostically, track shortlist-stage rejections of unsuitable properties (an earlier rejection is a prevented wasted detail open, not a lost conversion), and read detail exits together with suitable-property detail opens and handoff rate — never either alone.

### Diagnostic coverage measures

Report provider coverage separately per dimension — presence, equipment, hours, age policy, fees, closure — rather than as one blended "complete" rate. Track unknown, stale, conflicting, and malformed exposure rates. If unknown exposure dominates, the honest design problem is unknown-state presentation, not fitness coverage.

## Minimum Evidence Hierarchy To Validate

This defines which questions must stay distinct. It prescribes no component, chip, icon, or layout.

1. **Is there a facility, and on what evidence?** Preserve `confirmed`, `unavailable`, `unknown`, and `not_returned` as four different answers. "Not returned" must never render as "no gym," and "unavailable" must never be softened into "not provided."
2. **What did the provider actually describe about equipment?** Report only enumerated equipment the provider supplied. Do not synthesize a breadth tier, a size claim, or a quality verdict from a count, a photo, hotel class, price, or Deal Score. "Facility listed, equipment not described" is the honest and common answer.
3. **When is it accessible?** Compare disclosed access hours to the traveler's stay only where hours are genuinely disclosed. Report covers / partly covers / does not cover / hours not provided. A 24-hour claim requires an explicit provider statement, not an absent closing time.
4. **Who may use it?** Surface a disclosed minimum-age threshold, supervision requirement, or guest-only restriction as its own dimension, with "age policy not provided" kept explicit. Also keep access fees distinct from presence: a fee-gated facility is present but conditional.
5. **What is the scope, provenance, and freshness?** Property-level unless a narrower scope is genuinely supplied, with source label and `fetchedAt` where available; conflicting, stale, and malformed evidence stay visible.
6. **What remains unverified at the decision boundary?** Disclosed attributes do not confirm day-of-stay opening, maintenance, capacity or crowding, equipment condition, temporary closure, or renovation impact. State this where the traveler acts, not buried.

"Fits my routine" may only be a transparent match between disclosed facts and the traveler's stated need. It must never become a synthetic fitness score or an inferred suitability verdict.

## Constraints

1. **Provider-disclosed facts only; no photo or label inference.** Every fitness fact enters through `lib/providers` and preserves the `Result<T>` boundary. Do not infer presence, equipment, breadth, hours, age policy, or quality from photographs, image counts, hotel class, brand, price, destination, marketing copy, reviews, or Deal Score. Photo-derived inference is explicitly prohibited by this ticket. Missing evidence is unknown — never "no gym," never "open," never "unrestricted."
2. **A confirmed facility and unavailable evidence must never collapse into one state.** The four-state `HotelEvidenceStatus` distinction is the deliverable's core, and it must survive the card summary, the detail ledger, and the accessible name — it cannot be carried by color, icon, or chip presence alone, and it must hold at 375px and 1280px, under keyboard navigation and assistive technology.
3. **Compact, and subordinate to the existing decision hierarchy.** The signal must not displace property identity, price, Deal Score, or stay dates on the card, must not add clutter to a shortlist scan, and must reuse existing design tokens and evidence-ledger patterns rather than introducing a parallel vocabulary. This UXD ticket authorizes no filters, no ranking change, no Deal Score change, and no UI.

## Success Statement

This is solved when a first-time routine-maintaining traveler can move from a deal card to hotel detail and correctly state whether the provider confirmed a fitness facility, what equipment (if any) was actually described, whether disclosed access hours cover their training window, whether an age restriction applies, and whether a closure was reported — without mistaking a generic amenity label for a suitability answer, and without mistaking absent evidence for a confirmed yes or a confirmed no.

## Required UXR Focus

`UXR-HOTEL-FITNESS-FACILITY-01` should:

1. Audit the exact end-to-end delta on the reachable `DealFeed` → `DealCard` → `/deals/[dealId]` → provider-handoff path, plus the orphaned `HotelCard`, `lib/types.ts`, `lib/providers/hotelAmenityEvidence.ts`, provider/cache paths, `deals` persistence, and analytics. State precisely where a fitness fact would be dropped today.
2. Sample current and plausible provider payloads and report coverage **separately** for facility presence, equipment enumeration, access hours, 24-hour claims, age/supervision policy, access fees, source, and freshness. Recommend stop / narrow / go if the evidence cannot support an honest distinction between two hotels.
3. Compare one or two travel-reference patterns (Booking.com, Google Hotels) at the interaction level on listed-versus-described semantics, hours presentation, restriction disclosure, and unknown-state handling — not visual styling.
4. Resolve the closure-ownership boundary explicitly. `HotelDisruptionNoticeType` already carries `facility_closure` and `facility_restriction` with `affectedScopes` (`lib/types.ts:162-177`, rendered by `app/components/ui/HotelDisruptionNotice.tsx`). Recommend whether reported gym closure is expressed through that contract or duplicated, and forbid conflicting claims between the two.
5. Validate the hierarchy with routine-maintaining travelers across scenarios: confirmed-with-equipment, confirmed-but-equipment-unknown, hours cover / partly cover / do not cover / not provided, age-restricted, fee-gated, explicitly unavailable, not-returned, stale, conflicting, and reported-closure. Test recognition and comprehension together, at 375px and 1280px.
6. Produce 3–5 testable directives covering capability-gated card and detail content, exact hours-matching semantics, evidence and provenance language, the confirmation boundary copy, and the instrumentation needed for fitness-fit recognition and reduced generic-label reliance.

## Out Of Scope And Dependencies

Out of scope: provider integration, UI implementation, amenity filters or ranking, Deal Score changes, live occupancy or crowding, equipment condition or brand, class schedules and personal training, spa/sauna/pool/wellness features (pool is owned by `hotel-pool-operating-status`), nearby off-site or partner gyms, accessibility of the facility (owned by the accessibility tickets), review mining, and post-booking property contact.

Dependencies and blockers for later stages:

- **Provider evidence.** The normalizer cannot retain a fitness id today, and no audited provider sample establishes coverage. Any positive fitness claim is blocked until UXR validates a source and a canonical shape.
- **Persistence and continuity.** `deals` stores no amenity evidence, so the detail page cannot reproduce a result-time fitness statement. UXR must state whether persistence or per-property detail fetch is required, since that choice decides whether card-level fitness signals are feasible at all.
- **Measurement.** No fitness analytics and no production baseline exist; recognition and reliance outcomes require research plus later approved instrumentation.
- **Adjacent ownership.** Generic evidence status and provenance semantics belong to `hotel-amenity-provenance`; reported closures overlap the disruption contract; the unreachable-`HotelCard` surface split is a known repo-wide issue that this ticket must not attempt to fix. Reuse existing semantics; do not fork them.

## Handoff

Create `UXR-HOTEL-FITNESS-FACILITY-01` with this report path and the problem statement above. Research must validate provider evidence availability and traveler comprehension before recommending any visible fitness treatment.

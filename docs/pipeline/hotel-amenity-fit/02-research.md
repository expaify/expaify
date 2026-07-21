# UX Research: Hotel Amenity Fit

Ticket: `UXR-HOTEL-AMENITY-FIT-01`
Stage: UX Research
Priority: P0
Date: 2026-07-21
Persona: Senior UX Researcher

## Source Inputs

- Discovery report: `docs/pipeline/hotel-amenity-fit/01-discovery.md`
- **Settled foundation (do not re-derive):** `docs/pipeline/hotel-amenity-provenance/01-discovery.md` and `02-research.md`. That pair established the provider-neutral amenity evidence contract this ticket builds on: each amenity carries a canonical id, display label, `status` of `confirmed` / `unavailable` / `not_returned` / `unknown`, source label, confidence, and optional `scope` (`property` / `room` / `rate` / `selected_stay`) and `fee` (`included` / `paid` / `unknown`). It also set UI-state rules (max 3 confirmed amenities collapsed, never the literal copy `No amenities`, never imply selected-stay availability without provider support).
- Current implementation audited (read directly this stage, not assumed):
  - `lib/types.ts` (`HotelOffer`, lines 137–151)
  - `lib/providers/hotellook.ts`
  - `app/components/HotelCard.tsx` (collapsed 425–521, expanded 523–582)
  - `app/deals/DealFeed.tsx` (filter surface 89–160, 231–517; tabs 520–532)
  - `app/page.tsx` (marketing/upsell copy at line 345)
  - `app/api/search/route.ts` (hotel streaming 393–420)
- Reference patterns checked at the interaction level:
  - Booking.com Facilities filter (left-rail multi-select checkbox group with per-option counts).
  - Google Hotels Amenities filter (quick chips + multi-select "Amenities" menu applied to the results list).

## Research Question

Which amenities matter enough to prioritize, and can a value-focused traveler correctly self-assess amenity fit across the scan → filter → card → detail path **without misreading absence of data as unavailability**, given a provider (Hotellook) that frequently returns no amenity fields at all?

## Research Summary

Amenity fit is entirely absent from the stack: no fields in `HotelOffer`, no mapping in any hotel provider adapter, no amenity chip or panel in `HotelCard`. That structural finding matches the provenance research and is not re-litigated here.

Two findings do change the design brief:

1. **A working filter mechanism already exists — the discovery undercounted it.** The discovery states the only amenity-adjacent filter reference is Premium marketing copy at `app/page.tsx:345` (`'Filter by discount, stars, price'`). That is true only for *amenities*. `DealFeed.tsx` ships a real, implemented `FilterPill` system (Destination, Min discount, Stars, Max price, plus a newest/discount sort), premium-gated via `disabled={!premium}`. Amenity fit should extend this proven control, not introduce a new filter paradigm. This is the correct home for amenity *filtering*.

2. **The card that has amenity-shaped space (`HotelCard`) is not wired to the feed that has the filter (`DealFeed`).** `HotelCard` is the search-results component (hotels streamed from `/api/search`) and is currently referenced only in tests (`app/components/__tests__/scorePresentation.test.tsx`); it is not mounted in a live results page. `DealFeed` — the live feed carrying the real filter pills — renders `DealCard`/`LockedDealCard`, not `HotelCard`. Design must resolve **which surface amenity fit lands on** before UI work; a filter in `DealFeed` and a card panel in `HotelCard` would target two disconnected surfaces. This is flagged as an open question below, not guessed.

The central risk is comprehension, not decoration. With a provider that often returns nothing, the dominant on-screen state will be `not_returned`, and the failure mode is a user reading "no chip" or "not reported" as "hotel does not have it." Every directive below is built to make absence-of-data legibly different from confirmed-absence.

## Current Implementation Findings

### 1. `HotelOffer` carries no amenity dimension
`HotelOffer` (`lib/types.ts:137`–`151`) holds identity, area/`location`, `stars`, `pricePerNight`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, `guestRating`. No amenity list, status, source, scope, or fee field exists. `NormalizedHotelOffer = HotelOffer`, so the search stream inherits the same gap.

### 2. Hotellook maps zero amenity fields
`lib/providers/hotellook.ts` normalizes price, location, hotel class, and guest rating for both live and cached paths. A search for `amenit|facilit|breakfast|parking|wifi|pool|shuttle` returns nothing. There is no path today for any amenity — confirmed or otherwise — to reach the UI. The `not_returned` state is therefore the *expected default*, not an edge case.

### 3. `HotelCard` has evidence architecture but no amenity slot
- Collapsed (`425`–`521`): photo, name, hotel-class chip + guest-rating chip (`449`–`470`), location (`471`–`476`), price block, `ScoreChip` (Deal Score), `Review hotel` CTA, `Details` toggle. No amenity chip.
- Expanded (`523`–`582`): photo, `DealScorePanel`, `QualityEvidencePanel`, low-confidence note, Location panel, Price-scope/Rate-check/Provider-handoff panel. No `Amenities` panel.
- The card already demonstrates the exact evidence discipline amenity fit must match (`getConfidenceText`, quality helper copy, explicit unavailable states). Amenity fit must reach that bar and occupy its own labeled region.

### 4. The real filter surface: `DealFeed` `FilterPill`
`FilterPill` (`89`–`160`) is an outline pill opening a popover of options; an active filter renders as a teal fill with white text and an `×` to clear, and active filters also surface as removable chips. Current dimensions: Destination, Min discount, Stars, Max price; sort toggles newest/discount. All gated behind `premium`. This is the interaction pattern an amenity filter should reuse verbatim (multi-select being the one extension needed — see directives).

## Deliverable 1 — Amenity Priority Ranking (MVP lock)

Audience: value/deal-seeking travelers on a product whose entire promise is "never overpay." Ranking weights three intent drivers: **hidden-cost reveal** (absence adds real trip cost — closest to product DNA), **hard constraint** (a no-go that invalidates the booking), and **comfort floor / leisure pull** (strong scannable differentiator). Selected 8; the top 6 are the recommended lock, the last 2 are tier-2 (include if provider coverage supports; gym is first-to-cut if the set must shrink to 6).

| # | Amenity (canonical id) | Primary driver | One-line justification |
|---|------------------------|----------------|------------------------|
| 1 | Free Wi-Fi (`wifi`) | Hidden-cost reveal | Universally expected; paid Wi-Fi is a surprise fee that silently erodes the "deal." Highest scan frequency. |
| 2 | Free parking (`parking`) | Hidden-cost reveal | Largest single hidden-cost swing ($30–60/night can rival the room discount); directly serves the true-price ethos for anyone driving. |
| 3 | Breakfast included (`breakfast`) | Hidden-cost reveal | `included` vs `paid` moves effective daily cost materially; a primary deal-comparison lever between similar rates. |
| 4 | Air conditioning (`air_conditioning`) | Hard constraint / comfort floor | In many climates a hard no-go, not a nice-to-have; binary and high-stakes, so a false "unavailable" read is especially damaging. |
| 5 | Airport shuttle (`airport_shuttle`) | Hidden-cost reveal (product-distinctive) | expaify pairs flights + hotels; a shuttle offsets ground-transport cost and links the two legs — uniquely relevant here vs a hotel-only product. |
| 6 | Pool (`pool`) | Leisure pull | Top leisure/family must-have; a strong, emotionally salient scan differentiator among comparable prices. |
| 7 | Pet policy — pets allowed (`pets`) | Hard constraint | A pet owner cannot book without it; the sharpest comprehension trap — misreading `not_returned` as "no pets" wrongly excludes viable hotels. |
| 8 | Gym / fitness (`gym`) | Comfort (business/extended-stay) | Rounds out trip-type coverage; binary. Softest intent for the core value audience — first to cut if trimming to 6. |

Explicitly **excluded from MVP** to hold scope (per discovery constraint 1): spa, restaurant/bar, room service, laundry, business center, EV charging, kitchenette, accessibility features. Accessibility is deliberately deferred here — it deserves its own dedicated treatment, not a chip in a value-amenity row, and conflating it risks a data-integrity failure on a high-stakes attribute.

## Deliverable 2 — Comprehension Tasks

Each task validates that a user reads amenity **state** correctly. Run moderated (5–7 value-traveler participants) on the design prototype. Threshold: ≥85% correct on the absence-vs-unavailable tasks (B, C, E) is the release gate — those are the trust-critical ones.

- **Task A — three-way state sort.** Hotel with `wifi=confirmed`, `parking=not_returned`, `breakfast=unavailable`. Ask the user to place each into "definitely has / definitely does not have / can't tell from here." *Pass:* Wi-Fi→has, breakfast→does-not, parking→can't-tell. *Fail signal:* parking sorted into either certain bucket.
- **Task B — absence vs. explicit unavailable.** Two hotels side by side: Hotel X `parking=not_returned`, Hotel Y `parking=unavailable`. "Which hotel do you *know* has no parking?" *Pass:* Y only. *Fail:* "both" or "X" — the core misread the design must prevent.
- **Task C — filter semantics.** Apply the "Free parking" amenity filter. A hotel with `parking=not_returned` disappears from results. "Do the hotels that were hidden definitely lack parking?" *Pass:* "No — some just weren't reported." *Fail:* "Yes." Validates the user understands the filter hides unknowns, not just confirmed-absent.
- **Task D — fee/scope restraint.** `breakfast=confirmed`, `scope=property`, `fee=unknown`. "Is breakfast free, and is it included with this room?" *Pass:* "Can't tell / need to confirm at provider." *Fail:* "Yes, free" or "Yes, with this room."
- **Task E — all-unknown hotel.** Every priority amenity `not_returned`. "Describe this hotel's amenities." *Pass:* "The provider didn't report them." *Fail:* "It has none / it's a basic hotel."
- **Task F — 5-second glance / icon legibility.** Expose a collapsed card for 5s, then hide. "Which amenities did it confirm?" *Pass:* correct recall of the confirmed set. *Fail:* recalls an amenity that was shown as `not_returned`/`unavailable` as confirmed — indicates icon-only or color-only encoding is ambiguous.

## Deliverable 3 — Unknown-Data Handling Questions for Design

Given Hotellook returns no amenities today, these are first-order, not edge cases. UXDES must answer each:

1. **All-unknown card:** when a hotel returns 0 of the 6–8 priority amenities, does the card render an amenity region at all, or suppress it in favor of a single neutral line? (Avoid a wall of "not reported" that adds noise without informing.)
2. **Filter + unknown hotels:** when an amenity filter is active, are `not_returned`/`unknown` hotels excluded, kept-but-flagged, or bucketed separately ("Amenity info not reported")? Each has a different trust cost; Task C says the exclusion must be *disclosed* whichever is chosen.
3. **Filter meaning:** does "Free parking" mean `status=confirmed` only, or `confirmed + unknown`? Recommendation to design: confirmed-only, with the pill/label wording making that explicit (e.g., grouped under an "Amenities (confirmed)" heading) so the filter never over-promises against sparse data.
4. **Coverage degradation:** if amenity coverage across the result set is below a threshold, should the amenity filter render disabled-with-explanation rather than silently returning a near-empty list? What is the threshold, and who owns the copy?
5. **Positive-only display converse risk:** if the card shows only confirmed amenities, how do we stop a user inferring "everything not shown is absent"? Is a persistent "Only provider-confirmed amenities shown" affordance required?
6. **Coverage disclosure:** should the header or filter disclose data coverage ("Amenity info for 3 of 24 hotels")? Helps set expectation before a filter empties the list.
7. **Premium gating:** are amenity filters premium like the existing pills (`disabled={!premium}`), and if disabled for free users, what is shown — a locked pill or nothing?
8. **Surface reconciliation (blocking):** does amenity fit live on `HotelCard` (search results), on the `DealFeed` feed (which today renders `DealCard`), or both — and if both, is the amenity *filter* on the feed while the amenity *evidence* is on the card? These are currently disconnected surfaces (see Finding, item 2); design must name the target surface before UI/DEV.

## Reference Pattern Comparison (interaction level)

- **Booking.com — Facilities filter.** Left-rail multi-select checkbox group; popular facilities surfaced first; each option shows a live result count; selecting narrows the list. Interaction model: amenity is a structured, filterable property fact. **Delta:** expaify has the filter *mechanism* (`FilterPill`) but no amenity dimension and no per-option counts. Critically, Booking never distinguishes "confirmed" from "unknown" because its data is dense; expaify's data is sparse, so it *must* add that distinction — the reference pattern is a floor, not a ceiling, here.
- **Google Hotels — Amenities.** Quick chips (Free Wi-Fi, Pool, Free parking…) plus a multi-select "Amenities" menu applied to the list. Interaction model: fast, chip-driven must-have narrowing before opening any property. **Delta:** confirms multi-select and pre-open narrowing as the expected pattern; again assumes dense data and shows no "unknown" state.
- **Shared takeaway:** both let users narrow by must-have amenities *before* opening a property, treat amenities as structured facts, and show counts. expaify should adopt the pre-open narrowing and structured-fact framing, but its differentiator/obligation is the confirmed-vs-unknown legibility neither reference needs.

## Design Directives for UXDES (testable)

1. **Reuse `FilterPill`; add multi-select; label as confirmed-only.** Amenity filtering must extend the existing `DealFeed` `FilterPill` pattern, not a new control. The one required extension is multi-select within one "Amenities" pill (or a small pill group). *Test:* applying "Free parking" returns only hotels with `parking.status = confirmed`; `not_returned`/`unknown` hotels are excluded, and the exclusion is disclosed on-surface (Task C must pass ≥85%).
2. **Collapsed card: max 3 confirmed amenities, text + icon, never icon/color-only.** Placed after quality/location and not overlapping price, Deal Score, or CTA at 375px. All-unknown hotels show at most one neutral line, never a chip row. *Test:* 375px layout has no overlap; screen-reader announces each amenity's state in words (Task F passes; Task B/E ≥85%).
3. **Three states must be visually AND textually distinct; absence ≠ unavailable.** `confirmed`, `unavailable`, and `not_returned`/`unknown` each need a distinct label; a missing chip must never encode "unavailable." *Test:* Tasks B and E pass ≥85%.
4. **Hard separation from Deal Score and quality evidence** (discovery constraint 3). Amenity fit gets its own labeled block; it must not share a container, adjacency, or the success/warning color tokens with `DealBadge`/`ScoreChip` or `QualityEvidencePanel`, and must not feed or adjust the Deal Score. *Test:* amenity chips use no score/quality token; amenity block is not nested in the DealScore or Quality panels; scoring inputs unchanged.
5. **Graceful degradation, not silent empties.** When result-set amenity coverage is below the design-set threshold, the amenity filter renders disabled with explanatory copy rather than returning a near-empty list. *Test:* with an all-`not_returned` fixture, the filter is disabled + explains why; it does not silently produce an empty result list.

## Non-Negotiables Carried Forward

- All amenity data flows through `lib/providers` and normalizes vendor strings there; components never parse vendor amenity payloads.
- Adapters return `Result<T>`; money stays integer `priceCents`; secrets from env; outbound hotel deeplinks keep affiliate markers.
- Amenity fit never feeds, adjusts, or visually merges with Deal Score or hotel-class/guest-rating quality evidence.
- Reuse the provenance status contract (`confirmed`/`unavailable`/`not_returned`/`unknown`, `scope`, `fee`) — do not invent a parallel model.

## Out-of-Scope Findings

- **Surface wiring gap (flag, do not fix here):** `HotelCard` is not mounted in a live results page (tests only); `DealFeed` renders `DealCard`. Reconciling the target surface is a design decision (Question 8) and any wiring is DEV/UI work under a scoped ticket, not this research.
- Accessibility-feature amenities (step-free access, roll-in shower, etc.) are deferred to a dedicated treatment — not part of the value-amenity MVP row.
- Amenity data must not affect Deal Score until scoring has a separate approved hotel-fit model.
- Persisting amenity filter/selection into the `/book` flow, and per-option result counts (Booking-style), are candidate follow-up tickets, not MVP scope.

## Handoff

Create `UXDES-HOTEL-AMENITY-FIT-01` for an implementation-ready design covering: the 8-amenity MVP set (top-6 lock), the amenity filter as a multi-select extension of `FilterPill` with confirmed-only semantics and coverage-degradation state, the collapsed-card confirmed-amenity region (max 3, text+icon), the three-state legibility model, hard separation from Deal Score/quality, and answers to all eight unknown-data handling questions — with final copy for every state, at 375px and 1280px, plus keyboard/assistive-tech order.

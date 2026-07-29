# UXD-HOTEL-TRIP-PURPOSE-FIT-01 — Hotel Trip-Purpose Fit Discovery

Date: 2026-07-29
Stage: UX Discovery (UXD)
Persona: Senior UX Strategist
Priority: P2
Ticket: UXD-HOTEL-TRIP-PURPOSE-FIT-01

## Relationship to prior work — read this first

`docs/pipeline/trip-purpose-fit/01-discovery.md` (2026-07-21) covered the same
problem space and stalled at discovery — no `02-research.md` was ever produced
and no `UXR-TRIP-PURPOSE-FIT-01` handoff exists in this repo. **This report
supersedes it.** Two of its central data claims are no longer accurate against
the current code and must not be carried forward:

1. It states fit can lean on a **city-center distance**. Today the only anchor
   the search pipeline actually produces is an **airport** anchor
   (`getSearchLinkedAirportAnchor`, `lib/airports/resolve.ts:78`, called at
   `app/api/search/route.ts:403`). `HotelLocationAnchorKind` also declares
   `venue | landmark | city_center` (`lib/types.ts:390`) but nothing constructs
   them. There is no city-center distance in the product.
2. It treats `guestRating` as a usable weekend/leisure signal. On the live
   Hotellook path `guestRating` is always built by
   `buildGuestRatingEvidence` with no review data
   (`lib/providers/hotellook.ts:527`), so it resolves to `kind: 'unknown'` /
   `confidence: 'unavailable'` and `HotelCard` deliberately renders "Guest
   rating not provided". It is not a fit signal today.

The net effect of both corrections is to **strengthen** the airport-stay case
and **weaken** the weekend case relative to the prior report.

---

## Problem statement (one sentence)

A shopper scanning hotel deals cannot tell which properties suit the trip they
are actually taking — a work night, a weekend, a stay with kids, or a pre-flight
airport stop — so they must re-derive fit from raw stars, price, and an address
on every card, and expaify has no way to show fit without either inventing
attributes it does not hold or bolting yet another panel onto an already
overloaded card.

## Who is affected, and where

Every hotel shopper, at two distinct moments:

**1. First-pass deal scanning** — the streamed hotel list on `app/page.tsx`,
rendering `app/components/HotelCard.tsx` in raw provider order
(`app/api/search/route.ts:408`, `send({ type: 'hotels', ... })`). No sort, no
filter, no purpose cue exists. The collapsed card currently offers: photo, name,
hotel-class chip, guest-rating chip (usually absent), a collapsed elevator chip,
location label + value, nightly price block, rate-eligibility line, parking
summary, funds-policy summary, pet scan line, smoking line, score chip, and the
action. That is up to eleven competing elements before the fold at 375px. Any
trip-fit cue lands in an already contested space.

**2. Hotel-detail reassurance** — the expanded card
(`HotelCard.tsx:987`), which stacks Deal Score, Quality evidence, Location,
Parking, Pet policy, Smoking policy, Access & room requests, Price scope, Funds
policy, and Provider handoff panels. A shopper who has picked a candidate is
looking for confirmation that this property fits the stay; they currently get
ten provenance panels and no fit framing.

Both moments are in scope. Purpose is not a search-form question in this
report — the shopper's purpose is a lens applied to results, not a new required
input.

## Measurable signal that the problem exists

Structural, verifiable in the current tree — this is an absence, not a defect:

- **Zero purpose signals in the contract.** `HotelOffer` (`lib/types.ts:474`)
  has no purpose, tag, or fit field. The search query contract has no purpose
  parameter. `HotelCard` has no fit affordance.
- **Zero refinement affordances.** There is no hotel sort or filter control in
  the shipped UI; a shopper's only refinement tool is scrolling.
- **Fit reasoning is 100% user-side.** Every "is this right for my trip"
  inference happens in the shopper's head, per card, with no shared vocabulary
  between the card and the trip.
- **Overbuild pressure is already measurable.** The collapsed card carries up to
  11 elements and the detail view 10 panels. Adding an unbounded tag system is a
  legibility regression, which is why this ticket is scoped as a *taxonomy*
  decision, not a feature build.

Behavioural signals to instrument once a cue ships (see Measurement below) are
cue engagement, refinement behaviour, and booking handoff — none of which can be
baselined today because none of the surfaces exist.

## What expaify can actually substantiate

This is the hard gate. A trip-fit tag may only be shown when it is derived from
data the provider actually returned for that offer. Audit of the live path
(`HotellookProvider.searchHotels`, `lib/providers/hotellook.ts:445`):

| Attribute | Source | Real on the live path? |
|---|---|---|
| `location.precision` / `address` / `lat`,`lng` | `normalizeHotelLocation` (`hotellook.ts:98`) | **Yes** — varies per offer: `exact`, `coordinates`, `area`, or `search_area` |
| `location.distance` to an **airport** anchor | `withCalculatedAnchorDistance` + `getSearchLinkedAirportAnchor` | **Yes, conditionally** — only when the destination resolves to a known IATA in `AIRPORTS` *and* the offer has valid coordinates. Straight-line, `expaify_calculated`. |
| `location.distance` to city center / venue / landmark | — | **No.** Anchor kinds are declared but never constructed. |
| `stars` / `hotelClass` | `buildHotelClassEvidence` (`hotellook.ts:243`) | **Yes**, `confidence: 'provider_only'` |
| `pricePerNight` + Deal Score | `priceFromToCents` + `lib/scoring/scoreDeal.ts` | **Yes** |
| `guestRating` | `buildGuestRatingEvidence` (`hotellook.ts:527`) with no review input | **No** — always `unknown`/`unavailable` |
| `amenityEvidence` (elevator, step-free, ground floor, high floor, near elevator, **connecting rooms**) | passthrough of `entry.amenityEvidence`, a field `cache.json` never returns | **No** — resolves to `not_returned` for every fact |
| `propertyType` | present on the raw entry type (`hotellook.ts:38`), dropped in normalization | **No** |
| Parking, pet policy, smoking policy, funds policy, rate eligibility, document readiness | `notProvided*` / `createNotReturned*` / `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` | **No** — all explicitly "not returned" by design |

There is exactly one hotel provider wired (`hotellook`);
`bookingComRapidApi.ts` is a **flight** provider and is not a hotel data source.

## Prioritized trip-fit taxonomy

Four purposes were named in the ticket. They are not equally honest.

### Tier 1 — ship in MVP (substantiated today)

**T1. Airport stay — "Near {AIRPORT} — 2.4 mi"**
The only purpose with a first-class, per-offer, computed signal. The anchor is
already attached to `HotelLocation.anchor` and already rendered as raw prose by
`getHotelLocationDisplay` (`app/components/hotelLocationContext.ts:34`) — the
work is promotion and framing, not new data. Testable rule shape: show when
`location.anchor.kind === 'airport'` **and** `location.distance` is present
**and** distance ≤ a threshold UXR must set. Must carry its own provenance
(straight-line, calculated by expaify, not driving distance).

**T2. Business stay — "Exact address · 4-star"**
Substantiated by `location.precision ∈ {exact, coordinates}` plus
`hotelClass.value ≥ N` with `confidence: 'provider_only'`. This is honest but
**thin**: it says "we know exactly where this is and the provider rates it
highly," not "this is good for business." The copy must not claim Wi-Fi, desk,
early check-in, or invoicing — none exist. UXR must decide whether T2 clears the
value bar at all, or whether it is just re-labelling two facts already on the
card. My recommendation: treat T2 as the primary hypothesis to *kill or
confirm*, not as a foregone inclusion.

### Tier 2 — defer, blocked on data (do not fake)

**T3. Family stay.** The defining signals are connecting rooms, room capacity,
kitchenette, and property type. `room_pref_connecting` exists in the access
evidence taxonomy (`HotelCard.tsx:73`) but is `not_returned` on every offer;
capacity and property type do not exist in `HotelOffer` at all. A family tag
today would be pure inference from stars and price. **Blocked.**

**T4. Weekend stay.** Depends on guest rating (unavailable), property/resort
character (absent), and amenities (absent). What remains is Deal Score and
price, which are not weekend-specific — every offer would qualify. **Blocked.**

### The taxonomy rule that matters more than the tags

**A trip-fit tag is a re-presentation of a fact already on the card, never a new
claim.** Every tag must name its evidence inline and must disappear entirely
when that evidence is missing — matching the discipline `HotelCard` already
enforces via `getConfidenceText` / `getQualityHelperText` / the `not_returned`
states. A missing tag is the correct output for a thin offer. There is no
"unknown fit" state, no greyed-out tag, and no fallback tag: silence is the
honest fallback, and it also protects the card's density budget.

## Constraints the solution must respect

1. **Data integrity — explainable tags only, no inferred profiles.** A tag may
   only assert what a named field on that offer supports, and must state the
   evidence. No cross-offer inference, no scoring model, no persisted traveler
   profile, no purpose stored against a user, no personalization from prior
   sessions. Purpose is at most ephemeral session context. If evidence is
   absent, the tag is absent.

2. **Density — the card is already at capacity.** The MVP adds **at most one
   inline fit line per collapsed card**, reusing existing token patterns
   (`--radius-control`, `--bg-surface`, `--text-2`, `text-xs`) and existing chip
   idioms. It must not introduce a new panel to the detail view; trip-fit
   reassurance is framing applied to the Location panel, not an eleventh panel.
   At 375px it must not push the price block, score chip, or action below a
   second fold. No overlapping text, no new colour, no new font size.

3. **Optional and non-blocking, at both moments.** No purpose gate before
   results, no wizard, no required search-form field. A shopper who never
   engages with a purpose cue must get exactly today's experience, with no
   ranking change and no engagement drop. The `Review hotel` handoff, affiliate
   markers, and provider-confirmation copy are untouched.

## Measurement plan

**Cue engagement**
- Impression rate of each Tier-1 tag (share of rendered hotel cards carrying it)
  — validates the tag is neither universal nor vanishingly rare.
- Interaction rate on tagged vs. untagged cards: `Details` expansion and
  `Review hotel` activation, per tag.

**Refinement behaviour**
- If a purpose lens ships: opt-in rate, and the opt-out/ignore rate, which must
  stay frictionless.
- Scroll depth and cards-viewed-before-first-expand, tagged vs. baseline.
- Result-set abandonment (search with no hotel interaction) must not rise.

**Downstream booking handoff**
- `Review hotel` → provider handoff completion rate, split by whether the
  originating card carried a fit tag.
- Guardrail: handoff rate for untagged cards must not fall — a fit cue must add
  confidence, not suppress otherwise-valid inventory.

**Comprehension guardrail (qualitative, blocking)**
- In moderated tasks, a shopper shown "Near {AIRPORT} — 2.4 mi" must not report
  that expaify has confirmed a shuttle, 24-hour desk, or driving time; a shopper
  shown a business tag must not report confirmed Wi-Fi or workspace. A failure
  here kills the tag, regardless of engagement lift.

## Success statement

This is solved when a first-time shopper can identify, on the first pass through
hotel results, which properties suit an airport stay — and can confirm that
judgement on the detail view — **without** the app claiming any attribute the
provider did not return, **without** any new panel or personalization step, and
**without** the card becoming unreadable at 375px.

## Required deliverables for UXR (do not re-derive the audit above)

1. **Confirm or overturn the tier assignment** by reading
   `lib/providers/hotellook.ts`, `lib/hotels/locationEvidence.ts`, and
   `lib/types.ts` directly. Specifically: is T2 (business) worth shipping, or is
   it redundant with the existing class chip and location line?
2. **Exact, testable rule per Tier-1 tag** — anchor kind, distance threshold and
   unit, precision set, class floor, and the explicit no-tag condition.
3. **Final tag copy**, including the inline evidence clause and the wording that
   prevents a shuttle/driving-time misread.
4. **Surface decision across both moments** — collapsed card line vs. Location
   panel framing vs. an optional purpose lens above results — with a density
   justification at 375px measured against the current 11-element card.
5. **Reference comparison at the interaction level** (Booking.com's work-trip
   prompt, Google Hotels' intent chips): specifically how they degrade when the
   supporting attribute is missing, since that is expaify's dominant case.
6. **Comprehension scenarios** proving the misread guardrail above.

## Handoff

Create `UXR-HOTEL-TRIP-PURPOSE-FIT-01` with this report's path and problem
statement embedded, plus the six deliverables above as required research inputs.

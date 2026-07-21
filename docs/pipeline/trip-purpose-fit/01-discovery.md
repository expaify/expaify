# UXD-TRIP-PURPOSE-FIT-01: Trip-Purpose Hotel Fit Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist
Priority: P2

## Problem Statement (one sentence)

Travelers scanning hotel deals have to mentally translate generic hotel
attributes (stars, guest rating, price, location) into "does this fit *my* trip"
— business, weekend escape, event stay, or remote work — and the app gives them
no cue to do that quickly, so purpose-relevant deals are no easier to spot than
irrelevant ones.

## User Pain Point

A first-time user searching hotels sees a flat list of `HotelCard`s ranked and
labeled identically regardless of why they are traveling. Someone on a two-night
work trip and someone planning a weekend getaway see the same card, the same
signals, and the same order. The user is left to do the translation work in their
head — "5-star and central probably means good for a client dinner," "high guest
rating and a pool probably means good for a weekend" — attribute by attribute,
card by card. The app never says "this one fits what you came here to do."

## Who Is Affected And Where

All hotel-search users, across the initial deal-discovery path — not a single
screen:

- **Deal discovery / results scan:** the streamed list of `HotelCard` components
  rendered on `app/page.tsx`. Hotels arrive from the search stream
  (`app/api/search/route.ts`, `hotels` event ~line 400) in **provider order**;
  there is no purpose-aware ranking today.
- **Feed ranking or filtering:** there is no purpose filter and no purpose
  ranking. The only filter-adjacent text in the app is Premium marketing copy on
  `app/page.tsx` ("Filter by discount, stars, price") — not an implemented
  control. So there is no surface today where a user could declare or apply a
  trip purpose.
- **Deal detail:** the expanded `HotelCard` (Details toggle,
  `app/components/HotelCard.tsx:512`-`520`) exposes Deal Score, Quality Evidence,
  Location, and Price Scope panels. None of these frame the hotel against a stay
  purpose.

## What Attributes Actually Exist (the hard constraint)

The ticket requires deriving purpose fit **only from available hotel
attributes**. The available set is deliberately thin. `HotelOffer`
(`lib/types.ts:137`-`151`) provides:

- `name`, `area`
- `location`: `precision` (`exact` | `coordinates` | `area` | `search_area` |
  `missing`), optional `address`, `lat`/`lng`, `distance` (value + unit +
  `referencePoint`, which today is always **"city center"** —
  `lib/providers/hotellook.ts:94`), `providerLocationName`
- `stars` and `hotelClass` evidence (provider-only confidence)
- `guestRating` evidence (kind + confidence; frequently `unavailable`/`inferred`
  for the live Hotellook path)
- `pricePerNight` (`Money`), `photoUrl`, `deeplink`, `source`

There is **no amenity data, no property-type, and no distance-to-a-named-venue**
anywhere in the stack. `propertyType` exists on the raw provider entry
(`hotellook.ts:27`) but is dropped during normalization. This is the same
structural gap independently found by `docs/pipeline/hotel-amenity-fit/` and
`docs/pipeline/hotel-amenity-provenance/`.

**Consequence for this ticket:** the four candidate purposes are *not* equally
derivable from current data.

| Purpose | What honestly defines fit | Derivable from available attributes today? |
|---|---|---|
| **Business** | Central / near business district, dependable class, reliable Wi-Fi | **Partial.** Location `precision` + distance-to-city-center + `hotelClass` give a real "central, established-class" signal. Wi-Fi/workspace are unknown. |
| **Weekend escape** | Higher-rated leisure stay, resort/pool feel, good value | **Weak.** `guestRating` + `stars` + Deal Score exist, but the leisure/resort character depends on amenities and property type that are absent. |
| **Event stay** | Proximity to a *specific* venue (arena, convention center, wedding) | **Blocked.** We only know distance to **city center**, and the search has no venue input. Cannot honestly score fit to a user's event. |
| **Remote work** | Reliable Wi-Fi, desk/workspace, longer-stay value | **Blocked.** The defining signals (Wi-Fi, workspace) do not exist in the data at all. |

The highest-value, honestly-derivable purpose given today's attributes is a
**location-and-class "good for a work/business trip" cue** (central,
exact-location, established class), with a secondary **"good for a weekend"** cue
resting mainly on guest rating, stars, and Deal Score. The two purposes that
sound most compelling in the abstract — event stay and remote work — cannot be
supported honestly until either an amenity evidence contract lands (see the
amenity-fit / amenity-provenance tickets) or the search captures a venue.

## Measurable Signal

- **Selection speed:** time from hotel results render to first meaningful hotel
  interaction (Details expand or "Review hotel" click) should drop when a
  purpose cue is present, versus the current flat list.
- **Purpose-conditioned engagement:** save-rate and "Review hotel" CTA
  click-through on hotels the app marks as fitting the user's declared purpose
  should exceed the baseline for the same hotels shown with no purpose cue.
- **Structural signal (verifiable today):** zero purpose signals exist — no
  purpose field in the search contract, no purpose ranking in the search stream,
  no purpose cue in `HotelCard`. So the current state is not "purpose fit is
  wrong," it is "purpose is entirely absent," and 100% of purpose-fit reasoning
  happens in the user's head.

## Constraints (the solution must respect all three)

1. **MVP must stay optional and lightweight.** Declaring a purpose is an
   opt-in shortcut, never a required step and never a blocking personalization
   wizard. A user who ignores it must get exactly today's experience. No account,
   no onboarding gate.
2. **Collect no sensitive data.** A trip purpose is a coarse, non-identifying
   preference (business / weekend / event / remote work). Do not collect, infer,
   or store anything that identifies the traveler, their employer, their
   companions, or the specific event. No purpose value may be persisted to a user
   profile in the MVP; treat it as ephemeral session context.
3. **Derive fit only from attributes that exist, and never imply data we don't
   have.** Fit cues may use only `location` (precision, city-center distance),
   `stars`/`hotelClass`, `guestRating`, and `pricePerNight`/Deal Score. A purpose
   cue must never assert an amenity, a workspace, or venue proximity the provider
   never returned — this preserves the same data-integrity bar `HotelCard`
   already enforces for class and guest rating (`getConfidenceText`,
   `getQualityHelperText`). Where a purpose cannot be honestly supported, the
   honest answer is to not offer that purpose in the MVP, not to fake it.

## Success Statement

This is solved when a first-time user can **optionally declare a trip purpose and
immediately see which hotel deals fit it** — surfaced from real, available
attributes — **without** filling in a personalization flow, **without** handing
over any sensitive information, and **without** the app implying amenity, workspace,
or venue-proximity facts it does not actually have. Concretely: identify the small
set of purposes the current data can honestly support, and the minimum hotel
signals that define fit for each.

## Note For Downstream Stages: Related Prior Work

Read but do not re-derive:

- `docs/pipeline/hotel-amenity-fit/01-discovery.md` and
  `docs/pipeline/hotel-amenity-provenance/` — establish that **no amenity data
  exists** and define a provider-neutral amenity evidence contract
  (`confirmed`/`unavailable`/`not_returned`/`unknown`). Trip-purpose fit is a
  *consumer* of amenity data once it exists; several purposes here are blocked
  precisely on that contract. Treat amenity work as the unlock for the blocked
  purposes, not as this ticket's job.
- `docs/pipeline/trip-inspiration-paid-intent/` — adjacent "why are you
  traveling" framing on the discovery/inspiration side; check for overlap in how
  intent is captured so the two do not build two different purpose pickers.

This ticket is **not** an amenity ticket and **not** a full personalization
engine. It is: *given the coarse purpose a user is willing to declare in one tap,
which purposes can we honestly serve from current attributes, and what is the
minimum signal set that defines fit for each.*

## Downstream Focus (for UXR — required deliverables)

1. **Purpose shortlist with honesty verdict.** Confirm or revise the four-purpose
   table above by auditing `HotelOffer` and the Hotellook adapter directly. Deliver
   a ranked shortlist of purposes the MVP should ship, each labeled
   *derivable-now* vs *blocked-on-amenity/venue-data*, with the exact attributes
   used.
2. **Minimum-signal definition per shipped purpose.** For each *derivable-now*
   purpose, specify the precise, testable rule (e.g., "Business fit = location
   precision `exact` or `coordinates` AND city-center distance ≤ X km AND
   `hotelClass.value` ≥ N") and the low-confidence/absent-data fallback.
3. **Reference-pattern comparison.** Compare against 1–2 references at the
   interaction level: how Booking.com's "Are you traveling for work?" prompt and
   Google Hotels' trip-intent filters surface purpose as a lightweight,
   dismissable cue vs. a heavy filter. Extract the interaction pattern, not the
   visual style.
4. **Surface decision.** Recommend where the purpose cue lives across scan →
   ranking/filter → detail: a one-tap chip above results, a re-rank, a per-card
   "Good for a work trip" tag, or some subset — given that no filter UI exists
   today.
5. **Comprehension guardrails.** Define scenarios proving a user reads a purpose
   fit cue as "matches what we can see," not as a guarantee of amenities/venue
   proximity we don't have.

## Handoff (hypotheses, segments, metrics for UXR ticket)

**Hypotheses:**
- H1: Offering an optional one-tap trip purpose lets users select a relevant
  hotel deal faster than a flat list, without adding perceived setup burden.
- H2: A "business/work trip" fit cue derived from location centrality + hotel
  class is the highest-value purpose the current data can honestly support.
- H3: "Event stay" and "remote work" cannot be served honestly from current
  attributes and will erode trust if faked; they should be deferred to the
  amenity/venue unlock.

**Participant segments:**
- First-time hotel searchers with a clear single purpose (work trip vs. weekend).
- Returning value/deal-seeking travelers comparing multiple hotels per session.
- Mixed-purpose / undecided users (to validate the opt-out path stays frictionless).

**Experiment metrics:**
- Primary: time-to-first-meaningful-hotel-interaction; save / "Review hotel" CTR
  conditioned on declared purpose vs. baseline.
- Secondary: purpose-declaration opt-in rate; opt-out/ignore rate (must stay
  usable); misread rate in comprehension tasks (users must not infer unshown
  amenities/venue proximity).
- Guardrail: no drop in overall hotel engagement for users who skip the purpose
  cue.

Create `UXR-TRIP-PURPOSE-FIT-01` with this report's path and problem statement
embedded, plus the hypotheses, participant segments, and experiment metrics above
as required research inputs.

# UXD-GUEST-ROOM-FIT-01: Guest And Room Fit Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

A traveler cannot tell whether a hotel room safely fits their party — how many
people it sleeps, what beds it has, and whether children are allowed and at what
cost — from the deal card or its expanded detail, so solo travelers, couples,
families, and small groups have to leave expaify and open the provider page just
to confirm the room will actually hold everyone before they can trust the price.

## Who Is Affected And Where

Four party shapes are affected, and each hits the gap at a different point of the
same path (deal feed card → expanded deal detail → booking handoff):

- **Solo travelers and couples** need the least, but still must confirm a room is
  not being priced as a single when they are two, or vice versa.
- **Families** are the most exposed: they need headcount capacity **and** bed
  configuration (can two adults + two children actually sleep here) **and** child
  policy (are kids allowed, is there an age cutoff, do children cost extra).
- **Small groups (3–6)** need to know whether one room holds them or whether the
  shown "from" price silently assumes double occupancy and will not fit the party.

The affected surfaces, and what each carries today:

- **Deal feed card / expanded detail — `app/components/HotelCard.tsx`.** The card
  shows name, hotel-class and guest-rating chips, location, nightly price, Deal
  Score, and — when expanded — Deal Score, Quality Evidence, Location, and Price
  Scope panels (`HotelCard.tsx:449`-`579`). There is **no occupancy, bed, or
  child-policy element anywhere** on the collapsed card or in the expanded
  "Details" region. The "deal detail" the ticket refers to is this inline
  expanded card (`HotelCard.tsx:512`-`582`); there is no separate hotel detail
  route.
- **Data model — `HotelOffer` in `lib/types.ts:137`-`151`.** Fields are `id`,
  `name`, `area`, `location`, `stars`, `pricePerNight`, `priceBasis`, `rating`,
  `photoUrl`, `deeplink`, `source`, `hotelClass`, `guestRating`. There is **no
  `occupancy`, `maxGuests`, `beds`, `roomType`, `childPolicy`, or age-limit field
  of any kind**, and no room-offer concept — the model describes a hotel, not a
  bookable room.
- **Provider — `HotellookProvider` (`lib/providers/hotellook.ts`).** The
  cache.json engine returns hotel-level `priceFrom`/`stars`/`location`; the
  adapter normalizes location, hotel class, and guest rating and maps **no
  occupancy or bed data at any point** (live path `hotellook.ts:448`-`487`, cached
  path `normalizeCachedHotelOffer`). This provider is also currently dead (returns
  empty), so any room-fit signal must be defined against the generic
  `HotelProvider` interface (`lib/types.ts:179`-`184`) for a future room-aware
  provider, not against Hotellook specifically.
- **Search intake — `app/api/search/route.ts`.** Hotel search is called with only
  `area` + `{ checkin, checkout }` (`route.ts:396`-`397`). The `passengers`
  param (1–9, `parsePassengers`, `route.ts:107`-`113`) is a **flight** passenger
  count and is never passed to `hotellook.searchHotels`. **The app does not
  capture hotel party size or composition at all** — no adults/children counts,
  no child ages — so it cannot request or match room fit even in principle today.
- **Booking handoff — `buildHotelBookingHref` / `app/book/BookingFlow.tsx`.** The
  handoff carries price and location context onward but no room-fit context, so
  the first place a user can confirm the room holds their party is the provider's
  own site.

Net: room fit is not "sometimes wrong" — it is **entirely absent** from the model,
the provider adapter, the search intake, and the UI. Every room-fit decision is
forced off-platform, which is exactly the trust leak this ticket targets.

## Measurable Signal

- **Room-fit exit signal (primary):** users open the expanded hotel detail and
  then click through to the provider (or abandon) without any on-platform answer
  to "does this room fit my party?" — a proxy for fit uncertainty resolved
  off-site. Target: this drops once occupancy/bed/child signals are visible before
  the handoff.
- **Qualified booking-click signal:** "Review hotel" CTA click-through should rise
  specifically for offers whose confirmed occupancy/beds match the user's stated
  party, versus offers with no fit signal — i.e., clicks become more qualified,
  not just more numerous.
- **Structural signal (verifiable in code today):** zero occupancy/bed/child
  fields in `HotelOffer`, zero room-fit mapping in any hotel provider adapter,
  zero party-size intake for hotels in `/api/search`, and zero room-fit UI in
  `HotelCard`. Today the measurable fact is total absence, which forces 100% of
  room-fit qualification off-platform.

## Constraints

1. **Provider-supplied data only; never fabricate fit.** Occupancy, bed
   configuration, and child policy must come from provider data. A value that is
   not returned must never be rendered or implied as a real capacity, bed count,
   or child rule. Every fit signal must explicitly distinguish
   provider-confirmed, provider-says-not-available, and not-returned/unknown —
   the same data-integrity bar already enforced for hotel class and guest rating
   in `HotelCard` (`getConfidenceText`, `getQualityHelperText`) and for amenities
   in the sibling amenity work. Do not regress that bar. Money and provider
   contracts are unchanged: any per-room price stays `{ priceCents, currency }`
   integer minor units through `lib/providers`, returned as `Result<T>`.
2. **Room fit is its own concern — do not conflate with Deal Score, quality, or
   amenities.** Occupancy/beds/child policy must not feed, adjust, or be visually
   merged into the Deal Score badge, the Quality Evidence panel, or the amenity
   surfaces. It needs its own clearly labeled space on the card/detail. "This
   room fits your party" and "this is a good price / good hotel / has parking"
   are four distinct claims and must read as distinct.
3. **Stay scannable and non-crowding at 375px and desktop, and keep intake
   light.** Fit signals must not overlap or crowd the existing price, Deal Score,
   location, amenity, or booking-CTA hierarchy on the collapsed card, and must be
   keyboard-accessible. If party-size intake is introduced to power matching, it
   must respect the existing search-form clutter constraints (see
   `mobile-search-form-clutter`) — a family/group should be expressible without
   turning the search form into a wall of steppers on mobile.

## Success Statement

This is solved when a first-time solo traveler, couple, family, or small group
can look at a hotel deal card and its expanded detail and tell whether the room
safely fits their party — how many people it sleeps, what beds it has, and
whether their children are allowed and at what cost — **or** see clearly that the
provider did not report that detail, without opening the provider page just to
find out, and without confusing room fit with the hotel's price, quality score,
or amenities.

## Note For Downstream Stages: Related Prior Work

This is a **sibling** of the already-completed hotel-fit discoveries — treat their
foundations as settled, do not re-derive them:

- `docs/pipeline/hotel-amenity-fit/01-discovery.md` and
  `docs/pipeline/hotel-amenity-provenance/01-discovery.md` +`02-research.md`
  established a **provider-neutral evidence/provenance contract** (canonical id,
  label, `status` of `confirmed`/`unavailable`/`not_returned`/`unknown`, source
  label, confidence, optional `scope`/`fee`) and UI-state rules (cap collapsed
  facts, never render `No X` copy, never imply selected-stay availability without
  provider support). **Room fit should reuse this evidence shape**, not invent a
  parallel one.
- `docs/pipeline/hotel-location-decision-context/` established the "do not invent
  precision" rule the same way (broad-area vs. exact address). Apply the identical
  discipline to occupancy: a hotel-level "sleeps up to N" from a `priceFrom`-style
  feed is **not** the same claim as a confirmed room offer that sleeps N, and must
  be labeled as the weaker claim.

This ticket is **not** a duplicate of amenity fit: amenities answer "does the hotel
have the facilities I want"; **room fit answers the prior, harder question "will my
specific party physically and legally fit in this room."** A family cannot even use
amenities if the room does not hold them.

## Downstream Focus (for UXR)

The research stage (`UXR-GUEST-ROOM-FIT-01`) must produce:

1. **Target segments** — sharpen the four party shapes (solo, couple, family with
   children, small group 3–6) into research segments, each with the specific
   room-fit questions that party actually asks (e.g., families ask bed
   configuration + child age policy; groups ask single-room max occupancy vs.
   per-room "from" price).
2. **A minimum room-fit signal set** — decide which fields are the true minimum to
   let a user self-qualify: candidate set is (a) max occupancy / "sleeps N",
   (b) bed configuration (count + type), (c) child policy (children allowed?, age
   cutoff, child pricing). Rank these by decision impact and justify each; do not
   silently expand the set.
3. **Provenance/label rules for missing data** — using the amenity evidence
   contract, specify how each fit field renders in `confirmed` /
   `unavailable` / `not_returned` / `unknown` states, and the exact rule for the
   dangerous case: a hotel-level "from" price with **no** room-level occupancy
   (must not be shown as a confirmed fit for the party).
4. **Intake question** — an explicit recommendation on whether hotel party size
   should be captured at search time (and how, within mobile-clutter limits) or
   inferred from flight `passengers`, or neither for v1. This gates whether fit is
   *matched to the user's party* or only *displayed for self-assessment*.
5. **Validation metrics** — testable measures tied to the signals above:
   reduction in room-fit-driven provider exits, lift in qualified "Review hotel"
   clicks for matching offers, and comprehension checks that a user correctly
   reads a `not_returned` occupancy as "not reported" rather than "does not fit."
6. **Reference-pattern audit** — compare against Booking.com room-occupancy /
   bed-type rows and Google Hotels guest-count filtering at the interaction level
   (not visual style): how each surfaces "sleeps N", bed setup, and child policy
   during scan vs. detail.

## Handoff

Create `UXR-GUEST-ROOM-FIT-01` embedding this report's path
(`docs/pipeline/guest-room-fit/01-discovery.md`) and problem statement, with the
target segments, minimum room-fit signal set, provenance/missing-data rules,
intake question, validation metrics, and reference-pattern audit above listed as
required research deliverables.

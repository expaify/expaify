# UXD-ACCESSIBILITY-STAY-FIT-01: Accessible Stay Fit Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist
Priority: P1

## User Pain Point

A traveler with a mobility, vision, hearing, or other access need cannot tell from an expaify hotel result whether a property — let alone the specific room they would book — is actually usable for them, because the app carries no accessibility data at all and the only planned treatment is a single generic "accessibility" amenity chip that says nothing about step-free entry, roll-in showers, grab bars, doorway width, visual/hearing alarms, or service-animal policy.

## Who Is Affected And Where

Travelers with disabilities and access needs — wheelchair and mobility-aid users, blind and low-vision travelers, Deaf and hard-of-hearing travelers, neurodivergent travelers, and companions booking on their behalf — across the full hotel decision path:

- **Search / filtering** — there is no filter surface at all in `app/page.tsx` today (amenity/accessibility filtering does not exist), so a user cannot even express "I need a step-free, roll-in-shower room" before scanning.
- **Deal card scan** — the collapsed `HotelCard` (`app/components/HotelCard.tsx:425`-`520`) shows photo, name, hotel-class and guest-rating chips, location, nightly price, Deal Score, and the Review/Details controls. No accessibility signal exists.
- **Deal detail** — the expanded card (`app/components/HotelCard.tsx:523`-`582`) exposes Deal Score, quality evidence, location, and price-scope panels. There is no accessibility panel.
- **Booking handoff** — the "Review hotel" CTA hands off to the provider (`buildHotelBookingHref`) with no accessibility context carried or confirmed.

What the current code actually establishes (verified, not assumed):

- `HotelOffer` (`lib/types.ts:137`-`151`) defines identity, area/location, stars, `pricePerNight`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, and `guestRating`. **There is no amenity field of any kind, and specifically no accessibility field, feature list, or per-feature status.**
- `HotellookProvider` (`lib/providers/hotellook.ts`) normalizes location, hotel class, and guest-rating evidence for both live and cached responses. It maps **no** facilities, amenities, or accessibility fields anywhere in its normalization path (live: `hotellook.ts:458`-`486`; cached: `hotellook.ts:318`-`381`). The `cache.json` engine endpoint it calls returns a thin payload (id, name, stars, location, distance, priceFrom, photo, propertyType) with no accessibility attributes.
- A repository-wide search for `accessib|wheelchair|mobility|step-free|roll-in|grab bar|ada|hearing|braille|sensory` across `lib/` and `app/` returns **zero** matches in product code. The only amenity-adjacent string is a prompt guardrail in `lib/ai/generateHeadline.ts:120` telling the headline model not to mention amenities.

So today 100% of accessibility fit decisions happen off-platform, on the provider's site, after the user has already invested effort choosing an expaify result.

## The Distinct Problem: Generic Labels Are Not Fit Signals

This ticket is **not** "add an accessibility amenity chip." Prior amenity work (see Related Prior Work below) already treats "accessibility" as one entry in a small canonical amenity set, shown as a single confirmed/unavailable/unknown chip. For most amenities (Wi-Fi, breakfast, parking) a boolean is a reasonable decision signal. **For accessibility it is actively misleading**, for two reasons this discovery isolates as the core problem:

1. **"Accessible" is not one thing.** A property flagged "accessible" may have a ramp at the lobby and nothing else. A mobility user needs step-free room entry, doorway/turning clearance, a roll-in or grab-bar bathroom, and an accessible path from parking. A blind user needs Braille/tactile signage and screen-reader-friendly booking. A Deaf user needs visual/vibrating fire alarms and visual doorbell/phone alerts. A single yes/no collapses needs that do not substitute for one another, so a generic "Accessible ✓" can read as "usable for me" to a user for whom it is false.

2. **Property-level ≠ room-level.** "This hotel has accessible rooms" tells a user nothing about whether the room and rate they are about to book is one of them. A hotel can truthfully be "accessible" while every remaining bookable room for the stay dates has a step-in tub. Conflating property-level claims with the selected room/rate is the highest-risk failure here because it drives a booking that cannot be used and erodes trust irreversibly.

## Measurable Signal

- **Successful discovery of documented accessibility information** — the share of hotel decisions where a user with an access need can locate the specific, provider-documented accessibility facts relevant to their need (or a clear "not documented" state) *without leaving expaify*. Today this rate is structurally 0% because no accessibility data or surface exists.
- **Fewer unsupported-accessibility complaints / mismatches** — a drop in post-booking reports of "the room was not actually usable," which are the direct symptom of generic or property-only claims being read as room-level guarantees.
- **Structural signal (verifiable now):** zero accessibility fields in `HotelOffer`, zero accessibility mapping in any provider adapter, zero accessibility UI in `HotelCard`. The problem today is total absence, not incorrect data — which also means the first wrong move (a generic "Accessible" flag) would replace absence with false confidence.

## Constraints

1. **Surface only verified provider data.** Accessibility features may be shown only when a provider explicitly documents them, normalized in `lib/providers` per the non-negotiable contract. The app must never infer accessibility from stars, price, photos, property type, or the absence of a "not accessible" flag. Undocumented must render as an explicit *"not documented by the provider"* state — never as available and never as unavailable.

2. **Distinguish property-level from room-level claims — always.** Every accessibility fact shown must declare its `scope` (property vs. room/rate vs. selected-stay), reusing the `scope` dimension the amenity-provenance contract already defined. Property-level facts must use language that cannot be read as a promise about the selected room, and must direct the user to confirm room- and rate-level details with the provider before payment.

3. **No medical or legal guarantees.** Copy must never claim ADA / accessibility-standard compliance, never assert a room is "suitable for" or "safe for" any condition, and never give medical advice. The app reports what the provider documented, attributed to the provider, and defers final suitability to the provider and the user's own judgment. No "guaranteed accessible," no compliance badges, no certification claims.

4. (Carried from the general contract) Accessibility information must be scannable and non-overlapping at 375px mobile and 1280px desktop, must not rely on icon color alone to convey status (assistive-tech and low-vision users are the literal audience), and must not crowd the existing price, Deal Score, location, quality, or booking-CTA hierarchy on the collapsed card.

## Success Statement

This is solved when a first-time traveler with a mobility, vision, or hearing need can look at an expaify hotel result and correctly tell — without leaving the app and without hitting a generic label that overstates fit — which accessibility features the provider has documented, at what scope (whole property vs. the specific room/rate), and which relevant features are simply not documented, so that they never mistake "the hotel is accessible" for "the room I am booking is usable for me," and never see a claim the provider did not actually make.

## Note For Downstream Stages: Related Prior Work

Two adjacent, already-completed doc sets exist and must be treated as a settled foundation, not re-derived:

- `docs/pipeline/hotel-amenity-provenance/01-discovery.md` + `02-research.md` (`UXR-HOTEL-AMENITY-PROVENANCE-01`) defines a **provider-neutral amenity evidence contract**: canonical id, display label, `status` (`confirmed` / `unavailable` / `not_returned` / `unknown`), source label, confidence, and optional `fetchedAt`, `scope` (`property` / `room` / `rate` / `selected_stay`), and `fee`. It also sets the data-integrity bar: never render missing data as "No amenities," never imply selected-stay availability without provider support, never rely on color/icon alone for status.
- `docs/pipeline/hotel-amenity-fit/01-discovery.md` (`UXR-HOTEL-AMENITY-FIT-01`) addresses which high-intent amenities matter and how amenity fit should surface across scan → filter → card → detail.

**Why this ticket is not a duplicate:** those tickets model accessibility as *one amenity among six-to-eight*, shown as a single chip. This ticket establishes that accessibility is a **category of need-specific, scope-sensitive features** that a boolean chip actively misrepresents, in a domain where a wrong signal causes a real, unusable, hard-to-reverse booking. UXR should **reuse the provenance `status` + `scope` + source model as the data substructure** (do not invent a parallel one) and focus new work on: which specific accessibility features form a pragmatic MVP set, how they group by need type, how property-vs-room scope is expressed so it cannot be misread, and how "not documented" is treated as a first-class, non-alarming state.

## Downstream Focus (Required UXR Deliverables)

The ticket handoff mandates that `UXR-ACCESSIBILITY-STAY-FIT-01` deliver **participant criteria, evidence standards, and success measures**. Research must produce:

1. **Participant criteria** — who to evaluate this with: at minimum wheelchair/mobility-aid users, blind/low-vision screen-reader users, and Deaf/hard-of-hearing users, plus companions who book on someone's behalf. Define recruitment guardrails (real access needs, range of assistive tech) and what each group must be able to accomplish on the card/detail.

2. **Evidence standards** — the rule for what counts as a surfaceable accessibility fact: it must be provider-documented, normalized in `lib/providers`, carry an explicit `scope`, and carry a source label. Define exactly how "not documented" differs from "documented as unavailable," and forbid any inferred, star-derived, or photo-derived accessibility claim. Confirm the provenance contract's `status`/`scope`/source model is sufficient or specify the minimal extension needed (do not fork it).

3. **Success measures** — the measurable outcomes tied to the discovery signals: successful in-app discovery of relevant documented accessibility info (and correct reading of scope), and reduction in unsupported-accessibility mismatch complaints. Include comprehension checks that a user does not read property-level as room-level and does not read "not documented" as "unavailable" (or vice versa).

4. **Pragmatic MVP feature set** — a small, ranked set of accessibility features grouped by need type (e.g. mobility: step-free entrance, accessible room, roll-in shower, grab bars, accessible parking/path; sensory-vision: Braille/tactile signage, accessible booking; sensory-hearing: visual/vibrating alarms, visual alerts; general: service animals welcome, accessible common areas), with a one-line justification each and an explicit note that the set is provider-data-dependent.

5. **Empty-data treatment** — a recommendation for what the card and detail show when the provider documents little or no accessibility information (the common case given the current thin Hotellook payload): the exact "not documented" state, whether accessibility appears on the collapsed card at all, and how this state reads to a screen reader without alarming or falsely reassuring.

6. **Reference comparison** — one or two reference patterns at the interaction-pattern level (e.g. Booking.com accessibility facilities and its property-vs-room distinction, Google Hotels accessibility filters), focused on how each expresses scope and handles undocumented features — not visual style.

## Out Of Scope For This Feature (flag for later tickets)

- Adding a general amenity filter UI (owned by `hotel-amenity-fit`); accessibility filtering may reference it but should not build it here.
- Letting accessibility data influence Deal Score — scoring has no approved model for hotel fit and must not conflate price percentile with usability.
- Any provider integration that does not actually return documented accessibility data; DEV work is contingent on a provider that does.

## Handoff

Create `UXR-ACCESSIBILITY-STAY-FIT-01` (UX Research) with this discovery report path and the problem statement embedded, and with the required deliverables above — **participant criteria, evidence standards, and success measures**, plus the pragmatic MVP feature set and empty-data treatment — listed as mandatory research outputs.

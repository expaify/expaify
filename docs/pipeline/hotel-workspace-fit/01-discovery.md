# UXD-HOTEL-WORKSPACE-FIT-01: Work-Friendly Hotel Fit Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist
Priority: P2

## User Pain Point

A business or remote-work traveler cannot tell from an expaify hotel result whether a stay will actually let them work productively — hold a video call, type at a real surface, and concentrate — because the app carries no work-relevant signals at all, and the only planned treatment (a generic amenity list) reduces work-fit to booleans like "Free Wi-Fi ✓" that say nothing about connection reliability, desk suitability, or quiet.

## Who Is Affected And Where

Travelers whose stay has a work requirement — corporate/consulting travelers on billable days, "bleisure" travelers extending a work trip, and remote workers / digital nomads who must put in real work hours from the room — across the whole hotel decision path:

- **Trip-purpose selection** — there is **no trip-purpose control anywhere in the product today**. A repo-wide search for a purpose/business/remote-work/work-friendly selector across `app/` and `lib/` returns zero matches. A user cannot tell expaify "this is a work trip," so the app has no way to weight or surface work-relevant signals, and the intended "select purpose → see relevant fit" path does not exist to map — it must be designed.
- **Results scan** — hotel results render as a list of `HotelCard` components. The collapsed card (`app/components/HotelCard.tsx:425`-`520`) shows photo, name, hotel-class and guest-rating chips, location, nightly price, Deal Score, and the Review/Details controls. There is no work-fit signal.
- **Deal detail** — the expanded card (`app/components/HotelCard.tsx:523`-`582`) exposes Deal Score, quality evidence, location, and price-scope panels. There is no workspace/connectivity/quiet panel.
- **Shortlist / booking handoff** — the "Review hotel" CTA hands off to the provider (`buildHotelBookingHref`) with no work context carried or confirmed.

What the current code actually establishes (verified, not assumed):

- `HotelOffer` (`lib/types.ts:137`-`151`) defines identity, area/location, stars, `pricePerNight`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, and `guestRating`. **There is no amenity field of any kind, and specifically no connectivity (Wi-Fi), workspace (desk/chair/outlets), or quiet/noise field.**
- `HotellookProvider` (`lib/providers/hotellook.ts`) normalizes only location, hotel class, and guest-rating evidence for both live and cached responses. It maps **no** facilities, connectivity, workspace, or noise fields anywhere in its normalization path (live: `hotellook.ts:458`-`486`; cached: `hotellook.ts:318`-`381`). The `cache.json` engine endpoint it calls returns a thin payload (id, name, stars, location, distance, priceFrom, photo, propertyType) with no work-relevant attributes.
- A repository-wide search for `wi-?fi|wifi|desk|workspace|quiet|noise|soundproof|ergonomic|coworking` across `app/` and `lib/` returns **zero** matches in product code (the only hits are the "Deal Desk" brand string in `app/layout.tsx` and a test-fixture headline "Quiet four-star stay" — neither is a work-fit signal).

So today 100% of work-fit decisions happen off-platform, on the provider's site, after the user has already invested effort choosing an expaify result.

## The Distinct Problem: Presence Is Not Work Suitability

This ticket is **not** "add a Wi-Fi amenity chip." Prior amenity work (see Related Prior Work below) already treats Wi-Fi as one entry in a small canonical amenity set, shown as a single confirmed/unavailable/unknown chip. For a leisure booker a Wi-Fi boolean is a reasonable signal. **For a work traveler it is not**, for three reasons this discovery isolates as the core problem:

1. **Presence ≠ suitability.** "Free Wi-Fi ✓" does not say whether the connection sustains a video meeting; "Desk ✓" does not distinguish a real work surface with a chair and power from a decorative laptop shelf. A work traveler is deciding on *quality and usability*, which a boolean collapses. A hotel that truthfully "has Wi-Fi and a desk" can still be unworkable for a full billable day.

2. **Quiet has no representation at all.** Concentration and call quality depend on quiet — in-room noise, and whether there is any quiet place to work (business center, lobby workspace, coworking). There is no amenity in the planned set that expresses this, so the single most decision-relevant work signal is structurally invisible today.

3. **Property-level ≠ room-level ≠ selected-stay.** "The hotel has a business center" or "Wi-Fi in public areas" tells a user nothing about whether *the room they book* has a usable desk or in-room connectivity. Conflating a property-level work claim with the selected room/rate is the highest-risk failure: it drives a stay the user cannot actually work from, on a billable trip, and erodes trust irreversibly.

The correct framing, mirroring the completed accessibility work, is that **work-friendliness is a category of scope- and quality-sensitive attributes** that a boolean amenity chip misrepresents — not a new amenity to add to the list.

## Measurable Signal

- **Relevance of shortlisted hotels (primary, per ticket):** of the hotels a work traveler saves / clicks "Review hotel" on, the share that actually support productive work (usable connectivity, a real work surface, and a quiet option). Today this is unmeasurable and structurally near-zero as an in-app signal, because no work-fit data or surface exists to make the shortlist informed.
- **Successful in-app discovery of work-fit facts:** the share of work-trip hotel decisions where the user can locate the provider-documented connectivity / workspace / quiet facts relevant to working (or a clear "not documented" state) *without leaving expaify*. Today structurally 0%.
- **Structural signal (verifiable now):** zero trip-purpose control, zero work-fit fields in `HotelOffer`, zero work-fit mapping in any provider adapter, zero work-fit UI in `HotelCard`. The problem today is total absence — which means the first wrong move (a bare "Wi-Fi ✓" read as "good to work") would replace absence with false confidence.

## Constraints

1. **Surface only verified provider data — never infer work-fitness.** Work-relevant attributes may be shown only when a provider explicitly documents them, normalized in `lib/providers` per the non-negotiable contract. The app must never infer work-fitness from stars, price, photos, brand, or a "business hotel" property type. Undocumented must render as an explicit *"not documented by the provider"* state — never as available and never as unavailable. Reuse the amenity-provenance `status` + `scope` + source model as the data substructure; do not fork it.

2. **Distinguish presence from suitability, and property from room — always.** Every work-fit fact shown must carry its `scope` (property vs. room/rate vs. selected-stay) and must not let a boolean stand in for suitability where the provider offers more (e.g., "Wi-Fi in all rooms" vs. "public areas only"; "in-room desk" as room scope vs. "business center" as property scope). Property-level facts must use language that cannot be read as a promise about the selected room, and must direct the user to confirm room/rate details with the provider before booking.

3. **Fit existing surfaces without disrupting hierarchy or scoring.** Work-fit is a distinct concern from `DealScore` (price percentile) and from hotel-class/guest-rating quality evidence. It must not feed, adjust, or be visually conflated with the Deal Score badge or Quality Evidence panel; it must be scannable and non-overlapping at 375px mobile and 1280px desktop, must not crowd the existing price / Deal Score / location / booking-CTA hierarchy on the collapsed card, and must not rely on icon color alone to convey status.

## Success Statement

This is solved when a first-time business or remote-work traveler can look at an expaify hotel result and correctly tell — without leaving the app and without mistaking a bare "Wi-Fi ✓" or "Desk ✓" for a promise — which work-relevant facts the provider has documented (connectivity, a usable work surface, and a quiet place to work), at what scope (whole property vs. the specific room/rate), and which relevant facts are simply not documented, so that the hotels they shortlist are ones they can actually work from.

## Note For Downstream Stages: Related Prior Work

Three adjacent, already-completed doc sets exist and must be treated as a settled foundation, not re-derived:

- `docs/pipeline/hotel-amenity-provenance/01-discovery.md` + `02-research.md` (`UXR-HOTEL-AMENITY-PROVENANCE-01`) defines a **provider-neutral amenity evidence contract**: canonical id, display label, `status` (`confirmed` / `unavailable` / `not_returned` / `unknown`), source label, confidence, and optional `fetchedAt`, `scope` (`property` / `room` / `rate` / `selected_stay`), and `fee`, plus data-integrity rules (never render missing data as "not available," never imply selected-stay availability without provider support, never rely on color/icon alone).
- `docs/pipeline/hotel-amenity-fit/01-discovery.md` (`UXR-HOTEL-AMENITY-FIT-01`) addresses which high-intent amenities matter and how amenity fit surfaces across scan → filter → card → detail.
- `docs/pipeline/accessibility-stay-fit/01-discovery.md` (`UXR-ACCESSIBILITY-STAY-FIT-01`) establishes the pattern this ticket follows: a **need-specific fit lens** (accessibility) layered on the provenance `status`/`scope`/source substructure, where a generic boolean chip actively misrepresents a scope- and need-sensitive category.

**Why this ticket is not a duplicate:** amenity-fit models Wi-Fi as *one amenity among six-to-eight*, shown as a single chip. This ticket establishes that **work-friendliness is a category of scope- and quality-sensitive attributes** (reliable connectivity, a usable work surface, quiet) that a boolean chip misrepresents for a user whose trip depends on it. It is to amenity-fit what accessibility-stay-fit is: a need-specific lens that **reuses** the provenance `status`/`scope`/source model rather than inventing a parallel one, and focuses new work on which work attributes form a pragmatic MVP set, how quality/scope is expressed so presence is not misread as suitability, and how "not documented" is treated as a first-class, non-alarming state.

## Downstream Focus (Required UXR Deliverables)

The ticket handoff mandates creating `UXR-HOTEL-WORKSPACE-FIT-01`. Research must produce:

1. **Work-fit signal priority ranking** — a small, ranked MVP set of provider-documentable work attributes grouped by concern (e.g. connectivity: Wi-Fi presence + any quality/scope the provider states; workspace: in-room desk, chair, power/outlets at desk, adequate lighting; quiet-work context: quiet-room indicators, business center, lobby/coworking workspace; supporting: early check-in / late check-out for calls, in-room climate control), with a one-line justification each and an explicit note that the set is provider-data-dependent.

2. **Trip-purpose entry-point decision** — whether MVP needs an explicit trip-purpose selector at all, or whether work-fit signals should surface unconditionally (since no selector exists today). Map the intended path — purpose signal (explicit or inferred) → results scan → work-fit signal on card → detail → informed shortlist — and recommend the lightest entry point that does not add a new blocking step or empty control.

3. **Relevance measurement definition** — an operational definition of "shortlisted-hotel relevance" (the primary signal): what counts as a hotel that supports productive work, and how to measure whether informed shortlists improve, including the comprehension checks below.

4. **Comprehension tasks — presence vs. suitability, property vs. room** — scenarios validating that a user does not read a bare "Wi-Fi ✓" as "good enough to work," does not read a property-level "business center" as an in-room work surface, and does not read "not documented" as "unavailable" (or vice versa).

5. **Empty-data treatment** — what the card and detail show when the provider documents little or no work-relevant information (the common case given the thin Hotellook payload): the exact "not documented" state, whether work-fit appears on the collapsed card at all in that case, and how it reads to a screen reader without alarming or falsely reassuring.

6. **Reference comparison** — one or two reference patterns at the interaction-pattern level (e.g. Booking.com "Great for work" / work-friendly facilities and its property-vs-room distinction, Google Hotels work-relevant amenity surfacing), focused on how each expresses connectivity/quiet/desk quality and scope and handles undocumented attributes — not visual style.

## Out Of Scope For This Feature (flag for later tickets)

- Building a general amenity filter UI (owned by `hotel-amenity-fit`); work-fit filtering may reference it but must not build it here.
- Letting work-fit influence Deal Score — scoring has no approved model for hotel fit and must not conflate price percentile with work suitability.
- Any provider integration that does not actually return documented connectivity/workspace/quiet data; DEV work is contingent on a provider that does.
- A standalone "remote-worker" product mode, saved work-preferences, or account-level personalization — out of scope for an evidence-backed fit signal in existing surfaces.

## Handoff

Create `UXR-HOTEL-WORKSPACE-FIT-01` (UX Research) with this discovery report path and the problem statement embedded, and with the required deliverables above — **work-fit signal priority ranking, trip-purpose entry-point decision, relevance measurement definition, comprehension tasks, empty-data treatment, and reference comparison** — listed as mandatory research outputs.

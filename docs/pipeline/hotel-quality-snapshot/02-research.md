# UX Research: Hotel Quality Snapshot

Ticket: `UXR-HOTEL-QUALITY-SNAPSHOT-01`
Stage: UX Research
Priority: P0
Date: 2026-07-21

## Source Inputs

- Discovery report: `docs/pipeline/hotel-quality-snapshot/01-discovery.md`
- Prior research to validate, not re-derive: `docs/pipeline/hotel-amenity-provenance/02-research.md`
- Shipped design that must not be re-opened: `docs/pipeline/hotel-rating-source-confidence/03-design.md`
- Scan-order contract that governs the collapsed card: `docs/pipeline/deal-supporting-facts-order/02-research.md`
- Current implementation audited (read, not assumed):
  - `lib/types.ts` (`HotelOffer`, `HotelRatingEvidence`, `HotelProvider`)
  - `lib/providers/hotellook.ts` (live + cached normalization)
  - `lib/providers/bookingComRapidApi.ts` (provider shape)
  - `app/components/HotelCard.tsx` (collapsed + expanded render)
- Reference patterns checked at the interaction level: Booking.com review-score block ("X recent reviews" recency framing) and Google Hotels amenities filter/summary.

## Research Question

Given star class, verified guest score, review count, and data-fetch freshness are already shipped, what is the smallest set of *additional* quality signals a hotel card can carry that (a) helps a first-time user distinguish a stale, amenity-blind cheap hotel from a genuinely strong one, and (b) never claims more than the provider actually returned? Specifically: is review recency buildable from any provider under consideration today, and do amenities from `hotel-amenity-provenance` resume as their own chain or merge here?

## Research Summary

Two candidate signals remain — a **review-recency caveat** and **amenity highlights**. Neither is backed by any data the product can fetch today. The live Hotellook `cache.json` endpoint returns no review dates, no review-date distribution, no `reviewCount`, and no facilities/amenities of any kind; the only user-facing quality data that survives the live path is `stars`. Verified guest scores and review counts that the shipped card can display come exclusively from the **cached / seeded** evidence path, not from a live provider fetch.

Therefore the honest research conclusion is the same for both signals: **expaify cannot claim review recency or amenities today, and the correct design output is an explicit "not returned by provider" caveat, not UI designed around data that does not exist.** The design stage must design the caveat and the additive contract that a future provider would satisfy — it must not design a populated recency chip or amenity chip as if the data were arriving.

Because both signals are (1) currently unbuildable, (2) resolved by the same "not returned by provider" honesty pattern, and (3) competing for the same already-tight collapsed-card budget, the two efforts should **merge into one `hotel-quality-snapshot` design** rather than resuming `hotel-amenity-provenance` as a separate chain. Shipping them as two disconnected additions to the same card would duplicate caveat language and risk crowding the price → quality → confidence → handoff sequence twice.

## Current Implementation Findings

### 1. The live hotel provider returns nothing resembling review recency

`HotelLookCacheEntry` (`lib/providers/hotellook.ts:10-28`) types the entire live payload: `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType`. There is no review array, no `reviewsCount`, no `lastReviewDate`, no `reviewsByYear`, and no facilities field. The live normalization (`hotellook.ts:448-487`) builds each offer from exactly those fields and sets:

- `hotelClass` via `buildHotelClassEvidence` — `provider_only` from `stars`.
- `guestRating` via `buildGuestRatingEvidence` — which, with no `legacyRating`, returns `{ kind: 'unknown', confidence: 'unavailable' }` (`hotellook.ts:270-274`).

So on a genuine live fetch there is **no guest score, no review count, and no recency** — only star class and price. The verified guest score + `reviewCount` the shipped card is capable of showing arrive only through `normalizeCachedHotelOffer` → `normalizeCachedEvidence` (`hotellook.ts:277-316`, `354`), which validates pre-shaped `HotelRatingEvidence` objects from cached/seeded snapshot data. `normalizeCachedEvidence` reads `value`, `scaleMax`, `sourceLabel`, `reviewCount`, `fetchedAt` — and **nothing else**; any recency field on a cached object would be silently dropped because it is not in the allow-list.

Conclusion: review recency is **unbuildable today from Hotellook**, live or cached. `fetchedAt` is the timestamp of expaify's pull (`hotellook.ts:447`), and it is structurally incapable of standing in for review recency.

### 2. No amenity/facility data exists on any code path

Repo-wide, no provider returns amenities. `HotelLookCacheEntry` has no facilities field; `HotelOffer` (`lib/types.ts:137-151`) has no amenity list, status, or source; `HotelCard.tsx` has no amenity section, collapsed or expanded. The closest live field, `propertyType` (`hotellook.ts:27`), is not surfaced and is a category label, not an amenity. This confirms every finding in `hotel-amenity-provenance/02-research.md` §1–4 is still accurate as of this audit.

### 3. Booking.com RapidAPI is not a hotel fallback

`BookingComRapidApiProvider implements FlightProvider` (`lib/providers/bookingComRapidApi.ts:39`), and its mapping is deliberately unfinished (`bookingComRapidApi.ts:106-118` — "We do not map this provider into user-facing fares until..."). It exposes no `searchHotels`, no reviews, and no amenities. It is not a source of recency or amenity data and must not be assumed to become one.

### 4. The collapsed card budget is already spent

The shipped `rating-source-confidence` design caps the collapsed quality row at **two chips at 375px** (03-design §Mobile 375px: "Use no more than two visible quality chips in collapsed state"), and the card already fills that budget with hotel-class + guest-rating chips (`HotelCard.tsx:449-470`). The `deal-supporting-facts-order` scan sequence for the collapsed hotel card is fixed: identity → price/scope → quality → compact score support → confidence → visible handoff caveat → CTA (`deal-supporting-facts-order/02-research.md` Directive 1). There is no free slot in the collapsed card for a recency chip or an amenity chip without displacing something the two prior tickets deliberately placed.

### 5. Contract conflict to resolve: amenity "max 3 collapsed" vs "max 2 quality chips"

`hotel-amenity-provenance/02-research.md` Directive 2 permits "at most 3 provider-backed amenity labels" in the collapsed card. That predates and conflicts with the shipped `rating-source-confidence` rule of **max two quality chips at 375px**. This brief resolves the conflict below (Directive 1): amenities are **not additive** to the collapsed budget; the two-chip mobile cap wins.

## Reference Pattern Comparison (interaction level, not visual style)

### Booking.com — review recency

Booking.com's score block distinguishes total reviews from recency by surfacing "recent reviews" and dated review entries, so a shopper can tell whether a high score reflects current stays. The *interaction principle* is that recency is a labeled, provider-sourced fact — never inferred from when the page was loaded.

Delta vs expaify: expaify has `fetchedAt` (page pull time) but no provider-sourced review dates. It cannot replicate the pattern's substance; it can only replicate the pattern's honesty by stating recency is not available. Faking recency from `fetchedAt` would be the exact anti-pattern this reference warns against.

### Google Hotels — amenities as structured facts

Google Hotels treats amenities as structured, filterable property facts, not prose. The *interaction principle* is that an amenity shown is an amenity the provider asserts.

Delta vs expaify: expaify has no amenity field on any path. It cannot show amenity facts; the honest parallel is "amenities not returned by provider," consistent with `hotel-amenity-provenance` Directive 3.

## Source-Data Caveats: What expaify Can Honestly Claim Today

| Signal | Claimable today? | Backing path | Honest state when absent |
| --- | --- | --- | --- |
| Hotel class (stars) | Yes | Live + cached Hotellook (`buildHotelClassEvidence`) | `Class not provided` (already shipped) |
| Verified guest score | Only from cached/seeded data | `normalizeCachedEvidence` (never the live path) | `Guest rating not provided` (already shipped) |
| Review count | Only from cached/seeded data | `normalizeCachedEvidence.reviewCount` | `Review count not provided` (already shipped) |
| Data-fetch freshness | Yes | `fetchedAt` pull timestamp | `Freshness not provided` (already shipped) |
| **Review recency** | **No — no provider field exists** | none (live returns nothing; cached allow-list drops it) | **Design the caveat below** |
| **Amenities** | **No — no provider field exists** | none | **`Amenities not returned by provider`** (per amenity-provenance) |

Line the design stage must respect: **`fetchedAt` is not recency.** A card may honestly say when expaify last checked the price/rate, but must never let that read as "reviews are recent."

## Ranking For The Smallest Trustworthy Snapshot

Given the collapsed budget is fully allocated and neither new signal has data:

1. **Star class** — collapsed chip (shipped, keep).
2. **Verified guest score + review count** — collapsed chip when present (shipped, keep).
3. **Data-fetch freshness** — details-only (shipped, keep).
4. **Review-recency caveat** — **details-only, caveat form only.** Never a collapsed chip; never a populated value today.
5. **Amenity highlights** — **details-only.** Collapsed amenity chips are deferred until (a) a provider returns confirmed amenities AND (b) a future ticket re-earns collapsed space against the two-chip cap.

Rationale: any collapsed signal that renders only as "not available" adds scan cost without decision value and pushes the score-support and handoff-caveat lines that `deal-supporting-facts-order` fought to make visible. Caveats belong in the expanded panel where the user has opted into detail.

## Design Directives For UXDES

1. **Keep both new signals out of the collapsed card; the two-chip mobile cap wins.**
   - Collapsed card DOM must contain no recency text and no amenity text in this iteration.
   - Explicitly supersede `hotel-amenity-provenance` Directive 2 ("max 3 collapsed amenities"): amenities are not additive to the collapsed budget. If a future ticket adds a confirmed-amenity chip, it counts against the existing **max-two-quality-chips-at-375px** rule from `rating-source-confidence`, it does not extend it.
   - Testable: at 375px and 1280px, the collapsed quality row renders at most two chips (class, guest rating) and no amenity/recency chip.

2. **Design review recency as a caveat, not a value — because no provider returns it.**
   - Add one details-only line inside (or directly after) the shipped `Quality evidence` panel that distinguishes fetch freshness from review recency. Final copy:
     - Default (today, always): `Review recency: not provided by this hotel source. "Updated" above is when expaify last checked the rate, not how recent the reviews are.`
   - The line is static caveat copy until a provider field exists; UXDES must not design a populated "% of reviews in the last 12 months" or "most recent review" state as if it were arriving. It may specify the *future populated* copy for the additive contract in §Directive 3, clearly marked "requires provider field; do not build UI yet."
   - Testable: recency copy never derives from `fetchedAt`; the value shown is the fixed caveat, and no `HotelOffer`/`HotelRatingEvidence` recency field is read (because none exists).

3. **Specify the additive contract both signals would need, and the not-available default, so DEV/UXDES do not design for absent data.**
   - Review recency (future, optional, never fabricated):
     ```ts
     // Additive to HotelRatingEvidence; absent today on every provider path.
     reviewRecency?: {
       mostRecentReviewDate?: string;   // ISO; provider-sourced only
       shareLast12mo?: number;          // 0..1; provider-sourced only
       sourceLabel?: string;
     };
     ```
     When absent (the only real state today) → render the Directive 2 caveat. Never infer either field from `fetchedAt` or `reviewCount`.
   - Amenities: reuse `hotel-amenity-provenance` Directive 1's contract verbatim — each item has canonical id, display label, `status ∈ {confirmed, unavailable, not_returned, unknown}`, source label, confidence; optional `scope` and `fee`. Do not add amenity UI copy that says `includes`/`free`/`available` without status/scope support.
   - Testable: the design spec marks every recency/amenity populated state "requires new provider contract"; the only state wired for shipping is the not-available caveat.

4. **Place both caveats in the expanded panel in a fixed order that does not disturb shipped hierarchy.**
   - Expanded order becomes: Deal Score panel → **Quality evidence** (shipped, with the new recency caveat line appended inside it) → **Amenities** (new panel: `Amenities not returned by provider` today) → Location → Price scope → Provider handoff. This inserts the amenity panel without reordering any shipped panel above Location.
   - Neither caveat may use color or icon as the only signal (WCAG + consistency with shipped evidence copy).
   - Testable: expanded DOM order matches the sequence above; recency caveat is inside the `Quality evidence` section's `aria-label`ed region; amenity panel is a sibling directly after it.

5. **Merge the two efforts into one `hotel-quality-snapshot` design; do not resume `hotel-amenity-provenance` as a separate chain.**
   - One `03-design.md` under `hotel-quality-snapshot/` covers both the recency caveat and the amenity panel as one cohesive "what the provider told us / what it didn't" snapshot, with a single shared caveat voice.
   - The stalled `hotel-amenity-provenance` research is validated and absorbed here (its Directives 1, 3, 4, 5 carry forward; Directive 2 is superseded by Directive 1 above). Note this supersession in the design doc so the amenity acceptance criteria are not double-counted.
   - Testable: no new `hotel-amenity-provenance/03-design.md` is created; the merged design references both discovery reports.

## Acceptance Criteria For UXDES

- The design covers, with final copy: default (both caveats in their not-available form), the shipped quality states unchanged, expanded desktop 1280px, mobile 375px, focus/keyboard order, and screen-reader text for both caveats.
- The collapsed card gains no recency or amenity content; the two-chip mobile cap and the `deal-supporting-facts-order` scan sequence are preserved and cited.
- Review recency renders only as the fixed caveat; the design explicitly forbids deriving it from `fetchedAt` and marks any populated recency/amenity state "requires provider contract; not for build."
- The additive `reviewRecency?` contract and the reused amenity contract are specified so DEV knows the future target without shipping empty-data UI.
- A hotel with no amenity data shows `Amenities not returned by provider`, never `No amenities`.
- The design supersedes `hotel-amenity-provenance` Directive 2 in writing and does not re-open any `rating-source-confidence` decision.

## Risks And Constraints

- **Data honesty is the whole risk.** The failure mode here is not a missing chip; it is turning `fetchedAt` into a fake recency claim or turning `not_returned` amenities into implied inclusions. Both caveats must be first-class states, not edge cases.
- **Out-of-scope but worth flagging (see below):** on a genuine live Hotellook fetch, even the *shipped* verified guest score and review count do not appear — they exist only in cached/seeded data. The recency caveat and the verified score therefore depend on the same absent provider capability. This does not change this ticket's scope (the shipped rating work stands), but the recency caveat should be worded so it is honest whether or not a verified score is present.
- Non-negotiables still apply: external calls stay in `lib/providers`; adapters return `Result<T>`; money stays integer cents; amenity/recency vocab is normalized in `lib/providers`, never parsed in components; outbound deeplinks keep affiliate markers.
- No change to Deal Score: quality/recency/amenity signals stay out of `scoreDeal.ts` and `DealBadge` (Discovery constraint 1).

## Out-Of-Scope Findings

- The live Hotellook path never yields a verified guest rating or review count (only `stars`). If the product intends live verified guest scores, that requires a new provider contract and is its own ticket — not this one.
- Amenity filtering/ranking and persisting amenity/recency into `/book` remain out of scope until a provider supplies the data.
- `propertyType` from Hotellook is currently discarded; surfacing it (as a category, not an amenity) could be a small separate repair but is not part of this snapshot.

## Handoff

Create `UXDES-HOTEL-QUALITY-SNAPSHOT-01` for a single, implementation-ready design covering the review-recency caveat and the amenity provenance panel as one cohesive hotel quality snapshot, absorbing and superseding the stalled `hotel-amenity-provenance` design work.

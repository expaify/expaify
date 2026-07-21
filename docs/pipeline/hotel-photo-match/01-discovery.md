# UXD-HOTEL-PHOTO-MATCH-01: Hotel and Room Photo Match

## User Pain Point

A hotel deal shows a single unlabeled property photo pressed right against a specific nightly rate, so the traveler cannot tell whether that image is the room they would actually get at that price — a generic exterior or lobby shot reads as "your room," and the mismatch either creates booking hesitation or, worse, false confidence that collapses at the provider handoff.

## Scope Note: What Is Already Solved (Do Not Re-Solve)

This ticket is about the **photo's relationship to the rate** — its meaning, its label, and its ordering relative to the price. It must not reopen the following, which are already shipped or scoped:

- **Rate scope and price honesty** — "per night before taxes and fees," provider attribution, and the `Price` / `PriceUnavailable` states (`app/components/HotelCard.tsx:34-80`, `479-483`). Shipped under `hotel-price-visibility` / `room-rate-clarity`.
- **Quality evidence (class, guest rating, review count, confidence)** — `HotelOffer.hotelClass` / `guestRating` and the `QualityEvidencePanel` (`HotelCard.tsx:309-362`). Shipped under `hotel-rating-source-confidence` and `hotel-review-relevance`. Photo trust is a *separate* trust axis from rating trust; do not fold it into the quality panel.
- **Location decision context** — `HotelLocation` precision/label/distance (`lib/types.ts:127-135`). Out of scope here except where a photo is geotagged; even then, location is not this ticket.

## The Actual Gap

1. **One photo, no meaning attached.** `HotelOffer.photoUrl` is a single optional string (`lib/types.ts:145`). There is no field for what the photo *is* (exterior / lobby / room / amenity), no caption, no room-type association, and no per-rate photo. A grep for `roomType | caption | photoCategory | photoLabel | photos\b` across `lib/` and `app/` returns nothing — the model carries exactly one anonymous image per hotel.
2. **The image is presented as if it represents the rate.** In the collapsed card the photo sits inside the same price grid as "Nightly rate," column-adjacent to the price (`HotelCard.tsx:428-484`); in the expanded details it is enlarged to a `h-40` hero directly above the deal-score and price-scope panels (`HotelCard.tsx:526-536`); on the standalone deal detail it is a 220–320px hero above the title and CTA (`app/deals/[dealId]/page.tsx:264-291`). Visual adjacency to a specific price implies "this is what you are buying" — but the source photo is a generic property image, not the room at that fare.
3. **The app has not decided what the photo means.** Alt text is contradictory across surfaces: `alt={hotel.name}` in `HotelCard` (`HotelCard.tsx:435`, `531`) treats the image as informative content about the property, while `alt=""` in `DealCard` (`app/components/ui/DealCard.tsx:59`) and the detail hero (`app/deals/[dealId]/page.tsx:268`) treats it as purely decorative. Both cannot be right. This inconsistency is the design debt: there is no single answer to "is this photo a claim, and a claim about what?"
4. **No disclosure, no fallback labeling.** When a photo *is* present, nothing tells the user it is a representative property image rather than their room. When it is absent, the surfaces diverge — `HotelCard` shows a "Photo unavailable" text box (`HotelCard.tsx:439-443`), while `DealCard` and the detail hero silently substitute a decorative building-icon gradient (`DealCard.tsx:66-86`, `[dealId]/page.tsx:271-282`) that a user may not even read as "no photo."
5. **Data reality bounds the honest solution.** The provider returns one `entry.photoUrl` with no category or room linkage (`lib/providers/hotellook.ts:474`); snapshots and deals each store a single `photo_url` column (`lib/db/schema.sql:109`, `130`). expaify does **not** currently hold room-level or rate-level imagery. Therefore the shippable fix is **labeling and honest framing of the one photo we have**, not building a room gallery for data that does not exist. Designing UI for room-specific photos would be designing for phantom data.

## Affected Users And Flow Step

- **Who:** Paid-intent travelers choosing a hotel deal, especially first-timers who have not yet learned that OTA hero images are usually generic. They are most exposed at the moment of rate selection, when the photo is the largest, most emotionally weighted element on the surface and the price is the decision.
- **Flow (deal card → detail → handoff):**
  1. **Deal feed / results** — collapsed `HotelCard` (photo thumbnail + rate, `HotelCard.tsx:428-484`) or `DealCard` (photo hero + price). First impression forms here.
  2. **Deal detail** — expanded `HotelCard` (`HotelCard.tsx:523-582`) or standalone `app/deals/[dealId]/page.tsx` hero. This is where the enlarged photo most strongly implies "your room," and it is the last expaify surface before handoff.
  3. **Booking CTA / provider handoff** — `Review hotel` (`HotelCard.tsx:490-500`). If the photo set an expectation the provider page contradicts, trust breaks exactly at the revenue moment.

The gap bites hardest at step 2, where the photo is largest and the rate-selection decision is made.

## Measurable Signal

The problem is observable in the code today, independent of opinion:

- The type model carries one anonymous photo and no room/caption/category fields (`lib/types.ts:137-151`) — confirmed by grep.
- Alt-text semantics contradict each other across three rendering sites (`HotelCard.tsx:435`/`531` vs `DealCard.tsx:59` vs `[dealId]/page.tsx:268`).
- No string anywhere near the photo discloses that it is a representative property image; the photo is inside the price grid with no label (`HotelCard.tsx:428-484`).
- Missing-photo handling is inconsistent (text box vs silent decorative gradient) across surfaces.

**Success is measured as:** improved rate-selection confidence and cleaner booking-CTA progression — specifically (a) users advancing from deal detail to the `Review hotel` handoff at an equal or higher rate once the photo is honestly labeled, and (b) no increase in immediate provider-side bounce/back behavior that indicates the photo set a false expectation. Honest labeling must *not* be a fear tax: adding "this is a representative image" should not depress qualified handoffs for deals that are genuinely fine.

## Constraints The Solution Must Respect (3)

1. **Existing data only — no phantom imagery.** Use the single `photoUrl` / `photo_url` expaify already has (`lib/types.ts:145`, `schema.sql:109`,`130`). No scraping room photos, no invented room galleries, no presenting a generic image as a specific room. If per-rate imagery is ever needed it is a provider-contract change, out of this ticket. Metadata added (e.g. a photo-scope label) must be honestly derivable, not fabricated.
2. **Never imply a claim the photo does not support.** A photo shown next to a rate must be framed for what it truthfully is (a representative property image) unless expaify can attribute it to the specific room/rate — consistent with the app's existing source-attribution and "never present as verified fact" posture (`hotel-review-relevance`, `provider-freshness-timestamp-clarity`). Resolve the `alt=""` vs `alt={name}` contradiction to one intentional rule.
3. **Accessibility and 375px, no new clutter.** Any label/disclosure must stay inside the shipped price → quality → confidence → handoff hierarchy without crowding the 375px card or the thumbnail grid, must not rely on color or an unreadable icon alone (the current building-icon gradient fallback fails this), must give the missing-photo state one consistent honest treatment across all three surfaces, and must be reachable by keyboard and assistive tech.

## Success Statement

This is solved when a first-time traveler selecting a hotel rate can tell, at deal detail, **what the photo actually shows and how it relates to the rate they are about to book** — an honestly labeled representative property image (or a single consistent, non-decorative "no photo" state) — so they progress to the provider handoff with calibrated confidence instead of guessing, and without expaify ever implying the image is a room it cannot verify.

## Instrumentation Recommendations (for UXR/UXDES to validate the hypothesis)

The photo-to-rate trust hypothesis — *travelers assume the deal photo is the room at the selected rate, and honest labeling improves rather than harms progression* — is testable with events expaify can already emit around the existing surfaces:

- `hotel_photo_viewed` — fired when a card/detail photo (or the missing-photo state) renders, with props `{ surface: 'feed'|'detail', hasPhoto, source }`. Establishes exposure and how often the fallback state is what users actually see.
- `hotel_photo_label_viewed` — fired when the proposed scope label/disclosure renders. Separates "saw a photo" from "saw a labeled photo" for the A/B.
- `hotel_rate_reviewed` / `hotel_handoff_click` — the `Review hotel` CTA press (`HotelCard.tsx:490-500`), already the natural progression event; segment by labeled vs unlabeled to read booking-CTA progression.
- `hotel_detail_expanded` — the `Details` toggle (`HotelCard.tsx:512-520`) as a proxy for rate-selection engagement / hesitation before handoff.
- Guardrail: watch handoff-click rate on labeled vs control so honesty framing is confirmed not to depress qualified intent (the "fear tax" risk).

Primary readouts: **rate-selection confidence** (detail-expand + dwell, or a lightweight confidence probe) and **booking-CTA progression** (`hotel_handoff_click` rate), compared between the honestly-labeled photo and the current unlabeled photo.

## Handoff Notes For UXR (`UXR-HOTEL-PHOTO-MATCH-01`)

Research prompts:

- **Data availability first.** Confirm what any current/candidate provider actually returns per photo: does Hotellook (or any `lib/providers/` adapter) expose a photo *type*, room association, or multiple images? If it is one generic URL — as `hotellook.ts:474` suggests — state plainly that the MVP is **label-the-one-photo**, and that room-specific galleries are unbuildable until a provider contract changes, so UXDES does not design for phantom data.
- **Minimum labeling signal.** Validate the smallest honest label that resolves the "is this my room?" question — candidate: a single scope caption ("Representative property photo") plus a resolved alt-text rule — versus doing nothing. Bound the MVP; do not design a captioned multi-photo carousel.
- **Ordering signal.** Given `deal-supporting-facts-order` and `deal-card-redesign`, decide the photo's rank relative to rate, quality, and score on collapsed vs detail surfaces — should the photo lead, or should the rate/score lead with the photo clearly subordinate and labeled?
- **Missing-photo consistency.** Recommend one honest fallback treatment to replace the current split between `HotelCard`'s "Photo unavailable" text and the decorative building-icon gradient in `DealCard` / the detail hero.
- **Alt-text decision.** Deliver the single intentional rule that ends the `alt=""` vs `alt={hotel.name}` contradiction across the three rendering sites.

Source constraints for downstream: existing single-photo data only, no fabricated/scraped room imagery, photo framed truthfully (representative image unless room/rate-attributable), one consistent missing-photo state.

Measurable outcomes for downstream: rate-selection confidence up, booking-CTA progression (handoff click) equal-or-up, qualified booking intent not reduced by honesty framing.

# UXD-CANCELLATION-POLICY-01: Cancellation Policy Confidence

## Pain Point

A traveler cannot tell whether a hotel deal is refundable, when a cancellation penalty starts, or whether payment is due now — expaify defers all three questions to "the provider" and only says so after the user has already clicked through toward booking.

## Affected Users And Flow Step

- **Who is affected:** First-time and price-sensitive users comparing hotel deals who need to know their downside risk (can I get my money back if plans change?) before they invest time clicking through to a third-party site.
- **Flow steps:**
  1. **Hotel results card** — `app/components/HotelCard.tsx`. Neither the collapsed card nor the expanded "Details" panel mentions refundability, cancellation deadlines, or prepayment terms anywhere. The expanded panel has `QualityEvidencePanel` (hotel class, guest rating) and a "Price scope" panel, but no cancellation section exists.
  2. **Deal detail page** — `app/deals/[dealId]/page.tsx:332`. The only cancellation-related copy is: *"Nightly rate before taxes and fees. Taxes, fees, cancellation policy, and final total are confirmed by the provider."* This tells the user the policy exists but not what it is, and it appears after the price/CTA, not before.
  3. **Booking review handoff** — `app/book/BookingFlow.tsx`. The `HotelHandoffReview` screen (`hotelTermsCopy`, line 18; message, line 486) repeats the same pattern: *"Confirm the location, taxes, fees, cancellation policy, room details, and live availability with the provider before payment."* This is the first and only cancellation-related message in the entire flow, and it lands on the very last internal screen before the user leaves expaify.

Across all three surfaces, cancellation/refund/prepayment is treated as a disclaimer about what expaify does *not* know, never as a fact the user can act on before deciding to click through.

## Current Implementation Signal (source-verified)

- `HotelOffer` (`lib/types.ts`) has no field for refundability, cancellation deadline, or prepayment timing. The type covers price, stars, rating/quality evidence (`hotelClass`, `guestRating`), and location — nothing policy-related.
- `HotellookProvider.searchHotels` (`lib/providers/hotellook.ts`) parses the Travelpayouts HotelLook `cache.json` metasearch feed. Its response shape (`HotelLookCacheEntry`) only carries `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType` — no cancellation, refund, or prepayment field is fetched, parsed, or cached anywhere in this adapter.
- `grep` across `app/` and `lib/` for `cancel|refund|prepay|policy` turns up cancellation copy only in three places: the two deal-flow files above, and static marketing/legal copy for expaify's own Premium subscription (`app/terms`, `app/join`, `app/account`) — unrelated to hotel booking policy.
- The codebase already has a proven pattern for exactly this kind of problem: `HotelRatingEvidence` (`kind`, `confidence: 'verified' | 'provider_only' | 'inferred' | 'unavailable'`) is used so `HotelCard` never claims a guest rating it can't back up (see `getGuestRatingDetailText`, `getConfidenceText` in `HotelCard.tsx`). Any cancellation-policy signal should follow this same evidence/confidence shape rather than inventing a new one.

## Measurable Signal

The problem exists today because:
1. No CTA, card, or panel lets a user filter or visually distinguish a refundable hotel offer from a non-refundable one before clicking "Review hotel."
2. The word "cancellation" only ever appears as a disclaimer about what the user must go verify themselves — never as an answer.
3. There is no analytics event capturing hesitation or abandonment tied to policy uncertainty; `lib/analytics.ts`'s `track()` (already used for feed/watchlist events in `DealFeed.tsx`, `WatchCityCta.tsx`) has no equivalent `hotel_book_cta_clicked` / `hotel_policy_viewed` event pair today, so the stated success metric (reduced CTA abandonment, increased refundable-rate clicks) cannot currently be measured at all.

Downstream stages should treat "instrument it" as part of the deliverable, not an afterthought: define concrete `track()` event names (e.g. `hotel_policy_badge_viewed`, `hotel_book_cta_clicked` with a `refundable` property) so TEST can verify the signal exists, not just that copy renders.

## Constraints The Solution Must Respect

1. **Data integrity, no legal interpretation:** Never label a rate "refundable" or state a cancellation deadline unless that value comes directly from the provider feed. If the feed only returns a fare-rules string or nothing at all, the UI must say policy is unconfirmed rather than infer or paraphrase legal terms — mirroring the `unavailable`/`inferred` confidence states already used for `HotelRatingEvidence`.
2. **Provider feed reality:** The current `HotellookProvider` adapter fetches zero cancellation/refund/prepayment data (see above). Any UI built against this ticket can only render an honest "not provided by this provider" state today — surfacing real refundable/non-refundable badges requires a provider-side change (new field parsing, or a different/richer feed) that is out of scope for UXD/UXR/UXDES and must be scoped as its own DEV ticket.
3. **Copy brevity for cards:** `HotelCard`'s collapsed row already carries a hotel-class chip and a guest-rating chip in a `flex-wrap` row at `text-xs`. Any card-level cancellation signal must fit that existing chip pattern (a few words, e.g. "Free cancellation") — no multi-line policy text on the card; full explanation belongs in the expanded "Details" panel and deal/booking pages only.

## Success Statement

This is solved when a first-time user browsing hotel results can tell — without leaving expaify — whether a stay is refundable, roughly when a cancellation penalty would start, and whether payment is due now or at check-in, using only what the provider feed actually confirms; and when, for the (expected common) case where the feed confirms none of this, the user is told that plainly instead of being pointed at a vague "confirmed by the provider" disclaimer after the fact.

## Handoff Note for UXR

The central open question for research is **not** "what should the UI look like" but **"does any available or upgradeable provider feed actually return cancellation/refund/prepayment data, and in what shape?"** Research must audit `lib/providers/hotellook.ts`, check whether Travelpayouts/HotelLook exposes this in a different endpoint, and only then define what "Great/Good/Typical"-style comprehension the design stage can honestly build. If no feed provides this data, the research brief should say so explicitly and redirect the design stage toward an honest-absence pattern (consistent with `hotel-rating-source-confidence` precedent) rather than a fabricated policy badge.

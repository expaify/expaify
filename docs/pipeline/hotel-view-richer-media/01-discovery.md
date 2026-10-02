# UX Discovery: Hotel view pages show a single photo and no review signal, while the provider already sends more

Ticket: UXD-HOTEL-VIEW-RICHER-MEDIA-01

## The problem

A visitor to any `/deals/[dealId]` hotel detail page sees exactly **one
photo** and no star rating, review score, or review count anywhere on the
page — just the hotel name, price, discount, and a generic AI headline.
This is the single highest-stakes page in the product (the page a user is
on right when they decide whether to trust a deal enough to click through
and book), and it currently gives them less visual/trust evidence than a
basic hotel-search-results card on Booking.com itself.

## Who is affected, and where

Every visitor who reaches a deal detail page — both from the main feed/
destination pages (the primary path) and from any shared/direct link,
email alert, or social post pointing at a specific deal. Confirmed by
reading the real page (`app/deals/[dealId]/page.tsx`): exactly two
`<PropertyPhoto src={deal.photo_url} .../>` call sites in the whole file,
both rendering the same single stored URL (lines 479, 694).

## The measurable signal

Confirmed directly against the real, live Booking.com API response (the
exact endpoint this pipeline already calls nightly,
`api/v1/hotels/searchHotels`) for a real Las Vegas hotel:

- The raw `property` object already contains a `photoUrls` array with
  **3 real photo URLs** per hotel. Our own provider code
  (`lib/pipeline/snapshot.ts`, `fetchBookingCom15Page`) explicitly keeps
  only `photoUrls[0]` and discards the rest:
  `const photo = (prop.photoUrls as string[] | undefined)?.[0] ?? null`.
- The same raw object also already contains `reviewScore`, `reviewCount`,
  and `reviewScoreWord` (e.g. "Excellent", "Very Good") — real Booking.com
  review data, already inside every response this pipeline already fetches
  every night. None of these three fields are read anywhere in
  `fetchBookingCom15Page`'s parsing — they are silently dropped before a
  `HotelEntry` is ever constructed.
- The database schema itself hard-codes this ceiling: `photo_url TEXT`
  (singular) on both `price_snapshots` (schema.sql:174) and `deals`
  (schema.sql:206) — there is no column that could hold more than one URL
  today without a migration.
- `price_snapshots` already has an unused-by-this-provider `review_evidence
  JSONB` column (schema.sql:199, added via a prior `ALTER TABLE`) — already
  populated today for the TripAdvisor provider (confirmed via
  `lib/pipeline/__tests__/snapshot.test.ts`'s `'stores TripAdvisor bubbles
  as review evidence'` test) but never populated for Booking.com's own
  `reviewScore`/`reviewCount`, even though Booking is the dominant provider
  by hotel count in this pipeline.

So this is not "the data doesn't exist yet" — it is "the data arrives in
the same response we already fetch every night, and gets thrown away
before it's ever stored."

## Constraints the solution must respect

1. **No new API subscription or endpoint needed for the first real win.**
   `photoUrls[1]`/`photoUrls[2]` and `reviewScore`/`reviewCount`/
   `reviewScoreWord` are already present in the exact `searchHotels`
   response this pipeline already calls — capturing them is a parsing +
   schema change, not a new integration. (A deeper win — full amenity
   lists, long-form descriptions, more than 3 photos — would need the
   separate `getHotelDetails` endpoint, one extra API call per HOTEL not
   per market, a real cost/latency tradeoff to scope separately, not
   bundled into this first pass.)
2. **Never fabricate a review score or photo.** If a given snapshot/provider
   genuinely has only 1 photo or no review score, the UI must show exactly
   what's real — no placeholder stock photos, no invented "4.5 stars."
3. **Preserve the existing locked/tracked-hotel rendering contract.**
   `toApiDeal`'s `locked` branch across every surface (home, deals feed,
   destination pages, this detail page) must keep showing zero price/photo
   detail for members-only rows — richer media must not leak through the
   paywall.
4. **Money/threshold logic untouched.** This is a display + data-capture
   change only; `MIN_QUALIFYING_DISCOUNT_PCT`, `MIN_SNAPSHOTS`, and the
   anchor-date selection logic (both real, recently-fixed, deal-detection-
   class code) are explicitly out of scope and must not be touched by this
   work.

## Success statement

This is solved when a visitor to any hotel detail page sees a real photo
gallery (as many real photos as the provider actually returned that night,
not a hardcoded 1) and a real review score/count badge when the provider
supplied one — giving them genuine trust signal before they click through
to book, instead of today's single cropped photo and zero review context.

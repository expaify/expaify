export type OtaLinks = {
  expedia?: string
  booking?: string
  kiwi?: string
  trip?: string
  // Real, working, unattributed fallback -- see bookingSearchUrl comment below.
  bookingSearchUrl?: string
}

export function buildOtaLinks(opts: {
  hotelName: string
  city: string
  checkIn: string   // YYYY-MM-DD
  checkOut: string  // YYYY-MM-DD
}): OtaLinks {
  const { hotelName, city, checkIn, checkOut } = opts
  const q = encodeURIComponent(`${hotelName} ${city}`)

  // The approved hotel contract exposes one Travelpayouts/HotelLook marker,
  // not provider-specific Expedia, Booking, or Kiwi affiliate credentials.
  // Keep those actions unavailable rather than emitting unattributed links or
  // pretending the snapshot's hidden occupancy default was traveler intent.
  const expedia = undefined
  const booking = undefined
  const kiwi = undefined

  // Trip.com is deliberately never built here. Confirmed live (2026-08-06)
  // via the actual Travelpayouts dashboard: this account has zero hotel
  // programs subscribed -- Trip.com/Hotellook/Booking are all gated behind
  // Travelpayouts' own review (3 consecutive months of stable traffic + an
  // active travel-content blog), not a config value. A correctly-attributed
  // link (marker + trs + p) was shipped once and rendered as a real,
  // clickable option, but every click landed on a Travelpayouts error page
  // ("traffic_source is not valid") instead of Trip.com -- worse than not
  // showing it at all. See REPAIR-TRAVELPAYOUTS-TRS-INVALID-01 and
  // REPAIR-TRIP-LINK-REMOVE-UNTIL-APPROVED-01 for the working marker/trs/p
  // values and exact URL format to restore once the account is approved.
  const trip = undefined

  // Real, working, zero-setup fallback while that review is pending: a plain
  // Booking.com search for this exact hotel/city/dates. Not affiliate-
  // attributed (no revenue), and deliberately kept out of the `booking` field
  // above and out of CompareRow's attributed-link set -- CompareRow's
  // isAttributedHotelProviderUrl() is also relied on elsewhere (the
  // post-booking handoff/recovery flow in HotelDealCriteria.tsx) to mean "a
  // real, trackable, revenue link", and this deliberately isn't one. A
  // working link beats a dead "no attributed link" state or a broken
  // Travelpayouts redirect; swap back to `trip` once the account is approved.
  // No group_adults/no_rooms here, deliberately -- see the comment above about
  // not asserting the snapshot's search default was the traveler's real party
  // size. Booking.com applies its own default; the traveler adjusts it there.
  const bookingSearchUrl =
    `https://www.booking.com/searchresults.html?ss=${q}&checkin=${checkIn}&checkout=${checkOut}`

  return { expedia, booking, kiwi, trip, bookingSearchUrl }
}

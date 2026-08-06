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
  // deploy.yml only ever provisions TP_AFFILIATE_MARKER -- HOTEL_AFFILIATE_ID
  // has never existed in this deployment, so this always resolved to '' and
  // every real deal's booking link silently never rendered. lib/providers/
  // hotellook.ts already carries this same fallback for the same reason.
  const marker = process.env.HOTEL_AFFILIATE_ID ?? process.env.TP_AFFILIATE_MARKER ?? ''

  // The approved hotel contract exposes one Travelpayouts/HotelLook marker,
  // not provider-specific Expedia, Booking, or Kiwi affiliate credentials.
  // Keep those actions unavailable rather than emitting unattributed links or
  // pretending the snapshot's hidden occupancy default was traveler intent.
  const expedia = undefined
  const booking = undefined
  const kiwi = undefined

  // Confirmed live (2026-08-06) via the actual Travelpayouts dashboard: this
  // account has zero hotel programs subscribed -- Trip.com/Hotellook/Booking
  // are all gated behind Travelpayouts' own review (3 consecutive months of
  // stable traffic + an active travel-content blog), not a config value. The
  // marker/trs below will silently 404/error until that review passes.
  const trip = marker
    ? `https://tp.media/r?marker=${encodeURIComponent(marker)}&trs=233847&p=4536&u=https%3A%2F%2Fwww.trip.com%2Fhotels%2F%3FhotelName%3D${q}%26checkIn%3D${checkIn}%26checkOut%3D${checkOut}`
    : undefined

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

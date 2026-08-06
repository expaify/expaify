export type OtaLinks = {
  expedia?: string
  booking?: string
  kiwi?: string
  trip?: string
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

  const trip = marker
    ? `https://tp.media/r?marker=${encodeURIComponent(marker)}&trs=233847&p=4536&u=https%3A%2F%2Fwww.trip.com%2Fhotels%2F%3FhotelName%3D${q}%26checkIn%3D${checkIn}%26checkOut%3D${checkOut}`
    : undefined

  return { expedia, booking, kiwi, trip }
}

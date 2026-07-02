export type OtaLinks = {
  expedia?: string
  booking?: string
  kiwi?: string
  trip?: string
}

function addAffiliate(url: string, param: string, value: string | undefined): string {
  if (!value) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${param}=${encodeURIComponent(value)}`
}

export function buildOtaLinks(opts: {
  hotelName: string
  city: string
  checkIn: string   // YYYY-MM-DD
  checkOut: string  // YYYY-MM-DD
}): OtaLinks {
  const { hotelName, city, checkIn, checkOut } = opts
  const q = encodeURIComponent(`${hotelName} ${city}`)
  const marker = process.env.TP_AFFILIATE_MARKER ?? ''

  const expedia = addAffiliate(
    `https://www.expedia.com/Hotel-Search?destination=${q}&startDate=${checkIn}&endDate=${checkOut}`,
    'affcid', process.env.EXPEDIA_AFFILIATE_ID
  )

  const booking = addAffiliate(
    `https://www.booking.com/search.html?ss=${q}&checkin=${checkIn}&checkout=${checkOut}`,
    'aid', process.env.BOOKING_AFFILIATE_ID
  )

  const kiwi = addAffiliate(
    `https://www.kiwi.com/en/search/results/${encodeURIComponent(city)}/${encodeURIComponent(city)}/${checkIn}/${checkOut}?adults=2&accommodation=true`,
    'affilid', process.env.KIWI_AFFILIATE_ID
  )

  const trip = marker
    ? `https://tp.media/r?marker=${encodeURIComponent(marker)}&trs=233847&p=4536&u=https%3A%2F%2Fwww.trip.com%2Fhotels%2F%3FhotelName%3D${q}%26checkIn%3D${checkIn}%26checkOut%3D${checkOut}`
    : `https://www.trip.com/hotels/?hotelName=${q}&checkIn=${checkIn}&checkOut=${checkOut}`

  return { expedia, booking, kiwi, trip }
}

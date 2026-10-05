import { cache } from '../cache/redis'
import type { Result } from '../types'

// Real amenity/facility data for a specific Booking.com-sourced hotel,
// fetched lazily at deal-detail page render time rather than during the
// nightly snapshot pipeline. Scoped deliberately narrow (UXR-HOTEL-VIEW-
// RICHER-MEDIA-01 Phase 2): only for confirmed deals a real visitor is
// actually looking at, not every tracked hotel in the DB every night --
// confirmed deals are rare (0-2 at a time, verified against production),
// so real per-request cost stays naturally bounded by real traffic instead
// of a fixed nightly multiplier across all 36 markets' full hotel rosters.
// Booking.com-sourced only (bk_ prefixed hotel ids) -- this is the one
// provider with a real, rich getHotelDetails endpoint already confirmed
// live; TripAdvisor/Agoda amenity data would need its own separate
// investigation, not assumed to exist just because this one does.

export type HotelAmenity = {
  name: string
  icon: string | null
}

const BOOKING_HOTEL_ID_PREFIX = 'bk_'

// This is a live, per-page-render fetch (not pipeline-stored), so a popular
// deal page would otherwise re-hit RapidAPI's shared quota on every single
// visitor -- facilities don't vary by check-in/check-out, so cache by hotel
// id alone, same 6h TTL convention sibling Booking.com RapidAPI calls use
// (lib/providers/bookingComHotelsRapidApi.ts's SEARCH_CACHE_TTL). Cache both
// a real success and the honest "no facilities" outcome (same reasoning as
// lib/providers/locationQuality.ts); never cache a transient failure (rate
// limit, network error, bad HTTP status, malformed JSON) so an outage
// self-heals on the next real request instead of being pinned for 6 hours.
const CACHE_TTL_SECONDS = 21_600

function cacheKeyFor(hotelId: string): string {
  return `hotel-amenities:${hotelId}`
}

export function isBookingSourcedHotelId(hotelId: string): boolean {
  return hotelId.startsWith(BOOKING_HOTEL_ID_PREFIX)
}

export async function fetchHotelAmenities(
  hotelId: string,
  checkIn: string,
  checkOut: string
): Promise<Result<HotelAmenity[]>> {
  if (!isBookingSourcedHotelId(hotelId)) {
    return { ok: false, reason: 'not a booking.com-sourced hotel id' }
  }
  const realHotelId = hotelId.slice(BOOKING_HOTEL_ID_PREFIX.length)
  const key = process.env.RAPIDAPI_KEY ?? ''
  if (!key) {
    return { ok: false, reason: 'RAPIDAPI_KEY not configured' }
  }

  const cacheKey = cacheKeyFor(hotelId)
  const cached = await cache.get<Result<HotelAmenity[]>>(cacheKey).catch(() => null)
  if (cached !== null) return cached

  const url =
    `https://booking-com15.p.rapidapi.com/api/v1/hotels/getHotelDetails` +
    `?hotel_id=${encodeURIComponent(realHotelId)}` +
    `&arrival_date=${checkIn}&departure_date=${checkOut}` +
    `&adults=2&room_qty=1&currency_code=USD`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'booking-com15.p.rapidapi.com' },
      signal: AbortSignal.timeout(8_000),
    })
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
  if (res.status === 429) return { ok: false, reason: 'rate limited (429)' }
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    return { ok: false, reason: `malformed response: ${err instanceof Error ? err.message : String(err)}` }
  }

  const facilities = (json as {
    data?: { facilities_block?: { facilities?: { name?: unknown; icon?: unknown }[] } }
  })?.data?.facilities_block?.facilities ?? []

  const amenities: HotelAmenity[] = facilities
    .filter((f): f is { name: string; icon?: unknown } => typeof f.name === 'string' && f.name.trim().length > 0)
    .map(f => ({ name: f.name.trim(), icon: typeof f.icon === 'string' ? f.icon : null }))

  if (amenities.length === 0) {
    const result: Result<HotelAmenity[]> = { ok: false, reason: 'provider returned no real facilities for this hotel' }
    await cache.set(cacheKey, result, CACHE_TTL_SECONDS).catch(() => {})
    return result
  }
  const result: Result<HotelAmenity[]> = { ok: true, data: amenities }
  await cache.set(cacheKey, result, CACHE_TTL_SECONDS).catch(() => {})
  return result
}

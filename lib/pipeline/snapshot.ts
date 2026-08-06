import { query } from '../db/client'
import { buildOtaLinks } from './otaLinks'

const NIGHTS = 2

// Instead of relative offsets (which shift every day, preventing snapshot accumulation),
// we use two fixed calendar anchors per month so the same hotel+date gets re-scanned
// and builds up MIN_SNAPSHOTS=8 within days rather than never.
// Alternating between 2 anchors keeps the daily API call count at 19 (1 per market),
// well within the RapidAPI quota that previously exhausted after ~7 markets.
function getAnchorCheckInDate(): string {
  const today = new Date()
  const nm1 = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const nm15 = new Date(today.getFullYear(), today.getMonth() + 1, 15)
  // If next-month's 1st is already within 7 days, roll to month+2
  const daysToNm1 = Math.ceil((nm1.getTime() - today.getTime()) / 86400000)
  const anchors = daysToNm1 < 7
    ? [nm15, new Date(today.getFullYear(), today.getMonth() + 2, 1)]
    : [nm1, nm15]
  // Alternate anchors each day so both accumulate snapshots every ~2 days
  return anchors[today.getDate() % anchors.length].toISOString().slice(0, 10)
}

// ── Market metadata ──────────────────────────────────────────────────────────

type Market = { id: number; city: string; country: string; iata: string }

// Booking.com city dest_ids (booking-com15 provider)
const BK_DEST: Record<string, string> = {
  MIA: '20023182', NYC: '20088325', CUN: '-1655011', PAR: '-1456928',
  ROM: '-126693',  BCN: '-372490',  LIS: '-2167973', LON: '-2601889',
  TYO: '-246227',  BKK: '-3414440', DXB: '-782831',  LAS: '20079110',
  MCO: '20023488', SJU: '20154335', TUL: '-1707023', AMS: '-2140479',
  ATH: '-814876',  PUJ: '-3364907', CLT: '20091627', BNA: '20123908',
}

// Lat/lon for booking-com v1 coordinate search
const COORDS: Record<string, [number, number]> = {
  MIA: [25.7617, -80.1918], NYC: [40.7128, -74.0060], CUN: [21.1619, -86.8515],
  PAR: [48.8566,   2.3522], ROM: [41.9028,  12.4964], BCN: [41.3851,   2.1734],
  LIS: [38.7169,  -9.1395], LON: [51.5074,  -0.1278], TYO: [35.6762, 139.6503],
  BKK: [13.7563, 100.5018], DXB: [25.2048,  55.2708], LAS: [36.1699,-115.1398],
  MCO: [28.5383, -81.3792], SJU: [18.4655, -66.1057], TUL: [20.2114, -87.4654],
  AMS: [52.3676,   4.9041], ATH: [37.9838,  23.7275], PUJ: [18.5601, -68.3725],
  CLT: [35.2271, -80.8431], BNA: [36.1627, -86.7816],
}

// TripAdvisor geoIds (tripadvisor16 provider) — omitted where unavailable
const TA_GEO: Record<string, string> = {
  MIA: '34438',    NYC: '60763',    CUN: '150807',  PAR: '187147',
  ROM: '187791',   BCN: '187497',   LIS: '189158',  LON: '186338',
  BKK: '293916',   LAS: '45963',    SJU: '147320',  TUL: '23240074',
  AMS: '188590',   ATH: '29209',    CLT: '49022',   BNA: '55229',
}

// Priceline city ids (priceline-com2 provider) -- resolved via that API's own
// /hotels/auto-complete for each tracked market's city name (2026-08-06).
const PL_CITY: Record<string, string> = {
  MIA: '3000003311', NYC: '3000016152', CUN: '3000061781', PAR: '3000035827',
  ROM: '3000035823', BCN: '3000035833', LIS: '3000035890', LON: '3000035825',
  TYO: '3000040035', BKK: '3000040033', DXB: '5000003658', LAS: '3000015284',
  MCO: '3000003349', SJU: '3000024950', TUL: '5000495528', AMS: '3000035824',
  ATH: '3000035889', PUJ: '5000494493', CLT: '3000012874', BNA: '3000020633',
}

// ── Normalised hotel type ────────────────────────────────────────────────────

type HotelEntry = {
  hotelId: string
  hotelName: string
  stars: number | null
  priceCents: number   // per night
  photoUrl: string | null
}

export class RateLimitError extends Error {
  constructor() { super('RAPIDAPI quota exhausted (429)'); this.name = 'RateLimitError' }
}

// ── Provider 1: booking-com15 (dest_id city search) ─────────────────────────

async function fetchBookingCom15(iata: string, checkIn: string, checkOut: string, key: string): Promise<HotelEntry[]> {
  const destId = BK_DEST[iata]
  if (!destId) return []

  const url =
    `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels` +
    `?dest_id=${encodeURIComponent(destId)}&search_type=city` +
    `&arrival_date=${checkIn}&departure_date=${checkOut}` +
    `&adults=2&room_qty=1&page_number=1&currency_code=USD&languagecode=en-us&units=metric&temperature_unit=c`

  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'booking-com15.p.rapidapi.com' },
    signal: AbortSignal.timeout(18_000),
  })
  if (res.status === 429) throw new RateLimitError()
  if (!res.ok) return []

  const json = await res.json() as { data?: { hotels?: unknown[] } }
  return (json?.data?.hotels ?? []).flatMap((h: unknown) => {
    const prop = (h as { property?: Record<string, unknown> })?.property
    if (!prop) return []
    const id = String(prop.id ?? prop.hotelId ?? '')
    const name = String(prop.name ?? '')
    const stars = prop.propertyClass ? Number(prop.propertyClass) : null
    const photo = (prop.photoUrls as string[] | undefined)?.[0] ?? null
    const price = (prop.priceBreakdown as { grossPrice?: { value?: number } } | undefined)?.grossPrice?.value ?? 0
    const priceCents = Math.round(price * 100)
    if (!id || !name || priceCents <= 0) return []
    return [{ hotelId: `bk_${id}`, hotelName: name, stars, priceCents, photoUrl: photo }]
  })
}

// ── Provider 2: booking-com v1 (coordinate search) ──────────────────────────

async function fetchBookingComCoords(iata: string, checkIn: string, checkOut: string, key: string): Promise<HotelEntry[]> {
  const coord = COORDS[iata]
  if (!coord) return []
  const [lat, lng] = coord

  const url =
    `https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates` +
    `?locale=en-gb&room_number=1&checkout_date=${checkOut}&filter_by_currency=USD` +
    `&checkin_date=${checkIn}&adults_number=2&latitude=${lat}&longitude=${lng}` +
    `&order_by=popularity&units=metric&page_number=1&filter_by_min_review_score=5`

  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'booking-com.p.rapidapi.com' },
    signal: AbortSignal.timeout(18_000),
  })
  if (res.status === 429) throw new RateLimitError()
  if (!res.ok) return []

  const json = await res.json() as { result?: unknown[] }
  return (json?.result ?? []).flatMap((h: unknown) => {
    const hotel = h as Record<string, unknown>
    const id = String(hotel.hotel_id ?? hotel.id ?? '')
    const name = String(hotel.hotel_name ?? '')
    const stars = hotel.class ? Number(hotel.class) : null
    const photo = String(hotel.main_photo_url ?? hotel.max_photo_url ?? '')
    const totalPrice = Number(hotel.min_total_price ?? 0)
    const priceCents = Math.round((totalPrice / NIGHTS) * 100)
    // Skip apartments/non-hotel accommodation (class 0 = no star rating / unclassified)
    if (!id || !name || priceCents <= 0 || (stars !== null && stars < 1)) return []
    return [{ hotelId: `bk_${id}`, hotelName: name, stars: stars || null, priceCents, photoUrl: photo || null }]
  })
}

// ── Provider 3: tripadvisor16 (geoId search) ─────────────────────────────────

function parseTAPrice(raw: string | null | undefined): number {
  if (!raw) return 0
  const num = parseFloat(raw.replace(/[^0-9.]/g, ''))
  return isNaN(num) ? 0 : Math.round(num * 100)
}

async function fetchTripAdvisor(iata: string, checkIn: string, checkOut: string, key: string): Promise<HotelEntry[]> {
  const geoId = TA_GEO[iata]
  if (!geoId) return []

  const url =
    `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels` +
    `?geoId=${geoId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=2&rooms=1&currency=USD`

  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com' },
    signal: AbortSignal.timeout(18_000),
  })
  if (res.status === 429) throw new RateLimitError()
  if (!res.ok) return []

  const json = await res.json() as { data?: { data?: unknown[] } }
  return (json?.data?.data ?? []).flatMap((h: unknown) => {
    const hotel = h as Record<string, unknown>
    const id = String(hotel.id ?? '')
    const name = String(hotel.title ?? '').replace(/^\d+\.\s*/, '') // strip "1. " prefix
    const stars = (hotel.bubbleRating as { rating?: number } | undefined)?.rating ?? null
    const photos = (hotel.cardPhotos as { sizes?: { urlTemplate?: string } }[] | undefined) ?? []
    const photoTpl = photos[0]?.sizes?.urlTemplate ?? null
    const photo = photoTpl ? photoTpl.replace('{width}', '600').replace('{height}', '400') : null
    const priceCents = parseTAPrice(hotel.priceForDisplay as string | undefined)
    if (!id || !name || priceCents <= 0) return []
    return [{ hotelId: `ta_${id}`, hotelName: name, stars: stars ? Number(stars) : null, priceCents, photoUrl: photo }]
  })
}

// ── Provider 4: priceline-com2 (city id search) ──────────────────────────────
//
// Separate RapidAPI subscription/key from the other three (RAPIDAPI_KEY isn't
// subscribed to this one, and this key isn't subscribed to the other three) --
// reads its own env var rather than the shared `key` param threaded through
// fetchWithRotation, so it's silently skipped (not an error) if unconfigured.

async function fetchPricelineComProvider(iata: string, checkIn: string, checkOut: string): Promise<HotelEntry[]> {
  const key = process.env.RAPIDAPI_KEY_PRICELINE ?? ''
  const locationId = PL_CITY[iata]
  if (!key || !locationId) return []

  const url =
    `https://priceline-com2.p.rapidapi.com/hotels/search` +
    `?locationId=${locationId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=2&rooms=1&currency=USD`

  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'priceline-com2.p.rapidapi.com' },
    signal: AbortSignal.timeout(18_000),
  })
  if (res.status === 429) throw new RateLimitError()
  if (!res.ok) return []

  const json = await res.json() as { data?: { hotels?: unknown[] } }
  return (json?.data?.hotels ?? []).flatMap((h: unknown) => {
    const hotel = h as Record<string, unknown>
    const id = String(hotel.hotelId ?? '')
    const name = String(hotel.name ?? '')
    const stars = hotel.starRating ? Number(hotel.starRating) : null
    const images = hotel.images as { fastlyUrl?: string }[] | undefined
    const photo = images?.[0]?.fastlyUrl ?? (typeof hotel.thumbnailUrl === 'string' ? hotel.thumbnailUrl : null)
    // ratesSummary.minPrice is a pre-tax/fee teaser figure -- confirmed live
    // (2026-08-06) against real Vegas listings where it understated the real
    // price by 8-13x (e.g. Flamingo Las Vegas: minPrice "6.00" vs the actual
    // nightlyRateIncludingTaxesAndFees "62.99", which matches grandTotal /
    // nights exactly). Using minPrice would have shipped fabricated
    // sub-$10/night "deals" -- the same class of dishonesty this app has
    // repeatedly had to fix elsewhere (never present a pre-fee price as if
    // it were the real one).
    const ratesSummary = hotel.ratesSummary as { nightlyRateIncludingTaxesAndFees?: string } | undefined
    const price = Number(ratesSummary?.nightlyRateIncludingTaxesAndFees ?? 0)
    const priceCents = Math.round(price * 100)
    if (!id || !name || priceCents <= 0) return []
    return [{ hotelId: `pl_${id}`, hotelName: name, stars, priceCents, photoUrl: photo }]
  })
}

// ── Rotation ──────────────────────────────────────────────────────────────────

type ProviderFn = (iata: string, ci: string, co: string, key: string) => Promise<HotelEntry[]>

// Ignores the shared `key` param -- reads RAPIDAPI_KEY_PRICELINE itself.
// Named (not an inline arrow) so provider.name stays meaningful in
// fetchWithRotation's providerErrors messages below.
function fetchPricelineCom(iata: string, ci: string, co: string): Promise<HotelEntry[]> {
  return fetchPricelineComProvider(iata, ci, co)
}

const PROVIDERS: ProviderFn[] = [fetchBookingCom15, fetchBookingComCoords, fetchTripAdvisor, fetchPricelineCom]

type RotationResult = { hotels: HotelEntry[]; providerErrors: string[] }

async function fetchWithRotation(
  iata: string, checkIn: string, checkOut: string, key: string, offsetIndex: number, marketIndex: number
): Promise<RotationResult> {
  // Each check-in offset gets a different starting provider; market index shifts within that
  const startIdx = (offsetIndex + marketIndex) % PROVIDERS.length
  const providerErrors: string[] = []
  for (let i = 0; i < PROVIDERS.length; i++) {
    const provider = PROVIDERS[(startIdx + i) % PROVIDERS.length]
    try {
      const results = await provider(iata, checkIn, checkOut, key)
      if (results.length > 0) return { hotels: results, providerErrors }
      // An empty result isn't necessarily an error (a market can genuinely have
      // no matches), but it's worth recording alongside real errors so a market
      // that comes back empty from every provider, every night, is visible
      // instead of indistinguishable from "briefly nothing to report."
      providerErrors.push(`${provider.name}: returned 0 results`)
    } catch (err) {
      // Rate limit is shared across all providers (same key) — stop immediately
      if (err instanceof RateLimitError) throw err
      // Every other per-provider failure used to be swallowed entirely here,
      // with no log and no way to distinguish "provider had nothing" from
      // "provider is broken" -- this is exactly how a market silently
      // stopped producing data for three weeks (2026-07-06 to 2026-07-27)
      // while the pipeline kept reporting overall success every night, and
      // no real deal was detected anywhere for over a month as a result.
      providerErrors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { hotels: [], providerErrors }
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function storeSnapshot(market: Market, hotel: HotelEntry, checkIn: string, isMock: boolean): Promise<void> {
  await query(
    `INSERT INTO price_snapshots
       (hotel_id, hotel_name, stars, photo_url, market_id, check_in, nights, price_cents, currency, snapshot_date, is_mock)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'USD',CURRENT_DATE,$9)
     ON CONFLICT ON CONSTRAINT price_snapshots_unique
     DO UPDATE SET price_cents = EXCLUDED.price_cents, photo_url = COALESCE(EXCLUDED.photo_url, price_snapshots.photo_url)`,
    [hotel.hotelId, hotel.hotelName, hotel.stars, hotel.photoUrl, market.id, checkIn, NIGHTS, hotel.priceCents, isMock]
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

export type SnapshotResult = { market: string; checkIn: string; hotelsProcessed: number; error?: string; providerErrors?: string[] }

export async function runSnapshotsForMarket(market: Market, marketIndex = 0): Promise<SnapshotResult[]> {
  const key = process.env.RAPIDAPI_KEY ?? ''
  const isMock = !key

  // Single anchor date per run — keeps total calls at 19/day (1 per market) vs 57 before
  const checkIn = getAnchorCheckInDate()
  const checkOut = toCheckOut(checkIn, NIGHTS)

  try {
    const { hotels, providerErrors } = isMock
      ? { hotels: generateMockHotels(market.iata, checkIn), providerErrors: [] as string[] }
      : await fetchWithRotation(market.iata, checkIn, checkOut, key, 0, marketIndex)

    for (const hotel of hotels) {
      await storeSnapshot(market, hotel, checkIn, isMock)
    }

    return [{
      market: market.iata,
      checkIn,
      hotelsProcessed: hotels.length,
      // Surfaced even on the "no exception thrown" path -- a market that came
      // back empty from every provider is a real signal worth keeping visible,
      // not silently indistinguishable from a normal, healthy zero-hotel night.
      ...(hotels.length === 0 && providerErrors.length > 0 ? { providerErrors } : {}),
    }]
  } catch (err) {
    const result = { market: market.iata, checkIn, hotelsProcessed: 0, error: err instanceof Error ? err.message : String(err) }
    if (err instanceof RateLimitError) throw err
    return [result]
  }
}

export async function getActiveMarkets(): Promise<Market[]> {
  const res = await query<Market>(`SELECT id, city, country, iata FROM tracked_markets WHERE active = true ORDER BY id`)
  return res.rows
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toCheckOut(checkIn: string, nights: number): string {
  const d = new Date(checkIn)
  d.setDate(d.getDate() + nights)
  return d.toISOString().slice(0, 10)
}

function generateMockHotels(iata: string, checkIn: string): HotelEntry[] {
  const seed = iata.charCodeAt(0) + new Date(checkIn).getDate()
  return [
    { id: seed * 10 + 1, name: `The ${iata} Grand`, stars: 4 },
    { id: seed * 10 + 2, name: `${iata} Boutique Suites`, stars: 3 },
    { id: seed * 10 + 3, name: `Harbour View ${iata}`, stars: 5 },
    { id: seed * 10 + 4, name: `City Inn ${iata}`, stars: 3 },
    { id: seed * 10 + 5, name: `The Modern ${iata}`, stars: 4 },
  ].map(h => ({
    hotelId: String(h.id),
    hotelName: h.name,
    stars: h.stars,
    priceCents: Math.round((60 + ((seed * h.id) % 140)) * 100),
    photoUrl: null,
  }))
}

export { buildOtaLinks }

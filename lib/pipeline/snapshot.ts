import { query } from '../db/client'
import { buildOtaLinks } from './otaLinks'

const NIGHTS = 2
const CHECK_IN_OFFSETS = [14, 30, 60]

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

// ── Normalised hotel type ────────────────────────────────────────────────────

type HotelEntry = {
  hotelId: string
  hotelName: string
  stars: number | null
  priceCents: number   // per night
  photoUrl: string | null
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

// ── Rotation ──────────────────────────────────────────────────────────────────

type ProviderFn = (iata: string, ci: string, co: string, key: string) => Promise<HotelEntry[]>

const PROVIDERS: ProviderFn[] = [fetchBookingCom15, fetchBookingComCoords, fetchTripAdvisor]

async function fetchWithRotation(
  iata: string, checkIn: string, checkOut: string, key: string, offsetIndex: number, marketIndex: number
): Promise<HotelEntry[]> {
  // Each check-in offset gets a different starting provider; market index shifts within that
  const startIdx = (offsetIndex + marketIndex) % PROVIDERS.length
  for (let i = 0; i < PROVIDERS.length; i++) {
    const provider = PROVIDERS[(startIdx + i) % PROVIDERS.length]
    try {
      const results = await provider(iata, checkIn, checkOut, key)
      if (results.length > 0) return results
    } catch { /* try next */ }
  }
  return []
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

export type SnapshotResult = { market: string; checkIn: string; hotelsProcessed: number; error?: string }

export async function runSnapshotsForMarket(market: Market, marketIndex = 0): Promise<SnapshotResult[]> {
  const key = process.env.RAPIDAPI_KEY ?? ''
  const isMock = !key

  const results: SnapshotResult[] = []

  for (let oi = 0; oi < CHECK_IN_OFFSETS.length; oi++) {
    const checkIn = addDays(CHECK_IN_OFFSETS[oi])
    const checkOut = toCheckOut(checkIn, NIGHTS)

    try {
      const hotels = isMock
        ? generateMockHotels(market.iata, checkIn)
        : await fetchWithRotation(market.iata, checkIn, checkOut, key, oi, marketIndex)

      for (const hotel of hotels) {
        await storeSnapshot(market, hotel, checkIn, isMock)
      }

      results.push({ market: market.iata, checkIn, hotelsProcessed: hotels.length })
    } catch (err) {
      results.push({ market: market.iata, checkIn, hotelsProcessed: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}

export async function getActiveMarkets(): Promise<Market[]> {
  const res = await query<Market>(`SELECT id, city, country, iata FROM tracked_markets WHERE active = true ORDER BY id`)
  return res.rows
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

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

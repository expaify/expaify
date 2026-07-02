import { query } from '../db/client'
import { buildOtaLinks } from './otaLinks'

const BOOKING_BASE = 'https://booking-com15.p.rapidapi.com/api/v1/hotels'
const NIGHTS = 2
const CHECK_IN_OFFSETS = [14, 30, 60] // days from today

// Booking.com city dest_ids for our 20 tracked markets
const DEST_IDS: Record<string, string> = {
  MIA: '20023182',
  NYC: '20088325',
  CUN: '-1655011',
  PAR: '-1456928',
  ROM: '-126693',
  BCN: '-372490',
  LIS: '-2167973',
  LON: '-2601889',
  TYO: '-246227',
  BKK: '-3414440',
  DXB: '-782831',
  LAS: '20079110',
  MCO: '20023488',
  SJU: '20154335',
  TUL: '-1707023',
  AMS: '-2140479',
  ATH: '-814876',
  PUJ: '-3364907',
  CLT: '20091627',
  BNA: '20123908',
}

type Market = { id: number; city: string; country: string; iata: string }

type BookingHotel = {
  hotelId: string
  hotelName: string
  stars: number | null
  priceCents: number
  photoUrl: string | null
}

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

async function fetchBookingPrices(iata: string, checkIn: string, checkOut: string): Promise<BookingHotel[]> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) return []

  const destId = DEST_IDS[iata]
  if (!destId) return []

  const url =
    `${BOOKING_BASE}/searchHotels` +
    `?dest_id=${encodeURIComponent(destId)}` +
    `&search_type=city` +
    `&arrival_date=${checkIn}` +
    `&departure_date=${checkOut}` +
    `&adults=2&room_qty=1&page_number=1` +
    `&currency_code=USD&languagecode=en-us&units=metric&temperature_unit=c`

  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'booking-com15.p.rapidapi.com',
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) return []

  const json: unknown = await res.json()
  const hotels: unknown[] = (json as { data?: { hotels?: unknown[] } })?.data?.hotels ?? []

  return hotels.flatMap((h: unknown) => {
    const prop = (h as { property?: Record<string, unknown> })?.property
    if (!prop) return []

    const hotelId = String(prop.id ?? prop.hotelId ?? '')
    const hotelName = String(prop.name ?? '')
    const stars = prop.propertyClass ? Number(prop.propertyClass) : null
    const photo = (prop.photoUrls as string[] | undefined)?.[0] ?? null

    const gross = (prop.priceBreakdown as { grossPrice?: { value?: number } } | undefined)?.grossPrice
    const pricePerNight = gross?.value ?? 0
    const priceCents = Math.round(pricePerNight * 100)

    if (!hotelId || !hotelName || priceCents <= 0) return []
    return [{ hotelId, hotelName, stars, priceCents, photoUrl: photo }]
  })
}

async function storeSnapshot(
  market: Market,
  hotel: BookingHotel,
  checkIn: string,
  isMock: boolean
): Promise<void> {
  await query(
    `INSERT INTO price_snapshots
       (hotel_id, hotel_name, stars, photo_url, market_id, check_in, nights, price_cents, currency, snapshot_date, is_mock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USD', CURRENT_DATE, $9)
     ON CONFLICT ON CONSTRAINT price_snapshots_unique
     DO UPDATE SET price_cents = EXCLUDED.price_cents, photo_url = COALESCE(EXCLUDED.photo_url, price_snapshots.photo_url)`,
    [
      hotel.hotelId,
      hotel.hotelName,
      hotel.stars,
      hotel.photoUrl,
      market.id,
      checkIn,
      NIGHTS,
      hotel.priceCents,
      isMock,
    ]
  )
}

export type SnapshotResult = {
  market: string
  checkIn: string
  hotelsProcessed: number
  error?: string
}

export async function runSnapshotsForMarket(market: Market): Promise<SnapshotResult[]> {
  const results: SnapshotResult[] = []
  const isMock = !process.env.RAPIDAPI_KEY

  for (const offset of CHECK_IN_OFFSETS) {
    const checkIn = addDays(offset)
    const checkOut = toCheckOut(checkIn, NIGHTS)

    try {
      const hotels = isMock
        ? generateMockHotels(market.iata, checkIn)
        : await fetchBookingPrices(market.iata, checkIn, checkOut)

      for (const hotel of hotels) {
        await storeSnapshot(market, hotel, checkIn, isMock)
      }

      results.push({ market: market.iata, checkIn, hotelsProcessed: hotels.length })
    } catch (err) {
      results.push({
        market: market.iata,
        checkIn,
        hotelsProcessed: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}

export async function getActiveMarkets(): Promise<Market[]> {
  const res = await query<Market>(`SELECT id, city, country, iata FROM tracked_markets WHERE active = true ORDER BY id`)
  return res.rows
}

function generateMockHotels(iata: string, checkIn: string): BookingHotel[] {
  const seed = iata.charCodeAt(0) + new Date(checkIn).getDate()
  const hotels = [
    { id: seed * 10 + 1, name: `The ${iata} Grand`, stars: 4 },
    { id: seed * 10 + 2, name: `${iata} Boutique Suites`, stars: 3 },
    { id: seed * 10 + 3, name: `Harbour View ${iata}`, stars: 5 },
    { id: seed * 10 + 4, name: `City Inn ${iata}`, stars: 3 },
    { id: seed * 10 + 5, name: `The Modern ${iata}`, stars: 4 },
  ]
  return hotels.map(h => ({
    hotelId: String(h.id),
    hotelName: h.name,
    stars: h.stars,
    priceCents: Math.round((60 + ((seed * h.id) % 140)) * 100),
    photoUrl: null,
  }))
}

export { buildOtaLinks }

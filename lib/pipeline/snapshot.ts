import { query } from '../db/client'
import { buildOtaLinks } from './otaLinks'

const HOTELLOOK_BASE = 'https://engine.hotellook.com/api/v2/cache.json'
const NIGHTS = 2
const CHECK_IN_OFFSETS = [14, 30, 60] // days from today

type Market = { id: number; city: string; country: string; iata: string }

type HotellookEntry = {
  hotelId: number
  hotelName: string
  stars?: number | string
  priceFrom?: number | string
  photoUrl?: string
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

async function fetchHotellookPrices(iata: string, checkIn: string, checkOut: string): Promise<HotellookEntry[]> {
  const token = process.env.TP_TOKEN
  if (!token) return []

  const url =
    `${HOTELLOOK_BASE}` +
    `?location=${encodeURIComponent(iata)}` +
    `&checkIn=${checkIn}` +
    `&checkOut=${checkOut}` +
    `&currency=USD` +
    `&token=${encodeURIComponent(token)}` +
    `&limit=50`

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return []

  const json: unknown = await res.json()
  if (!Array.isArray(json)) return []
  return json.filter((e): e is HotellookEntry => typeof e?.hotelId === 'number')
}

async function storeSnapshot(
  market: Market,
  entry: HotellookEntry,
  checkIn: string,
  isMock: boolean
): Promise<void> {
  const priceCents = Math.round(Number(entry.priceFrom ?? 0) * 100)
  if (!priceCents || priceCents <= 0) return

  await query(
    `INSERT INTO price_snapshots
       (hotel_id, hotel_name, stars, photo_url, market_id, check_in, nights, price_cents, currency, is_mock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USD', $9)
     ON CONFLICT (hotel_id, market_id, check_in, (captured_at::DATE))
     DO UPDATE SET price_cents = EXCLUDED.price_cents, photo_url = COALESCE(EXCLUDED.photo_url, price_snapshots.photo_url)`,
    [
      String(entry.hotelId),
      entry.hotelName,
      entry.stars ? Number(entry.stars) : null,
      entry.photoUrl ?? null,
      market.id,
      checkIn,
      NIGHTS,
      priceCents,
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
  const isMock = !process.env.TP_TOKEN

  for (const offset of CHECK_IN_OFFSETS) {
    const checkIn = addDays(offset)
    const checkOut = toCheckOut(checkIn, NIGHTS)

    try {
      const entries = isMock
        ? generateMockEntries(market.iata, checkIn)
        : await fetchHotellookPrices(market.iata, checkIn, checkOut)

      for (const entry of entries) {
        await storeSnapshot(market, entry, checkIn, isMock)
      }

      results.push({ market: market.iata, checkIn, hotelsProcessed: entries.length })
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

// Deterministic mock price generator — same inputs always give same output
function generateMockEntries(iata: string, checkIn: string): HotellookEntry[] {
  const seed = iata.charCodeAt(0) + new Date(checkIn).getDate()
  const hotels = [
    { id: seed * 10 + 1, name: `The ${iata} Grand`, stars: 4 },
    { id: seed * 10 + 2, name: `${iata} Boutique Suites`, stars: 3 },
    { id: seed * 10 + 3, name: `Harbour View ${iata}`, stars: 5 },
    { id: seed * 10 + 4, name: `City Inn ${iata}`, stars: 3 },
    { id: seed * 10 + 5, name: `The Modern ${iata}`, stars: 4 },
  ]
  return hotels.map((h) => ({
    hotelId: h.id,
    hotelName: h.name,
    stars: h.stars,
    priceFrom: 60 + ((seed * h.id) % 140), // $60–$200 range
    photoUrl: undefined,
  }))
}

export { buildOtaLinks }

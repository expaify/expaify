import type { OtaLinks } from './otaLinks'

export type MockSnapshot = {
  hotel_id: string
  hotel_name: string
  stars: number
  photo_url: string | null
  price_cents: number
  is_mock: true
}

export type MockDeal = {
  hotel_id: string
  hotel_name: string
  stars: number
  photo_url: string | null
  deal_price_cents: number
  median_price_cents: number
  discount_pct: number
  check_in_window: string
  check_in_date: string
  nights: number
  snapshot_count: number
  ota_links: OtaLinks
  is_mock: true
  status: 'active'
}

const MOCK_HOTELS = [
  { id: 'mock-1', name: 'Grand Mercure Roxy', stars: 4, price: 8900, median: 16700 },
  { id: 'mock-2', name: 'Kimpton Shorebreak Resort', stars: 4, price: 11200, median: 19800 },
  { id: 'mock-3', name: 'Boutique Riviera Suites', stars: 5, price: 14200, median: 26100 },
  { id: 'mock-4', name: 'The Townhouse Collective', stars: 3, price: 5800, median: 10400 },
  { id: 'mock-5', name: 'Harbour View Inn', stars: 4, price: 9600, median: 17100 },
]

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatWindow(checkIn: string, nights: number): string {
  const ci = new Date(checkIn)
  const co = new Date(checkIn)
  co.setDate(co.getDate() + nights)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(ci)} – ${fmt(co)}`
}

export function generateMockDeals(count = 5): MockDeal[] {
  const today = new Date()
  return MOCK_HOTELS.slice(0, count).map((h, i) => {
    const checkIn = addDays(today, 14 + i * 7)
    const nights = 2
    const discountPct = Math.round((1 - h.price / h.median) * 100)
    return {
      hotel_id: h.id,
      hotel_name: h.name,
      stars: h.stars,
      photo_url: null,
      deal_price_cents: h.price,
      median_price_cents: h.median,
      discount_pct: discountPct,
      check_in_window: formatWindow(checkIn, nights),
      check_in_date: checkIn,
      nights,
      snapshot_count: 12,
      ota_links: {
        expedia: `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(h.name)}`,
        booking: `https://www.booking.com/search.html?ss=${encodeURIComponent(h.name)}`,
        kiwi: 'https://www.kiwi.com',
        trip: 'https://www.trip.com',
      },
      is_mock: true as const,
      status: 'active' as const,
    }
  })
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { getPaywallContext } from '@/lib/paywall'
import { generateMockDeals } from '@/lib/pipeline/mock'

export const runtime = 'nodejs'

type ApiDeal = {
  id: string
  hotelId: string
  hotelName: string
  stars: number | null
  photoUrl: string | null
  city: string
  dealPriceCents: number
  medianPriceCents: number
  discountPct: number
  checkInWindow: string
  checkInDate: string
  nights: number
  snapshotCount: number
  otaLinks: Record<string, string>
  headline: string | null
  isMock: boolean
  firstSeen: string
  locked: boolean
}

function toApiDeal(row: DealRow, locked: boolean): ApiDeal {
  if (locked) {
    return {
      id: row.id,
      hotelId: row.hotel_id,
      hotelName: 'Members-only deal',
      stars: null,
      photoUrl: null,
      city: row.city,
      dealPriceCents: 0,
      medianPriceCents: 0,
      discountPct: row.discount_pct,
      checkInWindow: row.check_in_window,
      checkInDate: row.check_in_date,
      nights: row.nights,
      snapshotCount: row.snapshot_count,
      otaLinks: {},
      headline: null,
      isMock: row.is_mock,
      firstSeen: row.first_seen,
      locked: true,
    }
  }
  return {
    id: row.id,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
    stars: row.stars,
    photoUrl: row.photo_url,
    city: row.city,
    dealPriceCents: row.deal_price_cents,
    medianPriceCents: row.median_price_cents,
    discountPct: row.discount_pct,
    checkInWindow: row.check_in_window,
    checkInDate: row.check_in_date,
    nights: row.nights,
    snapshotCount: row.snapshot_count,
    otaLinks: row.ota_links,
    headline: row.headline,
    isMock: row.is_mock,
    firstSeen: row.first_seen,
    locked: false,
  }
}

const FREE_LIMIT = 3

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset = Number(searchParams.get('offset') ?? '0')
  const minDiscount = Number(searchParams.get('min_discount') ?? '20')
  const maxPriceCents = searchParams.get('max_price_cents') ? Number(searchParams.get('max_price_cents')) : undefined
  const minStars = searchParams.get('min_stars') ? Number(searchParams.get('min_stars')) : undefined
  const dateFrom = searchParams.get('date_from') || undefined
  const dateTo = searchParams.get('date_to') || undefined
  let marketId = searchParams.get('market_id') ? Number(searchParams.get('market_id')) : undefined
  const sort = searchParams.get('sort') === 'discount' ? 'discount' as const : 'newest' as const
  const hasFilters = Boolean(
    searchParams.get('city') ||
    searchParams.get('market_id') ||
    searchParams.get('max_price_cents') ||
    searchParams.get('min_stars') ||
    searchParams.get('date_from') ||
    searchParams.get('date_to') ||
    minDiscount !== 20
  )

  // Support filtering by city name (resolve to market_id)
  const cityName = searchParams.get('city')
  if (cityName && !marketId) {
    const { query: dbQuery } = await import('@/lib/db/client')
    const res = await dbQuery<{ id: number }>('SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1', [cityName])
    if (res.rows[0]) marketId = res.rows[0].id
  }

  const [deals, pwCtx] = await Promise.all([
    getActiveDeals({ limit, offset, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, marketId, sort, includeMock: false }),
    getPaywallContext(),
  ])

  // Fall back to mock deals when DB has no real data yet
  const source = deals.length > 0 ? deals : null

  if (!source && !hasFilters) {
    const mocks = generateMockDeals(5)
    // Mock deals have camelCase-adjacent structure — apply paywall mask inline
    const paywalled = mocks.map((d, i) => {
      const locked = !pwCtx.premium && i >= FREE_LIMIT
      if (locked) return { ...d, hotelName: 'Members-only deal', dealPriceCents: 0, medianPriceCents: 0, otaLinks: {}, locked: true }
      return { ...d, locked: false }
    })
    return NextResponse.json({ deals: paywalled, total: mocks.length, premium: pwCtx.premium })
  }

  if (!source) {
    return NextResponse.json({ deals: [], total: 0, premium: pwCtx.premium })
  }

  const paywalled = source.map((row, i) => {
    const locked = !pwCtx.premium && i >= FREE_LIMIT
    return toApiDeal(row, locked)
  })

  return NextResponse.json({ deals: paywalled, total: source.length, premium: pwCtx.premium })
}

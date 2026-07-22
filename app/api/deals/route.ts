export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { generateMockDeals } from '@/lib/pipeline/mock'
import type { HotelDealSort } from '@/lib/deals/feedContract'
import { resolveHotelSearchCriteria } from '@/lib/hotels/searchCriteria'

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
  firstSeen: string | null
  updatedAt: string | null
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
      updatedAt: row.updated_at,
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
    updatedAt: row.updated_at,
    locked: false,
  }
}

function mockToApiDeal(d: ReturnType<typeof generateMockDeals>[number]): ApiDeal {
  return {
    id: d.hotel_id,
    hotelId: d.hotel_id,
    hotelName: d.hotel_name,
    stars: d.stars,
    photoUrl: d.photo_url,
    city: '',
    dealPriceCents: d.deal_price_cents,
    medianPriceCents: d.median_price_cents,
    discountPct: d.discount_pct,
    checkInWindow: d.check_in_window,
    checkInDate: d.check_in_date,
    nights: d.nights,
    snapshotCount: d.snapshot_count,
    otaLinks: d.ota_links,
    headline: null,
    isMock: true,
    firstSeen: null,
    updatedAt: null,
    locked: false,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pwCtx = await getPaywallContext()
  const criteriaResolution = resolveHotelSearchCriteria(searchParams)
  if (criteriaResolution.status === 'invalid') {
    return NextResponse.json({ ok: false, reason: 'Invalid hotel search criteria' }, { status: 400 })
  }

  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset = Number(searchParams.get('offset') ?? '0')
  // Filters and sort are a Premium feature: for free users every filter param is
  // ignored server-side so the plain newest-first feed is the only view.
  const minDiscount = pwCtx.premium ? Number(searchParams.get('min_discount') ?? '20') : 20
  const maxPriceCents = pwCtx.premium && searchParams.get('max_price_cents') ? Number(searchParams.get('max_price_cents')) : undefined
  const minStars = pwCtx.premium && searchParams.get('min_stars') ? Number(searchParams.get('min_stars')) : undefined
  const dateFrom = searchParams.get('date_from') || undefined
  const dateTo = searchParams.get('date_to') || undefined
  let marketId = pwCtx.premium && searchParams.get('market_id') ? Number(searchParams.get('market_id')) : undefined
  const requestedSort = searchParams.get('sort')
  const sort: HotelDealSort = pwCtx.premium && (requestedSort === 'discount' || requestedSort === 'price')
    ? requestedSort
    : 'newest'
  const hasFilters = Boolean(
    searchParams.get('city') ||
    searchParams.get('market_id') ||
    searchParams.get('date_from') ||
    searchParams.get('date_to') ||
    (pwCtx.premium && (searchParams.get('max_price_cents') || searchParams.get('min_stars') || minDiscount !== 20))
  )

  // Support filtering by city name (resolve to market_id)
  const cityName = searchParams.get('city')
  if (cityName && !marketId) {
    const { query: dbQuery } = await import('@/lib/db/client')
    const res = await dbQuery<{ id: number }>('SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1', [cityName]).catch(() => null)
    if (!res) return NextResponse.json({ ok: false, reason: 'Hotel destinations unavailable' }, { status: 503 })
    if (!res.rows[0]) return NextResponse.json({ ok: false, reason: 'Unsupported hotel destination' }, { status: 400 })
    marketId = res.rows[0].id
  }

  const [deals, unlockedIds] = await Promise.all([
    getActiveDeals({ limit, offset, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, marketId, sort, includeMock: false }),
    pwCtx.premium ? Promise.resolve(new Set<string>()) : getFreeUnlockedDealIds(),
  ])

  // Fall back to mock deals when DB has no real data yet
  const source = deals.length > 0 ? deals : null

  if (!source && !hasFilters) {
    const mocks = generateMockDeals(3).map(mockToApiDeal)
    return NextResponse.json({ deals: mocks, total: mocks.length, premium: pwCtx.premium, criteriaVersion: criteriaResolution.status === 'valid' ? criteriaResolution.criteria.criteriaVersion : undefined })
  }

  if (!source) {
    return NextResponse.json({ deals: [], total: 0, premium: pwCtx.premium, criteriaVersion: criteriaResolution.status === 'valid' ? criteriaResolution.criteria.criteriaVersion : undefined })
  }

  // Lock by membership in the weekly unlock set — never by position in the page,
  // which would let offset/sort variations expose every price.
  const paywalled = source.map((row) => {
    const locked = !pwCtx.premium && !unlockedIds.has(row.id)
    return toApiDeal(row, locked)
  })

  return NextResponse.json({ deals: paywalled, total: source.length, premium: pwCtx.premium, criteriaVersion: criteriaResolution.status === 'valid' ? criteriaResolution.criteria.criteriaVersion : undefined })
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActiveDeals, getTrackedHotels, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { generateMockDeals } from '@/lib/pipeline/mock'
import { buildDealPage, HOTEL_DEAL_PAGE_SIZE, type HotelDealSort } from '@/lib/deals/feedContract'
import { resolveHotelResultsView, resolveHotelSearchCriteria } from '@/lib/hotels/searchCriteria'
import type { HotelReviewEvidence } from '@/lib/types'

export const runtime = 'nodejs'

type ApiDeal = {
  id: string
  hotelId: string
  hotelName: string
  stars: number | null
  reviewEvidence?: HotelReviewEvidence
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
  let parsedEvidence: HotelReviewEvidence | undefined
  if (row.review_evidence) {
    try {
      parsedEvidence = typeof row.review_evidence === 'string'
        ? JSON.parse(row.review_evidence) as HotelReviewEvidence
        : row.review_evidence as HotelReviewEvidence
    } catch (error) {
      console.warn(`Malformed review_evidence JSON for hotel_id ${row.hotel_id}:`, error)
    }
  }
  return {
    id: row.id,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
    stars: row.stars === null ? null : Number(row.stars),
    ...(parsedEvidence ? { reviewEvidence: parsedEvidence } : {}),
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
  const requestedView = resolveHotelResultsView(searchParams)
  if (criteriaResolution.status === 'invalid') {
    return NextResponse.json({ ok: false, reason: 'Invalid hotel search criteria' }, { status: 400 })
  }
  if (!requestedView) {
    return NextResponse.json({ ok: false, reason: 'Invalid hotel result filters' }, { status: 400 })
  }

  const requestedLimit = Number(searchParams.get('limit') ?? HOTEL_DEAL_PAGE_SIZE)
  const offset = Number(searchParams.get('offset') ?? '0')
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100 || !Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ ok: false, reason: 'Invalid hotel deal page' }, { status: 400 })
  }
  const limit = requestedLimit
  // Filters and sort are a Premium feature: for free users every filter param is
  // ignored server-side so the plain newest-first feed is the only view.
  const minDiscount = pwCtx.premium ? requestedView.minDiscount : 20
  const maxPriceCents = pwCtx.premium ? requestedView.maxPriceCents ?? undefined : undefined
  const minStars = pwCtx.premium ? requestedView.minStars || undefined : undefined
  const dateFrom = criteriaResolution.status === 'valid' && criteriaResolution.criteria.dates.semantic === 'checkin_window'
    ? criteriaResolution.criteria.dates.dateFrom
    : searchParams.get('date_from') || undefined
  const dateTo = criteriaResolution.status === 'valid' && criteriaResolution.criteria.dates.semantic === 'checkin_window'
    ? criteriaResolution.criteria.dates.dateTo
    : searchParams.get('date_to') || undefined
  let marketId = pwCtx.premium && searchParams.get('market_id') ? Number(searchParams.get('market_id')) : undefined
  const sort: HotelDealSort = pwCtx.premium ? requestedView.sort : 'newest'
  const hasFilters = Boolean(
    searchParams.get('city') ||
    searchParams.get('market_id') ||
    searchParams.get('date_from') ||
    searchParams.get('date_to') ||
    (pwCtx.premium && (searchParams.get('max_price_cents') || searchParams.get('min_stars') || minDiscount !== 20))
  )

  // Support filtering by city name (resolve to market_id)
  const cityName = criteriaResolution.status === 'valid' && criteriaResolution.criteria.destination.state === 'selected'
    ? criteriaResolution.criteria.destination.city
    : searchParams.get('city')
  if (cityName && !marketId) {
    const { query: dbQuery } = await import('@/lib/db/client')
    const res = await dbQuery<{ id: number }>('SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1', [cityName]).catch(() => null)
    if (!res) return NextResponse.json({ ok: false, reason: 'Hotel destinations unavailable' }, { status: 503 })
    if (!res.rows[0]) return NextResponse.json({ ok: false, reason: 'Unsupported hotel destination' }, { status: 400 })
    marketId = res.rows[0].id
  }

  // Query one extra stable row. This makes continuation state authoritative
  // without relying on an expensive count or guessing from a full page.
  const [rowsWithLookahead, unlockedIds] = await Promise.all([
    getActiveDeals({ limit: limit + 1, offset, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, marketId, sort, includeMock: false }),
    pwCtx.premium ? Promise.resolve(new Set<string>()) : getFreeUnlockedDealIds(pwCtx.userId),
  ])

  // Fall back to mock deals when DB has no real data yet
  const source = rowsWithLookahead.length > 0 ? buildDealPage(rowsWithLookahead, offset, limit) : null

  if (!source && !hasFilters && offset === 0) {
    // No confirmed deals yet — prefer real, currently-tracked hotels (real
    // photo, real price) over fabricated example cards. Only fall back to
    // generated mock deals if there's truly no real snapshot data yet.
    const tracked = await getTrackedHotels({ limit: 3 }).catch(() => [] as DealRow[])
    const deals = tracked.length > 0
      ? tracked.map(row => toApiDeal(row, false))
      : generateMockDeals(3).map(mockToApiDeal)
    return NextResponse.json({
      deals,
      total: deals.length,
      premium: pwCtx.premium,
      freeUnlockedThisWeek: pwCtx.freeUnlockedThisWeek,
      freeUnlockLimit: pwCtx.freeUnlockLimit,
      coverage: 'confirmed_end',
      page: { nextOffset: null, hasMore: false },
      criteriaVersion: criteriaResolution.status === 'valid' ? criteriaResolution.criteria.criteriaVersion : undefined,
    })
  }

  if (!source) {
    return NextResponse.json({
      deals: [], total: 0, premium: pwCtx.premium,
      freeUnlockedThisWeek: pwCtx.freeUnlockedThisWeek,
      freeUnlockLimit: pwCtx.freeUnlockLimit,
      coverage: 'confirmed_end',
      page: { nextOffset: null, hasMore: false },
      criteriaVersion: criteriaResolution.status === 'valid' ? criteriaResolution.criteria.criteriaVersion : undefined,
    })
  }

  // Lock by membership in the weekly unlock set — never by position in the page,
  // which would let offset/sort variations expose every price.
  const paywalled = source.items.map((row) => {
    const locked = !pwCtx.premium && !unlockedIds.has(row.id)
    return toApiDeal(row, locked)
  }).sort((a, b) => Number(a.locked) - Number(b.locked))

  return NextResponse.json({
    deals: paywalled,
    total: paywalled.length,
    premium: pwCtx.premium,
    freeUnlockedThisWeek: pwCtx.freeUnlockedThisWeek,
    freeUnlockLimit: pwCtx.freeUnlockLimit,
    coverage: source.coverage,
    page: source.page,
    criteriaVersion: criteriaResolution.status === 'valid' ? criteriaResolution.criteria.criteriaVersion : undefined,
  })
}

import { NextRequest } from 'next/server'
import { getActiveDeals, getTrackedHotels, getStableFreeTrackedHotelIds, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { getSubscription } from '@/lib/subscription'
import { GET } from '../route'
import { query } from '@/lib/db/client'

jest.mock('@/lib/pipeline/dealDetection', () => ({
  getActiveDeals: jest.fn(),
  getTrackedHotels: jest.fn(() => Promise.resolve([])),
  getStableFreeTrackedHotelIds: jest.fn(() => Promise.resolve(new Set())),
}))

jest.mock('@/lib/paywall', () => ({
  getPaywallContext: jest.fn(),
  getFreeUnlockedDealIds: jest.fn(),
}))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))

const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockGetTrackedHotels = getTrackedHotels as jest.MockedFunction<typeof getTrackedHotels>
const mockGetStableFreeTrackedHotelIds = getStableFreeTrackedHotelIds as jest.MockedFunction<typeof getStableFreeTrackedHotelIds>
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>
const mockGetSubscription = getSubscription as jest.MockedFunction<typeof getSubscription>
const mockQuery = query as jest.MockedFunction<typeof query>

const row: DealRow = {
  id: 'deal-cheapest',
  hotel_id: 'hotel-1',
  hotel_name: 'Cheapest Hotel',
  stars: 4,
  photo_url: null,
  city: 'Miami',
  deal_price_cents: 9_999,
  median_price_cents: 15_000,
  currency: 'EUR',
  discount_pct: 33,
  check_in_window: 'Aug 1–3',
  check_in_date: '2026-08-01',
  nights: 2,
  snapshot_count: 20,
  ota_links: { booking: 'https://example.test/hotel?aid=affiliate' },
  headline: null,
  description: null,
  is_mock: false,
  first_seen: '2026-07-22T00:00:00.000Z',
  expires_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-07-22T01:00:00.000Z',
}

function trackedRow(id: string): DealRow {
  return { ...row, id, hotel_id: id, hotel_name: `Hotel ${id}` }
}

function request(query = ''): NextRequest {
  return new NextRequest(`https://expaify.test/api/deals${query ? `?${query}` : ''}`)
}

describe('GET /api/deals sorting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetActiveDeals.mockResolvedValue([row])
    mockGetTrackedHotels.mockResolvedValue([])
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())
    mockGetSubscription.mockResolvedValue(null)
    mockQuery.mockResolvedValue({ rows: [{ id: 7 }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] })
  })

  it('accepts price sorting for Premium requests and returns the ranked integer price unchanged', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'premium-user',
      premium: true,
      freeUnlockedThisWeek: 0,
      freeUnlockLimit: 3,
    })

    const response = await GET(request('sort=price&limit=12&offset=0'))
    const body = await response.json() as { deals: Array<Record<string, unknown>>; premium: boolean }

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({
      sort: 'price',
      limit: 13,
      offset: 0,
    }))
    expect(body.premium).toBe(true)
    expect(body.deals[0]).toMatchObject({
      id: 'deal-cheapest',
      dealPriceCents: 9_999,
      locked: false,
    })
    expect(mockGetFreeUnlockedDealIds).not.toHaveBeenCalled()
  })

  it('parses serialized review evidence into the unlocked API deal', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'premium-user', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3,
    })
    mockGetActiveDeals.mockResolvedValue([{
      ...row,
      review_evidence: JSON.stringify({
        schemaVersion: 1,
        state: 'ready',
        providerPropertyId: 'ta_123',
        providerId: 'tripadvisor16',
        provenance: 'provider_only',
        sourceLabel: 'TripAdvisor',
        coverage: { kind: 'none' },
        score: { value: 4.5, scaleMax: 5 },
      }),
    }])

    const response = await GET(request('limit=12&offset=0'))
    const body = await response.json() as { deals: Array<Record<string, unknown>> }

    expect(body.deals[0].reviewEvidence).toMatchObject({
      providerPropertyId: 'ta_123',
      provenance: 'provider_only',
      score: { value: 4.5, scaleMax: 5 },
    })
  })

  it('warns and omits malformed review evidence instead of failing the route', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'premium-user', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3,
    })
    mockGetActiveDeals.mockResolvedValue([{ ...row, review_evidence: '{broken' }])
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const response = await GET(request('limit=12&offset=0'))
    const body = await response.json() as { deals: Array<Record<string, unknown>> }

    expect(response.status).toBe(200)
    expect(body.deals[0].reviewEvidence).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('hotel_id hotel-1'), expect.any(SyntaxError))
    warn.mockRestore()
  })

  it.each(['price', 'discount'])('forces newest for free requests asking for %s and masks only after retrieval', async requestedSort => {
    mockGetPaywallContext.mockResolvedValue({
      userId: null,
      premium: false,
      freeUnlockedThisWeek: 0,
      freeUnlockLimit: 3,
    })

    const response = await GET(request(`sort=${requestedSort}&limit=12&offset=0`))
    const body = await response.json() as { deals: Array<Record<string, unknown>>; premium: boolean }

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ sort: 'newest' }))
    expect(body.premium).toBe(false)
    expect(body.deals[0]).toMatchObject({
      id: 'deal-cheapest',
      hotelName: 'Members-only deal',
      dealPriceCents: 0,
      locked: true,
    })
  })

  it('places unlocked deals before locked deals while preserving each group order', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: null,
      premium: false,
      freeUnlockedThisWeek: 2,
      freeUnlockLimit: 3,
    })
    mockGetActiveDeals.mockResolvedValue([
      { ...row, id: 'locked-first', hotel_id: 'hotel-1' },
      { ...row, id: 'unlocked-first', hotel_id: 'hotel-2' },
      { ...row, id: 'locked-second', hotel_id: 'hotel-3' },
      { ...row, id: 'unlocked-second', hotel_id: 'hotel-4' },
    ])
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set(['unlocked-first', 'unlocked-second']))

    const response = await GET(request('limit=4&offset=0'))
    const body = await response.json() as { deals: Array<{ id: string; locked: boolean }> }

    expect(body.deals).toEqual([
      expect.objectContaining({ id: 'unlocked-first', locked: false }),
      expect.objectContaining({ id: 'unlocked-second', locked: false }),
      expect.objectContaining({ id: 'locked-first', locked: true }),
      expect.objectContaining({ id: 'locked-second', locked: true }),
    ])
  })

  it('applies validated destination and date criteria for free requests and echoes the successful version', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    const version = '785d80de-8954-46c7-90f7-a4a04f719e5f'
    const response = await GET(request(`criteriaSchema=1&criteriaVersion=${version}&criteriaSource=edit&city=Miami&date_from=2026-08-01&date_to=2026-08-03`))
    const body = await response.json() as { criteriaVersion?: string }

    expect(response.status).toBe(200)
    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketId: 7, dateFrom: '2026-08-01', dateTo: '2026-08-03' }))
    expect(body.criteriaVersion).toBe(version)
  })

  it('rejects malformed referenced criteria before querying deals', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    const response = await GET(request('criteriaSchema=1&criteriaVersion=short&city=Miami'))
    expect(response.status).toBe(400)
    expect(mockGetActiveDeals).not.toHaveBeenCalled()
  })

  it('rejects malformed view state before querying deals', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: 'premium-user', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    const response = await GET(request('sort=unknown&max_price_cents=not-money'))
    expect(response.status).toBe(400)
    expect(mockGetActiveDeals).not.toHaveBeenCalled()
  })

  it('returns one-row-lookahead coverage metadata without exposing the lookahead deal', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: 'premium-user', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    mockGetActiveDeals.mockResolvedValue([
      row,
      { ...row, id: 'deal-next', hotel_id: 'hotel-2' },
    ])

    const response = await GET(request('sort=price&limit=1&offset=4'))
    const body = await response.json() as { deals: Array<{ id: string }>; coverage: string; page: { hasMore: boolean; nextOffset: number | null } }

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ limit: 2, offset: 4, sort: 'price' }))
    expect(body.deals.map(deal => deal.id)).toEqual(['deal-cheapest'])
    expect(body.coverage).toBe('more_available')
    expect(body.page).toEqual({ hasMore: true, nextOffset: 5 })
  })

  it('rejects invalid pagination before querying deals', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: 'premium-user', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    const response = await GET(request('limit=0&offset=-1'))

    expect(response.status).toBe(400)
    expect(mockGetActiveDeals).not.toHaveBeenCalled()
  })
})

describe('GET /api/deals — tracked-hotels fallback locking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // No confirmed real deals: forces the tracked-hotels fallback branch.
    mockGetActiveDeals.mockResolvedValue([])
    mockGetSubscription.mockResolvedValue(null)
  })

  it('keeps a personally-unlocked tracked-hotel deal outside the stable free set unlocked', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'user-1', premium: false, freeUnlockedThisWeek: 1, freeUnlockLimit: 3,
    })
    mockGetTrackedHotels.mockResolvedValue(['h1', 'h2', 'h3', 'h4', 'h5'].map(trackedRow))
    mockGetStableFreeTrackedHotelIds.mockResolvedValue(new Set(['h1', 'h2', 'h3']))
    // h4 is not in the stable free set, but was personally unlocked via a
    // real /api/deals/[id]/unlock call.
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set(['h4']))

    const response = await GET(request('limit=6&offset=0'))
    const body = await response.json() as { deals: Array<{ id: string; locked: boolean; hotelName: string }> }
    const deal = body.deals.find(d => d.id === 'h4')

    expect(deal?.locked).toBe(false)
    expect(deal?.hotelName).toBe('Hotel h4')
  })

  it('still locks a tracked-hotel deal outside the stable free set that was never personally unlocked', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'user-1', premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3,
    })
    mockGetTrackedHotels.mockResolvedValue(['h1', 'h2', 'h3', 'h4', 'h5'].map(trackedRow))
    mockGetStableFreeTrackedHotelIds.mockResolvedValue(new Set(['h1', 'h2', 'h3']))
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())

    const response = await GET(request('limit=6&offset=0'))
    const body = await response.json() as { deals: Array<{ id: string; locked: boolean; hotelName: string }> }
    const deal = body.deals.find(d => d.id === 'h4')

    expect(deal?.locked).toBe(true)
    expect(deal?.hotelName).toBe('Members-only deal')
  })

  // Regression guard for the real bug this fix exists for (2026-10-05): a
  // tracked-hotel card the user saw as "free" on this list must stay
  // consistent with its own detail page -- which can only know "free" by
  // checking the SAME stable, id-based set this route now also checks,
  // never by array position (which the detail page has no way to see).
  // This test specifically proves locking is driven by stable-set
  // membership, not by position in the array returned by getTrackedHotels.
  it('locks/unlocks by stable-set membership, not by array position', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3,
    })
    // h1 is first in the array (would have been "free" under old
    // position-based logic) but is NOT in the stable free set.
    // h5 is last in the array but IS in the stable free set.
    mockGetTrackedHotels.mockResolvedValue(['h1', 'h2', 'h3', 'h4', 'h5'].map(trackedRow))
    mockGetStableFreeTrackedHotelIds.mockResolvedValue(new Set(['h5']))
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())

    const response = await GET(request('limit=6&offset=0'))
    const body = await response.json() as { deals: Array<{ id: string; locked: boolean; hotelName: string }> }

    expect(body.deals.find(d => d.id === 'h1')?.locked).toBe(true)
    expect(body.deals.find(d => d.id === 'h5')?.locked).toBe(false)
    expect(body.deals.find(d => d.id === 'h5')?.hotelName).toBe('Hotel h5')
  })

  it('passes the real freeUnlockLimit through to getStableFreeTrackedHotelIds, unscoped by market', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 5,
    })
    mockGetTrackedHotels.mockResolvedValue(['h1'].map(trackedRow))
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())

    await GET(request('limit=6&offset=0'))

    expect(mockGetStableFreeTrackedHotelIds).toHaveBeenCalledWith({ limit: 5 })
  })
})

describe('GET /api/deals — watchlist personalization', () => {
  const SUB = {
    onboardingDone: true,
    watchlist: ['Nashville', 'Miami'],
    alertMinDiscount: 50,
    alertPreference: 'instant' as const,
    status: 'free' as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetPaywallContext.mockResolvedValue({ userId: 'user-1', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    mockGetSubscription.mockResolvedValue(SUB as never)
    mockGetActiveDeals.mockResolvedValue([])
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())
    // Single-city lookup returns id 7; the watchlist's own ANY() lookup
    // (resolveWatchlistMarketIds) returns ids 3 and 9.
    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('ANY')) {
        return Promise.resolve({ rows: [{ id: 3 }, { id: 9 }], rowCount: 2, command: 'SELECT', oid: 0, fields: [] })
      }
      return Promise.resolve({ rows: [{ id: 7 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
    })
  })

  it('filters getActiveDeals by the watchlist\'s market ids on a clean request', async () => {
    await GET(request())

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketIds: [3, 9], marketId: undefined }))
  })

  it('does not apply the watchlist filter when an explicit city is requested', async () => {
    await GET(request('city=Miami'))

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketId: 7, marketIds: undefined }))
  })

  it('does not apply the watchlist filter when an explicit date range is requested', async () => {
    await GET(request('date_from=2026-08-01'))

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketIds: undefined }))
  })

  it('does not apply the watchlist filter when the "Show all deals" override (?all=1) is given', async () => {
    await GET(request('all=1'))

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketIds: undefined }))
  })

  it('does not call getSubscription at all for an anonymous visitor', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })

    await GET(request())

    expect(mockGetSubscription).not.toHaveBeenCalled()
    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketIds: undefined }))
  })

  // The real bug this closes: the tracked-hotels/mock fallback previously
  // always filled the response with unrelated global data whenever the
  // real query came back empty, masking DealFeed.tsx's own personalized
  // empty state (PersonalizedEmpty/PersonalizedEmptyActions) for every
  // personalized caller with zero matching deals.
  it('does not fall back to global tracked-hotel/mock teasers when personalization is active and the real query is empty', async () => {
    const response = await GET(request())
    const body = await response.json() as { deals: unknown[] }

    expect(mockGetTrackedHotels).not.toHaveBeenCalled()
    expect(body.deals).toEqual([])
  })
})

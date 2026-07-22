import { NextRequest } from 'next/server'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { GET } from '../route'

jest.mock('@/lib/pipeline/dealDetection', () => ({
  getActiveDeals: jest.fn(),
}))

jest.mock('@/lib/paywall', () => ({
  getPaywallContext: jest.fn(),
  getFreeUnlockedDealIds: jest.fn(),
}))

const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>

const row: DealRow = {
  id: 'deal-cheapest',
  hotel_id: 'hotel-1',
  hotel_name: 'Cheapest Hotel',
  stars: 4,
  photo_url: null,
  city: 'Miami',
  deal_price_cents: 9_999,
  median_price_cents: 15_000,
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

function request(query = ''): NextRequest {
  return new NextRequest(`https://expaify.test/api/deals${query ? `?${query}` : ''}`)
}

describe('GET /api/deals sorting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetActiveDeals.mockResolvedValue([row])
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())
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

  it('returns a trustworthy next offset from a one-row lookahead', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'premium-user',
      premium: true,
      freeUnlockedThisWeek: 0,
      freeUnlockLimit: 3,
    })
    mockGetActiveDeals.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => ({
        ...row,
        id: `deal-${index + 1}`,
        hotel_id: `hotel-${index + 1}`,
      })),
    )

    const response = await GET(request('limit=12&offset=0'))
    const body = await response.json() as {
      deals: Array<{ id: string }>
      page: { nextOffset: number | null; hasMore: boolean }
      coverage: string
    }

    expect(body.deals).toHaveLength(12)
    expect(body.page).toEqual({ hasMore: true, nextOffset: 12 })
    expect(body.coverage).toBe('more_available')
  })

  it('confirms the end for a short continuation page without substituting samples', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'premium-user',
      premium: true,
      freeUnlockedThisWeek: 0,
      freeUnlockLimit: 3,
    })
    mockGetActiveDeals.mockResolvedValue([])

    const response = await GET(request('limit=12&offset=12'))
    const body = await response.json() as {
      deals: Array<{ id: string }>
      page: { nextOffset: number | null; hasMore: boolean }
      coverage: string
    }

    expect(body.deals).toEqual([])
    expect(body.page).toEqual({ hasMore: false, nextOffset: null })
    expect(body.coverage).toBe('confirmed_end')
  })

  it('deduplicates repeated stable deal ids before returning a page', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'premium-user',
      premium: true,
      freeUnlockedThisWeek: 0,
      freeUnlockLimit: 3,
    })
    mockGetActiveDeals.mockResolvedValue([row, { ...row, hotel_name: 'Duplicate row' }])

    const response = await GET(request('limit=12&offset=0'))
    const body = await response.json() as {
      deals: Array<{ id: string }>
      page: { nextOffset: number | null; hasMore: boolean }
    }

    expect(body.deals.map(deal => deal.id)).toEqual(['deal-cheapest'])
    expect(body.page).toEqual({ hasMore: false, nextOffset: null })
  })

  it('advances continuation by consumed rows after stable-id deduplication', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'premium-user',
      premium: true,
      freeUnlockedThisWeek: 0,
      freeUnlockLimit: 3,
    })
    mockGetActiveDeals.mockResolvedValue([
      row,
      { ...row, hotel_name: 'Duplicate row' },
      ...Array.from({ length: 11 }, (_, index) => ({
        ...row,
        id: `deal-${index + 2}`,
        hotel_id: `hotel-${index + 2}`,
      })),
    ])

    const response = await GET(request('limit=12&offset=24'))
    const body = await response.json() as {
      deals: Array<{ id: string }>
      page: { nextOffset: number | null; hasMore: boolean }
      coverage: string
    }

    expect(body.deals).toHaveLength(11)
    expect(body.page).toEqual({ hasMore: true, nextOffset: 36 })
    expect(body.coverage).toBe('more_available')
  })
})

import { NextRequest } from 'next/server'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { GET } from '../route'
import { query } from '@/lib/db/client'

jest.mock('@/lib/pipeline/dealDetection', () => ({
  getActiveDeals: jest.fn(),
}))

jest.mock('@/lib/paywall', () => ({
  getPaywallContext: jest.fn(),
  getFreeUnlockedDealIds: jest.fn(),
}))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))

const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>
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
      limit: 12,
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
})

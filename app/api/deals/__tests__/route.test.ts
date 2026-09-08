import { GET } from '../route'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { getActiveDeals, getTrackedHotels, type DealRow } from '@/lib/pipeline/dealDetection'

jest.mock('@/lib/paywall', () => ({
  getPaywallContext: jest.fn(),
  getFreeUnlockedDealIds: jest.fn(),
}))

jest.mock('@/lib/pipeline/dealDetection', () => ({
  getActiveDeals: jest.fn(),
  getTrackedHotels: jest.fn(),
}))

const mockGetPaywallContext = getPaywallContext as jest.Mock
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.Mock
const mockGetActiveDeals = getActiveDeals as jest.Mock
const mockGetTrackedHotels = getTrackedHotels as jest.Mock

function trackedRow(id: string): DealRow {
  return {
    id, hotel_id: id, hotel_name: `Hotel ${id}`, stars: 4, photo_url: null,
    city: 'Paris', deal_price_cents: 10000, median_price_cents: 15000, currency: 'USD',
    discount_pct: 33, check_in_window: 'Oct 10 - 12', check_in_date: '2026-10-10', nights: 2,
    snapshot_count: 20, ota_links: {}, headline: null, description: null, is_mock: false,
    first_seen: '2026-09-01T00:00:00Z', expires_at: null, updated_at: '2026-09-01T00:00:00Z',
  }
}

function request(): Request {
  return new Request('https://expaify.test/api/deals?limit=6&offset=0&min_discount=30&sort=newest')
}

describe('GET /api/deals — tracked-hotels fallback locking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // No confirmed real deals: forces the tracked-hotels fallback branch.
    mockGetActiveDeals.mockResolvedValue([])
  })

  it('keeps a personally-unlocked tracked-hotel deal past the free index cutoff unlocked', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'user-1', premium: false, freeUnlockedThisWeek: 1, freeUnlockLimit: 3,
    })
    const rows = ['h1', 'h2', 'h3', 'h4', 'h5'].map(trackedRow)
    mockGetTrackedHotels.mockResolvedValue(rows)
    // h4 sits at index 3, past the freeUnlockLimit=3 cutoff, but was
    // personally unlocked via a real /api/deals/[id]/unlock call.
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set(['h4']))

    const res = await GET(request() as never)
    const body = await res.json()
    const deal = body.deals.find((d: { id: string }) => d.id === 'h4')

    expect(deal.locked).toBe(false)
    expect(deal.hotelName).toBe('Hotel h4')
  })

  it('still locks a tracked-hotel deal past the free index cutoff that was never personally unlocked', async () => {
    mockGetPaywallContext.mockResolvedValue({
      userId: 'user-1', premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3,
    })
    const rows = ['h1', 'h2', 'h3', 'h4', 'h5'].map(trackedRow)
    mockGetTrackedHotels.mockResolvedValue(rows)
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())

    const res = await GET(request() as never)
    const body = await res.json()
    const deal = body.deals.find((d: { id: string }) => d.id === 'h4')

    expect(deal.locked).toBe(true)
    expect(deal.hotelName).toBe('Members-only deal')
  })
})

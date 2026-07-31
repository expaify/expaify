import type { ReactElement } from 'react'
import { auth } from '@/auth'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { query } from '@/lib/db/client'
import CityPage from '../page'
import { DealFeed } from '@/app/deals/DealFeed'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/paywall', () => ({ getPaywallContext: jest.fn(), getFreeUnlockedDealIds: jest.fn() }))
jest.mock('@/lib/pipeline/dealDetection', () => ({ getActiveDeals: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn(), isPremium: jest.fn(() => false) }))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>
const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockQuery = query as jest.MockedFunction<typeof query>

function walk(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== 'object') return []
  const element = node as ReactElement<Record<string, unknown>>
  const children = element.props?.children
  return [element, ...(Array.isArray(children) ? children : [children]).flatMap(walk)]
}

describe('destination criteria continuity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue(null as never)
    mockGetPaywallContext.mockResolvedValue({ userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())
    mockGetActiveDeals.mockResolvedValue([])
    mockQuery.mockResolvedValue({ rows: [{ id: 7 }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] })
  })

  it('reuses the same default criteria version across clean-url refreshes', async () => {
    const props = { params: Promise.resolve({ city: 'miami' }), searchParams: Promise.resolve({}) }
    const first = await CityPage(props)
    const refreshed = await CityPage(props)
    const firstFeed = walk(first).find(element => element.type === DealFeed)
    const refreshedFeed = walk(refreshed).find(element => element.type === DealFeed)

    expect(firstFeed).toBeDefined()
    expect(refreshedFeed).toBeDefined()
    expect((refreshedFeed!.props.initialCriteria as { criteriaVersion: string }).criteriaVersion)
      .toBe((firstFeed!.props.initialCriteria as { criteriaVersion: string }).criteriaVersion)
    expect((firstFeed!.props.initialCriteria as { source: string }).source).toBe('destination_page')
  })

  it('renders a restore-failure state when the requested criteria targets a different city', async () => {
    const props = {
      params: Promise.resolve({ city: 'miami' }),
      searchParams: Promise.resolve({
        criteriaSchema: '1',
        criteriaVersion: '785d80de-8954-46c7-90f7-a4a04f719e5f',
        criteriaSource: 'restored',
        city: 'Paris',
      }),
    }
    const tree = await CityPage(props)
    const feed = walk(tree).find(element => element.type === DealFeed)

    expect(feed).toBeUndefined()
    expect(mockGetActiveDeals).not.toHaveBeenCalled()
  })

  it('bridges normalized funds-policy state into destination initial deals', async () => {
    mockGetActiveDeals.mockResolvedValue([{
      id: 'deal-1', hotel_id: 'hotel-1', hotel_name: 'Hotel One', stars: 4,
      photo_url: null, city: 'Miami', deal_price_cents: 10_000, median_price_cents: 15_000,
      discount_pct: 33, check_in_window: 'Aug 1–3', check_in_date: '2026-08-01', nights: 2,
      snapshot_count: 20, ota_links: {}, headline: null, description: null, is_mock: false,
      first_seen: null, expires_at: null, updated_at: null,
    }])
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set(['deal-1']))

    const tree = await CityPage({ params: Promise.resolve({ city: 'miami' }), searchParams: Promise.resolve({}) })
    const feed = walk(tree).find(element => element.type === DealFeed)

    expect(feed?.props.initialDeals).toEqual([
      expect.objectContaining({
        id: 'deal-1',
        fundsPolicy: {
          provider: 'other', capability: { policy: false },
          evidence: { state: 'not_returned', obligations: [], sourceLabel: 'Hotel provider', scope: 'not_returned' },
          loadState: 'ready',
        },
      }),
    ])
  })
})
